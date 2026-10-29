// The Room · member app. Hash routes, one shell, views rendered from Room.db (data.js).
(function () {
  var db = Room.db, H = window.HOUSE || {}, R = H.room || { schedule: [], prompts: [] };
  var view = document.getElementById("view");
  var MNL = 8 * 3600e3, DAY = 864e5, WEEK = 7 * DAY;
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var map = null, tickers = [];

  // ---------- helpers ----------
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };
  var first = function (name) { return String(name || "").split(" ")[0]; };
  var safeUrl = function (u) { return /^https?:\/\//i.test(u || "") ? u : ""; };
  var mnl = function (ms) { return new Date(ms + MNL); };
  var hm = function (t) { var p = t.split(":"); return (+p[0]) * 3600e3 + (+p[1]) * 60e3; };
  var pad = function (n) { return String(n).padStart(2, "0"); };
  var tz = ""; try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  var inManila = tz === "Asia/Manila";
  var fmtManila = function (ms) { var d = mnl(ms); return DAYS[d.getUTCDay()] + " " + d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " · " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes()) + " Manila"; };
  var fmtYou = function (ms) { return new Date(ms).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }); };
  var whenBoth = function (ms) { return fmtManila(ms) + (inManila ? "" : " · " + fmtYou(ms) + " your time"); };
  var ago = function (ms) {
    var s = (Date.now() - ms) / 1000;
    if (s < 60) return "just now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h";
    if (s < 7 * 86400) return Math.floor(s / 86400) + "d";
    var d = new Date(ms); return d.getDate() + " " + MONTHS[d.getMonth()];
  };
  var weekStart = function (ms) { // Monday 00:00 Manila, in real ms
    var d = mnl(ms), midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - MNL;
    return midnight - ((d.getUTCDay() + 6) % 7) * DAY;
  };
  var weekNo = function (ms) { return Math.floor((weekStart(ms) - Date.UTC(2026, 9, 12) + MNL) / WEEK); }; // week 0 = 12 Oct 2026
  // Avatar backgrounds drawn from the site palette: cobalt and ink-green shades, one sun-brown.
  var AV = ["#2D47B8", "#14221F", "#4A5A55", "#3D57C9", "#26407A", "#2F4A43", "#5C6A9E", "#8A6A1F"];
  var colorFor = function (id) { var h = 0; for (var i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997; return AV[h % AV.length]; };
  var initials = function (n) { return String(n || "?").split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join("").toUpperCase(); };
  var avatar = function (m, size) {
    size = size || 40;
    if (!m) return "";
    var inner = m.photo ? '<img src="' + esc(m.photo) + '" alt="">' : esc(initials(m.name));
    return '<span class="av" style="--s:' + size + 'px;background:' + colorFor(m.id) + '">' + inner + "</span>";
  };
  var who = function (id) { var m = db.member(id); return m ? '<a class="who" href="#/m/' + esc(m.id) + '">' + esc(m.name) + "</a>" : "Someone"; };
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 3200);
  }

  // shared helpers for feature files (site/app/features/*.js)
  Room.h = { esc: esc, $: $, $$: $$, first: first, safeUrl: safeUrl, avatar: avatar, who: who, toast: toast, ago: ago,
    fmtManila: fmtManila, fmtYou: fmtYou, whenBoth: whenBoth, weekStart: weekStart, weekNo: weekNo, colorFor: colorFor, initials: initials, isStaff: function () { return isStaff(); } };

  // ---------- schedule ----------
  function nextStart(ev, from) {
    var m = mnl(from), midnight = Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate()) - MNL;
    var t = midnight + ((ev.day - m.getUTCDay() + 7) % 7) * DAY + hm(ev.time);
    if (t + ev.mins * 60e3 <= from) t += WEEK;
    if (ev.monthly) while (mnl(t).getUTCDate() > 7) t += WEEK;
    return t;
  }
  function liveEvents(days) {
    var out = [], end = Date.now() + days * DAY;
    R.schedule.filter(function (e) { return e.live; }).forEach(function (ev) {
      var t = nextStart(ev, Date.now() - ev.mins * 60e3);
      while (t < end) {
        out.push({ key: ev.title + "@" + t, title: ev.title, start: t, mins: ev.mins, kind: "online", room: ev.room, text: ev.text,
          type: /Round/.test(ev.title) ? "The Round" : "House Session" });
        t += WEEK; if (ev.monthly) while (mnl(t).getUTCDate() > 7) t += WEEK;
      }
    });
    return out.sort(function (a, b) { return a.start - b.start; });
  }
  function inPersonEvents() {
    var c = H.camp01 || { pods: [] };
    var starts = { a: Date.UTC(2027, 2, 10, 13 - 8), b: Date.UTC(2027, 2, 17, 13 - 8) };
    return (c.pods || []).map(function (p) {
      return { key: "camp01-" + p.id, title: "Camp 01 · Tagaytay · " + p.name, start: starts[p.id], mins: 4 * 24 * 60 + 60, kind: "in-person",
        type: "Retreat camp", text: p.dates + ". Five days in a hillside villa above Taal Lake. Room and meals included.", href: "../camps.html#apply" };
    });
  }
  function promptOfWeek() {
    var w = Math.max(0, weekNo(Date.now()));
    return R.prompts && R.prompts.length ? R.prompts[((w % R.prompts.length) + R.prompts.length) % R.prompts.length] : "This week's prompt";
  }

  // ---------- up next banner ----------
  function upnext() {
    var evs = liveEvents(40), now = Date.now();
    var live = evs.filter(function (e) { return e.start <= now && now < e.start + e.mins * 60e3; })[0];
    var next = evs.filter(function (e) { return e.start > now; })[0];
    var t = $("#upnextTitle"), c = $("#upnextClock");
    if (live) { t.textContent = "Live now: " + live.title; c.textContent = "JOIN"; return; }
    if (!next) { t.textContent = "Nothing scheduled"; c.textContent = ""; return; }
    var ms = next.start - now, d = Math.floor(ms / DAY), hh = Math.floor(ms % DAY / 3600e3), mm = Math.floor(ms % 3600e3 / 60e3), ss = Math.floor(ms % 60e3 / 1000);
    t.textContent = next.title + " · " + fmtManila(next.start).replace(" Manila", "") + " Manila";
    c.textContent = pad(d) + "d : " + pad(hh) + "h : " + pad(mm) + "m : " + pad(ss) + "s";
  }

  // ---------- my numbers (checklist + stave) ----------
  function mine() {
    var me = db.me(), s = db.state, id = me.id;
    var posts = s.posts.filter(function (p) { return p.author === id; });
    var notes = 0; s.posts.forEach(function (p) { p.notes.forEach(function (n) { if (n.by === id) notes++; }); });
    var signed = db.myRooms().filter(function (r) { return r.signed[id]; }).length;
    var playedRound = Object.keys(s.played).some(function (k) { return /Round/.test(k); });
    return {
      prompts: posts.filter(function (p) { return p.cat === "prompt"; }).length,
      intro: posts.some(function (p) { return p.cat === "general"; }),
      notes: notes, signed: signed, playedRound: playedRound,
      rsvps: Object.keys(s.rsvps).length
    };
  }
  function checklist() {
    var me = db.me(), n = mine();
    return [
      { id: "photo", label: "Put a face to your name", done: !!me.photo, href: "#/me" },
      { id: "city", label: "Add your city, so writers near you can find you", done: !!me.city, href: "#/me" },
      { id: "intro", label: "Say hello in Introductions", done: n.intro, href: "#/feed/general" },
      { id: "prompt", label: "Post to this week's prompt", done: n.prompts > 0, href: "#/feed/prompt" },
      { id: "notes", label: "Give notes on two songs", done: n.notes >= 2, href: "#/feed/feedback" },
      { id: "pairing", label: "Say \"I'm in\" for the Pairing", done: !!db.state.pairing.optIn, href: "#/cowrites" }
    ];
  }
  var MILESTONES = [
    { line: 4, key: "F", name: "Flourish", items: [
      { id: "f1", label: "Release or pitch a song with every split in order" },
      { id: "f2", label: "Earn your first money from a song you wrote" }] },
    { line: 3, key: "D", name: "Deliver", items: [
      { id: "d1", label: "Take a song from voice memo to finished demo" },
      { id: "d2", label: "Get Pro Desk notes and post the rewrite" }] },
    { line: 2, key: "B", name: "Book", items: [
      { id: "b1", label: "Play a song at a live Round", auto: function (n) { return [n.playedRound ? 1 : 0, 1]; } },
      { id: "b2", label: "Play a writers' night, online or at the house" }] },
    { line: 1, key: "G", name: "Grow", items: [
      { id: "g1", label: "Write three songs in the Pairing, with ownership signed", auto: function (n) { return [Math.min(n.signed, 3), 3]; } },
      { id: "g2", label: "Give useful notes on twenty songs", auto: function (n) { return [Math.min(n.notes, 20), 20]; } }] },
    { line: 0, key: "E", name: "Establish", items: [
      { id: "e1", label: "Post to four weekly prompts", auto: function (n) { return [Math.min(n.prompts, 4), 4]; } },
      { id: "e2", label: "Register a song with FILSCAP or your home society" }] }
  ];
  function staveState() {
    var n = mine(), self = db.state.selfMilestones, done = 0, top = null;
    var lines = MILESTONES.map(function (L) {
      var items = L.items.map(function (it) {
        var prog = it.auto ? it.auto(n) : null;
        var ok = prog ? prog[0] >= prog[1] : !!self[it.id];
        if (ok) done++;
        return Object.assign({}, it, { prog: prog, done: ok });
      });
      var lit = items.every(function (i) { return i.done; });
      if (lit && (top === null || L.line > top.line)) top = L;
      return Object.assign({}, L, { items: items, lit: lit });
    });
    return { lines: lines, done: done, top: top };
  }

  // ---------- views ----------
  var CAT = {}; Room.CATEGORIES.forEach(function (c) { CAT[c.id] = c.name; });

  function postCard(p) {
    var a = db.member(p.author) || { id: "x", name: "Former member" }, me = db.state.me;
    var felt = p.feels.indexOf(me) !== -1, link = safeUrl(p.link);
    var noteable = p.cat === "feedback" || p.cat === "prompt";
    return '<article class="post' + (p.pinned ? " pinned" : "") + '" id="post-' + esc(p.id) + '">' +
      '<header class="post-h">' + avatar(a, 42) + '<div><p class="post-who">' + who(a.id) + (a.host ? ' <span class="chip host">Host</span>' : a.mentor ? ' <span class="chip host">Visiting mentor</span>' : "") + '</p>' +
      '<p class="post-meta">' + esc(a.city || "") + " · " + ago(p.at) + (p.pinned ? " · pinned" : "") + '</p></div>' +
      '<a class="chip cat-' + esc(p.cat) + '" href="#/feed/' + esc(p.cat) + '">' + esc(CAT[p.cat] || p.cat) + "</a></header>" +
      '<p class="post-body">' + esc(p.body).replace(/\n/g, "<br>") + "</p>" +
      (link ? '<p><a class="listen" href="' + esc(link) + '" target="_blank" rel="noopener">▶ Listen</a></p>' : "") +
      (p.notes.length ? '<div class="notes">' + p.notes.map(function (n) {
        return '<div class="note"><p class="note-by">' + avatar(db.member(n.by), 24) + " " + who(n.by) + " · " + ago(n.at) + "</p>" +
          '<dl><div><dt>Works</dt><dd>' + esc(n.works) + '</dd></div><div><dt>Try</dt><dd>' + esc(n.tryit) + '</dd></div><div><dt>Question</dt><dd>' + esc(n.question) + "</dd></div></dl></div>";
      }).join("") + "</div>" : "") +
      '<div class="post-actions"><button type="button" class="feel' + (felt ? " on" : "") + '" data-act="feel" data-id="' + esc(p.id) + '" aria-pressed="' + felt + '">♥ ' + (p.feels.length || "") + ' <span>Felt it</span></button>' +
      '<span class="post-count">' + p.comments.length + " comment" + (p.comments.length === 1 ? "" : "s") + (p.notes.length ? " · " + p.notes.length + " note" + (p.notes.length === 1 ? "" : "s") : "") + "</span>" +
      (noteable && p.author !== me ? '<button type="button" class="btn-sm" data-act="note-open" data-id="' + esc(p.id) + '">Give notes</button>' : "") + Room.slot("post.actions", p) + "</div>" + Room.slot("post.after", p) +
      (noteable ? '<form class="note-form" data-form="note" data-id="' + esc(p.id) + '" hidden><p class="eyebrow">Works · try · question</p>' +
        '<label>One thing that works<input name="works" required maxlength="300"></label>' +
        '<label>One thing to try<input name="tryit" required maxlength="300"></label>' +
        '<label>One question<input name="question" required maxlength="300"></label><button class="btn-sm solid">Send notes</button></form>' : "") +
      '<div class="comments">' + p.comments.map(function (c) {
        return '<div class="comment">' + avatar(db.member(c.by), 28) + "<p>" + who(c.by) + " <span>" + ago(c.at) + "</span><br>" + esc(c.body) + "</p></div>";
      }).join("") +
      '<form class="comment-form" data-form="comment" data-id="' + esc(p.id) + '">' + avatar(db.me(), 28) + '<input name="body" placeholder="Write a comment" maxlength="1000" aria-label="Write a comment"><button class="btn-sm">Post</button></form></div></article>';
  }

  function viewFeed(cat) {
    cat = cat || "all";
    var s = db.state, me = db.me();
    var ws = weekStart(Date.now());
    var promptPosters = []; s.posts.forEach(function (p) { if (p.cat === "prompt" && p.at >= ws && promptPosters.indexOf(p.author) === -1) promptPosters.push(p.author); });
    var mineDone = promptPosters.indexOf(me.id) !== -1;
    var list = s.posts.filter(function (p) { return cat === "all" || p.cat === cat; }).sort(function (a, b) { return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.at - a.at; });
    var steps = checklist(), doneN = steps.filter(function (x) { return x.done; }).length;
    var showList = !s.checklistHidden && doneN < steps.length;
    var evs = liveEvents(40).filter(function (e) { return e.start > Date.now(); });
    var nx = evs[0];
    return '<div class="feed-grid"><div class="feed-main">' +
      '<a class="prompt-card-app" href="#/feed/prompt"><span class="eyebrow">This week\'s prompt</span><b>' + esc(promptOfWeek()) + '</b>' +
      '<span>' + (promptPosters.length ? promptPosters.length + " " + (promptPosters.length === 1 ? "writer has" : "writers have") + " shared this week. " : "") + (mineDone ? "Yours is in. Now give notes on two." : "Yours is still open: post by Sunday.") + '</span>' +
      '<span class="stack">' + promptPosters.slice(0, 4).map(function (id) { return avatar(db.member(id), 30); }).join("") + "</span></a>" +
      (showList ? '<section class="welcome-card"><div class="welcome-h"><p class="eyebrow">Welcome home</p><span class="muted">' + doneN + " of " + steps.length + ' · <button type="button" class="link" data-act="hide-checklist">Dismiss</button></span></div>' +
        '<h2>Welcome in, ' + esc(first(me.name)) + '</h2><p class="muted">Six small steps and you\'re fully in the room.</p><ul class="steps">' +
        steps.map(function (x) { return '<li class="' + (x.done ? "done" : "") + '"><a href="' + x.href + '"><i></i>' + esc(x.label) + "</a></li>"; }).join("") + "</ul></section>" : "") +
      '<div class="chips" role="tablist">' + [["all", "All"]].concat(Room.CATEGORIES.map(function (c) { return [c.id, c.name]; })).map(function (c) {
        return '<a class="chip big' + (cat === c[0] ? " on" : "") + '" href="#/feed/' + c[0] + '">' + esc(c[1]) + "</a>";
      }).join("") + "</div>" +
      '<form class="composer" data-form="post">' + avatar(me, 42) + '<div class="composer-body">' +
      '<textarea name="body" rows="2" placeholder="' + (cat === "prompt" ? "Post your take on this week's prompt…" : cat === "feedback" ? "What do you want notes on?" : "What's on your mind, songwise?") + '" required maxlength="3000" aria-label="Write a post"></textarea>' +
      '<div class="composer-row"><select name="cat" aria-label="Category">' + Room.CATEGORIES.map(function (c) { return '<option value="' + c.id + '"' + ((cat === c.id || (cat === "all" && c.id === "general")) ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select>" +
      '<input name="link" type="url" placeholder="Song link (optional)" aria-label="Song link"><button class="btn-sm solid">Post</button></div></div></form>' +
      (list.length ? list.map(postCard).join("") : '<p class="empty">Nothing here yet. Be the first.</p>') +
      '</div><aside class="feed-side">' +
      (nx ? '<section class="side-card dark"><p class="eyebrow">Up next on the calendar</p><h3>' + esc(nx.title) + '</h3><p>' + esc(nx.text) + '</p><p class="mono">' + esc(whenBoth(nx.start)) + '</p>' +
        '<button class="btn-sm sun" data-act="rsvp" data-key="' + esc(nx.key) + '">' + (s.rsvps[nx.key] ? "Seat saved ✓" : "Save my seat") + '</button><a class="link-arrow" href="#/calendar">See the calendar →</a></section>' : "") +
      '<section class="side-card"><p class="eyebrow">The Pairing</p><h3>' + (s.pairing.optIn ? "You're in this week" : "Write with two new people this week") + '</h3><p class="muted">Groups of three go out every Tuesday at 09:00 Manila.</p><a class="btn-sm solid" href="#/cowrites">' + (s.pairing.optIn ? "See your group" : "Say I'm in") + "</a></section>" +
      '<section class="side-card"><p class="eyebrow">New in the room</p>' + s.members.slice().sort(function (a, b) { return b.joined - a.joined; }).slice(0, 4).map(function (m) {
        return '<a class="mini-member" href="#/m/' + esc(m.id) + '">' + avatar(m, 32) + "<span><b>" + esc(m.name) + "</b>" + esc(m.city || "") + "</span></a>";
      }).join("") + "</section>" + Room.slot("feed.side", {}) + "</aside></div>";
  }

  function viewCalendar(kind) {
    kind = kind || "all";
    var s = db.state, now = Date.now();
    var evs = liveEvents(42).concat(inPersonEvents()).filter(function (e) { return (kind === "all" || e.kind === kind) && e.start + e.mins * 60e3 > now - 3 * 3600e3; })
      .sort(function (a, b) { return a.start - b.start; });
    var held = evs.filter(function (e) { return s.rsvps[e.key]; });
    return '<section class="will"><div class="will-h"><div><p class="eyebrow sun">Gising Sining House · Calendar</p><h1>Hey ' + esc(first(db.me().name)) + ".</h1>" +
      '<p>' + (held.length ? "You've saved " + held.length + " seat" + (held.length === 1 ? "" : "s") + ". See you in the room." : "No seats saved yet. Pick a session.") + '</p></div>' +
      '<div class="seg">' + [["all", "All"], ["online", "Online"], ["in-person", "In person"]].map(function (k) { return '<a class="' + (kind === k[0] ? "on" : "") + '" href="#/calendar/' + k[0] + '">' + k[1] + "</a>"; }).join("") + "</div></div>" +
      '<div class="tickets">' + evs.map(function (e) {
        var live = e.start <= now && now < e.start + e.mins * 60e3, past = now >= e.start + e.mins * 60e3, saved = !!s.rsvps[e.key];
        return '<article class="ticket ' + e.kind + '"><div class="ticket-top"><span class="chip ' + (e.kind === "online" ? "green" : "rust") + '">' + esc(e.type) + " · " + (e.kind === "online" ? "online" : "in person") + "</span>" +
          (live ? '<span class="chip live">Live now</span>' : "") + "<h3>" + esc(e.title) + '</h3><p class="mono">' + esc(whenBoth(e.start)) + '</p><p class="muted">' + esc(e.text) + "</p></div>" +
          '<div class="ticket-stub">' + (e.href ? '<a class="btn-sm sun" href="' + e.href + '">Join and reserve</a>' :
            (past || live) && e.type === "The Round" && !s.played[e.key] ? '<button class="btn-sm sun" data-act="played" data-key="' + esc(e.key) + '">I played a song</button>' :
            '<button class="btn-sm ' + (saved ? "" : "sun") + '" data-act="rsvp" data-key="' + esc(e.key) + '" aria-pressed="' + saved + '">' + (saved ? "Seat saved ✓" : "Save my seat") + "</button>") +
          (live && safeUrl((s.callLinks || {})[e.type]) ? '<a class="btn-sm solid" href="' + esc(safeUrl(s.callLinks[e.type])) + '" target="_blank" rel="noopener">Join the call</a>' : "") +
          (e.kind === "online" ? '<button class="btn-sm" data-act="ics" data-key="' + esc(e.key) + '">Add to calendar</button>' : "") +
          '<span class="stub-note">' + (e.kind === "online" ? "No ticket needed. Every member has a seat." : "Founding places for members") + "</span></div></article>";
      }).join("") + (kind !== "online" ? [["Day camp · in person", "Day camps in Manila", "1 day · from 2027", "One cowrite and a playback with notes. Every level welcome. Dates go up here first."],
        ["Two-day camp · in person", "Two-day camps in Manila", "2 days · 2027", "Two cowrites, two demos, notes from mentors. Dates go up here first."],
        ["Writers' night · in person", "Writers' nights at the Manila house", "Monthly, 7–10pm · when the house opens in 2027", "Members hear first."]].map(function (c) {
          return '<article class="ticket in-person soon"><div class="ticket-top"><span class="chip rust">' + c[0] + "</span><h3>" + c[1] + '</h3><p class="mono">' + c[2] + '</p><p class="muted">' + c[3] + '</p></div><div class="ticket-stub"><span class="stub-note">Coming 2027</span></div></article>';
        }).join("") : "") + "</div>" +
      Room.slot("calendar.after", { kind: kind }) +
      '<a class="replays" href="#/academy"><span class="chip green">Replays</span> Missed a House Session or a Round? Watch it back in the Academy. <b>→</b></a>' +
      '<p class="will-foot">Online sessions: bring headphones and a song. Times show in Manila and in your own time zone. The Round runs twice on the first Saturday so both halves of the world can come.</p></section>';
  }

  var BRIEFS = ["A goodbye at an airport, told by the person who stays behind.", "The first song you'd play on a long drive home.", "Write the chorus as a text message that was never sent.",
    "A love song set entirely in a convenience store at 3am.", "Thank someone who will never hear it.", "A song about leaving, with a chorus that wants to stay."];
  function pairingGroup() {
    var me = db.me(), w = weekNo(Date.now());
    var pool = db.state.members.filter(function (m) { return m.id !== me.id && !m.host && !m.mentor && m.openToWrite; });
    var need = me.roles.indexOf("Production") === -1 ? ["Production"] : ["Melody", "Words"];
    var a = pool.filter(function (m) { return m.roles.some(function (r) { return need.indexOf(r) !== -1; }); });
    var b = pool.filter(function (m) { return m.roles.indexOf("Words") !== -1 || m.roles.indexOf("Melody") !== -1; });
    var at = function (arr, i) { return arr[((i % arr.length) + arr.length) % arr.length]; };
    var pick = function (arr, k) { return arr.length ? at(arr, w + k) : at(pool, k); };
    if (pool.length < 2) return null;   // not enough writers to make a group
    var one = pick(a, 0), two = pick(b.filter(function (m) { return m.id !== one.id; }), 3);
    if (!one || !two || one.id === two.id) { one = pool[0]; two = pool[1]; }
    return { writers: [me.id, one.id, two.id], brief: BRIEFS[((w % BRIEFS.length) + BRIEFS.length) % BRIEFS.length] };
  }

  function viewCowrites() {
    var s = db.state, me = db.me(), p = s.pairing, w = weekNo(Date.now());
    // Live: groups come from the server's Tuesday job (p.room). Demo: build one here so the screen has something to show.
    var g = p.optIn && Room.mode !== "ghl" ? pairingGroup() : null;
    if (g && p.week !== w) { p.week = w; p.room = db.openRoom(g.writers, "Pairing · week " + Math.max(w + 1, 1)); db.room(p.room).brief = g.brief; db.save(); }
    var room = p.optIn && p.room ? db.room(p.room) : null;
    var nextTue = nextStart({ day: 2, time: "09:00", mins: 0 }, Date.now());
    var times = s.openTimes.filter(function (t) { return t.at > Date.now() - 3600e3; }).sort(function (a, b) { return a.at - b.at; });
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · Cowrites</p><h1>Cowrites</h1><p class="lead">Two ways to write with people here. The Pairing puts you in a group of three every week. Or post a time you\'re open and anyone in the room can book it. Every write gets its own room with a lyric sheet and an ownership form.</p></div>' +
      '<section class="pairing-panel"><div><p class="eyebrow sun">The Pairing · week ' + Math.max(w + 1, 1) + '</p><h2>' + (p.optIn ? "You're in this week." : "Write with two new people this week.") + '</h2>' +
      '<p>' + (p.optIn ? "In the real room your group arrives Tuesday at 09:00 Manila. Here in the demo, it's ready now." : "Tick in by Monday night. Groups of three, matched on skills, languages and time zone, go out " + esc(fmtManila(nextTue)) + ".") + "</p>" +
      '<label class="switch"><input type="checkbox" data-act="optin"' + (p.optIn ? " checked" : "") + '><span></span> I\'m in this week</label></div>' +
      (room ? '<div class="group"><p class="eyebrow">Your group</p>' + room.writers.map(function (id) { var m = db.member(id); return '<a class="group-m" href="#/m/' + esc(id) + '">' + avatar(m, 44) + "<span><b>" + esc(m.name) + (id === me.id ? " (you)" : "") + "</b>" + esc((m.roles || []).join(", ") || "Writer") + " · " + esc(m.city || "") + "</span></a>"; }).join("") +
        '<p class="brief"><b>Song idea:</b> ' + esc(room.brief || "") + '</p><a class="btn-sm sun" href="#/write/' + esc(room.id) + '">Open your writing room</a></div>' :
        '<div class="group empty-group"><p class="eyebrow">How it works</p><ol><li>Say "I\'m in" by Monday night</li><li>Meet your group of three on Tuesday</li><li>Sign the ownership form: 30 / 30 / 30, 10 to the house</li><li>Write, then post it for notes</li></ol></div>') + "</section>" +
      '<div class="cw-grid"><section class="panel"><div class="panel-h"><h2>Open times</h2><button class="btn-sm solid" data-act="open-time-toggle">Post a time you\'re open</button></div>' +
      '<form class="open-form" data-form="opentime" hidden><label>When (your time)<input type="datetime-local" name="at" required></label><label>How long<select name="mins"><option value="60">1 hour</option><option value="90">90 minutes</option><option value="120" selected>2 hours</option></select></label><label class="wide">What you want to write<input name="note" maxlength="140" placeholder="e.g. Have a track, need a topline"></label><button class="btn-sm solid">Post it</button></form>' +
      (times.length ? '<ul class="times">' + times.map(function (t) {
        var m = db.member(t.by), mineT = t.by === me.id, booked = t.bookedBy;
        return '<li>' + avatar(m, 40) + '<div><p><b>' + who(t.by) + "</b> · " + esc(t.note || "Open to write") + '</p><p class="mono">' + esc(whenBoth(t.at)) + " · " + (t.mins / 60) + "h</p></div>" +
          (mineT ? '<span class="chip">' + (booked ? "Booked by " + esc(first(db.member(booked).name)) : "Your time") + "</span>" :
            booked ? '<span class="chip">Booked</span>' : '<button class="btn-sm sun" data-act="book" data-id="' + esc(t.id) + '">Book it</button>') + "</li>";
      }).join("") + "</ul>" : '<p class="empty">No open times yet. Post yours.</p>') + "</section>" +
      '<section class="panel dark"><p class="eyebrow sun">Writing rooms</p><h2>One room for every song</h2><p>A lyric sheet everyone can see, a place for the call link, and the ownership form signed before the first line.</p>' +
      '<button class="btn-sm sun" data-act="new-room">Open a new room</button>' +
      '<ul class="room-list">' + db.myRooms().sort(function (a, b) { return b.created - a.created; }).map(function (r) {
        return '<li><a href="#/write/' + esc(r.id) + '"><b>' + esc(r.title) + "</b><span>" + r.writers.map(function (id) { return esc(first((db.member(id) || {}).name)); }).join(", ") + " · " + (r.signed[me.id] ? "signed" : "not signed yet") + "</span></a></li>";
      }).join("") + "</ul></section></div>" + Room.slot("cowrites.after", {});
  }

  function viewWrite(id) {
    var r = db.room(id), me = db.me();
    if (!r) return '<p class="empty">That room doesn\'t exist any more. <a href="#/cowrites">Back to cowrites</a></p>';
    var n = r.writers.length, share = Math.round(9000 / n) / 100;
    var allSigned = r.writers.every(function (w) { return r.signed[w]; });
    return '<div class="page-h"><p class="eyebrow"><a href="#/cowrites">Cowrites</a> · writing room</p><input class="title-input" data-field="title" data-id="' + esc(r.id) + '" value="' + esc(r.title) + '" aria-label="Song title"></div>' +
      '<div class="write-grid"><section class="panel"><div class="panel-h"><h2>Lyric sheet</h2><span class="muted" id="saved">Saves as you type</span></div>' +
      (r.brief ? '<p class="brief"><b>Song idea:</b> ' + esc(r.brief) + "</p>" : "") +
      (Room.slot("write.lyrics", r) || '<textarea class="lyrics" data-field="lyrics" data-id="' + esc(r.id) + '" placeholder="Verse 1&#10;&#10;Chorus&#10;" aria-label="Lyric sheet">' + esc(r.lyrics) + "</textarea>") +
      '<label class="field-l">Session notes<textarea data-field="notes" data-id="' + esc(r.id) + '" rows="3" placeholder="Key, tempo, chords, who\'s doing what">' + esc(r.notes) + "</textarea></label>" + Room.slot("write.main", r) + "</section>" +
      '<aside class="write-side"><section class="panel"><h2>The writers</h2>' + r.writers.map(function (w) { var m = db.member(w); return '<div class="mini-member">' + avatar(m, 32) + "<span><b>" + esc(m.name) + "</b>" + esc((m.roles || []).join(", ")) + "</span></div>"; }).join("") +
      '<label class="field-l">Call link (Zoom, Meet, anything)<input data-field="call" data-id="' + esc(r.id) + '" value="' + esc(r.call) + '" placeholder="https://"></label>' +
      (safeUrl(r.call) ? '<a class="btn-sm solid" href="' + esc(safeUrl(r.call)) + '" target="_blank" rel="noopener">Join the call</a>' : "") + "</section>" +
      '<section class="panel split-panel"><h2>Ownership form</h2><p class="muted">Signed before you write. You each keep all of your writer\'s share. Publishing:</p><table class="split-t"><tbody>' +
      r.writers.map(function (w) { var m = db.member(w); return "<tr><td>" + esc(m.name) + '</td><td class="n">' + share + '%</td><td>' + (r.signed[w] ? '<span class="ok">Signed ✓</span>' : w === me.id ? '<button class="btn-sm sun" data-act="sign" data-id="' + esc(r.id) + '">Sign</button>' : '<span class="muted">Waiting</span>') + "</td></tr>"; }).join("") +
      '<tr class="split-house"><td>Gising Sining House</td><td class="n">10%</td><td><span class="muted">Registers and pitches the song</span></td></tr></tbody></table>' +
      (r.signed[me.id] && !allSigned ? '<button class="link" data-act="sign-others" data-id="' + esc(r.id) + '">Demo: sign for the other writers</button>' : "") +
      '<a class="link-arrow" href="#/splitsheet/' + esc(r.id) + '">Print the split sheet →</a></section>' +
      '<section class="panel"><h2>Finished a draft?</h2><p class="muted">Post it to the Feedback Room with every writer\'s name.</p><form data-form="room-post" data-id="' + esc(r.id) + '"><input name="link" type="url" placeholder="Voice memo or demo link" aria-label="Song link"><button class="btn-sm solid">Post for notes</button></form></section>' + Room.slot("write.side", r) + "</aside></div>";
  }

  function viewSplitSheet(id) {
    var r = db.room(id) || { title: "", writers: [db.state.me], signed: {} };
    var n = r.writers.length, share = Math.round(9000 / n) / 100, today = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
    return '<div class="sheet"><div class="sheet-actions"><a href="#/cowrites">← Back</a><button class="btn-sm solid" data-act="print">Print or save as PDF</button></div>' +
      '<h1>Split sheet</h1><p class="mono">Gising Sining House · ' + esc(today) + '</p><dl class="sheet-meta"><div><dt>Song title</dt><dd>' + esc(r.title) + '</dd></div><div><dt>Written at</dt><dd>The Room (online)</dd></div></dl>' +
      '<h2>Writer\'s share</h2><p>Each writer keeps 100% of their own writer\'s share, collected through their society (FILSCAP or their home society). Writer\'s shares are split equally unless agreed below.</p>' +
      '<h2>Publishing share</h2><table class="split-t print"><thead><tr><th>Name</th><th>Role</th><th>Society / IPI</th><th class="n">Publishing</th><th>Signature</th></tr></thead><tbody>' +
      r.writers.map(function (w) { var m = db.member(w) || {}; return "<tr><td>" + esc(m.name) + "</td><td>" + esc((m.roles || []).join(", ")) + '</td><td></td><td class="n">' + share + "%</td><td>" + (r.signed[w] ? "Signed in the Room" : "") + "</td></tr>"; }).join("") +
      '<tr><td>Gising Sining House</td><td>Publisher</td><td></td><td class="n">10%</td><td></td></tr></tbody></table>' +
      '<p class="mono small">Draft template for the founding season. Have it checked by a lawyer before relying on it.</p></div>';
  }

  function memberCard(m) {
    return '<a class="m-card" href="#/m/' + esc(m.id) + '">' + avatar(m, 64) + '<b>' + esc(m.name) + "</b><span>" + esc(m.city || "Somewhere") + "</span>" +
      '<span class="m-tags">' + (m.roles || []).slice(0, 2).map(function (r) { return '<i>' + esc(r) + "</i>"; }).join("") + "</span>" +
      (m.openToWrite ? '<span class="chip green">Open to write</span>' : "") + Room.slot("members.card", m) + "</a>";
  }
  function viewMembers(q) {
    var me = db.me(), s = db.state;
    var incomplete = !me.photo || !me.city || !me.bio || !(me.roles || []).length;
    return '<div class="hero-band"><p class="eyebrow sun">Gising Sining House</p><h1>Members</h1><p><em>The people in the room with you.</em></p></div>' +
      '<a class="map-bar" href="#/map"><span class="globe">◍</span><span><b>Member map</b><small>See who is where</small></span><b>→</b></a>' +
      (incomplete ? '<section class="finish"><div><p class="eyebrow sun">Your profile isn\'t finished</p><p>Add a photo, your city, what you bring and a line about you. Finished profiles show first, and the Pairing matches you better.</p></div><a class="btn-sm sun" href="#/me">Finish my profile</a></section>' : "") +
      '<div class="m-tools"><span class="mono">' + s.members.length + ' members</span><input type="search" id="mSearch" placeholder="Search names, cities, sounds, languages" value="' + esc(q || "") + '" aria-label="Search members"></div>' +
      '<div class="m-grid" id="mGrid">' + filterMembers(q).map(memberCard).join("") + "</div>" + Room.slot("members.after", {});
  }
  function filterMembers(q) {
    q = (q || "").toLowerCase().trim();
    return db.state.members.filter(function (m) {
      if (!q) return true;
      return [m.name, m.city, (db.city(m.city) || {}).country, /^(Manila|Quezon City|Makati|Pasig)$/.test(m.city || "") ? "Metro Manila" : ""].concat(m.roles || [], m.sounds || [], m.languages || []).join(" ").toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return (b.photo ? 1 : 0) - (a.photo ? 1 : 0) || (b.host ? 1 : 0) - (a.host ? 1 : 0) || a.name.localeCompare(b.name); });
  }

  function viewProfile(id) {
    var m = db.member(id), me = db.me();
    if (!m) return '<p class="empty">Member not found.</p>';
    var c = db.city(m.city), posts = db.state.posts.filter(function (p) { return p.author === id; }).slice(0, 5);
    return '<section class="profile"><div class="profile-h">' + avatar(m, 120) + '<div><p class="eyebrow">' + (m.host ? "Host" : m.mentor ? "Visiting mentor" : m.founding ? "Founding member" : "Member") + '</p><h1>' + esc(m.name) + '</h1><p class="mono">' + esc(m.city || "") + (c ? ", " + esc(c.country) : "") + "</p>" +
      (m.openToWrite ? '<span class="chip green">Open to write</span>' : "") + "</div>" +
      (id === me.id ? '<a class="btn-sm" href="#/me">Edit profile</a>' : '<button class="btn-sm sun" data-act="write-with" data-id="' + esc(m.id) + '">Write with ' + esc(first(m.name)) + "</button>") + '<span class="profile-actions">' + Room.slot("profile.actions", m) + "</span></div>" +
      (m.bio ? '<p class="bio">' + esc(m.bio) + "</p>" : "") +
      '<dl class="facts-app"><div><dt>Brings</dt><dd>' + esc((m.roles || []).join(", ") || "Not added yet") + '</dd></div><div><dt>Writes in</dt><dd>' + esc((m.languages || []).join(", ") || "Not added yet") + '</dd></div><div><dt>Sounds</dt><dd>' + esc((m.sounds || []).join(", ") || "Not added yet") + "</dd></div>" +
      (safeUrl(m.link) ? '<div><dt>Listen</dt><dd><a href="' + esc(safeUrl(m.link)) + '" target="_blank" rel="noopener">' + esc(m.link) + "</a></dd></div>" : "") + "</dl>" +
      Room.slot("profile.after", m) +
      "<h2>Recent in the room</h2>" + (posts.length ? posts.map(postCard).join("") : '<p class="empty">Nothing posted yet.</p>') + "</section>";
  }

  function viewMap() {
    return '<div class="page-h"><h1>Member map</h1><p class="eyebrow">Where the house lives. Add your city on your profile to get your pin.</p></div><div id="mapBox" class="map-box"></div>' +
      (window.L ? "" : '<p class="empty">The map needs an internet connection to load.</p>');
  }
  function drawMap() {
    if (!window.L || !$("#mapBox")) return;
    map = L.map("mapBox", { worldCopyJump: true, scrollWheelZoom: false }).setView([12, 121], 3);
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}", { attribution: "Tiles &copy; Esri", maxZoom: 14 }).addTo(map);
    var seen = {}, pts = [];
    db.state.members.forEach(function (m) {
      if (m.under18) return; // members aged 16 or 17 aren't pinned on the map
      var c = db.city(m.city); if (!c) return;
      var k = c.name, n = seen[k] = (seen[k] || 0) + 1, ang = n * 2.4, rad = n > 1 ? 0.5 * Math.sqrt(n - 1) : 0;
      var icon = L.divIcon({ className: "pin", html: avatar(m, 38), iconSize: [42, 42], iconAnchor: [21, 21] });
      pts.push([c.lat, c.lng]);
      L.marker([c.lat + rad * Math.sin(ang), c.lng + rad * Math.cos(ang)], { icon: icon, title: m.name }).addTo(map)
        .bindPopup('<b>' + esc(m.name) + "</b><br>" + esc(c.name) + '<br><a href="#/m/' + esc(m.id) + '">View profile</a>');
    });
    if (pts.length > 1) map.fitBounds(pts, { padding: [40, 40], maxZoom: 5 });
  }

  function viewStave() {
    var st = staveState(), s = db.state, ws = weekStart(Date.now());
    var wk = { prompts: 0, notes: 0, wins: 0, cowrites: 0 };
    s.posts.forEach(function (p) { if (p.at >= ws) { if (p.cat === "prompt") wk.prompts++; if (p.cat === "wins") wk.wins++; } p.notes.forEach(function (n) { if (n.at >= ws) wk.notes++; }); });
    s.openTimes.forEach(function (t) { if (t.bookedBy) wk.cowrites++; });
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · the 5 Keys</p><h1>The 5 Keys</h1><p class="lead">No leaderboard here. Points for posting reward the loudest person in the room. You climb the 5 Keys, from E up to F, by doing things that matter to a career. Some lines tick themselves as you use the room; tick the others when they happen.</p></div>' +
      '<div class="stave-wrap"><section class="panel"><div class="journey"><p class="eyebrow">Your journey</p><h2>' + (st.top ? "On the " + st.top.key + " line · " + st.top.name : "Starting at the bottom line, like everyone") + '</h2><p class="muted">' + st.done + ' of 10 milestones</p></div>' +
      '<div class="app-stave">' + st.lines.map(function (L) {
        return '<div class="a-line' + (L.lit ? " lit" : "") + '"><p class="a-key"><b>' + L.key + "</b> " + L.name + "</p>" + L.items.map(function (it) {
          return '<label class="a-item' + (it.done ? " done" : "") + '">' + (it.auto ? '<i class="auto" aria-hidden="true">' + (it.done ? "✓" : "") + "</i>" : '<input type="checkbox" data-act="self" data-id="' + it.id + '"' + (it.done ? " checked" : "") + ">") +
            "<span>" + esc(it.label) + (it.prog ? ' <em>' + it.prog[0] + " / " + it.prog[1] + "</em>" : "") + "</span></label>";
        }).join("") + "</div>";
      }).join("") + '</div><p class="muted small">Ticks with a circle are counted for you from what you do in the room. Only you see your progress.</p></section>' +
      '<aside><section class="panel dark"><p class="eyebrow sun">The room this week</p><p class="muted-l">Everyone together. No rankings.</p><div class="wk-stats"><div><b>' + wk.prompts + '</b><span>prompt songs</span></div><div><b>' + wk.notes + '</b><span>notes given</span></div><div><b>' + wk.wins + '</b><span>wins shared</span></div><div><b>' + wk.cowrites + "</b><span>cowrites booked</span></div></div></section>" + Room.slot("stave.side", {}) + "</aside></div>" + Room.slot("stave.after", {});
  }

  var LESSONS = [
    ["E", "Establish", "The split sheet", "Names, roles, percentages, signatures, date. How this house shares songs (30 / 30 / 30, 10 to the house on publishing), and why you sign before the first line.", true],
    ["E", "Establish", "Registering your songs", "FILSCAP, your home society, and what an IPI number is. What to do the week a song is finished.", false],
    ["G", "Grow", "Publishing in plain English", "Writer's share, publisher's share, and who collects what. The money nobody explains.", false],
    ["B", "Book", "From song to stage", "Getting your songs into writers' nights and rounds, and what to say between them.", false],
    ["D", "Deliver", "Demos that carry the song", "What a pitch demo needs and what it doesn't. Spend less, finish more.", false],
    ["F", "Flourish", "Sync and brand briefs", "How briefs work, what supervisors listen for, and how splits work when a song is licensed.", false]
  ];
  function viewAcademy() {
    var s = db.state, monthKey = new Date().getFullYear() + "-" + new Date().getMonth();
    var minePd = s.prodesk.filter(function (p) { return p.by === s.me; });
    var usedThisMonth = minePd.some(function (p) { return p.month === monthKey; });
    return '<div class="hero-band"><p class="eyebrow sun">Gising Sining House</p><h1>The Academy</h1><p><em>The craft and the money side, taught plainly.</em></p></div>' +
      '<div class="acad-grid"><article class="acad-card ink"><p class="eyebrow sun">The Pro Desk · monthly</p><h2>Put one song in front of a mentor</h2><p>One song a month, written notes from a mentor from the house, in the same works · try · question shape.</p>' +
      (usedThisMonth ? '<p class="ok">This month\'s song is in. Notes come back here and by email.</p>' :
        '<form data-form="prodesk"><input name="title" placeholder="Song title" required maxlength="120" aria-label="Song title"><input name="link" type="url" placeholder="Link to the song" required aria-label="Song link"><button class="btn-sm sun">Send to the Pro Desk</button></form>') +
      (minePd.length ? '<ul class="pd-list">' + minePd.map(function (p) { return "<li><b>" + esc(p.title) + "</b> · " + ago(p.at) + " · " + esc(p.status) + (p.notes ? '<br><span class="pd-notes">Works: ' + esc(p.notes.works) + " · Try: " + esc(p.notes.tryit) + " · Question: " + esc(p.notes.question) + "</span>" : "") + "</li>"; }).join("") + "</ul>" : "") + "</article>" +
      '<article class="acad-card rust"><p class="eyebrow">Template</p><h2>The split sheet</h2><p>The form every cowrite in the house starts with, ready to print or save as a PDF.</p><a class="btn-sm sun" href="#/splitsheet/blank">Open the template</a></article>' +
      '<article class="acad-card rust"><p class="eyebrow">Reviews and sessions</p><h2>Want more than the Pro Desk?</h2><p>A full video Song Review, a Mentor Session, a cowrite with a pro or a demo. Pricing announced soon.</p><a class="btn-sm sun" href="../services.html">See the services</a></article>' +
      '<article class="acad-card green"><p class="eyebrow">Replays</p><h2>Missed a session?</h2><p>Every House Session and Round is recorded and lands here within a day.</p><p class="muted-l">No replays yet. The first ones arrive after the first live session.</p></article></div>' +
      '<h2 class="sec-t">The Money Side · lessons</h2><div class="lessons">' + LESSONS.map(function (l) {
        return '<details class="lesson"' + (l[4] ? "" : "") + '><summary><span class="lk">' + l[0] + '</span><span><b>' + esc(l[2]) + "</b><small>" + esc(l[1]) + (l[4] ? " · ready" : " · coming in the founding season") + "</small></span></summary><p>" + esc(l[3]) + "</p>" +
          (l[4] ? '<p><a class="link-arrow" href="#/splitsheet/blank">Open the split sheet template →</a></p>' : "") + "</details>";
      }).join("") + "</div>" + Room.slot("academy.after", {});
  }

  function viewMe() {
    var me = db.me();
    var opts = function (list, chosen) { return list.map(function (x) { return '<label class="tick"><input type="checkbox" name="roles" value="' + esc(x) + '"' + ((chosen || []).indexOf(x) !== -1 ? " checked" : "") + "> " + esc(x) + "</label>"; }).join(""); };
    return '<div class="page-h"><p class="eyebrow">Your profile</p><h1>' + esc(me.name) + '</h1><p class="lead"><a href="#/m/' + esc(me.id) + '">See your profile as others see it →</a></p></div>' +
      '<form class="panel me-form" data-form="me"><div class="photo-row">' + avatar(me, 96) + '<label class="btn-sm">Change photo<input type="file" accept="image/*" id="photoIn" hidden></label>' + (me.photo ? '<button type="button" class="link" data-act="photo-clear">Remove</button>' : "") + "</div>" +
      '<label>Name<input name="name" value="' + esc(me.name) + '" required maxlength="60"></label>' +
      '<label>City (puts your pin on the map)<select name="city"><option value="">Choose…</option>' + Room.CITIES.map(function (c) { return '<option' + (c.name === me.city ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("") + "</select></label>" +
      '<fieldset><legend>What you bring to a room</legend><div class="ticks-row">' + opts(Room.ROLES, me.roles) + "</div></fieldset>" +
      '<label>Languages you write in<input name="languages" value="' + esc((me.languages || []).join(", ")) + '" placeholder="Filipino, English, Taglish"></label>' +
      '<label>Your sounds<input name="sounds" value="' + esc((me.sounds || []).join(", ")) + '" placeholder="OPM, ballad, R&B"></label>' +
      '<label>About you<textarea name="bio" rows="3" maxlength="400" placeholder="One or two lines: what you write and what you want from the room">' + esc(me.bio) + "</textarea></label>" +
      '<label>A link to your music<input name="link" type="url" value="' + esc(me.link) + '" placeholder="https://"></label>' +
      '<label class="switch"><input type="checkbox" name="openToWrite"' + (me.openToWrite ? " checked" : "") + '><span></span> Open to write (shows on your card and in the Pairing)</label>' +
      '<div class="row"><button class="btn-sm solid">Save profile</button><button type="button" class="link" data-act="signout">Sign out</button></div></form>' + Room.slot("me.after", me);
  }

  function viewWelcome() {
    return '<section class="gate"><div class="gate-card"><svg width="52" height="44" viewBox="0 0 26 22" aria-hidden="true"><g stroke="currentColor" stroke-width="1.4"><path d="M0 2h26M0 6.5h26M0 11h26M0 15.5h26M0 20h26"/></g><circle cx="17" cy="11" r="3.6" fill="var(--accent)"/></svg>' +
      '<p class="eyebrow sun">Gising Sining House · the Room</p><h1>Come in.</h1><p class="demo-only">This is a working demo of the members\' room. Make a profile and look around: post to the prompt, give notes, join the Pairing, open a writing room. Nothing leaves this browser.</p>' +
      '<form data-form="signup"><label>Your name<input name="name" required maxlength="60" autocomplete="name"></label><label>Your city<select name="city"><option value="">Choose…</option>' +
      Room.CITIES.map(function (c) { return "<option>" + esc(c.name) + "</option>"; }).join("") + '</select></label><button class="btn-sm sun big">Enter the room</button></form>' +
      '<div class="sample-logins"><p class="eyebrow">Or sign in as a sample account</p>' +
      '<button class="btn-sm" data-act="as" data-id="mara">' + avatar(db.member("mara"), 26) + ' Mara · member</button>' +
      '<button class="btn-sm" data-act="as" data-id="darryl">' + avatar(db.member("darryl"), 26) + ' Darryl · host, with admin</button>' +
      '<button class="btn-sm" data-act="as" data-id="paul">' + avatar(db.member("paul"), 26) + ' Paul · visiting mentor</button>' +
      '<button class="btn-sm" data-act="as" data-id="lia">' + avatar(db.member("lia"), 26) + ' Lia · member aged 17</button></div>' + Room.slot("welcome.after", {}) + "</div></section>";
  }


  // ---------- admin (host and mentors) ----------
  function isStaff() { var m = db.me(); return !!(m && (m.host || m.mentor)); }
  function regionOf(m) { var c = db.city(m.city); return c ? (H.regionFor ? H.regionFor(c.country) : null) : null; }
  function buildGroups() {
    var s = db.state, ids = s.pairing.others.slice();
    if (s.pairing.optIn && s.me && ids.indexOf(s.me) === -1) ids.push(s.me);
    var prod = ids.filter(function (id) { return ((db.member(id) || {}).roles || []).indexOf("Production") !== -1; });
    var rest = ids.filter(function (id) { return prod.indexOf(id) === -1; });
    var groups = [];
    while (prod.length + rest.length >= 3) {
      var g = [];
      if (prod.length) g.push(prod.shift());
      while (g.length < 3 && rest.length) g.push(rest.shift());
      while (g.length < 3 && prod.length) g.push(prod.shift());
      groups.push(g);
    }
    var left = prod.concat(rest);
    if (left.length && groups.length) left.forEach(function (id, i) { groups[i % groups.length].push(id); });
    s.pairing.groups = groups.map(function (g, i) {
      var rid = db.openRoom(g, "Pairing · group " + (i + 1)); db.room(rid).brief = BRIEFS[i % BRIEFS.length]; return rid;
    });
    db.save();
  }
  function exportCsv() {
    var rows = [["Name", "City", "Country", "Roles", "Languages", "Joined", "Open to write"]].concat(db.state.members.map(function (m) {
      var c = db.city(m.city) || {};
      return [m.name, m.city, c.country || "", (m.roles || []).join("; "), (m.languages || []).join("; "), new Date(m.joined).toISOString().slice(0, 10), m.openToWrite ? "yes" : "no"];
    }));
    var csv = rows.map(function (r) { return r.map(function (x) { return '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"'; }).join(","); }).join("\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "gising-sining-members.csv"; a.click();
  }
  function viewAdmin(tab) {
    tab = tab || "overview";
    var s = db.state, me = db.me(), ws = weekStart(Date.now()), now = Date.now();
    var tabs = [["overview", "Overview"], ["members", "Members"], ["prodesk", "Pro Desk"], ["pairing", "The Pairing"], ["feed", "Feed"], ["sessions", "Sessions"]]
      .concat(Room.adminTabs.filter(function (t) { return Room.flag(t.flag); }).map(function (t) { return [t.id, t.label]; }));
    var head = '<div class="page-h"><p class="eyebrow">Gising Sining House · admin</p><h1>Admin</h1><p class="lead">Signed in as ' + esc(me.name) + (me.host ? " (host)" : " (visiting mentor)") + '. In demo mode this works on the sample data in this browser; live, the same screens read the real database.</p></div>' +
      '<div class="admin-tabs">' + tabs.map(function (t) { return '<a class="chip big' + (tab === t[0] ? " on" : "") + '" href="#/admin/' + t[0] + '">' + t[1] + "</a>"; }).join("") + "</div>";
    var body = "";
    if (tab === "overview") {
      var joinedWeek = s.members.filter(function (m) { return m.joined >= ws; }).length;
      var postsWeek = s.posts.filter(function (p) { return p.at >= ws; }).length;
      var notesWeek = 0; s.posts.forEach(function (p) { p.notes.forEach(function (n) { if (n.at >= ws) notesWeek++; }); });
      var openPd = s.prodesk.filter(function (p) { return p.status !== "Notes back"; }).length;
      var byCountry = {}; s.members.forEach(function (m) { var c = (db.city(m.city) || {}).country || "No city yet"; byCountry[c] = (byCountry[c] || 0) + 1; });
      var countries = Object.keys(byCountry).sort(function (a, b) { return byCountry[b] - byCountry[a]; });
      var maxC = byCountry[countries[0]] || 1;
      var camp = H.camp01 || { tiers: [] };
      body = '<div class="kpis">' + [[s.members.length, "members"], [joinedWeek, "joined this week"], [postsWeek, "posts this week"], [notesWeek, "notes given this week"],
        [s.pairing.others.length + (s.pairing.optIn ? 1 : 0), "in this week's Pairing"], [openPd, "Pro Desk songs waiting"]].map(function (k) { return '<div class="kpi"><b>' + k[0] + "</b><span>" + k[1] + "</span></div>"; }).join("") + "</div>" +
        '<div class="admin-grid"><section class="panel"><h2>Where members are</h2><div class="bars">' + countries.map(function (c) {
          return '<div class="bar-row"><span>' + esc(c) + '</span><i style="--w:' + Math.round(100 * byCountry[c] / maxC) + '%"></i><b>' + byCountry[c] + "</b></div>";
        }).join("") + '</div></section><section class="panel"><h2>To do</h2><ul class="todo">' +
        '<li><a href="#/admin/prodesk">' + openPd + " Pro Desk song" + (openPd === 1 ? "" : "s") + " need notes</a></li>" +
        '<li><a href="#/admin/pairing">Build this week\'s Pairing groups (' + (s.pairing.groups.length ? "done" : "not yet") + ")</a></li>" +
        '<li><a href="#/admin/sessions">' + (safeUrl(s.callLinks["House Session"]) ? "House Session call link is set" : "Add the House Session call link") + "</a></li>" +
        '<li><a href="#/admin/feed">Post this week\'s prompt announcement</a></li></ul>' +
        '<h2 style="margin-top:12px">Camp 01 places</h2>' + (camp.tiers || []).map(function (t) { return '<p class="mono">' + esc(t.name) + ": " + t.taken + " of " + t.places + " taken</p>"; }).join("") +
        '<p class="muted small">Camp applications arrive in GoHighLevel. Update "taken" in config.js as places are confirmed.</p></section></div>';
    }
    if (tab === "members") {
      body = '<div class="panel"><div class="panel-h"><h2>' + s.members.length + ' members</h2><button class="btn-sm" data-act="csv">Export CSV</button></div><div class="tbl-wrap"><table class="admin-t"><thead><tr><th>Member</th><th>City</th><th>Brings</th><th>Joined</th><th>Region</th><th>Status</th></tr></thead><tbody>' +
        s.members.slice().sort(function (a, b) { return b.joined - a.joined; }).map(function (m) {
          var r = regionOf(m);
          return '<tr><td><a class="mini-member" href="#/m/' + esc(m.id) + '">' + avatar(m, 30) + "<span><b>" + esc(m.name) + "</b></span></a></td><td>" + esc(m.city || "–") + "</td><td>" + esc((m.roles || []).join(", ") || "–") + "</td><td>" + ago(m.joined) + "</td><td>" + esc(r ? r.name : "–") + "</td><td>" +
            (m.host ? '<span class="chip host">Host</span>' : m.mentor ? '<span class="chip host">Mentor</span>' : m.founding ? '<span class="chip">Founding</span>' : "") + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";
    }
    if (tab === "prodesk") {
      body = '<div class="panel"><h2>Pro Desk queue</h2><p class="muted">One song a month per member. Notes go back in the works · try · question shape and appear in the member\'s Academy.</p>' +
        (s.prodesk.length ? s.prodesk.map(function (p) {
          var m = db.member(p.by) || { name: "Member", id: "x" }, done = p.status === "Notes back";
          return '<div class="pd-item"><div class="pd-h">' + avatar(m, 36) + "<div><b>" + esc(p.title) + "</b><span>" + esc(m.name) + " · " + ago(p.at) + "</span></div>" +
            '<span class="chip ' + (done ? "" : "green") + '">' + esc(p.status) + "</span>" + (safeUrl(p.link) ? '<a class="listen" href="' + esc(p.link) + '" target="_blank" rel="noopener">▶ Listen</a>' : "") +
            (done ? "" : '<button class="btn-sm solid" data-act="pd-open" data-id="' + esc(p.id) + '">Write notes</button>') + "</div>" +
            (done ? '<p class="muted small">Works: ' + esc(p.notes.works) + " · Try: " + esc(p.notes.tryit) + " · Question: " + esc(p.notes.question) + "</p>" :
              '<form class="note-form" data-form="pd-notes" data-id="' + esc(p.id) + '" hidden><label>One thing that works<input name="works" required></label><label>One thing to try<input name="tryit" required></label><label>One question<input name="question" required></label><button class="btn-sm solid">Send notes</button></form>') + "</div>";
        }).join("") : '<p class="empty">Nothing in the queue.</p>') + "</div>";
    }
    if (tab === "pairing") {
      var ins = s.pairing.others.concat(s.pairing.optIn && s.pairing.others.indexOf(s.me) === -1 ? [s.me] : []);
      body = '<div class="admin-grid"><section class="panel"><h2>In this week (' + ins.length + ")</h2>" + ins.map(function (id) { var m = db.member(id); return '<div class="mini-member">' + avatar(m, 30) + "<span><b>" + esc(m.name) + "</b>" + esc((m.roles || []).join(", ")) + " · " + esc(m.city || "") + "</span></div>"; }).join("") +
        '<p class="muted small">Live, groups go out automatically every Tuesday at 09:00 Manila. Here you can build them by hand.</p><button class="btn-sm solid" data-act="build-groups">' + (s.pairing.groups.length ? "Rebuild groups" : "Build groups now") + "</button></section>" +
        '<section class="panel"><h2>Groups</h2>' + (s.pairing.groups.length ? s.pairing.groups.map(function (rid, i) {
          var r = db.room(rid); if (!r) return "";
          return '<div class="grp"><p class="eyebrow">Group ' + (i + 1) + '</p><p>' + r.writers.map(function (w) { return esc((db.member(w) || {}).name); }).join(", ") + '</p><p class="muted small">' + esc(r.brief || "") + '</p><a class="link-arrow" href="#/write/' + esc(rid) + '">Open the writing room →</a></div>';
        }).join("") : '<p class="empty">Not built yet.</p>') + "</section></div>";
    }
    if (tab === "feed") {
      body = '<form class="panel" data-form="announce"><h2>Announcement</h2><p class="muted">Pinned to the top of the feed, and every member gets a notification.</p><textarea name="body" rows="3" required maxlength="1000" placeholder="This week\'s prompt is live…" aria-label="Announcement"></textarea><button class="btn-sm solid">Announce</button></form>' +
        '<div class="panel" style="margin-top:16px"><h2>Recent posts</h2><div class="tbl-wrap"><table class="admin-t"><tbody>' + s.posts.slice().sort(function (a, b) { return b.at - a.at; }).slice(0, 25).map(function (p) {
          var a = db.member(p.author) || { name: "Former member" };
          return "<tr><td><b>" + esc(a.name) + '</b><br><span class="muted small">' + esc(CAT[p.cat] || p.cat) + " · " + ago(p.at) + "</span></td><td>" + esc(p.body.slice(0, 110)) + (p.body.length > 110 ? "…" : "") + '</td><td class="nowrap"><button class="btn-sm" data-act="pin" data-id="' + esc(p.id) + '">' + (p.pinned ? "Unpin" : "Pin") + '</button> <button class="btn-sm danger" data-act="remove-post" data-id="' + esc(p.id) + '">Remove</button></td></tr>';
        }).join("") + "</tbody></table></div></div>";
    }
    if (tab === "sessions") {
      var evs = liveEvents(28);
      body = '<div class="admin-grid"><form class="panel" data-form="calls"><h2>Call links</h2><p class="muted">Members see a "Join the call" button on the calendar while a session is live.</p>' +
        '<label>House Session (Zoom, Meet…)<input name="c0" value="' + esc(s.callLinks["House Session"]) + '" placeholder="https://"></label>' +
        '<label>The Round<input name="c1" value="' + esc(s.callLinks["The Round"]) + '" placeholder="https://"></label><button class="btn-sm solid">Save links</button></form>' +
        '<section class="panel"><h2>Next four weeks</h2>' + evs.map(function (e) {
          var n = Object.keys(s.rsvps).filter(function (k) { return k === e.key; }).length;
          return '<div class="sess"><b>' + esc(e.title) + '</b><span class="mono">' + esc(fmtManila(e.start)) + "</span><span class=\"muted small\">" + n + " seat" + (n === 1 ? "" : "s") + " saved in this browser</span></div>";
        }).join("") + '<p class="muted small">The weekly schedule is set in config.js (room.schedule).</p></section></div>';
    }
    var ext = Room.adminTabs.filter(function (t) { return t.id === tab && Room.flag(t.flag); })[0];
    if (ext) { try { body = ext.render(); } catch (err) { console.error(err); body = '<p class="empty">This tab hit an error.</p>'; } }
    return head + body;
  }

  // In live (GHL) mode the feed, calendar and courses live in GHL Communities; the app links straight there.
  function viewCommunity(r) {
    var url = (H.ghl && H.ghl.communityUrl) || "";
    var what = { feed: ["The feed", "Posts, the weekly prompt, the Feedback Room, the Cowrite Board and Wins"], calendar: ["The calendar", "House Sessions, Rounds and events, with reminders"], academy: ["The Academy", "Lessons, replays and the Money Side"] }[r] || ["The Room", ""];
    return '<section class="community-link panel"><p class="eyebrow">In the Room on GHL</p><h1>' + what[0] + ' lives in the Room.</h1><p>' + esc(what[1]) + '. Open it in the Gising Sining House community app or your browser.</p>' +
      (url ? '<a class="btn-sm solid big" href="' + esc(url) + '" target="_blank" rel="noopener">Open the Room</a>' : '<p class="muted">The community link isn\'t set yet (config.js → ghl.communityUrl).</p>') +
      '<p class="muted small">House tools (the Pairing, writing rooms, ownership forms, the 5 Keys and the Pro Desk) stay here.</p></section>' + Room.slot(r + ".after", {});
  }
  // ---------- router ----------
  var TITLES = { admin: "Admin", feed: "Feed", calendar: "Calendar", cowrites: "Cowrites", write: "Writing room", members: "Members", m: "Profile", map: "Member map", stave: "The 5 Keys", academy: "Academy", me: "Your profile", splitsheet: "Split sheet" };
  function route() {
    tickers.forEach(clearInterval); tickers = [];
    if (map) { map.remove(); map = null; }
    var parts = (location.hash || "#/feed").slice(2).split("/"), r = parts[0] || "feed", arg = decodeURIComponent(parts[1] || "");
    // Direct sample sign-in links: #/as/mara, #/as/darryl, #/as/paul, #/as/lia (aged 17)
    if (r === "as" && db.member(arg)) { db.state.me = arg; db.save(); location.replace("#/" + (arg === "darryl" ? "admin" : "feed")); return; }
    var signedIn = !!db.me();
    document.body.classList.toggle("signed-out", !signedIn);
    document.body.classList.toggle("is-staff", signedIn && isStaff());
    $$("[data-nav]").forEach(function (a) { a.classList.toggle("on", a.dataset.nav === (r === "m" ? "members" : r === "write" ? "cowrites" : r)); a.setAttribute("aria-current", a.classList.contains("on") ? "page" : "false"); });
    if (!signedIn) { view.innerHTML = viewWelcome(); $("#topTitle").textContent = "The Room"; return; }
    var ext = Room.routes[r] && Room.flag(Room.routes[r].flag) ? Room.routes[r] : null;
    $("#topTitle").textContent = ext ? ext.title : (TITLES[r] || "The Room");
    $("#meAvatar").innerHTML = avatar(db.me(), 40);
    syncNav();
    var html = ext ? ext.render(arg, parts) : Room.mode === "ghl" && (r === "feed" || r === "calendar") ? viewCommunity(r) : r === "calendar" ? viewCalendar(arg) : r === "cowrites" ? viewCowrites() : r === "write" ? viewWrite(arg) : r === "members" ? viewMembers() :
      r === "m" ? viewProfile(arg) : r === "map" ? viewMap() : r === "stave" ? viewStave() : r === "academy" ? viewAcademy() : r === "me" ? viewMe() :
      r === "splitsheet" ? viewSplitSheet(arg) : r === "admin" ? (isStaff() ? viewAdmin(arg) : '<p class="empty">The admin area is for the host and mentors.</p>') : viewFeed(arg);
    view.innerHTML = html;
    document.body.classList.toggle("print-sheet", r === "splitsheet");
    if (r === "map") drawMap();
    if (ext && ext.after) { try { ext.after(arg, parts); } catch (err) { console.error(err); } }
    Room.afterRender.forEach(function (fn) { try { fn(r, arg); } catch (err) { console.error(err); } });
    if (window.Flags) window.Flags.apply(view);
    bell(false);
    window.scrollTo(0, 0);
  }
  Room.route = route;

  // side menu: feature nav items appear only when their flag is on (and staff-only items for the host and mentors)
  function syncNav() {
    var side = $(".side"), gap = $(".side-gap");
    Room.navItems.forEach(function (it) {
      var a = side.querySelector('[data-nav="' + it.id + '"]');
      if (!a) {
        a = document.createElement("a"); a.href = it.href || "#/" + it.id; a.dataset.nav = it.id;
        a.innerHTML = '<svg viewBox="0 0 24 24">' + (it.icon || '<circle cx="12" cy="12" r="8"/>') + "</svg><span>" + esc(it.label) + "</span>";
        side.insertBefore(a, gap);
      }
      a.hidden = !Room.flag(it.flag) || (it.staff && !isStaff());
    });
  }

  // ---------- notifications ----------
  function bell(open) {
    var s = db.state, unread = s.notifications.filter(function (n) { return !n.read; }).length, panel = $("#bellPanel");
    $("#bellDot").hidden = !unread;
    if (open === undefined) open = panel.hidden;
    panel.hidden = !open; $("#bellBtn").setAttribute("aria-expanded", open);
    if (open) {
      panel.innerHTML = '<p class="eyebrow">Notifications</p>' + (s.notifications.length ? s.notifications.slice(0, 12).map(function (n) {
        return '<a class="notif' + (n.read ? "" : " new") + '" href="' + esc(n.href) + '">' + esc(n.text) + "<span>" + ago(n.at) + "</span></a>";
      }).join("") : '<p class="muted">Nothing yet.</p>');
      db.markAllRead(); $("#bellDot").hidden = true;
    }
  }

  // ---------- events ----------
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!e.target.closest(".bell-wrap") && !$("#bellPanel").hidden) bell(false);
    if (!b) return;
    var act = b.dataset.act, id = b.dataset.id, key = b.dataset.key, s = db.state;
    if (Room.acts[act]) { Room.acts[act](b, { id: id, key: key, state: s, event: e }); return; }
    if (act === "feel") { db.toggleFeel(id); var p = db.post(id); b.classList.toggle("on"); b.firstChild.nodeValue = "♥ " + (p.feels.length || "") + " "; return; }
    if (act === "note-open") { var f = $('form[data-form="note"][data-id="' + id + '"]'); f.hidden = !f.hidden; if (!f.hidden) f.querySelector("input").focus(); return; }
    if (act === "hide-checklist") { s.checklistHidden = true; db.save(); route(); return; }
    if (act === "rsvp") { var on = !s.rsvps[key]; db.rsvp(key, on); toast(on ? "Seat saved. It's on your calendar here." : "Seat released."); route(); return; }
    if (act === "played") { db.markPlayed(key); toast("Nice. That's a tick on B · Book."); route(); return; }
    if (act === "ics") { downloadIcs(key); return; }
    if (act === "optin") { s.pairing.optIn = b.checked; if (!b.checked) { s.pairing.room = null; s.pairing.week = null; } db.save(); toast(b.checked ? "You're in. Your group is ready below." : "You're out this week. No problem."); route(); return; }
    if (act === "open-time-toggle") { var of = $('form[data-form="opentime"]'); of.hidden = !of.hidden; return; }
    if (act === "book") { var rid = db.bookOpenTime(id); toast("Booked. Your writing room is open."); location.hash = "#/write/" + rid; return; }
    if (act === "new-room") { location.hash = "#/write/" + db.openRoom([s.me], "Untitled song"); return; }
    if (act === "write-with") { location.hash = "#/write/" + db.openRoom([s.me, id], "Cowrite with " + first(db.member(id).name)); return; }
    if (act === "sign") { db.room(id).signed[s.me] = true; db.save(); toast("Signed. You keep all of your writer's share."); route(); return; }
    if (act === "sign-others") { var rm = db.room(id); rm.writers.forEach(function (w) { rm.signed[w] = true; }); db.save(); route(); return; }
    if (act === "self") { s.selfMilestones[id] = b.checked; db.save(); route(); return; }
    if (act === "print") { window.print(); return; }
    if (act === "photo-clear") { db.updateMe({ photo: "" }); route(); return; }
    if (act === "signout") { db.signOut(); location.hash = "#/feed"; route(); return; }
    if (act === "as") { s.me = id; db.save(); location.hash = id === "darryl" ? "#/admin" : "#/feed"; route(); return; }
    if (act === "switch") { s.me = null; db.save(); location.hash = "#/feed"; route(); return; }
    if (act === "pin") { var pp = db.post(id); pp.pinned = !pp.pinned; db.save(); toast(pp.pinned ? "Pinned to the top of the feed." : "Unpinned."); route(); return; }
    if (act === "remove-post") { if (confirm("Remove this post from the room?")) { s.posts = s.posts.filter(function (x) { return x.id !== id; }); db.save(); toast("Post removed."); route(); } return; }
    if (act === "build-groups") { buildGroups(); toast("Groups built. Writing rooms opened for each one."); route(); return; }
    if (act === "csv") { exportCsv(); return; }
    if (act === "pd-open") { var pf = $('form[data-form="pd-notes"][data-id="' + id + '"]'); pf.hidden = !pf.hidden; return; }
  });
  $("#bellBtn").addEventListener("click", function () { bell(); });
  $("#resetDemo").addEventListener("click", function () { if (confirm("Reset the demo? Everything you've done here is cleared.")) { db.reset(); location.hash = "#/feed"; route(); } });

  document.addEventListener("submit", function (e) {
    var f = e.target, kind = f.dataset.form; if (!kind) return;
    e.preventDefault();
    var v = function (n) { return f.elements[n] ? String(f.elements[n].value || "").trim() : ""; };
    var s = db.state;
    if (Room.forms[kind]) { Room.forms[kind](f, v); return; }
    if (kind === "signup") { if (!v("name")) return; db.signUp({ name: v("name"), city: v("city") }); location.hash = "#/feed"; route(); return; }
    if (kind === "post") {
      if (!v("body")) return;
      if (v("link") && !safeUrl(v("link"))) { toast("Links need to start with https://"); return; }
      db.addPost({ cat: v("cat"), body: v("body"), link: v("link") }); toast("Posted."); location.hash = "#/feed/" + v("cat"); route(); return;
    }
    if (kind === "comment") { if (!v("body")) return; db.addComment(f.dataset.id, v("body")); route(); setTimeout(function () { var el = $("#post-" + f.dataset.id); if (el) el.scrollIntoView({ block: "center" }); }, 0); return; }
    if (kind === "note") { db.addNote(f.dataset.id, { works: v("works"), tryit: v("tryit"), question: v("question") }); toast("Notes sent. That's one more on your G line."); route(); return; }
    if (kind === "opentime") {
      var at = new Date(v("at")).getTime(); if (!at || at < Date.now()) { toast("Pick a time in the future."); return; }
      db.addOpenTime({ at: at, mins: +v("mins"), note: v("note") }); toast("Posted. Anyone in the room can book it."); route(); return;
    }
    if (kind === "room-post") {
      var r = db.room(f.dataset.id);
      if (v("link") && !safeUrl(v("link"))) { toast("Links need to start with https://"); return; }
      db.addPost({ cat: "feedback", body: "\"" + r.title + "\", a new song by " + r.writers.map(function (w) { return db.member(w).name; }).join(", ") + ". Notes welcome.", link: v("link") });
      toast("Posted to the Feedback Room."); location.hash = "#/feed/feedback"; return;
    }
    if (kind === "announce") {
      if (!v("body")) return;
      s.posts.unshift({ id: "p" + Date.now(), author: s.me, cat: "general", at: Date.now(), body: v("body"), link: "", feels: [], comments: [], notes: [], pinned: true });
      db.notify("Announcement from " + first(db.me().name) + ": " + v("body").slice(0, 80), "#/feed");
      db.save(); toast("Announced and pinned to the feed. Every member gets a notification."); route(); return;
    }
    if (kind === "pd-notes") {
      var pd = s.prodesk.filter(function (x) { return x.id === f.dataset.id; })[0];
      pd.notes = { works: v("works"), tryit: v("tryit"), question: v("question"), by: s.me }; pd.status = "Notes back";
      db.save(); toast("Notes sent to " + first((db.member(pd.by) || {}).name) + "."); route(); return;
    }
    if (kind === "calls") {
      ["House Session", "The Round"].forEach(function (k, i) { var u = v("c" + i); if (u && !safeUrl(u)) return; s.callLinks[k] = u; });
      db.save(); toast("Call links saved. Members see a Join button when a session is live."); route(); return;
    }
    if (kind === "prodesk") {
      if (!safeUrl(v("link"))) { toast("Links need to start with https://"); return; }
      s.prodesk.unshift({ id: "pd" + Date.now(), by: s.me, title: v("title"), link: v("link"), at: Date.now(), status: "With a mentor", month: new Date().getFullYear() + "-" + new Date().getMonth() });
      db.save(); toast("Sent to the Pro Desk."); route(); return;
    }
    if (kind === "me") {
      if (v("link") && !safeUrl(v("link"))) { toast("Links need to start with https://"); return; }
      var list = function (x) { return x.split(",").map(function (y) { return y.trim(); }).filter(Boolean); };
      db.updateMe({ name: v("name") || db.me().name, city: v("city"), bio: v("bio"), link: v("link"), languages: list(v("languages")), sounds: list(v("sounds")),
        roles: $$('input[name="roles"]:checked', f).map(function (x) { return x.value; }), openToWrite: f.elements.openToWrite.checked });
      toast("Profile saved."); route(); return;
    }
  });

  // live search + room autosave + photo upload
  var saveT;
  document.addEventListener("input", function (e) {
    var t = e.target;
    for (var i = 0; i < Room.inputs.length; i++) { if (Room.inputs[i](e)) return; }
    if (t.id === "mSearch") { $("#mGrid").innerHTML = filterMembers(t.value).map(memberCard).join("") || '<p class="empty">No one matches that yet.</p>'; return; }
    if (t.dataset.field && t.dataset.id) {
      var r = db.room(t.dataset.id); r[t.dataset.field] = t.value;
      clearTimeout(saveT); saveT = setTimeout(function () { db.save(); var sv = $("#saved"); if (sv) sv.textContent = "Saved " + new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }, 400);
    }
  });
  document.addEventListener("change", function (e) {
    if (e.target.id !== "photoIn" || !e.target.files[0]) return;
    var img = new Image(), rd = new FileReader();
    rd.onload = function () { img.src = rd.result; };
    img.onload = function () {
      var c = document.createElement("canvas"), sz = 256, sc = Math.max(sz / img.width, sz / img.height);
      c.width = c.height = sz;
      c.getContext("2d").drawImage(img, (sz - img.width * sc) / 2, (sz - img.height * sc) / 2, img.width * sc, img.height * sc);
      db.updateMe({ photo: c.toDataURL("image/jpeg", 0.82) }); toast("Photo added."); route();
    };
    rd.readAsDataURL(e.target.files[0]);
  });

  function downloadIcs(key) {
    var e = liveEvents(42).filter(function (x) { return x.key === key; })[0]; if (!e) return;
    var f = function (ms) { return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""); };
    var ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Gising Sining House//The Room//EN", "BEGIN:VEVENT", "UID:" + key.replace(/\W/g, "") + "@harana", "DTSTAMP:" + f(Date.now()),
      "DTSTART:" + f(e.start), "DTEND:" + f(e.start + e.mins * 60e3), "SUMMARY:Gising Sining House · " + e.title, "DESCRIPTION:" + e.text, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" })); a.download = "gising-sining-" + e.type.toLowerCase().replace(/\W+/g, "-") + ".ics"; a.click();
  }

  window.addEventListener("hashchange", route);
  Promise.all([window.Flags ? window.Flags.ready : null, Room.ready]).then(boot, boot);
  function boot() { route(); upnext(); setInterval(upnext, 1000); }
})();
