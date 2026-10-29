// The Room · extension registry. Loaded after data.js and before any feature file and app.js.
// Feature files (site/app/features/*.js) register routes, nav items, slots, actions, forms and admin tabs here;
// app.js reads the registry. Keep features behind a flag id from assets/flags.js.
(function () {
  var R = window.Room = window.Room || {};
  R.mode = R.mode || "demo";            // "demo" (browser only) or "ghl" (set by api.js when the server is connected)
  R.routes = {}; R.navItems = []; R.slots = {}; R.acts = {}; R.forms = {}; R.inputs = []; R.adminTabs = []; R.afterRender = [];

  R.flag = function (id) { return !id || (window.Flags ? window.Flags.isOn(id) : false); };

  // route: #/<name>/<arg>. def = { title, flag, render(arg, parts) -> html, after(arg) }
  R.registerRoute = function (name, def) { R.routes[name] = def; };
  // nav: { id, href, label, icon (svg inner markup), flag, staff (bool) }
  R.addNav = function (item) { R.navItems.push(item); };
  // slots: named insertion points inside the core views. fn(ctx) -> html
  //   post.actions, post.after, profile.actions, profile.after, write.main, write.side, cowrites.after,
  //   feed.side, stave.after, academy.after, calendar.after, me.after, members.after, welcome.after
  R.addSlot = function (name, fn, flag) { (R.slots[name] = R.slots[name] || []).push({ fn: fn, flag: flag }); };
  R.slot = function (name, ctx) {
    return (R.slots[name] || []).filter(function (s) { return R.flag(s.flag); }).map(function (s) {
      try { return s.fn(ctx) || ""; } catch (e) { console.error("slot " + name, e); return ""; }
    }).join("");
  };
  // click actions: data-act="<name>". fn(el, ctx) where ctx = { id, key, state }
  R.onAct = function (name, fn) { R.acts[name] = fn; };
  // form submits: data-form="<kind>". fn(form, v) where v(name) -> trimmed value
  R.onForm = function (kind, fn) { R.forms[kind] = fn; };
  // input events anywhere: fn(event) -> true if handled
  R.onInput = function (fn) { R.inputs.push(fn); };
  // admin tabs: { id, label, flag, render() -> html }
  R.addAdminTab = function (tab) { R.adminTabs.push(tab); };
  // run after each render: fn(routeName, arg)
  R.onRender = function (fn) { R.afterRender.push(fn); };

  // Namespaced, persisted state for a feature: Room.store("ledger", { songs: [] })
  R.store = function (ns, defaults) {
    var st = R.db.state;
    st.ext = st.ext || {};
    if (!st.ext[ns]) { st.ext[ns] = JSON.parse(JSON.stringify(defaults || {})); R.db.save(); }
    return st.ext[ns];
  };
  R.save = function () { R.db.save(); if (R.api && R.api.sync) R.api.sync(); };
  R.rerender = function () { if (R.route) R.route(); };
})();
