// Feature: The Song Ledger (flag "song-ledger"). Every song written together in the house gets a living record:
// writers, splits (publishing 90% equal + 10% house; each writer keeps 100% of their writer's share), signatures,
// registration, demos, pitches and earnings. Data: Room.store("ledger", { songs: [] }) — shape shared with member.html.
(function () {
  var R = window.Room, FLAG = "song-ledger";
  var H = function () { return R.h; };
  var DAY = 864e5;

  // ₱ amounts, used by the Ledger, the pitch pipeline and anything else that shows money.
  R.money = R.money || function (n) {
    var v = Number(n) || 0;
    try { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: v % 1 ? 2 : 0 }).format(v); }
    catch (e) { return "₱" + v.toLocaleString(); }
  };

  function splitsFor(writers) {
    var pub = {}, each = Math.round(9000 / writers.length) / 100;
    writers.forEach(function (w) { pub[w] = each; });
    pub.house = 10;
    return pub;
  }
  function song(o) {
    return Object.assign({ id: "s" + Math.random().toString(36).slice(2, 9), title: "Untitled song", writers: [], roomId: "", createdAt: Date.now(),
      splits: { publishing: {}, signed: {} }, status: { registered: false, registeredWith: "", iswc: "", released: false, released_at: "", link: "" },
      demos: [], pitches: [], earnings: [], ipi: {} }, o);
  }

  function seed() {
    var now = Date.now();
    var sign = function (ws, at) { var o = {}; ws.forEach(function (w) { o[w] = at; }); return o; };
    var a = ["grace", "dana", "tom"], b = ["mara", "bea", "jun"], c = ["ayu", "kenji", "sofia"], d = ["hana", "arif", "eli"];
    return [
      song({ id: "s-borrowed-light", title: "Borrowed Light", writers: a, createdAt: now - 62 * DAY, splits: { publishing: splitsFor(a), signed: sign(a, now - 62 * DAY) },
        status: { registered: true, registeredWith: "PRS (UK), FILSCAP for the house share", iswc: "T-912.345.678-1", released: true, released_at: "2026-09-12", link: "https://open.spotify.com/" },
        demos: [{ label: "Mix 3", link: "https://youtube.com/", at: now - 20 * DAY }],
        pitches: [{ id: "pt1", to: "A UK sync agency", type: "sync", at: now - 15 * DAY, status: "shortlisted", note: "For a late-night drama trailer" }],
        earnings: [{ at: now - 9 * DAY, source: "Streaming (publishing)", amount: 4200, currency: "PHP", houseShare: 420 }] }),
      song({ id: "s-electric-fan", title: "Electric Fan", writers: b, createdAt: now - 30 * DAY, splits: { publishing: splitsFor(b), signed: sign(b, now - 30 * DAY) },
        status: { registered: true, registeredWith: "FILSCAP", iswc: "", released: false, released_at: "", link: "" },
        demos: [{ label: "Voice memo", link: "https://soundcloud.com/", at: now - 29 * DAY }] }),
      song({ id: "s-window-seat", title: "Window Seat", writers: c, createdAt: now - 21 * DAY, splits: { publishing: splitsFor(c), signed: sign(c, now - 21 * DAY) },
        demos: [{ label: "Demo", link: "https://soundcloud.com/", at: now - 18 * DAY }],
        pitches: [
          { id: "pt2", to: "An artist in Jakarta", type: "artist", at: now - 12 * DAY, status: "cut", note: "Recorded for a single" },
          { id: "pt3", to: "A Manila label (A&R)", type: "label", at: now - 10 * DAY, status: "passed", note: "Not right for the roster" }] }),
      song({ id: "s-small-hours", title: "Small Hours", writers: d, createdAt: now - 14 * DAY, splits: { publishing: splitsFor(d), signed: sign(d, now - 14 * DAY) },
        pitches: [
          { id: "pt4", to: "A Singapore brand campaign", type: "brand", at: now - 6 * DAY, status: "on hold", note: "Waiting on the client's edit" },
          { id: "pt5", to: "A KL music supervisor", type: "sync", at: now - 3 * DAY, status: "sent", note: "" }] })
    ];
  }

  // Store, with seed songs and any signed writing rooms turned into Ledger entries.
  function store() {
    var st = R.store("ledger", { songs: [] });
    if (!st.seeded) { st.songs = seed().concat(st.songs || []); st.seeded = true; R.db.save(); }
    var rooms = R.db.state.rooms || {}, changed = false;
    Object.keys(rooms).forEach(function (k) {
      var r = rooms[k];
      if (!r || !r.writers || r.writers.length < 2) return;
      if (!r.writers.every(function (w) { return r.signed && r.signed[w]; })) return;
      var s = st.songs.filter(function (x) { return x.roomId === r.id; })[0];
      if (!s) { st.songs.push(song({ id: "s-" + r.id, title: r.title, writers: r.writers.slice(), roomId: r.id, createdAt: r.created || Date.now(), splits: { publishing: splitsFor(r.writers), signed: Object.assign({}, r.signed) } })); changed = true; }
      else if (s.title !== r.title) { s.title = r.title; changed = true; }
    });
    if (changed) R.db.save();
    return st;
  }
  R.ledger = {
    store: store,
    songs: function () { return store().songs; },
    song: function (id) { return store().songs.filter(function (s) { return s.id === id; })[0]; },
    forRoom: function (roomId) { return store().songs.filter(function (s) { return s.roomId === roomId; })[0]; },
    mine: function (id) { id = id || R.db.state.me; return store().songs.filter(function (s) { return s.writers.indexOf(id) !== -1; }); },
    totals: function (s) {
      var t = 0, h = 0; (s.earnings || []).forEach(function (e) { t += Number(e.amount) || 0; h += Number(e.houseShare) || 0; });
      return { earned: t, house: h };
    }
  };

  function statusChips(s) {
    var c = [];
    c.push('<span class="chip">' + (Object.keys(s.splits.signed || {}).length >= s.writers.length ? "Splits signed" : "Splits pending") + "</span>");
    if (s.status.registered) c.push('<span class="chip green">Registered</span>');
    if (s.status.released) c.push('<span class="chip host">Released</span>');
    if ((s.pitches || []).length) c.push('<span class="chip">' + s.pitches.length + " pitch" + (s.pitches.length === 1 ? "" : "es") + "</span>");
    return c.join("");
  }

  function viewList() {
    var h = H(), me = R.db.state.me, all = R.ledger.songs().slice().sort(function (a, b) { return b.createdAt - a.createdAt; });
    var mine = all.filter(function (s) { return s.writers.indexOf(me) !== -1; });
    var row = function (s) {
      var t = R.ledger.totals(s);
      return '<a class="ledger-row" href="#/ledger/' + h.esc(s.id) + '"><div><b>' + h.esc(s.title) + '</b><span class="mono">' + s.writers.map(function (w) { return h.esc(((R.db.member(w) || {}).name) || w); }).join(", ") + " · " + h.ago(s.createdAt) + '</span></div><div class="ledger-chips">' + statusChips(s) + "</div>" +
        '<span class="ledger-earn">' + (t.earned ? R.money(t.earned) : "–") + "</span></a>";
    };
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · the Song Ledger</p><h1>The Ledger</h1><p class="lead">Every song written together in the house, with who wrote it, the signed splits, where it\'s registered, every pitch and every peso it earns. Your catalogue, kept clean from the first line.</p></div>' +
      '<div class="kpis">' + [[mine.length, "your songs"], [mine.filter(function (s) { return s.status.registered; }).length, "registered"], [mine.filter(function (s) { return s.status.released; }).length, "released"], [all.length, "songs in the house"]].map(function (k) { return '<div class="kpi"><b>' + k[0] + "</b><span>" + k[1] + "</span></div>"; }).join("") + "</div>" +
      '<section class="panel"><div class="panel-h"><h2>Your songs</h2></div>' + (mine.length ? '<div class="ledger-list">' + mine.map(row).join("") + "</div>" : '<p class="empty">Songs land here as soon as every writer in a writing room has signed the ownership form.</p>') + "</section>" +
      '<section class="panel" style="margin-top:16px"><h2>All songs in the house</h2><div class="ledger-list">' + all.map(row).join("") + "</div></section>";
  }

  function viewSong(id) {
    var h = H(), s = R.ledger.song(id);
    if (!s) return '<p class="empty">That song isn\'t in the Ledger. <a href="#/ledger">Back to the Ledger</a></p>';
    var me = R.db.state.me, mineSong = s.writers.indexOf(me) !== -1, t = R.ledger.totals(s);
    var signedN = s.writers.filter(function (w) { return s.splits.signed && s.splits.signed[w]; }).length;
    var steps = [
      ["splits", "Every writer signed the split sheet", signedN >= s.writers.length, true],
      ["registered", "Registered with FILSCAP or each writer's home society", !!s.status.registered, false],
      ["ipi", "Every writer's IPI number recorded", s.writers.every(function (w) { return s.ipi && s.ipi[w]; }), true],
      ["iswc", "ISWC code received", !!s.status.iswc, true],
      ["released", "Released", !!s.status.released, false]
    ];
    return '<div class="page-h"><p class="eyebrow"><a href="#/ledger">The Ledger</a> · song</p><h1>' + h.esc(s.title) + '</h1><div class="ledger-chips">' + statusChips(s) + "</div></div>" +
      '<div class="ledger-grid"><div class="ledger-main">' +
      '<section class="panel"><h2>Who owns what</h2><p class="muted">Each writer keeps 100% of their own writer\'s share. The publishing is split 90% between the writers and 10% to the house.</p>' +
      '<div class="tbl-wrap"><table class="split-t"><thead><tr><th>Writer</th><th>Brings</th><th class="n">Writer\'s share</th><th class="n">Publishing</th><th>IPI</th><th>Signed</th></tr></thead><tbody>' +
      s.writers.map(function (w) {
        var m = R.db.member(w) || { name: w, roles: [] };
        return "<tr><td>" + h.esc(m.name) + "</td><td>" + h.esc((m.roles || []).join(", ")) + '</td><td class="n">100%</td><td class="n">' + h.esc(s.splits.publishing[w]) + "%</td><td>" +
          (mineSong ? '<input class="ipi-in" data-ledger-ipi="' + h.esc(s.id) + '" data-w="' + h.esc(w) + '" value="' + h.esc((s.ipi || {})[w] || "") + '" placeholder="IPI number" aria-label="IPI number for ' + h.esc(m.name) + '">' : h.esc((s.ipi || {})[w] || "–")) +
          "</td><td>" + (s.splits.signed && s.splits.signed[w] ? '<span class="ok">' + h.ago(s.splits.signed[w]) + "</span>" : '<span class="muted">Waiting</span>') + "</td></tr>";
      }).join("") +
      '<tr class="row-house"><td>Gising Sining House</td><td>Publisher</td><td class="n">–</td><td class="n">10%</td><td></td><td><span class="muted">Registers and pitches the song</span></td></tr></tbody></table></div></section>' +
      '<section class="panel"><h2>Registration checklist</h2><ul class="ledger-check">' + steps.map(function (st) {
        var input = st[3] || !mineSong ? '<i class="auto' + (st[2] ? " on" : "") + '" aria-hidden="true">' + (st[2] ? "✓" : "") + "</i>" :
          '<input type="checkbox" data-act="ledger-tick" data-id="' + h.esc(s.id) + '" data-key="' + st[0] + '"' + (st[2] ? " checked" : "") + ">";
        return '<li class="' + (st[2] ? "done" : "") + '"><label>' + input + "<span>" + st[1] + "</span></label></li>";
      }).join("") + "</ul>" +
      (mineSong ? '<form class="ledger-form" data-form="ledger-status" data-id="' + h.esc(s.id) + '"><label>Registered with<input name="registeredWith" value="' + h.esc(s.status.registeredWith) + '" placeholder="FILSCAP, PRS, ASCAP…"></label>' +
        '<label>ISWC<input name="iswc" value="' + h.esc(s.status.iswc) + '" placeholder="T-000.000.000-0"></label><label>Release date<input name="released_at" type="date" value="' + h.esc(s.status.released_at) + '"></label>' +
        '<label>Release link<input name="link" type="url" value="' + h.esc(s.status.link) + '" placeholder="https://"></label><button class="btn-sm solid">Save</button></form>' : "") + "</section>" +
      '<section class="panel"><h2>Demos and versions</h2>' + (s.demos.length ? '<ul class="ledger-demos">' + s.demos.map(function (d) {
        return "<li><b>" + h.esc(d.label) + "</b> · " + h.ago(d.at) + (h.safeUrl(d.link) ? ' · <a href="' + h.esc(h.safeUrl(d.link)) + '" target="_blank" rel="noopener">Listen</a>' : "") + "</li>";
      }).join("") + "</ul>" : '<p class="muted">No demos yet.</p>') +
      (mineSong ? '<form class="ledger-inline" data-form="ledger-demo" data-id="' + h.esc(s.id) + '"><input name="label" placeholder="Label, e.g. Mix 2" required maxlength="60" aria-label="Demo label"><input name="link" type="url" placeholder="https://" required aria-label="Demo link"><button class="btn-sm solid">Add demo</button></form>' : "") + "</section>" +
      "</div><aside class=\"ledger-side\">" +
      '<section class="panel"><h2>Pitches</h2>' + (s.pitches.length ? '<ul class="pitch-mini">' + s.pitches.map(function (p) {
        return '<li><span class="chip pitch-' + h.esc(p.status.replace(/\s/g, "-")) + '">' + h.esc(p.status) + "</span><b>" + h.esc(p.to) + '</b><span class="muted small">' + h.esc(p.type) + " · " + h.ago(p.at) + (p.note ? " · " + h.esc(p.note) : "") + "</span></li>";
      }).join("") + "</ul>" : '<p class="muted">Not pitched yet. The house pitches songs that are registered and have a demo.</p>') +
      (R.flag("pitch-pipeline") ? '<a class="link-arrow" href="#/pitches">See the pitch pipeline →</a>' : "") + "</section>" +
      '<section class="panel"><h2>Earnings</h2><p class="muted small">Publishing income recorded by the house. Your writer\'s share is paid to you directly by your society and isn\'t shown here.</p>' +
      (s.earnings.length ? '<table class="split-t"><tbody>' + s.earnings.map(function (e) {
        return "<tr><td>" + h.esc(e.source) + '<br><span class="muted small">' + h.ago(e.at) + '</span></td><td class="n">' + R.money(e.amount) + '</td><td class="n muted">house ' + R.money(e.houseShare) + "</td></tr>";
      }).join("") + '<tr><td><b>Total</b></td><td class="n"><b>' + R.money(t.earned) + '</b></td><td class="n muted">house ' + R.money(t.house) + "</td></tr></tbody></table>" : '<p class="muted">Nothing earned yet.</p>') + "</section>" +
      '<section class="panel"><h2>Export</h2><p class="muted small">The song\'s metadata, for a society, a distributor or a publisher.</p><div class="row-wrap"><button class="btn-sm" data-act="ledger-export" data-id="' + h.esc(s.id) + '" data-key="csv">Download CSV</button><button class="btn-sm" data-act="ledger-export" data-id="' + h.esc(s.id) + '" data-key="json">Download JSON</button></div>' +
      (s.roomId && R.db.room(s.roomId) ? '<a class="link-arrow" href="#/write/' + h.esc(s.roomId) + '">Open the writing room →</a>' : "") + "</section></aside></div>";
  }

  function exportSong(s, kind) {
    var meta = { title: s.title, iswc: s.status.iswc, registeredWith: s.status.registeredWith, released: s.status.released, releasedAt: s.status.released_at, link: s.status.link,
      writers: s.writers.map(function (w) { var m = R.db.member(w) || { name: w }; return { name: m.name, roles: m.roles || [], ipi: (s.ipi || {})[w] || "", writerShare: 100, publishing: s.splits.publishing[w], signed: s.splits.signed[w] ? new Date(s.splits.signed[w]).toISOString() : "" }; }),
      publisher: { name: "Gising Sining House", publishing: 10 } };
    var data, type, ext;
    if (kind === "json") { data = JSON.stringify(meta, null, 2); type = "application/json"; ext = "json"; }
    else {
      var rows = [["Title", "Writer", "Roles", "IPI", "Writer's share %", "Publishing %", "Signed", "ISWC", "Registered with"]];
      meta.writers.forEach(function (w) { rows.push([meta.title, w.name, w.roles.join("; "), w.ipi, w.writerShare, w.publishing, w.signed, meta.iswc, meta.registeredWith]); });
      rows.push([meta.title, "Gising Sining House (publisher)", "Publisher", "", "", 10, "", meta.iswc, meta.registeredWith]);
      data = rows.map(function (r) { return r.map(function (x) { return '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"'; }).join(","); }).join("\n"); type = "text/csv"; ext = "csv";
    }
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([data], { type: type }));
    a.download = s.title.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-metadata." + ext; document.body.appendChild(a); a.click(); a.remove();
  }

  R.registerRoute("ledger", { title: "The Ledger", flag: FLAG, render: function (arg) { return arg ? viewSong(arg) : viewList(); } });
  R.addNav({ id: "ledger", label: "Ledger", flag: FLAG, icon: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>' });

  R.onAct("ledger-tick", function (el, c) {
    var s = R.ledger.song(c.id); if (!s) return;
    s.status[c.key] = el.checked;
    if (c.key === "released" && el.checked && !s.status.released_at) s.status.released_at = new Date().toISOString().slice(0, 10);
    R.save(); H().toast(el.checked ? "Ticked." : "Unticked."); R.rerender();
  });
  R.onAct("ledger-export", function (el, c) { var s = R.ledger.song(c.id); if (s) exportSong(s, c.key); });
  R.onAct("ledger-stave", function () {
    var mine = R.ledger.mine(), sm = R.db.state.selfMilestones;
    if (mine.some(function (s) { return s.status.registered; })) sm.e2 = true;
    if (mine.some(function (s) { return s.status.released; })) sm.f1 = true;
    R.save(); H().toast("Your 5 Keys are up to date with the Ledger."); R.rerender();
  });
  R.onForm("ledger-status", function (f, v) {
    var s = R.ledger.song(f.dataset.id); if (!s) return;
    if (v("link") && !H().safeUrl(v("link"))) { H().toast("Links need to start with https://"); return; }
    s.status.registeredWith = v("registeredWith"); s.status.iswc = v("iswc"); s.status.released_at = v("released_at"); s.status.link = v("link");
    if (v("registeredWith")) s.status.registered = true;
    if (v("released_at")) s.status.released = true;
    R.save(); H().toast("Saved to the Ledger."); R.rerender();
  });
  R.onForm("ledger-demo", function (f, v) {
    var s = R.ledger.song(f.dataset.id); if (!s) return;
    if (!H().safeUrl(v("link"))) { H().toast("Links need to start with https://"); return; }
    s.demos.push({ label: v("label"), link: v("link"), at: Date.now() }); R.save(); H().toast("Demo added."); R.rerender();
  });
  var ipiT;
  R.onInput(function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.ledgerIpi) return false;
    var s = R.ledger.song(t.dataset.ledgerIpi); if (!s) return true;
    s.ipi = s.ipi || {}; s.ipi[t.dataset.w] = t.value.trim();
    clearTimeout(ipiT); ipiT = setTimeout(function () { R.save(); }, 400);
    return true;
  });

  // In the writing room: a link to the song's Ledger page once everyone has signed.
  R.addSlot("write.side", function (r) {
    var s = R.ledger.forRoom(r.id), h = H();
    if (!s) return '<section class="panel ledger-hint"><h2>The Ledger</h2><p class="muted small">When every writer has signed, this song gets its own page in the Ledger.</p></section>';
    return '<section class="panel ledger-hint"><h2>In the Ledger</h2><div class="ledger-chips">' + statusChips(s) + '</div><a class="btn-sm solid" href="#/ledger/' + h.esc(s.id) + '">Open in the Ledger</a></section>';
  }, FLAG);

  // On your stave: how your songs stand.
  R.addSlot("stave.side", function () {
    var mine = R.ledger.mine(), reg = mine.filter(function (s) { return s.status.registered; }).length, rel = mine.filter(function (s) { return s.status.released; }).length;
    var sm = R.db.state.selfMilestones, behind = (reg && !sm.e2) || (rel && !sm.f1);
    return '<section class="panel"><p class="eyebrow">From the Ledger</p><div class="wk-stats light"><div><b>' + mine.length + '</b><span>songs written together</span></div><div><b>' + reg + "</b><span>registered</span></div><div><b>" + rel + '</b><span>released</span></div></div>' +
      (behind ? '<button class="btn-sm solid" data-act="ledger-stave">Tick these on my 5 Keys</button>' : "") + '<a class="link-arrow" href="#/ledger">Open the Ledger →</a></section>';
  }, FLAG);
})();
