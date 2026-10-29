// Feature: direct messages (flag "messages"). One-to-one and small-group threads, unread counts, blocking.
// Demo: threads live in Room.store("messages"). Live (GHL): /api/state keeps each thread as its own House record
// and only sends a member the threads they're in (state.mjs, "Messages").
// Writers aged 16 or 17 (terms.html#young): an adult can only be in a conversation with an under-18 member if
// they're the host or a mentor, and the host (the safeguarding lead) can read any conversation with an under-18 in it.
// The server applies the same rule (dmAllowed in state.mjs).
(function () {
  var FLAG = "messages";
  var H = function () { return Room.h; };
  var DAY = 864e5, HOUR = 3600e3;

  var mem = function (id) { return Room.db.member(id) || {}; };
  var staffM = function (m) { return !!(m.host || m.mentor); };
  // Same rule as the server: if anyone in the conversation is under 18, every adult in it must be the host or a mentor.
  function allowed(ids) {
    var ms = ids.map(mem);
    if (!ms.some(function (m) { return m.under18; })) return true;
    return ms.every(function (m) { return m.under18 || staffM(m); });
  }
  var hasMinor = function (t) { return t.members.some(function (id) { return mem(id).under18; }); };
  var RULE = "Members under 18 can message each other, the host and mentors. Other adults can't message them privately.";

  function st() {
    var s = Room.store("messages", { threads: [], blocked: {}, seeded: false });
    if (Room.mode === "ghl") return s; // live: the server sends only your threads; no sample threads
    if (!s.seeded) {
      var now = Date.now();
      s.threads.push({ id: "t1", members: ["mara", "jun"], name: "", read: { mara: now, jun: now - HOUR }, msgs: [
        { by: "jun", at: now - 26 * HOUR, body: "Saw your prompt song. Want to try a topline on my 98 bpm track this week?" },
        { by: "mara", at: now - 25 * HOUR, body: "Yes! Friday 8pm Manila works. Send the track?" },
        { by: "jun", at: now - 24 * HOUR, body: "Sending now. Pre-chorus is wide open, go wild." }] });
      s.threads.push({ id: "t2", members: ["ayu", "kenji", "sofia"], name: "Jakarta cut", read: { ayu: now, kenji: now, sofia: now - 3 * HOUR }, msgs: [
        { by: "ayu", at: now - 9 * HOUR, body: "The artist wants a slightly shorter bridge. Can we fix it Thursday?" },
        { by: "kenji", at: now - 8 * HOUR, body: "I can cut a new instrumental Wednesday night." },
        { by: "sofia", at: now - 7 * HOUR, body: "I'll bring two bridge options. Same split sheet still applies." }] });
      s.seeded = true; Room.save();
    }
    var me = Room.db.state.me;
    if (me && !s.threads.some(function (t) { return t.welcome === me; }) && me !== "darryl") {
      s.threads.push({ id: "tw-" + me, welcome: me, members: ["darryl", me], name: "", read: {}, msgs: [
        { by: "darryl", at: Date.now() - 2 * HOUR, body: "Welcome to the house. If anything's unclear, or you want help finding cowriters, message me here any time." }] });
      Room.save();
    }
    return s;
  }
  var blockedBy = function (who) { return st().blocked[who] || []; };
  // Your threads. The host also sees conversations that include an under-18 member (read-only unless they're in it).
  function mine() {
    var me = Room.db.state.me, host = mem(me).host;
    return st().threads.filter(function (t) { return t.members.indexOf(me) !== -1 || (host && hasMinor(t)); })
      .sort(function (a, b) { return last(b).at - last(a).at; });
  }
  var last = function (t) { return t.msgs[t.msgs.length - 1] || { at: 0, body: "" }; };
  function unread(t) {
    var me = Room.db.state.me, seen = (t.read || {})[me] || 0;
    return t.msgs.filter(function (m) { return m.by !== me && m.at > seen; }).length;
  }
  function totalUnread() { var me = Room.db.state.me; return mine().reduce(function (n, t) { return n + (t.members.indexOf(me) !== -1 ? unread(t) : 0); }, 0); }
  function title(t) {
    var me = Room.db.state.me;
    if (t.name) return t.name;
    return t.members.filter(function (id) { return id !== me; }).map(function (id) { return (Room.db.member(id) || { name: "Member" }).name; }).join(", ");
  }
  function others(t) { var me = Room.db.state.me; return t.members.filter(function (id) { return id !== me; }); }

  function render(arg) {
    var h = H(), esc = h.esc, me = Room.db.state.me, list = mine();
    var t = list.filter(function (x) { return x.id === arg; })[0];
    if (arg === "new") t = null;
    if (t) { t.read = t.read || {}; t.read[me] = Date.now(); Room.save(); }
    var myBlocks = blockedBy(me);
    var listHtml = list.length ? list.map(function (x) {
      var u = unread(x), o = others(x);
      return '<a class="dm-item' + (t && t.id === x.id ? " on" : "") + '" href="#/messages/' + esc(x.id) + '">' +
        '<span class="dm-avs">' + o.slice(0, 2).map(function (id) { return h.avatar(Room.db.member(id), 34); }).join("") + "</span>" +
        "<span class=\"dm-txt\"><b>" + esc(title(x)) + (x.members.indexOf(me) === -1 ? ' <span class="chip">Safeguarding view</span>' : "") + "</b><small>" + esc(last(x).body.slice(0, 60)) + "</small></span>" +
        '<span class="dm-meta"><small>' + h.ago(last(x).at) + "</small>" + (u ? '<i class="dm-badge">' + u + "</i>" : "") + "</span></a>";
    }).join("") : '<p class="empty">No conversations yet.</p>';

    var convo;
    if (t) {
      var inIt = t.members.indexOf(me) !== -1, ok = allowed(t.members);
      var o = others(t), single = o.length === 1, iBlocked = single && myBlocks.indexOf(o[0]) !== -1, theyBlocked = single && blockedBy(o[0]).indexOf(me) !== -1;
      convo = '<div class="dm-head"><div><h2>' + esc(title(t)) + '</h2><p class="muted small">' + (t.members.length > 2 ? t.members.length + " people" : "Private conversation") + "</p></div>" +
        (single ? '<button class="btn-sm' + (iBlocked ? "" : " danger") + '" data-act="dm-block" data-id="' + esc(o[0]) + '">' + (iBlocked ? "Unblock" : "Block") + "</button>" : "") + "</div>" +
        '<div class="dm-msgs" id="dmMsgs">' + t.msgs.map(function (m) {
          var mm = m.by === me;
          return '<div class="dm-msg' + (mm ? " mine" : "") + '">' + (mm ? "" : h.avatar(Room.db.member(m.by), 28)) + '<div><p class="dm-by">' + (mm ? "You" : esc((Room.db.member(m.by) || {}).name || "Member")) + " · " + h.ago(m.at) + "</p><p>" + esc(m.body).replace(/\n/g, "<br>") + "</p></div></div>";
        }).join("") + "</div>" +
        (hasMinor(t) ? '<p class="muted dm-note dm-safe">This conversation includes a member under 18. The host, as safeguarding lead, can read it.</p>' : "") +
        (!inIt ? '<p class="muted dm-note">You\'re seeing this as the safeguarding lead. Only the people in it can send messages.</p>' :
          !ok ? '<p class="muted dm-note">' + RULE + "</p>" :
          iBlocked ? '<p class="muted dm-note">You blocked ' + esc(title(t)) + ". Unblock to send messages.</p>" :
          theyBlocked ? '<p class="muted dm-note">You can\'t message this member.</p>' :
          '<form class="dm-send" data-form="dm-send" data-id="' + esc(t.id) + '"><label class="sr-only" for="dmBody">Message</label><textarea id="dmBody" name="body" rows="2" maxlength="2000" required placeholder="Write a message"></textarea><button class="btn-sm solid">Send</button></form>');
    } else {
      var pool = Room.db.state.members.filter(function (m) { return m.id !== me && myBlocks.indexOf(m.id) === -1 && blockedBy(m.id).indexOf(me) === -1 && allowed([me, m.id]); });
      var minorsHidden = Room.db.state.members.some(function (m) { return m.id !== me && !allowed([me, m.id]); });
      convo = '<form class="dm-new" data-form="dm-new"><h2>New conversation</h2><p class="muted">Pick one person, or up to five for a small group.' + (minorsHidden ? " " + RULE : "") + "</p>" +
        '<div class="dm-pick">' + pool.map(function (m) { return '<label class="tick"><input type="checkbox" name="to" value="' + esc(m.id) + '"> ' + esc(m.name) + "</label>"; }).join("") + "</div>" +
        '<label>Group name (optional)<input name="name" maxlength="60"></label><label>Message<textarea name="body" rows="3" maxlength="2000" required></textarea></label><button class="btn-sm solid">Start conversation</button></form>';
    }
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · messages</p><h1>Messages</h1></div>' +
      '<div class="dm-grid"><aside class="panel dm-list"><div class="panel-h"><h2>Conversations</h2><a class="btn-sm" href="#/messages/new">New</a></div>' + listHtml + "</aside>" +
      '<section class="panel dm-convo">' + convo + "</section></div>";
  }

  Room.registerRoute("messages", { title: "Messages", flag: FLAG, render: render, after: function () { var m = document.getElementById("dmMsgs"); if (m) m.scrollTop = m.scrollHeight; } });
  Room.addNav({ id: "messages", href: "#/messages", label: "Messages", flag: FLAG, icon: '<path d="M4 6h16v10H8l-4 4z"/><path d="M8 10h8M8 13h5"/>' });

  Room.addSlot("profile.actions", function (m) {
    if (m.id === Room.db.state.me || !allowed([Room.db.state.me, m.id])) return "";
    return '<button class="btn-sm" data-act="dm-to" data-id="' + H().esc(m.id) + '">Message</button>';
  }, FLAG);

  Room.onAct("dm-to", function (el, c) {
    var me = Room.db.state.me, s = st();
    if (blockedBy(c.id).indexOf(me) !== -1) { H().toast("You can't message this member."); return; }
    if (!allowed([me, c.id])) { H().toast(RULE); return; }
    var t = s.threads.filter(function (x) { return x.members.length === 2 && x.members.indexOf(me) !== -1 && x.members.indexOf(c.id) !== -1 && !x.name; })[0];
    if (!t) { t = { id: "t" + Date.now(), members: [me, c.id], name: "", read: {}, msgs: [] }; s.threads.push(t); Room.save(); }
    location.hash = "#/messages/" + t.id;
  });
  Room.onAct("dm-block", function (el, c) {
    var me = Room.db.state.me, s = st(), b = s.blocked[me] = s.blocked[me] || [], i = b.indexOf(c.id);
    if (i === -1) b.push(c.id); else b.splice(i, 1);
    Room.save(); H().toast(i === -1 ? "Blocked. They can't message you." : "Unblocked."); Room.rerender();
  });
  Room.onForm("dm-send", function (f, v) {
    var body = v("body"); if (!body) return;
    var t = st().threads.filter(function (x) { return x.id === f.dataset.id; })[0]; if (!t) return;
    if (t.members.indexOf(Room.db.state.me) === -1 || !allowed(t.members)) { H().toast(RULE); return; }
    t.msgs.push({ by: Room.db.state.me, at: Date.now(), body: body }); t.read = t.read || {}; t.read[Room.db.state.me] = Date.now();
    Room.save(); Room.rerender();
  });
  Room.onForm("dm-new", function (f, v) {
    var to = Array.prototype.map.call(f.querySelectorAll('input[name="to"]:checked'), function (x) { return x.value; });
    if (!to.length) { H().toast("Pick at least one person."); return; }
    if (to.length > 5) { H().toast("Small groups are up to five people."); return; }
    if (!allowed([Room.db.state.me].concat(to))) { H().toast(RULE); return; }
    var me = Room.db.state.me, t = { id: "t" + Date.now(), members: [me].concat(to), name: to.length > 1 ? v("name") : "", read: {}, msgs: [{ by: me, at: Date.now(), body: v("body") }] };
    t.read[me] = Date.now();
    st().threads.push(t); Room.save(); location.hash = "#/messages/" + t.id;
  });

  // unread badge on the nav item
  Room.onRender(function () {
    var a = document.querySelector('.side [data-nav="messages"] span'); if (!a) return;
    if (!Room.flag(FLAG) || !Room.db.state.me) return;
    var n = totalUnread();
    a.innerHTML = "Messages" + (n ? ' <i class="dm-badge">' + n + "</i>" : "");
  });
})();
