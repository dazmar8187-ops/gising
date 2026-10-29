// Feature: writers' nights and event tickets (flag "events").
// Events with seat limits, member tickets with a QR code for check-in, recordings posted afterwards.
// Demo: Room.store("events"). Live (GHL): events and tickets need server storage; paid tickets use GHL payment links.
(function () {
  var FLAG = "events";
  var H = function () { return Room.h; };
  var MNL = 8 * 3600e3;
  var isStaff = function () { var m = Room.db.me(); return !!(m && (m.host || m.mentor)); };
  // Manila wall-clock "2027-03-27T20:00" -> real ms
  var fromManila = function (local) { var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local || ""); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - MNL : NaN; };
  var code = function () { return Math.random().toString(36).slice(2, 8).toUpperCase(); };

  function st() {
    var s = Room.store("events", { list: [], seeded: false });
    if (!s.seeded) {
      s.list.push({ id: "ev1", example: true, title: "Listening party: the Camp 01 songs", start: Date.UTC(2027, 2, 27, 12, 0), mins: 90, place: "online", seats: 100, paid: false,
        desc: "Every song written at Camp 01, played back online with the writers in the room. Bring headphones.", recording: "",
        tickets: [{ by: "mara", at: Date.now() - 864e5, code: "MRA7Q2", attended: false }, { by: "jun", at: Date.now() - 864e5, code: "JUN4K8", attended: false }] });
      s.list.push({ id: "ev2", example: true, title: "Writers' night 01 at the Manila house", start: Date.UTC(2027, 4, 7, 11, 0), mins: 180, place: "house", seats: 40, paid: true,
        desc: "The first writers' night in the house, 7–10pm. Six writers play two songs each; the room gives notes after. Date confirmed when the house opens.", recording: "", tickets: [] });
      s.seeded = true; Room.save();
    }
    return s;
  }
  var ev = function (id) { return st().list.filter(function (e) { return e.id === id; })[0]; };
  var left = function (e) { return Math.max(0, e.seats - e.tickets.length); };
  var mineT = function (e) { var me = Room.db.state.me; return e.tickets.filter(function (t) { return t.by === me; })[0]; };
  var placeName = function (e) { return e.place === "house" ? "Manila house · in person" : "Online"; };

  function priceLine(e) {
    if (!e.paid) return "Free for members";
    return "Paid ticket · price announced soon";
  }

  function card(e) {
    var h = H(), esc = h.esc, t = mineT(e), past = Date.now() > e.start + e.mins * 60e3;
    return '<article class="ticket ' + (e.place === "house" ? "in-person" : "online") + '"><div class="ticket-top"><span class="ev-chips"><span class="chip ' + (e.place === "house" ? "rust" : "green") + '">' + esc(placeName(e)) + "</span>" +
      (e.example ? '<span class="chip">Example</span>' : "") + "</span><h3>" + esc(e.title) + '</h3><p class="mono">' + esc(h.whenBoth(e.start)) + '</p><p class="muted">' + esc(e.desc) + "</p>" +
      '<p class="mono">' + left(e) + " of " + e.seats + " seats left · " + esc(priceLine(e)) + "</p></div>" +
      '<div class="ticket-stub">' +
      (past ? (h.safeUrl(e.recording) ? '<a class="btn-sm solid" href="' + esc(e.recording) + '" target="_blank" rel="noopener">Watch the recording</a>' : '<span class="stub-note">Recording coming soon</span>') :
        t ? '<span class="chip green">Your ticket · ' + esc(t.code) + '</span><button class="btn-sm" data-act="ev-cancel" data-id="' + esc(e.id) + '">Give it back</button>' :
        e.paid ? '<span class="stub-note">Tickets on sale when the price is set</span>' :
        left(e) ? '<button class="btn-sm sun" data-act="ev-get" data-id="' + esc(e.id) + '">Get a ticket</button>' : '<span class="stub-note">Sold out</span>') + "</div></article>";
  }

  function render() {
    var h = H(), esc = h.esc, s = st(), now = Date.now();
    var upcoming = s.list.filter(function (e) { return e.start + e.mins * 60e3 > now; }).sort(function (a, b) { return a.start - b.start; });
    var past = s.list.filter(function (e) { return e.start + e.mins * 60e3 <= now; }).sort(function (a, b) { return b.start - a.start; });
    var mine = s.list.filter(function (e) { return mineT(e) && e.start + e.mins * 60e3 > now; });
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · events</p><h1>Events</h1><p class="lead">Writers\' nights at the Manila house from 2027, and listening parties online. Tickets are free for members unless an event says otherwise, and seats are limited.</p></div>' +
      (mine.length ? '<section class="panel ev-mine"><h2>My tickets</h2><div class="ev-tix">' + mine.map(function (e) {
        var t = mineT(e);
        return '<div class="ev-tix-card"><div class="ev-qr" data-qr="GSH-TICKET:' + esc(e.id) + ":" + esc(t.code) + ":" + esc(Room.db.state.me) + '" aria-label="Ticket QR code for check-in"></div><div><b>' + esc(e.title) + '</b><p class="mono">' + esc(h.fmtManila(e.start)) + '</p><p class="mono">Code ' + esc(t.code) + "</p>" + (t.attended ? '<span class="chip green">Checked in</span>' : '<p class="muted small">Show this at the door.</p>') + "</div></div>";
      }).join("") + "</div></section>" : "") +
      '<div class="tickets">' + (upcoming.map(card).join("") || '<p class="empty">No events scheduled yet.</p>') + "</div>" +
      (past.length ? '<h2 class="sec-t" style="margin-top:28px">Past events</h2><div class="tickets">' + past.map(card).join("") + "</div>" : "");
  }
  function drawQr() {
    if (!window.QRCode) return;
    document.querySelectorAll("[data-qr]").forEach(function (el) {
      if (el.dataset.drawn) return; el.dataset.drawn = "1";
      try { new window.QRCode(el, { text: el.dataset.qr, width: 112, height: 112, colorDark: "#14221F", colorLight: "#FFFFFF" }); } catch (e) {}
    });
  }

  function adminTab() {
    var h = H(), esc = h.esc, s = st();
    return '<div class="admin-grid"><form class="panel" data-form="ev-create"><h2>Create an event</h2>' +
      '<label>Title<input name="title" required maxlength="120"></label><label>Date and time (Manila)<input name="start" type="datetime-local" required></label>' +
      '<label>Length (minutes)<input name="mins" type="number" min="30" max="600" value="120"></label>' +
      '<label>Where<select name="place"><option value="online">Online</option><option value="house">Manila house · in person</option></select></label>' +
      '<label>Seats<input name="seats" type="number" min="1" max="2000" value="40"></label>' +
      '<label class="tick"><input type="checkbox" name="paid"> Paid ticket (sold when a price and payment link are set)</label>' +
      '<label>Description<textarea name="desc" rows="3" maxlength="600"></textarea></label><button class="btn-sm solid">Create event</button></form>' +
      '<section class="panel"><h2>Events</h2>' + (s.list.slice().sort(function (a, b) { return a.start - b.start; }).map(function (e) {
        return '<div class="ev-admin"><div class="panel-h"><div><b>' + esc(e.title) + '</b><p class="mono">' + esc(h.fmtManila(e.start)) + " · " + e.tickets.length + "/" + e.seats + ' tickets</p></div><button class="btn-sm danger" data-act="ev-delete" data-id="' + esc(e.id) + '">Delete</button></div>' +
          (e.tickets.length ? '<ul class="ev-check">' + e.tickets.map(function (t, i) {
            return "<li>" + esc((Room.db.member(t.by) || {}).name || "Member") + ' · <span class="mono">' + esc(t.code) + "</span> " + (t.attended ? '<span class="chip green">Checked in</span>' : '<button class="btn-sm" data-act="ev-checkin" data-id="' + esc(e.id) + '" data-key="' + i + '">Check in</button>') + "</li>";
          }).join("") + "</ul>" : '<p class="muted small">No tickets yet.</p>') +
          '<form class="ev-rec" data-form="ev-rec" data-id="' + esc(e.id) + '"><label class="sr-only" for="er-' + esc(e.id) + '">Recording link</label><input id="er-' + esc(e.id) + '" name="link" type="url" placeholder="Recording link (after the event)" value="' + esc(e.recording) + '"><button class="btn-sm">Save</button></form></div>';
      }).join("") || '<p class="empty">No events yet.</p>') + "</section></div>";
  }

  Room.registerRoute("events", { title: "Events", flag: FLAG, render: render, after: drawQr });
  Room.addNav({ id: "events", href: "#/events", label: "Events", flag: FLAG, icon: '<path d="M4 9h16v10H4z"/><path d="M4 9l2-4h12l2 4M9 13h6"/>' });
  Room.addAdminTab({ id: "events", label: "Events", flag: FLAG, render: adminTab });
  Room.addSlot("calendar.after", function () {
    var n = st().list.filter(function (e) { return e.start > Date.now(); }).length;
    return n ? '<a class="replays" href="#/events"><span class="chip green">Events</span> ' + n + " upcoming writers' nights and listening parties. Get your ticket. <b>→</b></a>" : "";
  }, FLAG);

  Room.onAct("ev-get", function (el, c) {
    var e = ev(c.id); if (!e || mineT(e) || !left(e) || e.paid) return;
    e.tickets.push({ by: Room.db.state.me, at: Date.now(), code: code(), attended: false });
    Room.save(); H().toast("You're in. Your ticket is at the top of this page."); Room.rerender();
  });
  Room.onAct("ev-cancel", function (el, c) {
    var e = ev(c.id); if (!e) return; var me = Room.db.state.me;
    e.tickets = e.tickets.filter(function (t) { return t.by !== me; }); Room.save(); H().toast("Ticket given back. Someone else can have the seat."); Room.rerender();
  });
  Room.onAct("ev-checkin", function (el, c) { if (!isStaff()) return; var e = ev(c.id); e.tickets[+c.key].attended = true; Room.save(); Room.rerender(); });
  Room.onAct("ev-delete", function (el, c) {
    if (!isStaff()) return;
    if (el.dataset.confirm !== "1") { el.dataset.confirm = "1"; el.textContent = "Tap again to delete"; return; }
    st().list = st().list.filter(function (e) { return e.id !== c.id; }); Room.save(); H().toast("Event deleted."); Room.rerender();
  });
  Room.onForm("ev-create", function (f, v) {
    if (!isStaff()) return;
    var start = fromManila(v("start")); if (!isFinite(start)) { H().toast("Pick a date and time."); return; }
    st().list.push({ id: "ev" + Date.now(), title: v("title"), start: start, mins: +v("mins") || 120, place: v("place"), seats: +v("seats") || 40, paid: f.elements.paid.checked, desc: v("desc"), recording: "", tickets: [] });
    Room.save(); H().toast("Event created."); Room.rerender();
  });
  Room.onForm("ev-rec", function (f, v) {
    if (!isStaff()) return;
    if (v("link") && !H().safeUrl(v("link"))) { H().toast("Links need to start with https://"); return; }
    ev(f.dataset.id).recording = v("link"); Room.save(); H().toast("Recording link saved.");
  });
})();
