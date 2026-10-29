// Feature: Smart Pairing (flag "smart-pairing"). After a cowrite, writers rate it ("write again?" and 1–5). Matching
// then scores people on complementary skills, shared languages, time-zone overlap, past ratings and how often their
// cowrites become finished songs, suggests cowriters any day, and builds smarter weekly groups in the admin.
// Data: Room.store("pairing-smart", { ratings: [{ room, by, about, again, score, at }] }).
(function () {
  var R = window.Room, FLAG = "smart-pairing";
  var H = function () { return R.h; };
  var st = function () {
    var s = R.store("pairing-smart", { ratings: [] });
    if (!s.seeded) {
      var now = Date.now(), d = 864e5;
      s.ratings = s.ratings.concat([
        { room: "seed1", by: "ayu", about: "kenji", again: true, score: 5, at: now - 20 * d }, { room: "seed1", by: "kenji", about: "ayu", again: true, score: 5, at: now - 20 * d },
        { room: "seed1", by: "sofia", about: "ayu", again: true, score: 4, at: now - 20 * d }, { room: "seed2", by: "grace", about: "tom", again: true, score: 5, at: now - 60 * d },
        { room: "seed2", by: "dana", about: "grace", again: true, score: 4, at: now - 60 * d }, { room: "seed3", by: "bea", about: "jun", again: false, score: 2, at: now - 28 * d }
      ]);
      s.seeded = true; R.db.save();
    }
    return s;
  };

  // rough standard UTC offsets by country, for time-zone overlap
  var TZ = { "Philippines": 8, "Indonesia": 7, "Malaysia": 8, "Singapore": 8, "Thailand": 7, "Vietnam": 7, "Hong Kong": 8, "Taiwan": 8, "Japan": 9, "South Korea": 9, "India": 5.5,
    "United Arab Emirates": 4, "Australia": 10, "New Zealand": 12, "United Kingdom": 0, "Germany": 1, "Netherlands": 1, "France": 1, "Canada": -5, "United States": -6, "Mexico": -6, "Brazil": -3, "Nigeria": 1, "Kenya": 3 };
  var CITY_TZ = { "Los Angeles": -8, "Vancouver": -8, "Honolulu": -10, "Tucson": -7, "Austin": -6, "Chicago": -6, "New York": -5, "Toronto": -5, "Denpasar, Bali": 8, "Perth": 8 };
  function offset(m) {
    if (!m || !m.city) return null;
    if (CITY_TZ[m.city] != null) return CITY_TZ[m.city];
    var c = R.db.city(m.city); return c && TZ[c.country] != null ? TZ[c.country] : null;
  }
  function songsWith(a, b) {
    var rooms = Object.keys(R.db.state.rooms || {}).map(function (k) { return R.db.state.rooms[k]; }).filter(function (r) { return r.writers.indexOf(a) !== -1 && r.writers.indexOf(b) !== -1; });
    var ledger = R.ledger ? R.ledger.songs().filter(function (s) { return s.writers.indexOf(a) !== -1 && s.writers.indexOf(b) !== -1; }) : [];
    return { rooms: rooms.length, finished: ledger.length };
  }
  function finishRate(id) {
    if (!R.ledger) return null;
    var rooms = Object.keys(R.db.state.rooms || {}).map(function (k) { return R.db.state.rooms[k]; }).filter(function (r) { return r.writers.length > 1 && r.writers.indexOf(id) !== -1; }).length;
    var songs = R.ledger.songs().filter(function (s) { return s.writers.indexOf(id) !== -1; }).length;
    return songs ? Math.min(1, songs / Math.max(rooms, songs)) : rooms ? 0 : null;
  }

  // Score how well b suits a. Returns { total, parts: [[label, points]] }.
  function score(aId, bId) {
    var a = R.db.member(aId), b = R.db.member(bId); if (!a || !b) return { total: -99, parts: [] };
    var parts = [], ar = a.roles || [], br = b.roles || [];
    var fills = br.filter(function (r) { return ar.indexOf(r) === -1; });
    if (ar.indexOf("Production") === -1 && br.indexOf("Production") !== -1) parts.push(["Brings production", 3]);
    else if (fills.length) parts.push(["Fills a gap: " + fills[0].toLowerCase(), 2]);
    else parts.push(["Same skills as you", -1]);
    var al = (a.languages || []).map(function (x) { return x.toLowerCase(); }), bl = (b.languages || []).map(function (x) { return x.toLowerCase(); });
    var shared = al.filter(function (x) { return bl.indexOf(x) !== -1; });
    var local = shared.filter(function (x) { return x !== "english"; });
    if (local.length) parts.push(["Both write in " + local[0].charAt(0).toUpperCase() + local[0].slice(1), 2]);
    else if (shared.length) parts.push(["Shared language: English", 1]);
    var oa = offset(a), ob = offset(b);
    if (oa != null && ob != null) {
      var diff = Math.abs(oa - ob); diff = Math.min(diff, 24 - diff);
      if (diff <= 3) parts.push(["Awake at the same time", 3]); else if (diff <= 7) parts.push(["Time zones overlap", 1]); else parts.push(["Far apart in time", -1]);
    }
    var mine = st().ratings.filter(function (x) { return x.by === aId && x.about === bId; }).pop();
    if (mine) parts.push([mine.again ? "You'd write with them again" : "You said not again", mine.again ? 4 : -6]);
    var others = st().ratings.filter(function (x) { return x.about === bId && x.by !== aId; });
    if (others.length) { var avg = others.reduce(function (s, x) { return s + x.score; }, 0) / others.length; if (avg >= 4) parts.push(["Cowriters rate them highly", 1]); }
    var fr = finishRate(bId); if (fr != null && fr >= 0.5) parts.push(["Their cowrites get finished", 1]);
    var sw = songsWith(aId, bId); if (sw.finished) parts.push(["Finished " + sw.finished + " song" + (sw.finished === 1 ? "" : "s") + " together", 2]);
    var total = parts.reduce(function (s, p) { return s + p[1]; }, 0);
    return { total: total, parts: parts };
  }
  R.smartPairing = { score: score };

  function candidates(meId) {
    return R.db.state.members.filter(function (m) { return m.id !== meId && !m.host && !m.mentor && m.openToWrite; })
      .map(function (m) { return { m: m, s: score(meId, m.id) }; }).sort(function (a, b) { return b.s.total - a.s.total; });
  }

  function toRate(meId) {
    var rooms = Object.keys(R.db.state.rooms || {}).map(function (k) { return R.db.state.rooms[k]; })
      .filter(function (r) { return r.writers.length > 1 && r.writers.indexOf(meId) !== -1 && r.writers.every(function (w) { return r.signed && r.signed[w]; }); });
    var out = [];
    rooms.forEach(function (r) { r.writers.forEach(function (w) { if (w !== meId && !st().ratings.some(function (x) { return x.room === r.id && x.by === meId && x.about === w; })) out.push({ r: r, w: w }); }); });
    return out;
  }

  R.addSlot("cowrites.after", function () {
    var h = H(), me = R.db.state.me, pending = toRate(me), top = candidates(me).slice(0, 4);
    return '<div class="cw-grid sp-grid"><section class="panel"><p class="eyebrow">Smart Pairing</p><h2>Writers you\'d click with</h2><p class="muted small">Ranked on skills that fill your gaps, shared languages, time zones, and how past cowrites went. Only you see this.</p>' +
      top.map(function (x) {
        return '<div class="sp-cand">' + h.avatar(x.m, 40) + '<div><b>' + h.esc(x.m.name) + '</b><span class="muted small">' + h.esc((x.m.roles || []).join(", ")) + " · " + h.esc(x.m.city || "") + '</span><div class="sp-parts">' +
          x.s.parts.map(function (p) { return '<span class="chip' + (p[1] > 0 ? "" : " neg") + '">' + h.esc(p[0]) + "</span>"; }).join("") + '</div></div><div class="sp-act"><b class="sp-score">' + x.s.total + '</b><button class="btn-sm solid" data-act="sp-write" data-id="' + h.esc(x.m.id) + '">Suggest a cowrite</button></div></div>';
      }).join("") + "</section>" +
      '<section class="panel"><p class="eyebrow">After the write</p><h2>Rate your cowrites</h2>' + (pending.length ? pending.slice(0, 4).map(function (x) {
        var m = R.db.member(x.w) || { name: x.w };
        return '<form class="sp-rate" data-form="sp-rate" data-id="' + h.esc(x.r.id) + '" data-w="' + h.esc(x.w) + '"><p><b>' + h.esc(m.name) + '</b> · <span class="muted small">' + h.esc(x.r.title) + "</span></p>" +
          '<fieldset class="sp-again"><legend class="small">Write with them again?</legend><label><input type="radio" name="again" value="yes" required> Yes</label><label><input type="radio" name="again" value="no"> Not really</label></fieldset>' +
          '<label class="small">How did it go?<select name="score">' + [5, 4, 3, 2, 1].map(function (n) { return '<option value="' + n + '">' + n + (n === 5 ? " · great" : n === 1 ? " · it didn't work" : "") + "</option>"; }).join("") + '</select></label><button class="btn-sm solid">Save rating</button></form>';
      }).join("") : '<p class="muted">Nothing to rate. When every writer in a cowrite has signed, you can say how it went here. Ratings are private and only shape your matches.</p>') + "</section></div>";
  }, FLAG);

  R.onAct("sp-write", function (el, c) {
    var m = R.db.member(c.id); if (!m) return;
    var id = R.db.openRoom([R.db.state.me, c.id], "Cowrite with " + m.name.split(" ")[0]);
    H().toast("Writing room opened. Send " + m.name.split(" ")[0] + " the link.");
    location.hash = "#/write/" + id;
  });
  R.onForm("sp-rate", function (f, v) {
    var again = f.querySelector('input[name="again"]:checked'); if (!again) { H().toast("Choose yes or not really."); return; }
    st().ratings.push({ room: f.dataset.id, by: R.db.state.me, about: f.dataset.w, again: again.value === "yes", score: Number(v("score")) || 3, at: Date.now() });
    R.save(); H().toast("Thanks. Your matches just got better."); R.rerender();
  });

  // ---------- admin: smarter weekly groups ----------
  var draft = null;
  function build() {
    var p = R.db.state.pairing, ids = (p.others || []).slice();
    if (p.optIn && R.db.state.me && ids.indexOf(R.db.state.me) === -1) ids.push(R.db.state.me);
    var pair = function (a, b) { return (score(a, b).total + score(b, a).total) / 2; };
    var left = ids.slice(), groups = [];
    while (left.length >= 3) {
      // seed: the writer with the fewest good options goes first
      left.sort(function (a, b) { return Math.max.apply(null, left.filter(function (x) { return x !== a; }).map(function (x) { return pair(a, x); })) - Math.max.apply(null, left.filter(function (x) { return x !== b; }).map(function (x) { return pair(b, x); })); });
      var g = [left.shift()];
      while (g.length < 3) {
        var best = null, bestS = -1e9;
        left.forEach(function (x) { var s = g.reduce(function (t, y) { return t + pair(x, y); }, 0) / g.length; if (s > bestS) { bestS = s; best = x; } });
        g.push(best); left.splice(left.indexOf(best), 1);
      }
      groups.push(g);
    }
    left.forEach(function (x, i) { if (groups.length) groups[i % groups.length].push(x); });
    return groups.map(function (g) {
      var pairs = [], tot = 0;
      for (var i = 0; i < g.length; i++) for (var j = i + 1; j < g.length; j++) { var s = pair(g[i], g[j]); tot += s; pairs.push([g[i], g[j], Math.round(s * 10) / 10]); }
      return { writers: g, score: Math.round(tot / Math.max(1, pairs.length) * 10) / 10, pairs: pairs };
    });
  }
  function adminTab() {
    var h = H(), name = function (id) { return h.esc(((R.db.member(id) || {}).name) || id); };
    draft = draft || build();
    return '<section class="panel"><h2>Smart Pairing groups for next week</h2><p class="muted">Built from this week\'s opt-ins using the full score: complementary skills, shared languages, time zones, past "write again" ratings and finished songs. Compare with the simple builder in The Pairing tab.</p>' +
      '<div class="row-wrap"><button class="btn-sm" data-act="sp-rebuild">Rebuild</button><button class="btn-sm solid" data-act="sp-use">Use these groups</button></div>' +
      (draft.length ? draft.map(function (g, i) {
        return '<div class="grp"><p class="eyebrow">Group ' + (i + 1) + ' · score ' + g.score + "</p><p><b>" + g.writers.map(name).join(", ") + '</b></p><ul class="sp-pairs">' +
          g.pairs.map(function (p) { var s = score(p[0], p[1]); return "<li>" + name(p[0]) + " + " + name(p[1]) + ' <span class="mono">' + p[2] + '</span> <span class="muted small">' + s.parts.map(function (x) { return h.esc(x[0]); }).join(" · ") + "</span></li>"; }).join("") + "</ul></div>";
      }).join("") : '<p class="empty">Not enough writers opted in yet.</p>') + "</section>";
  }
  R.addAdminTab({ id: "smart-pairing", label: "Smart Pairing", flag: FLAG, render: adminTab });
  R.onAct("sp-rebuild", function () { draft = build(); R.rerender(); });
  R.onAct("sp-use", function () {
    draft = draft || build();
    var briefs = ["A goodbye at an airport, told by the person who stays behind.", "The first song you'd play on a long drive home.", "Write the chorus as a text message that was never sent.", "Thank someone who will never hear it."];
    R.db.state.pairing.groups = draft.map(function (g, i) { var rid = R.db.openRoom(g.writers, "Pairing · group " + (i + 1)); R.db.room(rid).brief = briefs[i % briefs.length]; return rid; });
    R.save(); H().toast("Groups set. Writing rooms opened for each one."); location.hash = "#/admin/pairing";
  });
})();
