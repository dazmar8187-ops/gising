// The Room page: live clocks, "now in the room", the week in the visitor's own time zone, and the stave demo.
// The schedule lives in config.js (HOUSE.room), set in Manila time.
(function () {
  var h = window.HOUSE || {};
  var r = h.room || { schedule: [], prompts: [] };
  var MNL = 8 * 3600e3;                     // Manila is UTC+8 all year
  var DAY = 864e5, WEEK = 7 * DAY;
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  var $ = function (id) { return document.getElementById(id); };

  // Manila "wall clock" as a UTC-based Date, so getUTC* reads Manila fields.
  var mnl = function (ms) { return new Date(ms + MNL); };
  var hm = function (t) { var p = t.split(":"); return (+p[0]) * 3600e3 + (+p[1]) * 60e3; };
  var firstOfMonth = function (ms) { return mnl(ms).getUTCDate() <= 7; };

  // Next start (real UTC ms) at or after `from` for an event.
  function nextStart(ev, from) {
    var m = mnl(from);
    var midnight = Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), m.getUTCDate()) - MNL;
    var t = midnight + ((ev.day - m.getUTCDay() + 7) % 7) * DAY + hm(ev.time);
    if (t + ev.mins * 60e3 <= from) t += WEEK;      // still running counts as "this one"
    if (ev.monthly) while (!firstOfMonth(t)) t += WEEK;
    return t;
  }

  var tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) {}
  var inManila = tz === "Asia/Manila";
  var youLabel = tz ? tz.split("/").pop().replace(/_/g, " ") : "Your time";
  var fmtYou = function (ms, withDay) {
    var o = { hour: "numeric", minute: "2-digit" };
    if (withDay) o.weekday = "short";
    return new Date(ms).toLocaleString(undefined, o);
  };
  var fmtMnl = function (ms) {
    var d = mnl(ms);
    return String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0");
  };
  var until = function (ms) {
    var mins = Math.max(1, Math.round(ms / 60e3)), d = Math.floor(mins / 1440), hh = Math.floor((mins % 1440) / 60), mm = mins % 60;
    return d ? d + "d " + hh + "h" : hh ? hh + "h " + mm + "m" : mm + "m";
  };

  // ---- the week table ----
  var table = $("weekTable");
  if (table) {
    $("youHead").textContent = inManila ? "" : "Your time · " + youLabel;
    var order = r.schedule.slice().sort(function (a, b) { return ((a.day + 6) % 7) - ((b.day + 6) % 7) || hm(a.time) - hm(b.time); });
    order.forEach(function (ev) {
      var row = document.createElement("div"); row.className = "week-row"; ev._row = row;
      var d = document.createElement("span"); d.className = "d"; d.textContent = DAYS[ev.day];
      var w = document.createElement("div");
      var t3 = document.createElement("h3"); t3.textContent = ev.title;
      if (ev.live || ev.monthly) { var s = document.createElement("small"); s.textContent = [ev.live ? "live" : "", ev.monthly ? "monthly" : ""].filter(Boolean).join(" · "); t3.appendChild(s); }
      var p = document.createElement("p"); p.textContent = ev.text;
      w.appendChild(t3); w.appendChild(p);
      var t = document.createElement("span"); t.className = "t"; t.textContent = ev.time;
      var y = document.createElement("span"); y.className = "y"; y.textContent = inManila ? "" : fmtYou(nextStart(ev, Date.now()), true);
      row.appendChild(d); row.appendChild(w); row.appendChild(t); row.appendChild(y);
      table.appendChild(row);
    });
  }

  // ---- the prompt of the week ----
  if ($("nowPrompt") && r.prompts && r.prompts.length && r.promptsStart) {
    var p = r.promptsStart.split("-");
    var start = Date.UTC(+p[0], +p[1] - 1, +p[2]) - MNL;
    var wk = Math.floor((Date.now() - start) / WEEK);
    if (wk >= 0) $("nowPrompt").textContent = r.prompts[wk % r.prompts.length];
    else {
      $("nowPrompt").textContent = r.prompts[0];
      $("nowPromptLabel").textContent = "First prompt · Monday " + mnl(start).getUTCDate() + " " + mnl(start).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
    }
  }

  // ---- clocks and "now" ----
  if ($("clkYouLabel")) $("clkYouLabel").textContent = inManila ? "Manila, you're here" : youLabel;
  function tick() {
    var now = Date.now();
    if ($("clkManila")) $("clkManila").textContent = fmtMnl(now);
    if ($("clkYou")) $("clkYou").textContent = inManila ? DAYS[mnl(now).getUTCDay()] : fmtYou(now, false);
    if (!r.schedule.length) return;

    var live = null, next = null;
    r.schedule.forEach(function (ev) {
      var s = nextStart(ev, now);
      if (s <= now && ev.live) live = ev;
      if (s > now && (!next || s < next.s)) next = { ev: ev, s: s };
      if (ev._row) ev._row.classList.remove("is-next");
    });
    if (next && next.ev._row) next.ev._row.classList.add("is-next");
    if ($("nowLive")) {
      $("nowLive").hidden = !live;
      if (live) $("nowLiveTitle").textContent = live.title;
    }
    if (next && $("nowNext")) {
      $("nowNext").textContent = next.ev.title + " · in " + until(next.s - now);
      $("nowNextWhen").textContent = DAYS[next.ev.day] + " " + next.ev.time + " Manila" + (inManila ? "" : " · " + fmtYou(next.s, true) + " your time");
    }
  }
  tick();
  setInterval(tick, 30e3);

  // ---- your stave (a demo; remembered in this browser only) ----
  var stave = $("myStave");
  if (stave) {
    var boxes = stave.querySelectorAll("input[type=checkbox]");
    var note = $("staveNote");
    var KEY = "house_stave_demo";
    try {
      var saved = JSON.parse(localStorage.getItem(KEY) || "[]");
      Array.prototype.forEach.call(boxes, function (b, i) { b.checked = !!saved[i]; });
    } catch (e) {}

    var drawStave = function () {
      var done = 0, top = null;
      stave.querySelectorAll(".line").forEach(function (line) {
        var c = line.querySelectorAll("input:checked").length;
        done += c;
        var lit = c === line.querySelectorAll("input").length;
        line.classList.toggle("lit", lit);
        if (lit && (top === null || +line.dataset.line > +top.dataset.line)) top = line;
      });
      var bottom = stave.querySelector('.line[data-line="0"]');
      var at = top || bottom;
      note.style.top = (at.offsetTop + at.offsetHeight - 1) + "px";
      note.classList.toggle("on", !!top);
      $("staveCount").textContent = done + " of " + boxes.length + " milestones" + (top ? " · your note sits on " + top.querySelector("legend b").textContent : "");
      try { localStorage.setItem(KEY, JSON.stringify(Array.prototype.map.call(boxes, function (b) { return b.checked ? 1 : 0; }))); } catch (e) {}
    };
    stave.addEventListener("change", drawStave);
    window.addEventListener("resize", drawStave);
    drawStave();
  }

  // Prices show only when set to a number in config.js (HOUSE.prices). Today they're all null, so nothing shows.
  (function () {
    var pr = (window.HOUSE && window.HOUSE.prices) || {};
    document.querySelectorAll("[data-price-key]").forEach(function (el) {
      var v = pr[el.getAttribute("data-price-key")];
      if (typeof v === "number" && isFinite(v)) { el.textContent = (el.dataset.prefix || "From ") + "₱" + v.toLocaleString("en-PH"); el.hidden = false; }
    });
  })();
})();
