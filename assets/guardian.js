// Parent or guardian consent page (guardian.html?t=…). Talks to /api/guardian-consent (netlify/functions).
// Demo mode (no GHL settings): the page still works as a preview and saves nothing.
(function () {
  var cfg = window.HOUSE || {};
  var t = new URLSearchParams(location.search).get("t") || "";
  var form = document.getElementById("gcForm"), err = document.getElementById("gcErr"), btn = document.getElementById("gcBtn");
  var preview = false;
  var show = function (id, on) { document.getElementById(id).hidden = !on; };

  function stop(msg) {
    var p = document.getElementById("gcProblem"); p.textContent = msg; p.hidden = false;
    show("gcBody", false);
  }
  function finished(msg) {
    show("gcBody", false); show("gcPreview", false);
    var d = document.getElementById("gcDone"); d.textContent = msg; d.hidden = false;
    d.focus && d.setAttribute("tabindex", "-1"); d.focus();
  }
  function api(method, payload) {
    return fetch("/api/guardian-consent" + (method === "GET" ? "?t=" + encodeURIComponent(t) : ""), {
      method: method, headers: { "Content-Type": "application/json" }, body: payload ? JSON.stringify(payload) : undefined
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, data: d }; }); });
  }

  api("GET").then(function (r) {
    // 503 demo answer, or no server functions at all (opened locally): preview.
    if (r.status === 503 || (r.data && r.data.mode === "demo") || (r.status === 404 && !(r.data && r.data.error))) { preview = true; show("gcPreview", true); return; }
    if (r.status === 409 && r.data.done) { finished("Consent has already been given. Thank you."); return; }
    if (r.status !== 200) { stop((r.data && r.data.error) || "This consent link isn't working. Ask the writer to sign in again and we'll send a new one."); return; }
    document.querySelectorAll("[data-writer]").forEach(function (el) { el.textContent = r.data.writer; });
    document.getElementById("gcTitle").textContent = "Your consent for " + r.data.writer + ".";
    document.getElementById("gcLede").textContent = r.data.writer + " has asked to join Gising Sining House and gave " + r.data.guardian + " as their parent or guardian's email. Nothing starts until you agree.";
  }, function () { preview = true; show("gcPreview", true); });

  function fail(msg, el) { err.textContent = msg; err.hidden = false; if (el) el.focus(); }

  form.addEventListener("submit", function (e) {
    e.preventDefault(); err.hidden = true;
    var name = form.guardian_name.value.trim(), rel = form.querySelector('input[name="relationship"]:checked');
    if (name.length < 3) return fail("Add your full name.", form.guardian_name);
    if (!rel) return fail("Choose your relationship to the writer.", form.querySelector('input[name="relationship"]'));
    var keys = ["isGuardian", "terms", "agreement", "privacy", "join"], confirm = {};
    for (var i = 0; i < keys.length; i++) { var box = form[keys[i]]; if (!box.checked) return fail("Tick every box to give consent.", box); confirm[keys[i]] = true; }
    var norm = function (s) { return s.trim().toLowerCase().replace(/\s+/g, " "); };
    if (norm(form.signature.value) !== norm(name)) return fail("Type your full name exactly as above to sign.", form.signature);
    if (preview) { finished("Preview: consent would be recorded now, and the writer's invite sent."); return; }
    btn.disabled = true; btn.textContent = "Saving…";
    api("POST", { t: t, decision: "give", guardian_name: name, relationship: rel.value, signature: form.signature.value, confirm: confirm, version: (cfg.legal || {}).termsVersion || "" })
      .then(function (r) {
        if (r.status === 200) finished("Thank you. Consent is recorded, and we'll send the writer their invite. A copy of what you agreed to is on file; email us any time to change it.");
        else { btn.disabled = false; btn.textContent = "Give consent"; fail((r.data && r.data.error) || "That didn't save. Try again."); }
      }, function () { btn.disabled = false; btn.textContent = "Give consent"; fail("You seem to be offline. Try again."); });
  });

  document.getElementById("gcDecline").addEventListener("click", function () {
    if (!window.confirm("Decline consent? The writer won't be able to join until a parent or guardian agrees.")) return;
    if (preview) { finished("Preview: the decision would be recorded now."); return; }
    api("POST", { t: t, decision: "decline" }).then(function (r) {
      if (r.status === 200) finished("Thank you. We've recorded that you don't consent, and the writer won't be given access. If you change your mind, email us.");
      else fail((r.data && r.data.error) || "That didn't save. Try again.");
    }, function () { fail("You seem to be offline. Try again."); });
  });
})();
