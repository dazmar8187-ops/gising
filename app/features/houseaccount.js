// Feature: One account from the Room to the house (flag "one-account"). A member pass with a QR code that checks the
// member in at the Manila house (opening 2027), their visits, and writers'-night recordings attached to their profile.
// Data: Room.store("house", { visits: [{ id, at, by }], recordings: [{ id, member, title, link, at }] }).
(function () {
  var R = window.Room, FLAG = "one-account";
  var H = function () { return R.h; };
  var st = function () { return R.store("house", { visits: [], recordings: [] }); };

  // A short, stable code per member. Live, the server signs it; in the demo it's a checksum so typos are caught.
  function code(id) {
    var h = 0; for (var i = 0; i < id.length; i++) h = (h * 33 + id.charCodeAt(i)) % 1679616;
    return "SH-" + id.toUpperCase() + "-" + h.toString(36).toUpperCase().padStart(4, "0");
  }
  function parse(c) {
    var m = String(c || "").trim().toUpperCase().match(/^SH-([A-Z0-9]+)-([A-Z0-9]{4})$/);
    if (!m) return null;
    var id = m[1].toLowerCase();
    return R.db.member(id) && code(id) === m[0] ? id : null;
  }
  R.memberPass = { code: code, parse: parse };

  function view() {
    var h = H(), me = R.db.me(), visits = st().visits.filter(function (v) { return v.id === me.id; }).sort(function (a, b) { return b.at - a.at; });
    var recs = st().recordings.filter(function (r) { return r.member === me.id; });
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · member pass</p><h1>Member pass</h1><p class="lead">One account for the Room and the house. When the Manila house opens in 2027, show this at the door to check in, book the booth, and get your writers\' night recordings on your profile.</p></div>' +
      '<div class="pass-grid"><div class="pass-card"><div class="pass-top"><svg width="30" height="26" viewBox="0 0 26 22" aria-hidden="true"><g stroke="currentColor" stroke-width="1.6"><path d="M0 2h26M0 6.5h26M0 11h26M0 15.5h26M0 20h26"/></g><circle cx="17" cy="11" r="3.6" fill="var(--sun)"/></svg><span>Gising Sining House</span></div>' +
      '<div class="pass-who">' + h.avatar(me, 56) + "<div><b>" + h.esc(me.name) + "</b><span>" + (me.host ? "Host" : me.mentor ? "Visiting mentor" : me.founding ? "Founding member" : "Member") + " · " + h.esc(me.city || "") + "</span></div></div>" +
      '<div class="pass-qr" id="passQr" role="img" aria-label="QR code for your member pass"></div><p class="pass-code mono">' + h.esc(code(me.id)) + '</p><p class="pass-note">Manila house · opening 2027</p></div>' +
      '<div class="pass-side"><section class="panel"><h2>Your visits</h2>' + (visits.length ? '<ul class="visit-list">' + visits.slice(0, 10).map(function (v) { return "<li>" + h.esc(h.fmtManila(v.at)) + "</li>"; }).join("") + "</ul>" : '<p class="muted">No visits yet. The house opens in 2027.</p>') + "</section>" +
      '<section class="panel"><h2>Writers\' night recordings</h2>' + (recs.length ? '<ul class="visit-list">' + recs.map(function (r) { return "<li><b>" + h.esc(r.title) + "</b> · " + h.ago(r.at) + (h.safeUrl(r.link) ? ' · <a href="' + h.esc(h.safeUrl(r.link)) + '" target="_blank" rel="noopener">Watch</a>' : "") + "</li>"; }).join("") + "</ul>" :
        '<p class="muted">When you play a writers\' night at the house, the recording lands here and on your profile.</p>') + "</section></div></div>";
  }

  R.registerRoute("pass", {
    title: "Member pass", flag: FLAG, render: view,
    after: function () {
      var el = document.getElementById("passQr"), me = R.db.me(); if (!el || !me) return;
      if (window.QRCode) { new window.QRCode(el, { text: code(me.id), width: 180, height: 180, colorDark: "#14221F", colorLight: "#FFFFFF", correctLevel: window.QRCode.CorrectLevel.M }); }
      else el.innerHTML = '<p class="muted small">The QR code needs an internet connection. Your code below works too.</p>';
    }
  });
  R.addNav({ id: "pass", label: "Member pass", flag: FLAG, icon: '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 10h3v3H8zM14 10h2M14 13h2M8 16h8"/>' });

  R.addSlot("profile.after", function (m) {
    var h = H(), recs = st().recordings.filter(function (r) { return r.member === m.id; });
    if (!recs.length) return "";
    return '<section class="panel" style="margin-top:8px"><h2>Writers\' night recordings</h2><ul class="visit-list">' + recs.map(function (r) { return "<li><b>" + h.esc(r.title) + "</b> · " + h.ago(r.at) + (h.safeUrl(r.link) ? ' · <a href="' + h.esc(h.safeUrl(r.link)) + '" target="_blank" rel="noopener">Watch</a>' : "") + "</li>"; }).join("") + "</ul></section>";
  }, FLAG);

  function adminTab() {
    var h = H(), start = new Date(); start.setHours(0, 0, 0, 0);
    var todays = st().visits.filter(function (v) { return v.at >= start.getTime(); }).sort(function (a, b) { return b.at - a.at; });
    return '<div class="admin-grid"><form class="panel" data-form="house-checkin"><h2>Check in a member</h2><p class="muted small">Scan the QR code on their member pass, or type the code under it.</p>' +
      '<label>Member code<input name="code" required placeholder="SH-MARA-XXXX" autocomplete="off" autocapitalize="characters"></label><button class="btn-sm solid">Check in</button></form>' +
      '<section class="panel"><h2>Today\'s visits (' + todays.length + ")</h2>" + (todays.length ? todays.map(function (v) { var m = R.db.member(v.id) || { name: v.id }; return '<div class="mini-member">' + h.avatar(m, 30) + "<span><b>" + h.esc(m.name) + "</b>" + new Date(v.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + "</span></div>"; }).join("") : '<p class="muted">Nobody yet.</p>') + "</section></div>" +
      '<form class="panel" data-form="house-rec" style="margin-top:16px"><h2>Attach a writers\' night recording</h2><div class="admin-grid"><label>Member<select name="member">' +
      R.db.state.members.map(function (m) { return '<option value="' + h.esc(m.id) + '">' + h.esc(m.name) + "</option>"; }).join("") + '</select></label><label>Title<input name="title" required maxlength="100" placeholder="Writers\' night · March 2027"></label><label>Link<input name="link" type="url" required placeholder="https://"></label></div><button class="btn-sm solid">Attach</button></form>';
  }
  R.addAdminTab({ id: "checkin", label: "Check-in", flag: FLAG, render: adminTab });

  R.onForm("house-checkin", function (f, v) {
    var id = parse(v("code"));
    if (!id) { H().toast("That code doesn't match a member. Check it and try again."); return; }
    st().visits.push({ id: id, at: Date.now(), by: R.db.state.me });
    R.save(); H().toast((R.db.member(id).name.split(" ")[0]) + " is checked in."); R.rerender();
  });
  R.onForm("house-rec", function (f, v) {
    if (!H().safeUrl(v("link"))) { H().toast("Links need to start with https://"); return; }
    st().recordings.push({ id: "rec" + Date.now(), member: v("member"), title: v("title"), link: v("link"), at: Date.now() });
    R.db.notify("A writers' night recording was added to your profile.", "#/pass");
    R.save(); H().toast("Recording attached to their profile."); R.rerender();
  });
})();
