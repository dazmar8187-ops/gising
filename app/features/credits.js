// Feature: Credits (flag "credits"). The house's answer to points and leaderboards.
// Credits come only from what a writer gave other writers and the songs they finished properly:
//   a note someone thanked you for (+3), a cowriter who'd write with you again (+5), a signed cowrite (+5),
//   a registered song (+10), a released song (+15), a song played at a live Round (+2).
// Posting, likes and time online earn nothing. Levels are named after the life of a song. Nobody is ranked:
// the room sees who was thanked this week, in alphabetical order, with no numbers.
// Data: Room.store("credits", { thanks: [{ from, to, post, at }] }). Ratings come from Smart Pairing, songs from the Ledger.
(function () {
  var R = window.Room, FLAG = "credits";
  var H = function () { return R.h; };
  var DAY = 864e5;
  var LEVELS = [
    { at: 0, name: "Voice Memo" }, { at: 5, name: "Hook" }, { at: 15, name: "First Verse" }, { at: 35, name: "Full Draft" },
    { at: 70, name: "Rewrite" }, { at: 120, name: "Demo" }, { at: 200, name: "Registered" }, { at: 320, name: "Released" }, { at: 500, name: "Standard" }
  ];
  var EARN = { thanked: 3, again: 5, signed: 5, registered: 10, released: 15, round: 2 };

  function st() {
    var s = R.store("credits", { thanks: [] });
    if (!s.seeded) { // demo: a few thank-yous so the room isn't empty
      var now = Date.now();
      s.thanks.push({ from: "mara", to: "sofia", post: "seed", at: now - 2 * DAY }, { from: "jun", to: "mara", post: "seed", at: now - 3 * DAY },
        { from: "bea", to: "kenji", post: "seed", at: now - 1 * DAY }, { from: "ayu", to: "grace", post: "seed", at: now - 12 * DAY });
      s.seeded = true; R.db.save();
    }
    return s;
  }

  function tally(id) {
    var s = R.db.state, t = { thanked: 0, again: 0, signed: 0, registered: 0, released: 0, round: 0 };
    st().thanks.forEach(function (x) { if (x.to === id) t.thanked++; });
    var sp = s.ext && s.ext["pairing-smart"];
    if (sp && sp.ratings) sp.ratings.forEach(function (r) { if (r.about === id && r.again) t.again++; });
    Object.keys(s.rooms || {}).map(function (k) { return s.rooms[k]; }).forEach(function (r) { if (r.writers && r.writers.length > 1 && r.writers.indexOf(id) !== -1 && r.signed && r.signed[id]) t.signed++; });
    if (R.ledger && s.ext && s.ext.ledger) R.ledger.mine(id).forEach(function (song) { if (song.status.registered) t.registered++; if (song.status.released) t.released++; });
    if (id === s.me) t.round = Object.keys(s.played || {}).filter(function (k) { return /Round/.test(k); }).length;
    var total = 0; Object.keys(t).forEach(function (k) { total += t[k] * EARN[k]; });
    return { parts: t, total: total };
  }
  function level(total) {
    var i = 0; LEVELS.forEach(function (L, n) { if (total >= L.at) i = n; });
    return { n: i + 1, name: LEVELS[i].name, next: LEVELS[i + 1] || null };
  }

  function panel() {
    var me = R.db.state.me, t = tally(me), L = level(t.total), p = t.parts;
    var pct = L.next ? Math.round(100 * (t.total - LEVELS[L.n - 1].at) / (L.next.at - LEVELS[L.n - 1].at)) : 100;
    var row = function (label, n, each) { return "<li><span>" + label + "</span><b>" + n + " × " + each + "</b></li>"; };
    return '<section class="panel cr-panel"><p class="eyebrow">Your credits</p><h2>Level ' + L.n + " · " + L.name + "</h2>" +
      '<div class="cr-meter" role="img" aria-label="' + t.total + ' credits"><i style="width:' + pct + '%"></i></div>' +
      '<p class="muted">' + t.total + " credits" + (L.next ? " · " + (L.next.at - t.total) + " to " + L.next.name : " · the top line. A song everyone knows.") + "</p>" +
      '<ul class="cr-list">' + row("Notes someone thanked you for", p.thanked, EARN.thanked) + row("Cowriters who'd write with you again", p.again, EARN.again) +
      row("Cowrites with the split signed", p.signed, EARN.signed) + row("Songs registered", p.registered, EARN.registered) + row("Songs released", p.released, EARN.released) + row("Songs played at a Round", p.round, EARN.round) + "</ul>" +
      '<p class="small muted">Posting, likes and time online earn nothing. Credits come from what you gave other writers and the songs you finished properly. Only you see your number.</p></section>';
  }

  // On your own posts: thank the writers whose notes helped.
  R.addSlot("post.after", function (p) {
    var me = R.db.state.me; if (p.author !== me || !p.notes || !p.notes.length) return "";
    var givers = []; p.notes.forEach(function (n) { if (n.by !== me && givers.indexOf(n.by) === -1) givers.push(n.by); });
    if (!givers.length) return "";
    var done = st().thanks.filter(function (x) { return x.post === p.id && x.from === me; }).map(function (x) { return x.to; });
    var esc = H().esc;
    return '<div class="cr-thank"><span class="small muted">Did a note help?</span>' + givers.map(function (g) {
      var m = R.db.member(g) || { name: "A member" }, first = esc(m.name.split(" ")[0]);
      return done.indexOf(g) !== -1 ? '<span class="chip green">Thanked ' + first + "</span>" :
        '<button type="button" class="btn-sm" data-act="cr-thank" data-id="' + esc(p.id) + '" data-key="' + esc(g) + '">Thank ' + first + "</button>";
    }).join("") + "</div>";
  }, FLAG);

  // The room: who was thanked this week, alphabetical, no numbers.
  R.addSlot("feed.side", function () {
    var since = H().weekStart(Date.now()), seen = {}, rows = [];
    st().thanks.filter(function (x) { return x.at >= since; }).forEach(function (x) {
      var k = x.from + ">" + x.to; if (seen[k]) return; seen[k] = 1;
      var a = R.db.member(x.from), b = R.db.member(x.to); if (a && b) rows.push([b.name, a.name]);
    });
    rows.sort(function (x, y) { return x[0].localeCompare(y[0]); });
    var esc = H().esc;
    return '<section class="side-card"><p class="eyebrow">Thank-yous this week</p>' + (rows.length ? '<ul class="cr-roll">' + rows.slice(0, 8).map(function (r) {
      return "<li><b>" + esc(r[0].split(" ")[0]) + "</b> was thanked by " + esc(r[1].split(" ")[0]) + "</li>"; }).join("") + "</ul>" :
      '<p class="small">Nobody yet this week. When a note helps you, thank the writer from your post.</p>') + '<p class="small muted">No rankings here. Just who helped who.</p></section>';
  }, FLAG);

  R.addSlot("stave.side", panel, FLAG);
  R.addSlot("profile.after", function (m) {
    if (m.id === R.db.state.me) return "";
    var L = level(tally(m.id).total);
    return '<section class="panel"><p class="eyebrow">Credits</p><h2>Level ' + L.n + " · " + L.name + '</h2><p class="muted">From notes that helped, cowriters who\'d write again, and songs signed, registered and released.</p></section>';
  }, FLAG);

  R.onAct("cr-thank", function (el, c) {
    var me = R.db.state.me, s = st();
    if (s.thanks.some(function (x) { return x.post === c.id && x.from === me && x.to === c.key; })) return;
    s.thanks.push({ from: me, to: c.key, post: c.id, at: Date.now() });
    R.save(); H().toast("Thanked. That's " + EARN.thanked + " credits to " + ((R.db.member(c.key) || {}).name || "them").split(" ")[0] + "."); R.rerender();
  });

  R.credits = { tally: tally, level: level, LEVELS: LEVELS, EARN: EARN };
})();
