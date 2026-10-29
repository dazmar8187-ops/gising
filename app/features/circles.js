// Feature: Circles (flag "circles"). Apply to a Circle, monthly brief board, submissions, mentor notes, pitch status.
// Demo: Room.store("circles"). Live (GHL): applications and submissions need server storage (see report).
(function () {
  var FLAG = "circles";
  var H = function () { return Room.h; };
  var CIRCLES = [
    { id: "opm", name: "OPM & Ballad", desc: "Filipino pop and the big ballad, in Filipino, English or both." },
    { id: "ppop", name: "P-pop & Topline", desc: "Hooks and toplines for groups across Asia, written to real track briefs." },
    { id: "sync", name: "Sync & Brand", desc: "Music for ads, TV, film and games in the Asian market, written to real briefs." },
    { id: "worship", name: "Worship", desc: "Congregational songs that people can actually sing on a Sunday." },
    { id: "artist", name: "Artist Circle", desc: "For writers who release their own music: the songs, the release plan and the first fans." }
  ];
  var PITCH = ["Not pitched yet", "Shortlisted", "Pitched", "On hold", "Cut"];
  var cname = function (id) { return (CIRCLES.filter(function (c) { return c.id === id; })[0] || { name: id }).name; };
  var isStaff = function () { var m = Room.db.me(); return !!(m && (m.host || m.mentor)); };

  function st() {
    var s = Room.store("circles", { apps: [], briefs: [], subs: [], seeded: false });
    if (!s.seeded) {
      var now = Date.now(), d = 864e5, month = new Date().toLocaleString("en-GB", { month: "long", year: "numeric" });
      s.apps.push({ id: "ca1", by: "mara", circle: "opm", why: "Ballads are what I write best. I want notes from someone who hears what radio wants.", links: ["https://soundcloud.com/"], status: "accepted", at: now - 20 * d });
      s.apps.push({ id: "ca2", by: "jun", circle: "ppop", why: "I make tracks for groups and need sharper toplines.", links: ["https://soundcloud.com/"], status: "accepted", at: now - 19 * d });
      s.apps.push({ id: "ca3", by: "hana", circle: "ppop", why: "Seoul camp writer, new to writing in English and Filipino.", links: ["https://soundcloud.com/"], status: "applied", at: now - 2 * d });
      s.apps.push({ id: "ca4", by: "arif", circle: "sync", why: "I write for ads and want to pitch full songs to TV.", links: ["https://soundcloud.com/"], status: "applied", at: now - 1 * d });
      var briefs = {
        opm: ["A wedding first-dance ballad in Filipino", "Slow, warm, under 4 minutes. Room for a key change in the last chorus. No clichés about forever."],
        ppop: ["Up-tempo opener for a five-member group", "118–124 bpm, a chant-able post-chorus, a rap-friendly second verse. English and Filipino mix."],
        sync: ["30 and 60-second cut for a travel brand", "Hopeful, acoustic-led, builds to a lift at 0:20. No lyrics about specific places."],
        worship: ["A simple chorus a congregation can learn in one go", "Low range, five-note melody in the chorus, verses that tell one story."],
        artist: ["The single you'd release next", "Bring the song and one sentence on who it's for. Notes cover the song and the release plan."]
      };
      Object.keys(briefs).forEach(function (cid, i) {
        s.briefs.push({ id: "cb" + i, circle: cid, month: month, title: briefs[cid][0], text: briefs[cid][1], due: now + (20 - i) * d, by: "darryl", at: now - 5 * d });
      });
      s.subs.push({ id: "cs1", briefId: "cb0", by: "mara", title: "Sa Iyong Kamay", link: "https://soundcloud.com/", at: now - 3 * d, pitch: "Shortlisted",
        notes: [{ by: "darryl", at: now - 2 * d, works: "The bridge in Filipino after an English verse is lovely.", tryit: "Take the key change half a step, not a full step.", question: "Is the 'you' the couple or someone watching them?" }] });
      s.seeded = true; Room.save();
    }
    return s;
  }
  function myApp(cid) { var me = Room.db.state.me; return st().apps.filter(function (a) { return a.by === me && a.circle === cid; })[0]; }
  function notesHtml(sub) {
    var h = H(), esc = h.esc;
    return sub.notes.map(function (n) {
      return '<div class="note"><p class="note-by">' + h.avatar(Room.db.member(n.by), 22) + " " + h.who(n.by) + " · " + h.ago(n.at) + "</p><dl><div><dt>Works</dt><dd>" + esc(n.works) + "</dd></div><div><dt>Try</dt><dd>" + esc(n.tryit) + "</dd></div><div><dt>Question</dt><dd>" + esc(n.question) + "</dd></div></dl></div>";
    }).join("");
  }
  function subHtml(sub, staff) {
    var h = H(), esc = h.esc, m = Room.db.member(sub.by) || { name: "Member", id: "x" };
    return '<div class="circ-sub"><div class="circ-sub-h">' + h.avatar(m, 30) + "<div><b>" + esc(sub.title) + "</b><span>" + esc(m.name) + " · " + h.ago(sub.at) + "</span></div>" +
      (h.safeUrl(sub.link) ? '<a class="listen" href="' + esc(sub.link) + '" target="_blank" rel="noopener">▶ Listen</a>' : "") +
      (staff ? '<label class="sr-only" for="cp-' + esc(sub.id) + '">Pitch status</label><select id="cp-' + esc(sub.id) + '" data-circ-pitch="' + esc(sub.id) + '">' + PITCH.map(function (p) { return "<option" + (p === sub.pitch ? " selected" : "") + ">" + p + "</option>"; }).join("") + "</select>"
        : '<span class="chip' + (sub.pitch === "Pitched" || sub.pitch === "Shortlisted" ? " green" : "") + '">' + esc(sub.pitch) + "</span>") + "</div>" +
      notesHtml(sub) +
      (staff ? '<button class="btn-sm" data-act="circ-note-open" data-id="' + esc(sub.id) + '">Write notes</button><form class="note-form" data-form="circ-note" data-id="' + esc(sub.id) + '" hidden><label>One thing that works<input name="works" required></label><label>One thing to try<input name="tryit" required></label><label>One question<input name="question" required></label><button class="btn-sm solid">Send notes</button></form>' : "") + "</div>";
  }

  function render() {
    var h = H(), esc = h.esc, s = st(), me = Room.db.state.me;
    var accepted = CIRCLES.filter(function (c) { var a = myApp(c.id); return a && a.status === "accepted"; });
    var cards = CIRCLES.map(function (c) {
      var a = myApp(c.id), members = s.apps.filter(function (x) { return x.circle === c.id && x.status === "accepted"; }).length;
      var status = !a ? "" : a.status === "accepted" ? '<span class="chip green">You\'re in</span>' : a.status === "declined" ? '<span class="chip">Not this time</span>' : '<span class="chip">Applied · waiting</span>';
      return '<article class="circ-card"><h3>' + esc(c.name) + "</h3><p>" + esc(c.desc) + '</p><p class="muted small">' + members + " of 12 places taken</p>" + status +
        (!a || a.status === "declined" ? '<button class="btn-sm solid" data-act="circ-apply" data-id="' + c.id + '">Apply</button>' : "") + "</article>";
    }).join("");
    var board = accepted.map(function (c) {
      var briefs = s.briefs.filter(function (b) { return b.circle === c.id; }).sort(function (a, b) { return b.at - a.at; });
      return '<section class="panel circ-board"><p class="eyebrow">' + esc(c.name) + " · brief board</p>" + briefs.map(function (b) {
        var subs = s.subs.filter(function (x) { return x.briefId === b.id; });
        var mineSub = subs.filter(function (x) { return x.by === me; })[0];
        return '<div class="circ-brief"><h3>' + esc(b.title) + '</h3><p class="mono">' + esc(b.month) + " · due " + new Date(b.due).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " · set by " + esc((Room.db.member(b.by) || {}).name || "the house") + "</p><p>" + esc(b.text) + "</p>" +
          (mineSub ? "" : '<form class="circ-submit" data-form="circ-submit" data-id="' + esc(b.id) + '"><label class="sr-only" for="cst-' + esc(b.id) + '">Song title</label><input id="cst-' + esc(b.id) + '" name="title" required maxlength="120" placeholder="Song title"><label class="sr-only" for="csl-' + esc(b.id) + '">Song link</label><input id="csl-' + esc(b.id) + '" name="link" type="url" required placeholder="https:// link to the song"><button class="btn-sm solid">Submit to this brief</button></form>') +
          (subs.length ? '<div class="circ-subs">' + subs.map(function (x) { return subHtml(x, false); }).join("") + "</div>" : '<p class="muted small">No submissions yet.</p>') + "</div>";
      }).join("") + "</section>";
    }).join("");
    return '<div class="hero-band"><p class="eyebrow sun">Gising Sining House · by application</p><h1>Circles</h1><p><em>Small rooms for the market you want to write for. Up to twelve writers and a mentor who works in it.</em></p></div>' +
      '<div class="circ-grid">' + cards + "</div>" +
      '<form class="panel circ-apply" id="circApply" data-form="circ-apply" hidden><h2>Apply to <span id="circApplyName"></span></h2><input type="hidden" name="circle"><label>Why this Circle, in a line or two<textarea name="why" rows="3" maxlength="500" required></textarea></label>' +
      '<label>A link to one finished song<input name="link1" type="url" required placeholder="https://"></label><label>A second song (optional)<input name="link2" type="url" placeholder="https://"></label><button class="btn-sm solid">Send my application</button></form>' +
      (board || '<p class="muted circ-note">Once you\'re accepted into a Circle, its monthly brief board appears here. Nobody can promise a placement; a Circle promises that the right person hears your best work.</p>');
  }

  function adminTab() {
    var h = H(), esc = h.esc, s = st();
    var pending = s.apps.filter(function (a) { return a.status === "applied"; });
    return '<div class="admin-grid"><section class="panel"><h2>Applications (' + pending.length + " waiting)</h2>" + (s.apps.slice().sort(function (a, b) { return b.at - a.at; }).map(function (a) {
      var m = Room.db.member(a.by) || { name: "Member", id: "x" };
      return '<div class="circ-app">' + h.avatar(m, 30) + "<div><b>" + esc(m.name) + "</b> → " + esc(cname(a.circle)) + "<p>" + esc(a.why) + "</p>" + a.links.filter(h.safeUrl).map(function (l, i) { return '<a href="' + esc(l) + '" target="_blank" rel="noopener">Song ' + (i + 1) + "</a>"; }).join(" · ") + "</div>" +
        (a.status === "applied" ? '<span class="circ-app-btns"><button class="btn-sm solid" data-act="circ-decide" data-id="' + esc(a.id) + '" data-key="accepted">Accept</button><button class="btn-sm" data-act="circ-decide" data-id="' + esc(a.id) + '" data-key="declined">Decline</button></span>' : '<span class="chip">' + esc(a.status) + "</span>") + "</div>";
    }).join("") || '<p class="empty">No applications yet.</p>') + "</section>" +
      '<form class="panel" data-form="circ-brief"><h2>Post a brief</h2><label>Circle<select name="circle">' + CIRCLES.map(function (c) { return '<option value="' + c.id + '">' + esc(c.name) + "</option>"; }).join("") + "</select></label>" +
      '<label>Title<input name="title" required maxlength="120"></label><label>The brief<textarea name="text" rows="3" required maxlength="800"></textarea></label><label>Due (days from today)<input name="days" type="number" min="3" max="60" value="21"></label><button class="btn-sm solid">Post brief</button></form></div>' +
      '<section class="panel" style="margin-top:16px"><h2>Submissions</h2>' + (s.subs.length ? s.subs.slice().sort(function (a, b) { return b.at - a.at; }).map(function (x) {
        var b = s.briefs.filter(function (y) { return y.id === x.briefId; })[0] || {};
        return '<p class="eyebrow" style="margin-top:12px">' + esc(cname(b.circle)) + " · " + esc(b.title || "") + "</p>" + subHtml(x, true);
      }).join("") : '<p class="empty">No submissions yet.</p>') + "</section>";
  }

  Room.registerRoute("circles", { title: "Circles", flag: FLAG, render: render });
  Room.addNav({ id: "circles", href: "#/circles", label: "Circles", flag: FLAG, icon: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/>' });
  Room.addAdminTab({ id: "circles", label: "Circles", flag: FLAG, render: adminTab });

  Room.onAct("circ-apply", function (el, c) {
    var f = document.getElementById("circApply"); if (!f) return;
    f.hidden = false; f.elements.circle.value = c.id; document.getElementById("circApplyName").textContent = cname(c.id);
    f.scrollIntoView({ block: "center" }); f.elements.why.focus();
  });
  Room.onForm("circ-apply", function (f, v) {
    var h = H(), links = [v("link1"), v("link2")].filter(Boolean);
    if (!links.every(h.safeUrl)) { h.toast("Links need to start with https://"); return; }
    var s = st(), me = Room.db.state.me;
    s.apps = s.apps.filter(function (a) { return !(a.by === me && a.circle === v("circle")); });
    s.apps.push({ id: "ca" + Date.now(), by: me, circle: v("circle"), why: v("why"), links: links, status: "applied", at: Date.now() });
    Room.save(); h.toast("Application sent. You'll hear back here."); Room.rerender();
  });
  Room.onForm("circ-submit", function (f, v) {
    var h = H(); if (!h.safeUrl(v("link"))) { h.toast("Links need to start with https://"); return; }
    st().subs.push({ id: "cs" + Date.now(), briefId: f.dataset.id, by: Room.db.state.me, title: v("title"), link: v("link"), at: Date.now(), pitch: "Not pitched yet", notes: [] });
    Room.save(); h.toast("Submitted. Notes come back on the board."); Room.rerender();
  });
  Room.onAct("circ-decide", function (el, c) {
    if (!isStaff()) return;
    var a = st().apps.filter(function (x) { return x.id === c.id; })[0]; if (!a) return;
    a.status = c.key; Room.save();
    if (c.key === "accepted") Room.db.notify("You're in the " + cname(a.circle) + " Circle. Your brief board is open.", "#/circles");
    H().toast(c.key === "accepted" ? "Accepted." : "Declined."); Room.rerender();
  });
  Room.onForm("circ-brief", function (f, v) {
    if (!isStaff()) return;
    st().briefs.push({ id: "cb" + Date.now(), circle: v("circle"), month: new Date().toLocaleString("en-GB", { month: "long", year: "numeric" }), title: v("title"), text: v("text"), due: Date.now() + (+v("days") || 21) * 864e5, by: Room.db.state.me, at: Date.now() });
    Room.save(); H().toast("Brief posted to the " + cname(v("circle")) + " board."); Room.rerender();
  });
  Room.onAct("circ-note-open", function (el, c) { var f = document.querySelector('form[data-form="circ-note"][data-id="' + c.id + '"]'); if (f) { f.hidden = !f.hidden; if (!f.hidden) f.querySelector("input").focus(); } });
  Room.onForm("circ-note", function (f, v) {
    if (!isStaff()) return;
    var sub = st().subs.filter(function (x) { return x.id === f.dataset.id; })[0]; if (!sub) return;
    sub.notes.push({ by: Room.db.state.me, at: Date.now(), works: v("works"), tryit: v("tryit"), question: v("question") });
    Room.save(); H().toast("Notes sent."); Room.rerender();
  });
  document.addEventListener("change", function (e) {
    var id = e.target.dataset && e.target.dataset.circPitch; if (!id || !isStaff()) return;
    var sub = st().subs.filter(function (x) { return x.id === id; })[0]; if (!sub) return;
    sub.pitch = e.target.value; Room.save(); H().toast("Pitch status: " + sub.pitch + ".");
  });
})();
