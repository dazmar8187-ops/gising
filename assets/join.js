// Sends the join form to a GoHighLevel "Inbound Webhook" workflow trigger,
// then moves the new member to the welcome page.
(function () {
  var form = document.getElementById("joinForm");
  if (!form) return;
  var cfg = window.HOUSE || { ghl: {} };
  var errEl = document.getElementById("formErr");
  var btn = document.getElementById("joinBtn");
  var connected = !!(cfg.ghl && cfg.ghl.webhookUrl);

  if (!connected) document.getElementById("previewNote").hidden = false;

  // Build the country list from the regions in config.js, one group per region.
  var countrySel = form.country;
  (cfg.regions || []).forEach(function (r) {
    var g = document.createElement("optgroup");
    g.label = r.name;
    r.countries.forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; g.appendChild(o);
    });
    countrySel.appendChild(g);
  });

  // 16- and 17-year-olds need a parent or guardian's consent (terms.html#young), so ask for their email.
  form.addEventListener("change", function (e) {
    if (e.target.name === "age_band") document.getElementById("jGuardianField").hidden = e.target.value !== "16-17";
  });

  function fail(msg, focusEl) {
    errEl.textContent = msg;
    errEl.hidden = false;
    if (focusEl) focusEl.focus();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;

    var first = form.first_name.value.trim();
    var email = form.email;
    if (!first) return fail("Add your first name so we know what to call you.", form.first_name);
    if (!email.value || !email.checkValidity()) return fail("That email doesn't look right. Check it and try again.", email);
    if (!form.country.value) return fail("Choose where you live, so we can match you with writers in your time zone.", form.country);
    var ageBand = form.querySelector('input[name="age_band"]:checked');
    if (!ageBand) return fail("Choose your age.", form.querySelector('input[name="age_band"]'));
    if (ageBand.value === "16-17" && (!form.guardian_email.value || !form.guardian_email.checkValidity())) return fail("Add a parent or guardian's email. We need their consent before you start.", form.guardian_email);
    if (!form.querySelector('input[name="writer_stage"]:checked')) return fail("Choose where you are as a writer.", form.querySelector('input[name="writer_stage"]'));
    if (!form.consent.checked) return fail("Tick the email box. It's how the prompt and your invite reach you.", form.consent);
    if (!form.agree.checked) return fail("Tick the box to agree to the member agreement and terms.", form.agree);

    var roles = Array.prototype.map.call(form.querySelectorAll('input[name="roles"]:checked'), function (c) { return c.value; });
    var data = new URLSearchParams({
      first_name: first,
      email: email.value.trim(),
      country: form.country.value,
      writer_stage: form.querySelector('input[name="writer_stage"]:checked').value,
      roles: roles.join(", "),
      interest: form.interest.value,
      age_band: form.querySelector('input[name="age_band"]:checked').value,
      guardian_email: form.guardian_email.value.trim(),
      price_region: cfg.regionFor(form.country.value).id,
      price_php: String(cfg.regionFor(form.country.value).price),
      consent: "yes",
      agreement_version: (cfg.legal || {}).memberAgreementVersion || "",
      terms_version: (cfg.legal || {}).termsVersion || "",
      privacy_version: (cfg.legal || {}).privacyVersion || "",
      source: "website-join",
      season: "founding",
      joined_at: new Date().toISOString()
    });

    try { sessionStorage.setItem("house_first_name", first); } catch (err) { /* storage may be blocked; the welcome page copes */ }

    if (window.track) window.track("Join", { country: form.country.value });
    if (!connected) { window.location.href = "welcome.html"; return; }

    btn.disabled = true;
    btn.textContent = "Joining…";
    // A form-encoded body with no-cors is a "simple" request, so the browser sends it
    // without a CORS preflight. The response is opaque; a network failure still rejects.
    fetch(cfg.ghl.webhookUrl, { method: "POST", mode: "no-cors", body: data })
      .then(function () { window.location.href = "welcome.html"; })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = "Join free";
        fail("We couldn't reach the sign-up service. Check your connection and try again.");
      });
  });
})();
