// Feature: Where You Stand Right Now in the members' app (flag "where-you-stand"). Same questions and scoring as
// where-you-stand.html (assets/where-you-stand.js). The result saves to the member and shows on their stave and profile.
// Data: Room.store("standing", { results: { <member id>: { strong, open, role, scores, at, answers } } }).
(function () {
  var R = window.Room, FLAG = "where-you-stand", SR = window.WhereYouStand;
  var H = function () { return R.h; };
  if (!SR) return;
  var st = function () { return R.store("standing", { results: {} }); };
  var lineOf = function (k) { return SR.lines.filter(function (L) { return L.key === k; })[0]; };
  var mine = function () { return st().results[R.db.state.me]; };

  function bars(scores) {
    return '<div class="rd-bars">' + SR.lines.slice().reverse().map(function (L) {
      return '<div class="rd-bar"><b>' + L.key + '</b><span><i style="width:' + Math.max(3, scores[L.key]) + '%"></i></span><em>' + scores[L.key] + "</em></div>";
    }).join("") + "</div>";
  }
  function summary(r, compact) {
    var esc = H().esc, open = lineOf(r.open), role = SR.roles[r.role];
    return '<section class="panel rd-panel"><p class="eyebrow">Where you stand · ' + H().ago(r.at) + "</p>" +
      "<h2>" + esc(SR.headline(r)) + "</h2>" + bars(r.scores) +
      '<p><b>This week:</b> ' + esc(open.move) + ' <a class="link-arrow" href="' + esc(open.where.app) + '">' + esc(open.where.appLabel) + " →</a></p>" +
      (compact ? "" : "<p><b>In a writing room you're " + esc(role.name) + ".</b> " + esc(role.brings) + "</p><p><b>What trips you up:</b> " + esc(role.trips) + "</p><p class=\"muted\"><b>The money side:</b> " + esc(role.money) + "</p>") +
      '<a class="btn-sm" href="#/stand/again">Take it again</a></section>';
  }

  function quiz() {
    var esc = H().esc, prev = (mine() || {}).answers || {};
    return '<form class="panel rd-app" data-form="standing">' + SR.lines.map(function (L) {
      return '<fieldset class="rd-g"><legend><b>' + L.key + "</b> " + esc(L.name) + "<small>" + esc(L.ask) + "</small></legend>" +
        SR.statements.filter(function (s) { return s.line === L.key; }).map(function (s) {
          return '<div class="rd-q"><p>' + esc(s.text) + '</p><div class="rd-scale">' + SR.scale.map(function (o) {
            return '<label><input type="radio" name="' + s.id + '" value="' + o.v + '"' + (String(prev[s.id]) === String(o.v) ? " checked" : "") + "><span>" + o.label + "</span></label>";
          }).join("") + "</div></div>";
        }).join("") + "</fieldset>";
    }).join("") + '<fieldset class="rd-g"><legend><b>♪</b> In a writing room<small>Pick the answer that sounds most like you.</small></legend>' +
      SR.roleQuestions.map(function (q) {
        return '<div class="rd-q"><p>' + esc(q.text) + '</p><div class="rd-scale opts">' + Object.keys(q.opts).map(function (k) {
          return '<label><input type="radio" name="' + q.id + '" value="' + k + '"' + (prev[q.id] === k ? " checked" : "") + "><span>" + esc(q.opts[k]) + "</span></label>";
        }).join("") + "</div></div>";
      }).join("") + '</fieldset><button class="btn-sm solid big">See where I stand</button></form>';
  }

  function render(arg) {
    var r = mine();
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · where you stand</p><h1>Where you stand right now</h1><p class="lead">Not a personality test. Twenty honest statements, four for each of the 5 Keys, and five about how you work in a writing room. Answer for today. Come back in three months and watch the lines move.</p></div>' +
      (r && arg !== "again" ? summary(r, false) : quiz());
  }

  R.registerRoute("stand", { title: "Where You Stand", flag: FLAG, render: render });
  R.addNav({ id: "stand", href: "#/stand", label: "Where you stand", flag: FLAG, icon: '<path d="M3 6h18M3 10h18M3 14h18M3 18h18"/><circle cx="15" cy="12" r="2.5"/>' });
  R.addSlot("stave.side", function () {
    var r = mine();
    return r ? summary(r, true) : '<section class="side-card"><p class="eyebrow">Where You Stand Right Now</p><h3>Where do your songs stand?</h3><p>Ten minutes, twenty honest statements, one move for this week.</p><a class="btn-sm solid" href="#/stand">Find out</a></section>';
  }, FLAG);
  R.addSlot("me.after", function () { var r = mine(); return r ? summary(r, true) : ""; }, FLAG);
  R.addSlot("profile.after", function (m) {
    var r = st().results[m.id]; if (!r || m.id === R.db.state.me) return "";
    var role = SR.roles[r.role];
    return '<section class="panel"><p class="eyebrow">In a writing room</p><h2>' + H().esc(role.name) + '</h2><p class="muted">' + H().esc(role.brings) + "</p></section>";
  }, FLAG);

  R.onForm("standing", function (f) {
    var a = {};
    SR.statements.forEach(function (s) { var c = f.querySelector('input[name="' + s.id + '"]:checked'); if (c) a[s.id] = Number(c.value); });
    SR.roleQuestions.forEach(function (q) { var c = f.querySelector('input[name="' + q.id + '"]:checked'); if (c) a[q.id] = c.value; });
    if (!SR.complete(a)) {
      var left = SR.statements.concat(SR.roleQuestions).filter(function (q) { return a[q.id] === undefined; });
      H().toast(left.length + (left.length === 1 ? " question is" : " questions are") + " still open.");
      var el = f.querySelector('input[name="' + left[0].id + '"]'); if (el) el.focus();
      return;
    }
    var r = SR.result(a);
    st().results[R.db.state.me] = { strong: r.strong.key, open: r.open.key, role: r.roleId, scores: r.scores, at: r.at, answers: a };
    R.save(); location.hash = "#/stand"; R.rerender(); window.scrollTo(0, 0);
  });
})();
