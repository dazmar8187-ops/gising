// Feature: Your stave as a portfolio (flag "stave-portfolio"). Members can opt in to a public portfolio: their stave
// line plus the songs they've finished, registered and released (from the Ledger). The public page is member.html?id=…
// Data: Room.store("portfolio", { public: { <id>: true }, line: { <id>: "On the B line · Book" } }).
(function () {
  var R = window.Room, FLAG = "stave-portfolio";
  var H = function () { return R.h; };
  var st = function () { var s = R.store("portfolio", { public: {}, line: {} }); s.line = s.line || {}; return s; };

  function shareUrl(id) { return new URL("../member.html?id=" + encodeURIComponent(id), location.href).href; }
  function panel(compact) {
    var h = H(), me = R.db.state.me, on = !!st().public[me];
    if ((R.db.member(me) || {}).under18) return '<section class="panel portfolio-panel"><p class="eyebrow">Your 5 Keys as a portfolio</p><h2>Private until you\'re 18</h2><p class="muted">Portfolios of members under 18 aren\'t public. Your 5 Keys and songs are all still here for you.</p></section>';
    var songs = R.ledger ? R.ledger.mine(me) : [];
    var reg = songs.filter(function (s) { return s.status.registered; }), rel = songs.filter(function (s) { return s.status.released; });
    return '<section class="panel portfolio-panel"><div class="panel-h"><div><p class="eyebrow">Your 5 Keys as a portfolio</p><h2>' + (on ? "Your portfolio is public" : "Show your work to the industry") + '</h2></div>' +
      '<label class="switch"><input type="checkbox" data-act="pf-toggle"' + (on ? " checked" : "") + '><span></span> Public portfolio</label></div>' +
      '<p class="muted">' + (on ? "Anyone with the link can see where you are on the 5 Keys and the songs you've finished, registered and released. Your lyrics, notes and earnings stay private." :
        "Turn this on to get a public page showing where you are on the 5 Keys and your finished songs, to send to publishers, A&R and Circle mentors. Lyrics, notes and earnings always stay private.") + "</p>" +
      (compact ? "" : '<div class="pf-preview"><p class="mono small">' + h.esc(st().line[me] || "Where you are on the 5 Keys shows here") + '</p><div class="wk-stats light"><div><b>' + songs.length + '</b><span>finished together</span></div><div><b>' + reg.length + '</b><span>registered</span></div><div><b>' + rel.length + "</b><span>released</span></div></div>" +
        (rel.concat(reg.filter(function (s) { return !s.status.released; })).slice(0, 5).map(function (s) { return '<p class="pf-song"><b>' + h.esc(s.title) + '</b> <span class="muted small">' + (s.status.released ? "Released" : "Registered") + " · with " + s.writers.filter(function (w) { return w !== me; }).map(function (w) { return h.esc(((R.db.member(w) || {}).name || "").split(" ")[0]); }).join(" and ") + "</span></p>"; }).join("")) + "</div>") +
      (on ? '<div class="pf-share"><input readonly id="pfLink" value="' + h.esc(shareUrl(me)) + '" aria-label="Your portfolio link"><button class="btn-sm solid" data-act="pf-copy">Copy link</button><a class="btn-sm" href="' + h.esc(shareUrl(me)) + '" target="_blank" rel="noopener">View it</a></div>' : "") + "</section>";
  }

  R.addSlot("stave.after", function () { return panel(false); }, FLAG);
  R.addSlot("me.after", function () { return panel(true); }, FLAG);

  // Keep a snapshot of the member's stave line for the public page.
  R.onRender(function (route) {
    if (route !== "stave" || !R.flag(FLAG)) return;
    var h2 = document.querySelector(".journey h2"); if (!h2) return;
    var me = R.db.state.me, s = st();
    if (s.line[me] !== h2.textContent) { s.line[me] = h2.textContent; R.db.save(); }
  });

  R.onAct("pf-toggle", function (el) { if ((R.db.member(R.db.state.me) || {}).under18) return; st().public[R.db.state.me] = el.checked; R.save(); H().toast(el.checked ? "Your portfolio is public." : "Your portfolio is private again."); R.rerender(); });
  R.onAct("pf-copy", function () {
    var inp = document.getElementById("pfLink"); if (!inp) return;
    var done = function () { H().toast("Link copied."); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(done, function () { inp.select(); });
    else { inp.select(); try { document.execCommand("copy"); done(); } catch (e) {} }
  });
})();
