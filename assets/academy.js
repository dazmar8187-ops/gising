// Second Chance Academy: the door buttons pick a track in the form, and the form sends
// form_type "academy-application" to HOUSE.forms.academyWebhookUrl, falling back to HOUSE.ghl.webhookUrl. Preview mode while both are blank.
(function () {
  var cfg = window.HOUSE || {};
  var form = document.getElementById("scaForm");
  if (!form) return;
  var url = (cfg.forms || {}).academyWebhookUrl || (cfg.ghl || {}).webhookUrl || "";
  var errEl = document.getElementById("scaErr"), btn = document.getElementById("scaBtn"), sent = document.getElementById("scaSent");

  document.getElementById("scaPreview").hidden = !!url;

  function sync() {
    var t = form.track.value;
    form.querySelectorAll("[data-for]").forEach(function (el) { el.hidden = el.getAttribute("data-for") !== t; });
  }
  form.track.addEventListener("change", sync);
  document.querySelectorAll("[data-track]").forEach(function (a) {
    a.addEventListener("click", function () { form.track.value = a.getAttribute("data-track"); sync(); });
  });
  var q = new URLSearchParams(location.search).get("track");
  if (q && form.querySelector('option[value="' + q.replace(/[^a-z-]/g, "") + '"]')) form.track.value = q;
  sync();

  function fail(msg, el) { errEl.textContent = msg; errEl.hidden = false; if (el) el.focus(); }
  function done(t) {
    Array.prototype.forEach.call(form.querySelectorAll(".field, .consent, #scaBtn, #scaPreview"), function (el) { el.hidden = true; });
    sent.textContent = "Application sent. A real person will read it and reply by email, usually within a week.";
    sent.hidden = false;
    if (window.track) window.track("Academy", { track: t });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;
    var t = form.track.value;
    if (!form.first_name.value.trim()) return fail("Add your first name.", form.first_name);
    if (!form.email.value || !form.email.checkValidity()) return fail("That email doesn't look right. Check it and try again.", form.email);
    if (t === "released") {
      if (!form.age.value) return fail("Choose your age. The Released Class is for 16–18s.", form.age);
      var g = form.guardian_email;
      if (form.age.value !== "18" && (!g.value || !g.checkValidity())) return fail("Add a parent or guardian's email. We need their consent before you start.", g);
    }
    if (!form.consent.checked) return fail("Tick the box so we can email you about this.", form.consent);
    if (!form.agree.checked) return fail("Tick the box to agree to the terms and privacy policy.", form.agree);
    var data = new URLSearchParams({
      form_type: "academy-application",
      track: t,
      first_name: form.first_name.value.trim(),
      email: form.email.value.trim(),
      city: form.city.value.trim(),
      age: t === "released" ? form.age.value : "",
      guardian_email: t === "released" ? form.guardian_email.value.trim() : "",
      note: form.note.value.trim(),
      consent: "yes",
      terms_version: (cfg.legal || {}).termsVersion || "",
      privacy_version: (cfg.legal || {}).privacyVersion || "",
      source: "academy-page",
      registered_at: new Date().toISOString()
    });
    if (!url) { done(t); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    fetch(url, { method: "POST", mode: "no-cors", body: data }).then(function () { done(t); }).catch(function () {
      btn.disabled = false; btn.textContent = "Send my application";
      fail("We couldn't send that. Check your connection and try again.");
    });
  });
})();
