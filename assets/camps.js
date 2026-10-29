// Camp page: fills places-left from config.js and sends "join and reserve" requests to GoHighLevel.
(function () {
  var h = window.HOUSE;
  if (!h || !h.camp01) return;
  var c = h.camp01;
  var tier = function (id) { return c.tiers.filter(function (t) { return t.id === id; })[0]; };
  var each = function (sel, fn) { document.querySelectorAll(sel).forEach(fn); };

  each("[data-camp]", function (el) { var k = el.getAttribute("data-camp"); if (c[k]) el.textContent = c[k]; });

  // Prices show only when set to a number in config.js (HOUSE.prices). Today they're all null, so nothing shows.
  (function () {
    var pr = (window.HOUSE && window.HOUSE.prices) || {};
    document.querySelectorAll("[data-price-key]").forEach(function (el) {
      var v = pr[el.getAttribute("data-price-key")];
      if (typeof v === "number" && isFinite(v)) { el.textContent = (el.dataset.prefix || "From ") + "₱" + v.toLocaleString("en-PH"); el.hidden = false; }
    });
  })();


  c.tiers.forEach(function (t) {
    var left = Math.max(0, t.places - t.taken);
    var full = left === 0;
    each('[data-left="' + t.id + '"]', function (el) { el.textContent = full ? "Full · join the waitlist" : left + " of " + t.places + " places left"; });
    each('[data-left-short="' + t.id + '"]', function (el) { el.textContent = full ? "Full" : left + " left"; });
    each('[data-meter="' + t.id + '"] i', function (el) { el.style.width = (100 * t.taken / t.places) + "%"; });
    if (full) each('input[name="tier"][value="' + t.id + '"]', function (el) { el.disabled = true; el.checked = false; });
  });

  each("[data-pick]", function (a) {
    a.addEventListener("click", function () {
      var r = document.querySelector('input[name="tier"][value="' + a.getAttribute("data-pick") + '"]');
      if (r && !r.disabled) r.checked = true;
    });
  });

  var form = document.getElementById("campForm");
  if (!form) return;

  // ---- country list ----
  var countrySel = form.country;
  (h.regions || []).forEach(function (r) {
    var g = document.createElement("optgroup"); g.label = r.name;
    r.countries.forEach(function (name) { var o = document.createElement("option"); o.value = name; o.textContent = name; g.appendChild(o); });
    countrySel.appendChild(g);
  });

  // ---- submit ----
  var url = h.ghl && h.ghl.campWebhookUrl;
  var joinUrl = h.ghl && h.ghl.webhookUrl;
  var errEl = document.getElementById("campErr");
  var btn = document.getElementById("campBtn");
  if (!url) document.getElementById("campPreview").hidden = false;
  function fail(msg, el) { errEl.textContent = msg; errEl.hidden = false; if (el) el.focus(); }
  // 16- and 17-year-olds need a parent or guardian's consent (terms.html#young), so ask for their email.
  form.addEventListener("change", function (e) {
    if (e.target.name === "age_band") document.getElementById("cGuardianField").hidden = e.target.value !== "16-17";
  });
  var post = function (u, data) { return fetch(u, { method: "POST", mode: "no-cors", body: data }); };

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;
    if (!form.first_name.value.trim()) return fail("Add your first name.", form.first_name);
    if (!form.email.value || !form.email.checkValidity()) return fail("That email doesn't look right. Check it and try again.", form.email);
    if (!countrySel.value) return fail("Choose where you live.", countrySel);
    if (!form.song_link.value || !form.song_link.checkValidity()) return fail("Add a link to one song, starting with https://. A rough demo is fine.", form.song_link);
    if (!form.querySelector('input[name="tier"]:checked')) return fail("Choose a founding place.", form.querySelector('input[name="tier"]'));
    var ageBand = form.querySelector('input[name="age_band"]:checked');
    if (!ageBand) return fail("Choose your age.", form.querySelector('input[name="age_band"]'));
    if (ageBand.value === "16-17" && (!form.guardian_email.value || !form.guardian_email.checkValidity())) return fail("Add a parent or guardian's email. We need their consent before you start.", form.guardian_email);
    if (!form.consent.checked) return fail("Tick the box to confirm you've read the camp terms.", form.consent);
    if (!form.agree.checked) return fail("Tick the box to agree to the member agreement and terms.", form.agree);

    var t = tier(form.querySelector('input[name="tier"]:checked').value);
    var isNew = form.querySelector('input[name="membership"]:checked').value === "new";
    var region = h.regionFor(countrySel.value);
    var roles = Array.prototype.map.call(form.querySelectorAll('input[name="roles"]:checked'), function (x) { return x.value; }).join(", ");
    var common = {
      first_name: form.first_name.value.trim(),
      email: form.email.value.trim(),
      country: countrySel.value,
      roles: roles,
      price_region: region.id,
      price_php: String(region.price),
      age_band: form.querySelector('input[name="age_band"]:checked').value,
      guardian_email: form.guardian_email.value.trim(),
      consent: "yes",
      agreement_version: (h.legal || {}).memberAgreementVersion || "",
      terms_version: (h.legal || {}).termsVersion || "",
      privacy_version: (h.legal || {}).privacyVersion || ""
    };
    var reservation = new URLSearchParams(Object.assign({}, common, {
      form_type: "camp-reservation",
      camp: "camp-01-tagaytay",
      join_founding: isNew ? "yes" : "already-member",
      song_link: form.song_link.value.trim(),
      tier: t ? t.id : "standard",
      pod: form.querySelector('input[name="pod"]:checked').value,
      room: form.room.value,
      needs: form.needs.value.trim(),
      applied_at: new Date().toISOString()
    }));
    var join = new URLSearchParams(Object.assign({}, common, {
      writer_stage: "camp-applicant",
      interest: "manila",
      source: "camps-page",
      season: "founding",
      joined_at: new Date().toISOString()
    }));

    var done = function () {
      Array.prototype.forEach.call(form.querySelectorAll(".field, .consent, .form-step, #campBtn, #campPreview"), function (el) { el.hidden = true; });
      document.getElementById("sentSummary").textContent =
        (isNew ? "You're now a founding member of the online room. " : "") +
        "Your request for a " + (t ? t.name : "standard") + " place in " +
        ({ a: "Pod A", b: "Pod B", either: "either pod" })[form.querySelector('input[name="pod"]:checked').value] +
        " is in.";
      document.getElementById("campSent").hidden = false;
      try { sessionStorage.setItem("house_first_name", common.first_name); } catch (err) {}
      document.getElementById("campSent").scrollIntoView({ behavior: "smooth", block: "start" });
    };

    if (window.track) window.track("Camp reservation", { tier: (form.querySelector("input[name=tier]:checked") || {}).value || "" });
    if (!url) { done(); return; }
    btn.disabled = true;
    btn.textContent = "Sending…";
    var jobs = [post(url, reservation)];
    if (isNew && joinUrl) jobs.push(post(joinUrl, join));
    Promise.all(jobs).then(done).catch(function () {
      btn.disabled = false;
      btn.textContent = "Join and reserve my place";
      fail("We couldn't send your details. Check your connection and try again.");
    });
  });
})();
