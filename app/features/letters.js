// Feature: The House Letter (flag "house-letter"). One letter a week, with a byline that rotates:
// the host, then a visiting mentor, then a member. The house speaks with many voices, not one founder's.
// Members can offer to write one; the host and mentors publish from the admin tab.
// Data: Room.store("letters", { list: [{ id, author, kind, title, body, at }], offers: [{ id, by, idea, at }] }).
(function () {
  var R = window.Room, FLAG = "house-letter";
  var H = function () { return R.h; };
  var DAY = 864e5;
  var KINDS = { host: "From the host", mentor: "From a visiting mentor", member: "From a member" };
  var ROTA = ["host", "mentor", "member"];

  function st() {
    var s = R.store("letters", { list: [], offers: [] });
    if (!s.seeded) {
      var now = Date.now();
      s.list.push(
        { id: "l1", author: "darryl", kind: "host", at: now - 8 * DAY, title: "House truths",
          body: "Every house has rules. Ours are short.\n\n1. This house won't make you famous. Nobody can promise that, and anyone who does is selling something. What it will do is help you finish songs, sign your splits and know where your money goes.\n\n2. Nobody here is the gatekeeper. Not me, not the mentors. Your songs don't need our permission.\n\n3. Notes are about the song, never the writer. What works, one thing to try, one question.\n\n4. Sign before the first line. Every cowrite, every time.\n\n5. Show up for other people's songs the way you want them to show up for yours.\n\n6. Nobody is ranked. Credits come from what you gave, not from how loud you were.\n\nThat's it. Come and write." },
        { id: "l2", author: "paul", kind: "mentor", at: now - 1 * DAY, title: "The week a song is finished",
          body: "Most writers find out how songwriting money works on the day they're owed some and can't collect it. I've watched it happen from every side of the desk.\n\nSo here's the week-one list for any song you finish in this house:\n\n1. Check the split sheet is signed by everyone. If it isn't, nothing else matters yet.\n\n2. Register the song with FILSCAP, or your own society if you're outside the Philippines. Register it the same way your split sheet says.\n\n3. Know your IPI number. Your society gives it to you, and it's how the money finds you.\n\nThree things. None of them is glamorous, and all of them are yours to control. Ask me about any of it at the next Pro Desk." });
      s.seeded = true; R.db.save();
    }
    return s;
  }
  var sorted = function () { return st().list.slice().sort(function (a, b) { return b.at - a.at; }); };
  var nextKind = function () { var l = sorted()[0]; return l ? ROTA[(ROTA.indexOf(l.kind) + 1) % ROTA.length] : "host"; };

  function body(text) { return H().esc(text).split(/\n\n+/).map(function (p) { return "<p>" + p.replace(/\n/g, "<br>") + "</p>"; }).join(""); }
  function byline(l) { var m = R.db.member(l.author) || { name: "A member" }; return H().avatar(m, 32) + " <b>" + H().esc(m.name) + "</b> · " + KINDS[l.kind] + " · " + H().ago(l.at); }

  function render(arg) {
    var esc = H().esc, list = sorted(), l = arg ? st().list.filter(function (x) { return x.id === arg; })[0] : list[0], nk = nextKind();
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · the House Letter</p><h1>The House Letter</h1><p class="lead">One letter a week, and the byline turns: the host, then a visiting mentor, then a member of the house. No single voice runs this room.</p></div>' +
      '<div class="lt-wrap">' + (l ? '<article class="panel lt-letter"><p class="lt-by">' + byline(l) + "</p><h2>" + esc(l.title) + '</h2><div class="lt-body">' + body(l.body) + "</div></article>" : '<p class="empty">No letters yet.</p>') +
      '<aside class="lt-side"><section class="panel dark"><p class="eyebrow sun">Next week</p><h3>' + KINDS[nk] + "</h3>" +
      (nk === "member" ? '<p class="muted-l">It could be you. Offer a letter below.</p>' : '<p class="muted-l">Then a member, then the host again.</p>') + "</section>" +
      '<form class="panel" data-form="lt-offer"><h3>Offer a letter</h3><p class="small muted">Something you learned finishing a song, a cowrite that went wrong, what a writers\' night taught you. A few hundred words.</p>' +
      '<label class="sr-only" for="ltIdea">Your idea</label><textarea id="ltIdea" name="idea" rows="3" maxlength="500" required placeholder="What would you write about?"></textarea><button class="btn-sm solid">Offer it</button></form>' +
      '<section class="panel"><h3>Earlier letters</h3><ul class="lt-list">' + list.map(function (x) {
        return '<li><a href="#/letters/' + esc(x.id) + '"><b>' + esc(x.title) + "</b><span>" + esc((R.db.member(x.author) || {}).name || "") + " · " + KINDS[x.kind].replace("From ", "") + "</span></a></li>";
      }).join("") + "</ul></section></aside></div>";
  }

  function adminTab() {
    var esc = H().esc, people = R.db.state.members || [], nk = nextKind(), pick = null;
    return '<div class="admin-grid"><form class="panel" data-form="lt-publish"><h2>Publish this week\'s letter</h2><p class="muted">The rota says this one is ' + KINDS[nk].toLowerCase() + ".</p>" +
      '<label>Who wrote it<select name="author">' + people.map(function (m) { var k = m.host ? "host" : m.mentor ? "mentor" : "member"; if (k === nk && !pick) pick = m.id; return '<option value="' + esc(m.id) + '"' + (pick === m.id ? " selected" : "") + ">" + esc(m.name) + " (" + k + ")</option>"; }).join("") + "</select></label>" +
      '<label>Title<input name="title" required maxlength="100"></label><label>The letter<textarea name="body" rows="10" required maxlength="6000"></textarea></label><button class="btn-sm solid">Publish to the Room</button></form>' +
      '<section class="panel"><h2>Offers from members</h2>' + (st().offers.length ? '<ul class="lt-list">' + st().offers.slice().reverse().map(function (o) {
        return "<li><b>" + esc(((R.db.member(o.by) || {}).name) || "A member") + "</b> · " + H().ago(o.at) + "<br><span>" + esc(o.idea) + "</span></li>"; }).join("") + "</ul>" : '<p class="muted">No offers yet.</p>') + "</section></div>";
  }

  R.registerRoute("letters", { title: "The House Letter", flag: FLAG, render: render });
  R.addNav({ id: "letters", href: "#/letters", label: "House Letter", flag: FLAG, icon: '<path d="M3 6h18v12H3z"/><path d="M3 7l9 6 9-6"/>' });
  R.addAdminTab({ id: "letters", label: "Letters", flag: FLAG, render: adminTab });
  R.addSlot("feed.side", function () {
    var l = sorted()[0]; if (!l) return "";
    var m = R.db.member(l.author) || { name: "" }, first = l.body.split(/\n/)[0];
    return '<section class="side-card dark"><p class="eyebrow sun">The House Letter</p><h3>' + H().esc(l.title) + '</h3><p class="mono small">' + H().esc(m.name) + " · " + KINDS[l.kind].replace("From ", "") + "</p><p>" + H().esc(first.length > 140 ? first.slice(0, 137) + "…" : first) + '</p><a class="link-arrow" href="#/letters/' + H().esc(l.id) + '">Read the letter →</a></section>';
  }, FLAG);

  R.onForm("lt-offer", function (f, v) {
    if (!v("idea")) return;
    st().offers.push({ id: "o" + Date.now(), by: R.db.state.me, idea: v("idea"), at: Date.now() });
    R.save(); H().toast("Thanks. The host will be in touch about a week for your letter."); R.rerender();
  });
  R.onForm("lt-publish", function (f, v) {
    if (!H().isStaff()) { H().toast("Only the host and mentors publish letters."); return; }
    var m = R.db.member(v("author")); if (!m || !v("title") || !v("body")) return;
    st().list.push({ id: "l" + Date.now(), author: m.id, kind: m.host ? "host" : m.mentor ? "mentor" : "member", title: v("title"), body: v("body"), at: Date.now() });
    R.save(); H().toast("Published. It's at the top of the feed sidebar."); R.rerender();
  });
})();
