// Services page: shows prices and "Pay now" only when they're set in config.js, and sends booking requests
// (form_type "service-booking" → HOUSE.forms.bookingWebhookUrl) or "tell me when it opens" requests
// (form_type "service-interest" → HOUSE.ghl.webhookUrl). Preview mode while a webhook is blank.
(function () {
  var cfg = window.HOUSE || {};
  var prices = cfg.prices || {}, pay = cfg.paymentLinks || {};
  var KEY = { "song-review": "songReview", "review-plus": "reviewPlus", "mentor-session": "mentorSession", "pro-cowrite": "proCowrite", demo: "demo", registration: "registration" };
  var peso = function (n) { return "₱" + Number(n).toLocaleString("en-PH"); };
  var priced = function (k) { return typeof prices[k] === "number" && isFinite(prices[k]); };

  document.querySelectorAll("[data-price-key]").forEach(function (el) { var k = el.getAttribute("data-price-key"); if (priced(k)) el.textContent = peso(prices[k]); });
  document.querySelectorAll("[data-pay]").forEach(function (a) { var k = a.getAttribute("data-pay"); if (/^https?:\/\//.test(pay[k] || "")) { a.href = pay[k]; a.hidden = false; } });

  var form = document.getElementById("svcForm");
  if (!form) return;
  var errEl = document.getElementById("svcErr"), btn = document.getElementById("svcBtn"), sent = document.getElementById("svcSent");
  var bookUrl = (cfg.forms || {}).bookingWebhookUrl || "", interestUrl = (cfg.ghl || {}).webhookUrl || "";
  var intent = function () { return (form.querySelector('input[name="intent"]:checked') || {}).value || "book"; };

  function sync() {
    var svc = form.service.value, k = KEY[svc], book = intent() === "book";
    document.getElementById("mentorField").hidden = svc !== "mentor-session";
    form.querySelectorAll(".book-only").forEach(function (el) { el.hidden = !book; });
    var pe = document.getElementById("svcPrice");
    if (k && priced(k)) { pe.textContent = "Price: " + peso(prices[k]) + (pay[k] ? ". You can pay once we've confirmed a time." : "."); pe.hidden = false; } else pe.hidden = true;
    btn.textContent = book ? "Send booking request" : "Tell me when it opens";
    document.getElementById("svcPreview").hidden = !!(book ? bookUrl : interestUrl);
  }
  form.addEventListener("change", sync);
  document.querySelectorAll("[data-svc]").forEach(function (a) {
    a.addEventListener("click", function () { form.service.value = a.getAttribute("data-svc"); sync(); });
  });
  sync();

  function fail(msg, el) { errEl.textContent = msg; errEl.hidden = false; if (el) el.focus(); }
  function done(book) {
    Array.prototype.forEach.call(form.querySelectorAll(".field, .consent, #svcBtn, #svcPreview"), function (el) { el.hidden = true; });
    sent.textContent = book ? "Request sent. We'll reply by email with the price, a mentor and a time. Nothing is charged until you agree." : "Thank you. You'll hear from us when booking opens.";
    sent.hidden = false;
    if (window.track) window.track(book ? "Service booking" : "Service interest", { service: form.service.value });
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errEl.hidden = true;
    var book = intent() === "book";
    if (!form.first_name.value.trim()) return fail("Add your first name.", form.first_name);
    if (!form.email.value || !form.email.checkValidity()) return fail("That email doesn't look right. Check it and try again.", form.email);
    if (book && form.song_link.value && !/^https?:\/\//i.test(form.song_link.value.trim())) return fail("Song links need to start with https://", form.song_link);
    if (!form.consent.checked) return fail("Tick the box so we can email you about this.", form.consent);
    var data = new URLSearchParams({
      form_type: book ? "service-booking" : "service-interest",
      first_name: form.first_name.value.trim(),
      email: form.email.value.trim(),
      service: form.service.value,
      mentor: form.service.value === "mentor-session" ? form.mentor.value : "",
      song_link: book ? form.song_link.value.trim() : "",
      note: form.note.value.trim(),
      consent: "yes",
      privacy_version: (cfg.legal || {}).privacyVersion || "",
      source: "services-page",
      registered_at: new Date().toISOString()
    });
    var url = book ? bookUrl : interestUrl;
    if (!url) { done(book); return; }
    btn.disabled = true; btn.textContent = "Sending…";
    fetch(url, { method: "POST", mode: "no-cors", body: data }).then(function () { done(book); }).catch(function () {
      btn.disabled = false; sync();
      fail("We couldn't send that. Check your connection and try again.");
    });
  });
})();
