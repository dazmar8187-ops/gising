// Feature: Visiting mentor network (flag "mentor-network"). Mentor profiles with focus areas and availability (shown
// in Manila time and the member's own time), session requests, and the Pro Desk queue per mentor; the admin sets
// slots, assigns Pro Desk songs and accepts or declines requests.
// Data: Room.store("mentors", { profiles: { <id>: { focus, about, slots: [{ id, at, mins }] } }, requests: [], assign: { <prodeskId>: <mentorId> } }).
(function () {
  var R = window.Room, FLAG = "mentor-network";
  var H = function () { return R.h; };
  var DAY = 864e5, MNL = 8 * 3600e3;

  // next occurrence of weekday (0=Sun) at HH:MM Manila, plus n weeks
  function manila(day, hh, mm, weeksAhead) {
    var now = Date.now(), d = new Date(now + MNL), mid = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - MNL;
    var t = mid + ((day - d.getUTCDay() + 7) % 7) * DAY + (hh * 60 + mm) * 60e3;
    if (t <= now) t += 7 * DAY;
    return t + (weeksAhead || 0) * 7 * DAY;
  }
  var st = function () {
    var s = R.store("mentors", { profiles: {}, requests: [], assign: {} });
    if (!s.seeded) {
      s.profiles.paul = { focus: ["Splits and publishing", "Deals and contracts in plain English", "Getting paid: collecting societies", "Building a career that lasts"],
        about: "Forty years in music: pirate radio, the BBC, major-label A&R, festivals, management and my own label. Bring me the money side.",
        slots: [0, 1, 2].map(function (w) { return { id: "pslot" + w, at: manila(3, 9, 0, w), mins: 60 }; }) };
      s.profiles.darryl = { focus: ["How the house works", "Your first cowrites", "Finishing songs", "Getting the most from the Room"],
        about: "I host the Room and the camps. Book me if you're new, stuck, or want help planning your next month of writing.",
        slots: [0, 1].map(function (w) { return { id: "dslot" + w, at: manila(4, 19, 0, w), mins: 30 }; }) };
      s.seeded = true; R.db.save();
    }
    return s;
  };
  function mentors() { return R.db.state.members.filter(function (m) { return m.mentor || m.host; }); }

  function card(m) {
    var h = H(), p = st().profiles[m.id] || { focus: [], about: "", slots: [] }, me = R.db.state.me;
    var slots = (p.slots || []).filter(function (x) { return x.at > Date.now(); }).sort(function (a, b) { return a.at - b.at; });
    var mineReq = st().requests.filter(function (r) { return r.by === me && r.mentor === m.id; });
    var queue = R.db.state.prodesk.filter(function (pd) { return st().assign[pd.id] === m.id && pd.status !== "Notes back"; }).length;
    return '<article class="mn-card"><div class="mn-h">' + h.avatar(m, 72) + '<div><p class="eyebrow">' + (m.host ? "Host · mentor" : "Visiting mentor") + "</p><h2>" + h.esc(m.name) + '</h2><p class="mono small">' + h.esc(m.city || "") + "</p></div></div>" +
      '<p class="mn-about">' + h.esc(p.about || m.bio || "") + '</p><div class="sp-parts">' + (p.focus || []).map(function (f) { return '<span class="chip">' + h.esc(f) + "</span>"; }).join("") + "</div>" +
      '<h3>Book a session</h3><p class="muted small">One to one on video. Pricing announced soon.</p>' +
      (slots.length ? '<ul class="slot-list">' + slots.map(function (x) {
        var taken = st().requests.some(function (r) { return r.slot === x.id && r.status !== "declined"; }), asked = mineReq.some(function (r) { return r.slot === x.id && r.status !== "declined"; });
        return '<li><div><b>' + h.esc(h.whenBoth(x.at)) + '</b><span class="muted small">' + x.mins + " minutes</span></div>" +
          (asked ? '<span class="chip green">Requested</span>' : taken ? '<span class="chip">Taken</span>' : '<button class="btn-sm solid" data-act="mn-pick" data-id="' + h.esc(m.id) + '" data-key="' + h.esc(x.id) + '">Request</button>') + "</li>";
      }).join("") + "</ul>" : '<p class="muted">No open times right now. New times go up every week.</p>') +
      '<form class="mn-req" data-form="mn-request" data-id="' + h.esc(m.id) + '" hidden><input type="hidden" name="slot"><label>What do you want to work on?<input name="note" required maxlength="300" placeholder="e.g. a split with a producer, my release plan"></label><button class="btn-sm solid">Send request</button></form>' +
      (mineReq.length ? '<p class="small">Your requests: ' + mineReq.map(function (r) { return h.esc(r.status); }).join(", ") + "</p>" : "") +
      '<p class="muted small">Pro Desk songs with ' + h.esc(m.name.split(" ")[0]) + ": " + queue + "</p></article>";
  }

  function view() {
    var list = mentors();
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · mentors</p><h1>Mentors</h1><p class="lead">The people who run the Pro Desk, the sessions and, from 2027, the Circles. Book an hour with a mentor for the thing you\'re stuck on.</p></div>' +
      '<div class="mn-grid">' + list.map(card).join("") + '<article class="mn-card soon"><p class="eyebrow">Coming</p><h2>More mentors join in January 2027</h2><p class="muted">Writers, producers and publishers from across Asia, each leading a Circle and taking Pro Desk songs. Members hear first.</p></article></div>';
  }

  R.registerRoute("mentors", { title: "Mentors", flag: FLAG, render: view });
  R.addNav({ id: "mentors", label: "Mentors", flag: FLAG, icon: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-4 3.6-6 7-6s6.2 2 7 6"/><path d="M17.5 4.5l1 2 2 .3-1.5 1.4.4 2-1.9-1-1.9 1 .4-2-1.5-1.4 2-.3z"/>' });

  R.onAct("mn-pick", function (el, c) {
    var f = document.querySelector('form[data-form="mn-request"][data-id="' + c.id + '"]'); if (!f) return;
    f.hidden = false; f.elements.slot.value = c.key; f.querySelector('input[name="note"]').focus();
  });
  R.onForm("mn-request", function (f, v) {
    st().requests.push({ id: "rq" + Date.now(), mentor: f.dataset.id, by: R.db.state.me, slot: v("slot"), note: v("note"), status: "requested", at: Date.now() });
    R.save(); H().toast("Request sent. You'll hear back once it's confirmed."); R.rerender();
  });

  function adminTab() {
    var h = H(), s = st(), list = mentors();
    var name = function (id) { return h.esc(((R.db.member(id) || {}).name) || id); };
    return '<div class="admin-grid"><form class="panel" data-form="mn-slot"><h2>Add an open time</h2><label>Mentor<select name="mentor">' + list.map(function (m) { return '<option value="' + h.esc(m.id) + '">' + h.esc(m.name) + "</option>"; }).join("") + "</select></label>" +
      '<label>When (your time)<input type="datetime-local" name="at" required></label><label>Length<select name="mins"><option value="30">30 minutes</option><option value="60" selected>1 hour</option></select></label><button class="btn-sm solid">Add time</button>' +
      list.map(function (m) { var sl = ((s.profiles[m.id] || {}).slots || []).filter(function (x) { return x.at > Date.now(); }); return '<p class="small"><b>' + h.esc(m.name) + "</b>: " + (sl.length ? sl.map(function (x) { return h.esc(h.fmtManila(x.at)) + ' <button type="button" class="link" data-act="mn-del" data-id="' + h.esc(m.id) + '" data-key="' + h.esc(x.id) + '">remove</button>'; }).join(" · ") : "no open times") + "</p>"; }).join("") + "</form>" +
      '<section class="panel"><h2>Session requests</h2>' + (s.requests.length ? s.requests.slice().reverse().map(function (r) {
        var slot = ((s.profiles[r.mentor] || {}).slots || []).filter(function (x) { return x.id === r.slot; })[0];
        return '<div class="pd-item"><div class="pd-h"><div><b>' + name(r.by) + " → " + name(r.mentor) + '</b><span>' + (slot ? h.esc(h.fmtManila(slot.at)) : "time removed") + " · " + h.ago(r.at) + '</span></div><span class="chip">' + h.esc(r.status) + "</span>" +
          (r.status === "requested" ? '<button class="btn-sm solid" data-act="mn-req" data-id="' + h.esc(r.id) + '" data-key="accepted">Accept</button><button class="btn-sm" data-act="mn-req" data-id="' + h.esc(r.id) + '" data-key="declined">Decline</button>' : "") + '</div><p class="muted small">' + h.esc(r.note) + "</p></div>";
      }).join("") : '<p class="empty">No requests yet.</p>') + "</section></div>" +
      '<section class="panel" style="margin-top:16px"><h2>Pro Desk assignments</h2><div class="tbl-wrap"><table class="admin-t"><thead><tr><th>Song</th><th>From</th><th>Status</th><th>Mentor</th></tr></thead><tbody>' +
      R.db.state.prodesk.map(function (pd) {
        return "<tr><td>" + h.esc(pd.title) + "</td><td>" + name(pd.by) + "</td><td>" + h.esc(pd.status) + '</td><td><select data-mn-assign="' + h.esc(pd.id) + '" aria-label="Mentor for ' + h.esc(pd.title) + '"><option value="">Unassigned</option>' +
          list.map(function (m) { return '<option value="' + h.esc(m.id) + '"' + (s.assign[pd.id] === m.id ? " selected" : "") + ">" + h.esc(m.name) + "</option>"; }).join("") + "</select></td></tr>";
      }).join("") + "</tbody></table></div></section>";
  }
  R.addAdminTab({ id: "mentors", label: "Mentors", flag: FLAG, render: adminTab });

  R.onForm("mn-slot", function (f, v) {
    var at = new Date(v("at")).getTime(); if (!at || at < Date.now()) { H().toast("Pick a time in the future."); return; }
    var s = st(), p = s.profiles[v("mentor")] = s.profiles[v("mentor")] || { focus: [], about: "", slots: [] };
    p.slots.push({ id: "slot" + Date.now(), at: at, mins: Number(v("mins")) || 60 });
    R.save(); H().toast("Open time added."); R.rerender();
  });
  R.onAct("mn-del", function (el, c) { var p = st().profiles[c.id]; if (p) { p.slots = p.slots.filter(function (x) { return x.id !== c.key; }); R.save(); R.rerender(); } });
  R.onAct("mn-req", function (el, c) {
    var r = st().requests.filter(function (x) { return x.id === c.id; })[0]; if (!r) return;
    r.status = c.key; R.db.notify("Your session request was " + c.key + ".", "#/mentors");
    R.save(); H().toast("Request " + c.key + "."); R.rerender();
  });
  document.addEventListener("change", function (e) {
    var id = e.target.dataset && e.target.dataset.mnAssign; if (!id) return;
    if (e.target.value) st().assign[id] = e.target.value; else delete st().assign[id];
    R.save(); H().toast("Pro Desk song assigned.");
  });
})();
