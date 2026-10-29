// Feature: booth booking for House Members (flag "booth"). The Manila house opens in 2027; this is a preview.
// Week grid of 2-hour slots, 10:00–22:00 Manila, a monthly allowance per member, admin can block slots.
// Demo: Room.store("booth"). Live (GHL): could use a GHL calendar for the booth instead (see report).
(function () {
  var FLAG = "booth";
  var ALLOWANCE_HOURS = 4;          // per member per calendar month
  var SLOT_HOURS = 2, FIRST = 10, LAST = 20;  // slots start 10:00 … 20:00 (last ends 22:00)
  var MNL = 8 * 3600e3, DAY = 864e5;
  var H = function () { return Room.h; };
  var isStaff = function () { var m = Room.db.me(); return !!(m && (m.host || m.mentor)); };
  var DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  function weekStart(offset) { return H().weekStart(Date.now()) + (offset || 0) * 7 * DAY; }
  function slotStart(ws, d, hr) { return ws + d * DAY + hr * 3600e3; }
  function monthKey(ms) { var d = new Date(ms + MNL); return d.getUTCFullYear() + "-" + d.getUTCMonth(); }

  function st() {
    var s = Room.store("booth", { bookings: [], blocked: [], seeded: false });
    if (!s.seeded) {
      var ws = weekStart(1);
      s.bookings.push({ id: "bk1", by: "jun", start: slotStart(ws, 1, 14) }, { id: "bk2", by: "tom", start: slotStart(ws, 3, 18) }, { id: "bk3", by: "bea", start: slotStart(ws, 5, 10) });
      s.blocked.push(slotStart(ws, 0, 10), slotStart(ws, 0, 12));
      s.seeded = true; Room.save();
    }
    return s;
  }
  function usedHours(me, ms) {
    var k = monthKey(ms);
    return st().bookings.filter(function (b) { return b.by === me && monthKey(b.start) === k; }).length * SLOT_HOURS;
  }

  function grid(offset, admin) {
    var h = H(), esc = h.esc, s = st(), me = Room.db.state.me, ws = weekStart(offset), now = Date.now();
    var head = "<tr><th scope=\"col\">Time (Manila)</th>" + DAYS.map(function (d, i) { var dt = new Date(ws + i * DAY + MNL); return '<th scope="col">' + d + "<br><small>" + dt.getUTCDate() + "/" + (dt.getUTCMonth() + 1) + "</small></th>"; }).join("") + "</tr>";
    var rows = "";
    for (var hr = FIRST; hr <= LAST; hr += SLOT_HOURS) {
      rows += '<tr><th scope="row">' + String(hr).padStart(2, "0") + ":00–" + String(hr + SLOT_HOURS).padStart(2, "0") + ":00</th>";
      for (var d = 0; d < 7; d++) {
        var t = slotStart(ws, d, hr), b = s.bookings.filter(function (x) { return x.start === t; })[0], blocked = s.blocked.indexOf(t) !== -1, past = t < now;
        var cell;
        if (admin) cell = b ? '<span class="bt-cell taken">' + esc(h.first((Room.db.member(b.by) || {}).name)) + "</span>" :
          '<button class="bt-cell ' + (blocked ? "blocked" : "free") + '" data-act="bt-block" data-key="' + t + '">' + (blocked ? "Blocked" : "Open") + "</button>";
        else if (b && b.by === me) cell = '<button class="bt-cell mine" data-act="bt-cancel" data-key="' + t + '" aria-label="Your booking, cancel">Yours ✕</button>';
        else if (b) cell = '<span class="bt-cell taken">Booked</span>';
        else if (blocked) cell = '<span class="bt-cell blocked">Closed</span>';
        else if (past) cell = '<span class="bt-cell past">–</span>';
        else cell = '<button class="bt-cell free" data-act="bt-book" data-key="' + t + '" aria-label="Book ' + DAYS[d] + " " + hr + ':00">Book</button>';
        rows += "<td>" + cell + "</td>";
      }
      rows += "</tr>";
    }
    var nav = '<div class="bt-nav"><a class="btn-sm" href="#/' + (admin ? "admin/booth" : "booth/" + (offset - 1)) + '"' + (admin || offset <= 0 ? ' hidden' : "") + '>← Previous week</a><span class="mono">Week of ' + new Date(ws + MNL).toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" }) + "</span>" +
      (admin ? "" : '<a class="btn-sm" href="#/booth/' + (offset + 1) + '">Next week →</a>') + "</div>";
    return nav + '<div class="tbl-wrap"><table class="bt-grid">' + head + rows + "</table></div>";
  }

  function render(arg) {
    var h = H(), esc = h.esc, offset = Math.max(0, Math.min(8, parseInt(arg, 10) || 0)), me = Room.db.state.me, s = st();
    var used = usedHours(me, weekStart(offset) + 3 * DAY);
    var mine = s.bookings.filter(function (b) { return b.by === me && b.start > Date.now(); }).sort(function (a, b) { return a.start - b.start; });
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · the Booth</p><h1>Book the Booth</h1><p class="lead">The small studio in the Manila house, for demos that carry the song. House Members get ' + ALLOWANCE_HOURS + " hours a month.</p></div>" +
      '<p class="bt-banner">Bookings open when the Manila house opens in 2027. This is a preview: nothing booked here is real yet.</p>' +
      '<div class="bt-wrap"><section class="panel">' + grid(offset, false) + "</section>" +
      '<aside class="panel"><h2>This month</h2><p class="bt-allow"><b>' + used + "</b> of " + ALLOWANCE_HOURS + " hours used</p>" +
      "<h3>My bookings</h3>" + (mine.length ? '<ul class="ref-list">' + mine.map(function (b) { return "<li>" + esc(h.fmtManila(b.start)) + ' <button class="btn-sm" data-act="bt-cancel" data-key="' + b.start + '">Cancel</button></li>'; }).join("") + "</ul>" : '<p class="muted">No bookings yet.</p>') + "</aside></div>";
  }

  Room.registerRoute("booth", { title: "The Booth", flag: FLAG, render: render });
  Room.addNav({ id: "booth", href: "#/booth", label: "Booth", flag: FLAG, icon: '<rect x="5" y="3" width="14" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M9 17h6"/>' });
  Room.addAdminTab({ id: "booth", label: "Booth", flag: FLAG, render: function () {
    return '<section class="panel"><h2>Booth availability</h2><p class="muted">Tap a slot to block it (maintenance, sessions, private use). Booked slots show who has them. Next week shown.</p>' + grid(1, true) + "</section>";
  } });

  Room.onAct("bt-book", function (el, c) {
    var t = +c.key, me = Room.db.state.me, s = st(), h = H();
    if (s.bookings.some(function (b) { return b.start === t; }) || s.blocked.indexOf(t) !== -1) return;
    if (usedHours(me, t) + SLOT_HOURS > ALLOWANCE_HOURS) { h.toast("That would go over your " + ALLOWANCE_HOURS + " hours this month."); return; }
    s.bookings.push({ id: "bk" + Date.now(), by: me, start: t }); Room.save(); h.toast("Booked " + h.fmtManila(t) + "."); Room.rerender();
  });
  Room.onAct("bt-cancel", function (el, c) {
    var t = +c.key, me = Room.db.state.me, s = st();
    s.bookings = s.bookings.filter(function (b) { return !(b.start === t && b.by === me); }); Room.save(); H().toast("Booking cancelled."); Room.rerender();
  });
  Room.onAct("bt-block", function (el, c) {
    if (!isStaff()) return;
    var t = +c.key, s = st(), i = s.blocked.indexOf(t);
    if (i === -1) s.blocked.push(t); else s.blocked.splice(i, 1);
    Room.save(); Room.rerender();
  });
})();
