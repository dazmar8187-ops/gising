// Feature: referrals and gift memberships (flag "referrals").
// Personal invite link (join.html?ref=<member id>), who joined with it, and gift memberships.
// Demo: Room.store("referrals"). Live (GHL): the join form already carries ?ref through to GHL once wired;
// gifts go to a GHL webhook (see report).
(function () {
  var FLAG = "referrals";
  var H = function () { return Room.h; };
  function st() { return Room.store("referrals", { joined: {}, gifts: [] }); }
  function link() { return new URL("../join.html?ref=" + encodeURIComponent(Room.db.state.me), location.href).href; }
  function joinedFor(me) {
    var s = st();
    if (!s.joined[me]) { // demo: one person has already used this member's link
      var pick = me === "eli" ? "ligaya" : "eli";
      s.joined[me] = [{ member: pick, at: Date.now() - 3 * 864e5, demo: true }]; Room.save();
    }
    return s.joined[me];
  }

  function render() {
    var h = H(), esc = h.esc, me = Room.db.state.me, list = joinedFor(me), gifts = st().gifts.filter(function (g) { return g.by === me; });
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · invite</p><h1>Bring a writer in</h1><p class="lead">Songwriters bring songwriters. Share your link with someone you\'d want in the room.</p></div>' +
      '<div class="admin-grid"><section class="panel"><h2>Your invite link</h2>' +
      '<div class="ref-link"><label class="sr-only" for="refLink">Your invite link</label><input id="refLink" readonly value="' + esc(link()) + '"><button class="btn-sm solid" data-act="ref-copy">Copy</button></div>' +
      '<p class="muted">The plan: when paid membership starts, you and the writer you invite each get a free month. Until then, the founding season is free for everyone.</p>' +
      "<h3>Joined with your link</h3>" + (list.length ? '<ul class="ref-list">' + list.map(function (j) {
        var m = Room.db.member(j.member) || { name: j.name || "A new member", id: "x" };
        return "<li>" + h.avatar(m, 28) + " <b>" + esc(m.name) + "</b> · " + h.ago(j.at) + (j.demo ? ' <span class="chip">example</span>' : "") + "</li>";
      }).join("") + "</ul>" : '<p class="muted">Nobody yet.</p>') + "</section>" +
      '<form class="panel" data-form="ref-gift"><h2>Gift a membership</h2><p class="muted">For a birthday, a holiday, or a writer who needs a push. They get an email with your message and a link to join.</p>' +
      '<label>Their name<input name="name" required maxlength="60"></label><label>Their email<input name="email" type="email" required></label>' +
      '<label>Your message<textarea name="msg" rows="3" maxlength="400" placeholder="Come write with me."></textarea></label><button class="btn-sm solid">Send the gift</button>' +
      (gifts.length ? '<h3>Gifts you\'ve sent</h3><ul class="ref-list">' + gifts.map(function (g) { return "<li><b>" + esc(g.name) + "</b> · " + esc(g.email) + " · " + h.ago(g.at) + "</li>"; }).join("") + "</ul>" : "") + "</form></div>";
  }

  Room.registerRoute("invite", { title: "Invite", flag: FLAG, render: render });
  Room.addNav({ id: "invite", href: "#/invite", label: "Invite", flag: FLAG, icon: '<path d="M4 8h16v12H4z"/><path d="M12 8v12M4 12h16M12 8c-2-4-6-3-5 0M12 8c2-4 6-3 5 0"/>' });
  Room.addSlot("feed.side", function () {
    return '<section class="side-card"><p class="eyebrow">Invite</p><h3>Know a writer who should be here?</h3><a class="btn-sm solid" href="#/invite">Get your invite link</a></section>';
  }, FLAG);

  Room.onAct("ref-copy", function (el) {
    var inp = document.getElementById("refLink"), text = inp.value;
    var ok = function () { el.textContent = "Copied"; setTimeout(function () { el.textContent = "Copy"; }, 1600); };
    var fallback = function () { inp.focus(); inp.select(); try { document.execCommand("copy"); ok(); } catch (e) { H().toast("Select the link and copy it."); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
  });
  Room.onForm("ref-gift", function (f, v) {
    if (!f.elements.email.checkValidity()) { H().toast("That email doesn't look right."); return; }
    st().gifts.push({ by: Room.db.state.me, name: v("name"), email: v("email"), msg: v("msg"), at: Date.now() });
    Room.save(); H().toast(Room.mode === "ghl" ? "Gift sent." : "Gift saved. Live, " + v("name") + " gets an email with your message."); Room.rerender();
  });
})();
