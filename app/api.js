// The Room · server adapter. Runs after data.js and core.js, before the feature files and app.js.
//   Demo (no server, or the server isn't connected to GHL): nothing changes; data stays in this browser.
//   Live (GHL): members sign in with a link sent to their email; the house is loaded from /api/state and every
//   change is written back to GHL. The app's views don't know the difference: they read Room.db.state as before.
(function () {
  var R = window.Room, db = R.db;
  var served = /^https?:$/.test(location.protocol);
  var snap = null, timer = null, inflight = false;

  function toast(msg) { if (R.h && R.h.toast) R.h.toast(msg); }
  function getJSON(url, opts) {
    return fetch(url, Object.assign({ credentials: "same-origin", headers: { "Content-Type": "application/json" } }, opts || {}))
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, data: d }; }); });
  }

  // ---------- what this member can change, as comparable JSON strings ----------
  var str = function (x) { return JSON.stringify(x == null ? null : x); };
  function parts() {
    var s = db.state, me = db.me() || {};
    var p = {
      profile: str({ name: me.name, city: me.city, roles: me.roles, languages: me.languages, sounds: me.sounds, bio: me.bio, link: me.link, openToWrite: me.openToWrite, photo: me.photo }),
      member: str({ selfMilestones: s.selfMilestones, rsvps: s.rsvps, played: s.played, checklistHidden: s.checklistHidden, notifications: s.notifications }),
      pairing: str({ optIn: !!(s.pairing && s.pairing.optIn) }),
      callLinks: str(s.callLinks), groups: str(s.pairing && s.pairing.groups),
      rooms: {}, prodesk: {}, openTimes: {}, ext: {}
    };
    Object.keys(s.rooms || {}).forEach(function (k) { p.rooms[k] = str(s.rooms[k]); });
    (s.prodesk || []).forEach(function (e) { p.prodesk[e.id] = str(e); });
    (s.openTimes || []).forEach(function (t) { p.openTimes[t.id] = str(t); });
    Object.keys(s.ext || {}).forEach(function (k) { p.ext[k] = str(s.ext[k]); });
    return p;
  }
  function changes() {
    var now = parts(), s = db.state, out = {}, any = false;
    ["profile", "member", "pairing"].forEach(function (k) { if (now[k] !== snap[k]) { out[k] = JSON.parse(now[k]); any = true; } });
    if (now.profile !== snap.profile && JSON.parse(snap.profile || "{}").photo === out.profile.photo) delete out.profile.photo; // don't re-upload an unchanged photo
    var staff = !!(db.me() && (db.me().host || db.me().mentor));
    if (staff && now.callLinks !== snap.callLinks) { out.callLinks = s.callLinks; any = true; }
    if (staff && now.groups !== snap.groups) { out.groups = s.pairing.groups; any = true; }
    var rooms = {}; Object.keys(now.rooms).forEach(function (k) { if (now.rooms[k] !== snap.rooms[k]) rooms[k] = s.rooms[k]; });
    if (Object.keys(rooms).length) { out.rooms = rooms; any = true; }
    var pd = (s.prodesk || []).filter(function (e) { return now.prodesk[e.id] !== snap.prodesk[e.id]; });
    if (pd.length) { out.prodesk = pd; any = true; }
    var ot = (s.openTimes || []).filter(function (t) { return now.openTimes[t.id] !== snap.openTimes[t.id]; });
    if (ot.length) { out.openTimes = ot; any = true; }
    var ext = {}; Object.keys(now.ext).forEach(function (k) { if (now.ext[k] !== snap.ext[k]) ext[k] = s.ext[k]; });
    if (Object.keys(ext).length) { out.ext = ext; any = true; }
    return { body: out, any: any, next: now };
  }

  // Debounced write-through. Also runs on a timer, so changes made inside data.js (which saves internally) are caught.
  function sync() {
    if (R.mode !== "ghl" || !snap || !db.me()) return;
    clearTimeout(timer);
    timer = setTimeout(push, 1500);
  }
  function push() {
    if (inflight) { sync(); return; }
    var c = changes();
    if (!c.any) return;
    inflight = true;
    getJSON("/api/state", { method: "PUT", body: JSON.stringify(c.body) }).then(function (r) {
      inflight = false;
      if (r.status === 200) snap = c.next;
      else if (r.status === 401) { toast("You've been signed out. Sign in again to save."); }
      else toast((r.data && r.data.error) || "Couldn't save to the house just now. We'll try again.");
    }, function () { inflight = false; toast("You're offline. Changes will save when you're back."); });
  }

  // ---------- sign in by email (live only) ----------
  function loginSlot() {
    return '<form class="ghl-login" data-form="ghl-login"><label>Your email<input name="email" type="email" required autocomplete="email"></label>' +
      '<button class="btn-sm sun big">Email me a sign-in link</button><p class="ghl-login-msg" role="status" aria-live="polite"></p></form>' +
      '<p class="ghl-login-note">Use the email you joined with. Not a member yet? <a href="../join.html">Join free</a>.</p>';
  }
  R.onForm("ghl-login", function (f, v) {
    var msg = f.querySelector(".ghl-login-msg"), btn = f.querySelector("button");
    btn.disabled = true; msg.textContent = "Sending…";
    getJSON("/api/auth-request", { method: "POST", body: JSON.stringify({ email: v("email") }) }).then(function (r) {
      btn.disabled = false;
      msg.textContent = r.status === 200 ? "Check your email for a sign-in link. It works for 20 minutes." : (r.data && r.data.error) || "That didn't work. Try again in a minute.";
    }, function () { btn.disabled = false; msg.textContent = "You seem to be offline. Try again."; });
  });

  // ---------- load the house ----------
  function load(d) {
    var s = db.state;
    ["me", "members", "rooms", "prodesk", "openTimes", "callLinks", "selfMilestones", "rsvps", "played", "notifications", "ext"].forEach(function (k) { if (k in d) s[k] = d[k]; });
    s.checklistHidden = !!d.checklistHidden;
    s.posts = []; s.announcements = [];
    s.pairing = Object.assign({ optIn: false, others: [], groups: [], signedWeeks: [] }, d.pairing || {});
    snap = parts();
  }

  function start() {
    if (!served) return Promise.resolve("demo");
    return getJSON("/api/health").then(function (h) {
      if (!h.data || h.data.mode !== "ghl") return "demo";
      R.mode = "ghl";
      document.body.classList.add("mode-ghl");
      // Never write live member data into the browser's demo copy (data.js saves there internally).
      // Those saves become a sync to GHL instead.
      try {
        var setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) { if (/^stave_room_demo_/.test(k)) { sync(); return; } return setItem.call(this, k, v); };
      } catch (e) { /* storage blocked: nothing to protect */ }
      db.save = function () { sync(); };
      db.signOut = function () { fetch("/api/auth-logout", { method: "POST", credentials: "same-origin" }).finally(function () { location.href = "../app/"; }); };
      db.reset = function () {};
      return getJSON("/api/state").then(function (r) {
        if (r.status === 200) { load(r.data); setInterval(push, 5000); return "ghl"; }
        db.state.me = null;
        R.addSlot("welcome.after", loginSlot);
        return "ghl-signed-out";
      });
    }).catch(function () { return "demo"; });
  }

  R.api = { sync: sync, push: push, reload: function () { return getJSON("/api/state").then(function (r) { if (r.status === 200) { load(r.data); R.rerender(); } }); } };
  R.ready = start();
})();
