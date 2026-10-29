// Feature: Transparent pitch pipeline (flag "pitch-pipeline"). Members see every pitch the house makes for their songs,
// and a dashboard shows what the house's 10% of publishing earned and from which songs. Pitches and earnings live on
// the Ledger songs (Room.store("ledger")); this feature reads them through Room.ledger (ledger.js loads first).
(function () {
  var R = window.Room, FLAG = "pitch-pipeline";
  var H = function () { return R.h; };
  var STATUSES = ["sent", "shortlisted", "on hold", "cut", "passed"];
  var TYPES = ["artist", "label", "sync", "brand"];
  var LABEL = { sent: "Sent", shortlisted: "Shortlisted", "on hold": "On hold", cut: "Cut", passed: "Passed" };

  function allPitches(songs) {
    var out = [];
    songs.forEach(function (s) { (s.pitches || []).forEach(function (p) { out.push({ p: p, s: s }); }); });
    return out.sort(function (a, b) { return b.p.at - a.p.at; });
  }
  function sums(songs) {
    var earned = 0, house = 0, per = [];
    songs.forEach(function (s) { var t = R.ledger.totals(s); earned += t.earned; house += t.house; if (t.earned) per.push({ s: s, t: t }); });
    return { earned: earned, house: house, per: per.sort(function (a, b) { return b.t.earned - a.t.earned; }) };
  }

  function view() {
    var h = H(), mine = R.ledger.mine(), all = R.ledger.songs();
    var mp = allPitches(mine), ap = allPitches(all), sm = sums(mine), sa = sums(all);
    var byStatus = {}, byType = {};
    ap.forEach(function (x) { byStatus[x.p.status] = (byStatus[x.p.status] || 0) + 1; byType[x.p.type] = (byType[x.p.type] || 0) + 1; });
    var maxS = Math.max.apply(null, STATUSES.map(function (k) { return byStatus[k] || 0; }).concat([1]));
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · pitch pipeline</p><h1>Pitches</h1><p class="lead">Every time the house pitches one of your songs, it shows up here: who heard it, what happened, and what it earned. The house keeps 10% of the publishing, so you can see exactly what that 10% is doing.</p></div>' +
      '<div class="kpis">' + [[mp.length, "pitches of your songs"], [mp.filter(function (x) { return x.p.status === "cut"; }).length, "cuts"], [R.money(sm.earned), "publishing earned on your songs"], [R.money(sa.house), "the house's 10%, all songs"]].map(function (k) { return '<div class="kpi"><b>' + k[0] + "</b><span>" + k[1] + "</span></div>"; }).join("") + "</div>" +
      '<section class="panel"><h2>Your songs in the pipeline</h2>' + (mp.length ? '<div class="pipe">' + STATUSES.map(function (st) {
        var col = mp.filter(function (x) { return x.p.status === st; });
        return '<div class="pipe-col"><p class="pipe-h"><span class="chip pitch-' + st.replace(/\s/g, "-") + '">' + LABEL[st] + "</span><b>" + col.length + "</b></p>" + col.map(function (x) {
          return '<a class="pipe-card" href="#/ledger/' + h.esc(x.s.id) + '"><b>' + h.esc(x.s.title) + "</b><span>" + h.esc(x.p.to) + '</span><span class="muted small">' + h.esc(x.p.type) + " · " + h.ago(x.p.at) + "</span>" + (x.p.note ? '<span class="small">' + h.esc(x.p.note) + "</span>" : "") + "</a>";
        }).join("") + "</div>";
      }).join("") + "</div>" : '<p class="empty">None of your songs has been pitched yet. The house pitches songs that are registered and have a demo, so finish the checklist in the Ledger.</p>') + "</section>" +
      '<div class="admin-grid" style="margin-top:16px"><section class="panel"><h2>Where the house\'s 10% came from</h2><p class="muted small">Publishing income only, across every song in the house. Writers\' shares are paid to writers directly by their societies.</p>' +
      (sa.per.length ? '<table class="split-t"><thead><tr><th>Song</th><th class="n">Publishing earned</th><th class="n">House 10%</th></tr></thead><tbody>' + sa.per.map(function (x) {
        return '<tr><td><a href="#/ledger/' + h.esc(x.s.id) + '">' + h.esc(x.s.title) + '</a></td><td class="n">' + R.money(x.t.earned) + '</td><td class="n">' + R.money(x.t.house) + "</td></tr>";
      }).join("") + '<tr><td><b>Total</b></td><td class="n"><b>' + R.money(sa.earned) + '</b></td><td class="n"><b>' + R.money(sa.house) + "</b></td></tr></tbody></table>" : '<p class="muted">Nothing earned yet.</p>') + "</section>" +
      '<section class="panel"><h2>Every pitch, by outcome</h2><div class="bars">' + STATUSES.map(function (st) {
        return '<div class="bar-row"><span>' + LABEL[st] + '</span><i style="--w:' + Math.round(100 * (byStatus[st] || 0) / maxS) + '%"></i><b>' + (byStatus[st] || 0) + "</b></div>";
      }).join("") + '</div><p class="muted small" style="margin-top:8px">By type: ' + TYPES.map(function (t) { return t + " " + (byType[t] || 0); }).join(" · ") + "</p></section></div>";
  }

  function adminTab() {
    var h = H(), songs = R.ledger.songs(), ap = allPitches(songs);
    var opts = songs.map(function (s) { return '<option value="' + h.esc(s.id) + '">' + h.esc(s.title) + "</option>"; }).join("");
    return '<div class="admin-grid"><form class="panel" data-form="pitch-log"><h2>Log a pitch</h2>' +
      '<label>Song<select name="song" required>' + opts + '</select></label><label>Pitched to<input name="to" required maxlength="120" placeholder="Artist, label, supervisor or brand"></label>' +
      '<label>Type<select name="type">' + TYPES.map(function (t) { return "<option>" + t + "</option>"; }).join("") + '</select></label><label>Note (writers see this)<input name="note" maxlength="200"></label><button class="btn-sm solid">Log pitch</button></form>' +
      '<form class="panel" data-form="pitch-earn"><h2>Record publishing income</h2><p class="muted small">Publishing income only. The house\'s share is worked out as 10% of the amount.</p>' +
      '<label>Song<select name="song" required>' + opts + '</select></label><label>Source<input name="source" required maxlength="80" placeholder="Streaming, sync fee, performance…"></label>' +
      '<label>Amount (₱)<input name="amount" type="number" min="0" step="0.01" required></label><button class="btn-sm solid">Record income</button></form></div>' +
      '<section class="panel" style="margin-top:16px"><h2>All pitches</h2><div class="tbl-wrap"><table class="admin-t"><thead><tr><th>Song</th><th>To</th><th>Type</th><th>When</th><th>Status</th></tr></thead><tbody>' +
      ap.map(function (x) {
        return "<tr><td>" + h.esc(x.s.title) + "</td><td>" + h.esc(x.p.to) + (x.p.note ? '<br><span class="muted small">' + h.esc(x.p.note) + "</span>" : "") + "</td><td>" + h.esc(x.p.type) + "</td><td>" + h.ago(x.p.at) + '</td><td><select data-pitch-status="' + h.esc(x.p.id) + '" aria-label="Status for ' + h.esc(x.s.title) + '">' +
          STATUSES.map(function (st) { return "<option" + (st === x.p.status ? " selected" : "") + ' value="' + st + '">' + LABEL[st] + "</option>"; }).join("") + "</select></td></tr>";
      }).join("") + "</tbody></table></div></section>";
  }

  R.registerRoute("pitches", { title: "Pitches", flag: FLAG, render: view });
  R.addNav({ id: "pitches", label: "Pitches", flag: FLAG, icon: '<path d="M4 18l6-6 4 4 6-8"/><path d="M15 8h5v5"/>' });
  R.addAdminTab({ id: "pitches", label: "Pitches", flag: FLAG, render: adminTab });

  function findPitch(id) {
    var out = null;
    R.ledger.songs().forEach(function (s) { (s.pitches || []).forEach(function (p) { if (p.id === id) out = { p: p, s: s }; }); });
    return out;
  }
  R.onForm("pitch-log", function (f, v) {
    var s = R.ledger.song(v("song")); if (!s || !v("to")) return;
    s.pitches.push({ id: "pt" + Date.now(), to: v("to"), type: v("type") || "artist", at: Date.now(), status: "sent", note: v("note") });
    s.writers.forEach(function () {});
    R.db.notify("\"" + s.title + "\" was pitched to " + v("to") + ". See it in Pitches.", "#/pitches");
    R.save(); H().toast("Pitch logged. The writers can see it."); R.rerender();
  });
  R.onForm("pitch-earn", function (f, v) {
    var s = R.ledger.song(v("song")), amt = Math.round(Number(v("amount")) * 100) / 100;
    if (!s || !(amt > 0)) { H().toast("Enter an amount above zero."); return; }
    s.earnings.push({ at: Date.now(), source: v("source"), amount: amt, currency: "PHP", houseShare: Math.round(amt * 10) / 100 });
    R.save(); H().toast("Income recorded. House share: " + R.money(Math.round(amt * 10) / 100)); R.rerender();
  });
  R.onInput(function (e) {
    var id = e.target.dataset && e.target.dataset.pitchStatus; if (!id) return false;
    var x = findPitch(id); if (x) { x.p.status = e.target.value; R.save(); H().toast("Status updated: " + LABEL[x.p.status] + "."); }
    return true;
  });
  // selects fire "change" reliably everywhere; route it to the same handler
  document.addEventListener("change", function (e) {
    if (!e.target.dataset || !e.target.dataset.pitchStatus) return;
    var x = findPitch(e.target.dataset.pitchStatus); if (x && x.p.status !== e.target.value) { x.p.status = e.target.value; R.save(); H().toast("Status updated: " + LABEL[x.p.status] + "."); }
  });
})();
