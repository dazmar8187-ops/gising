// Feature: shareable member profiles (flag "public-profiles").
// Opt-in switches on the profile page; the public page is ../member.html?id=<member id>,
// which reads state.ext.profiles.public[id] and state.ext.profiles.showSongs[id].
(function () {
  var FLAG = "public-profiles";
  var H = function () { return Room.h; };
  function st() { return Room.store("profiles", { public: {}, showSongs: {} }); }
  function link(id) { return new URL("../member.html?id=" + encodeURIComponent(id), location.href).href; }

  Room.addSlot("me.after", function (me) {
    if (me.under18) return '<section class="panel pp-panel"><h2>Public profile</h2><p class="muted">Profiles of members under 18 stay private, so there\'s no public link. You can still share your songs yourself.</p></section>';
    var esc = H().esc, s = st(), on = !!s.public[me.id], songs = !!s.showSongs[me.id];
    return '<section class="panel pp-panel"><h2>Public profile</h2><p class="muted">Off by default. Turn it on to get a link you can put in your bio or send to a collaborator. Only what you choose here is shown.</p>' +
      '<label class="switch"><input type="checkbox" data-act="pp-public"' + (on ? " checked" : "") + '><span></span> Make my profile public</label>' +
      '<label class="switch"><input type="checkbox" data-act="pp-songs"' + (songs ? " checked" : "") + (on ? "" : " disabled") + '><span></span> Show my finished songs</label>' +
      (on ? '<div class="ref-link"><label class="sr-only" for="ppLink">Your public profile link</label><input id="ppLink" readonly value="' + esc(link(me.id)) + '"><button type="button" class="btn-sm solid" data-act="pp-copy">Copy</button><a class="btn-sm" href="' + esc(link(me.id)) + '" target="_blank" rel="noopener">View</a></div>' : "") + "</section>";
  }, FLAG);
  Room.addSlot("profile.after", function (m) {
    return st().public[m.id] && !m.under18 ? '<p class="pp-chip"><span class="chip green">Public profile</span> <a href="' + H().esc(link(m.id)) + '" target="_blank" rel="noopener">See the public page →</a></p>' : "";
  }, FLAG);

  Room.onAct("pp-public", function (el) { var s = st(), me = Room.db.state.me; if ((Room.db.member(me) || {}).under18) return; s.public[me] = el.checked; if (!el.checked) s.showSongs[me] = false; Room.save(); H().toast(el.checked ? "Your profile is public." : "Your profile is private again."); Room.rerender(); });
  Room.onAct("pp-songs", function (el) { st().showSongs[Room.db.state.me] = el.checked; Room.save(); });
  Room.onAct("pp-copy", function (el) {
    var inp = document.getElementById("ppLink");
    var ok = function () { el.textContent = "Copied"; setTimeout(function () { el.textContent = "Copy"; }, 1600); };
    var fallback = function () { inp.focus(); inp.select(); try { document.execCommand("copy"); ok(); } catch (e) { H().toast("Select the link and copy it."); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(inp.value).then(ok, fallback); else fallback();
  });
})();
