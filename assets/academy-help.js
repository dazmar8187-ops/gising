// Second Chance Academy refer / sponsor / mentor pages. Each <form data-help-form="<form_type>"> sends every
// named field (checkbox groups joined with ", ") to HOUSE.forms.academyWebhookUrl, falling back to
// HOUSE.ghl.webhookUrl. Required fields carry data-msg; a fieldset with data-group-req needs one box ticked.
// Buttons with data-pick="<value>" choose that value in the form's sponsor_kind select. Preview mode while no webhook is set.
(function () {
  var cfg = window.HOUSE || {};
  var url = (cfg.forms || {}).academyWebhookUrl || (cfg.ghl || {}).webhookUrl || "";

  document.querySelectorAll("form[data-help-form]").forEach(function (form) {
    var errEl = form.querySelector(".err"), btn = form.querySelector('button[type="submit"]'), sent = form.querySelector(".sent-msg");
    var label = btn.textContent;
    form.querySelector(".preview").hidden = !!url;

    document.querySelectorAll("[data-pick]").forEach(function (a) {
      a.addEventListener("click", function () { if (form.sponsor_kind) form.sponsor_kind.value = a.getAttribute("data-pick"); });
    });

    function fail(msg, el) { errEl.textContent = msg; errEl.hidden = false; if (el) el.focus(); }
    function check() {
      var els = form.querySelectorAll("[required], fieldset[data-group-req]");
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.tagName === "FIELDSET") {
          if (!el.querySelector("input:checked")) return fail(el.getAttribute("data-msg"), el.querySelector("input")), false;
        } else if (el.type === "checkbox" ? !el.checked : (!el.value.trim() || !el.checkValidity())) {
          return fail(el.getAttribute("data-msg") || "Fill this in.", el), false;
        }
      }
      return true;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      errEl.hidden = true;
      if (!check()) return;
      var fields = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name) return;
        if (el.type === "checkbox" || el.type === "radio") {
          if (!(el.name in fields)) fields[el.name] = [];
          if (el.checked) fields[el.name].push(el.value);
        } else fields[el.name] = [el.value.trim()];
      });
      var data = new URLSearchParams({ form_type: form.getAttribute("data-help-form") });
      Object.keys(fields).forEach(function (k) { data.set(k, fields[k].join(", ")); });
      data.set("privacy_version", (cfg.legal || {}).privacyVersion || "");
      data.set("terms_version", (cfg.legal || {}).termsVersion || "");
      data.set("source", "academy-" + location.pathname.split("/").pop().replace(/\.html$/, ""));
      data.set("registered_at", new Date().toISOString());

      function done() {
        Array.prototype.forEach.call(form.querySelectorAll(".field, .consent, .preview, button[type=submit]"), function (el) { el.hidden = true; });
        sent.textContent = form.getAttribute("data-done");
        sent.hidden = false;
        if (window.track) window.track("Academy", { form: form.getAttribute("data-help-form") });
      }
      if (!url) { done(); return; }
      btn.disabled = true; btn.textContent = "Sending…";
      fetch(url, { method: "POST", mode: "no-cors", body: data }).then(done).catch(function () {
        btn.disabled = false; btn.textContent = label;
        fail("We couldn't send that. Check your connection and try again.");
      });
    });
  });
})();
