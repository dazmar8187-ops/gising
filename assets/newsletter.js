// The free weekly prompt by email. Renders a sign-up block into every element with data-newsletter,
// and posts form_type "newsletter" to HOUSE.forms.newsletterWebhookUrl (preview mode while it's blank).
(function () {
  var H = window.HOUSE || {}, url = (H.forms || {}).newsletterWebhookUrl || "";
  var root = document.querySelector('script[src$="assets/newsletter.js"]');
  var base = root ? root.getAttribute("src").replace("assets/newsletter.js", "") : "";
  function render(el, n) {
    var id = "nl" + n;
    el.classList.add("newsletter");
    el.innerHTML =
      '<div class="nl-copy"><p class="eyebrow">Free · every Monday</p><h2 class="nl-h">Get the weekly prompt by email.</h2>' +
      '<p>One songwriting prompt and one craft tip each week, the same ones the Room writes to. No card, unsubscribe any time.</p></div>' +
      '<form class="nl-form" novalidate><label class="sr-only" for="' + id + 'n">First name</label><input id="' + id + 'n" name="first_name" type="text" autocomplete="given-name" placeholder="First name" required>' +
      '<label class="sr-only" for="' + id + 'e">Email</label><input id="' + id + 'e" name="email" type="email" autocomplete="email" placeholder="Email" required>' +
      '<button class="btn" type="submit">Send me the prompt</button>' +
      '<label class="consent nl-consent"><input type="checkbox" name="consent" value="yes" required> <span>Email me the weekly prompt. See the <a href="' + base + 'privacy.html">privacy policy</a>.</span></label>' +
      '<p class="err" hidden></p>' + (url ? "" : '<p class="preview">Preview mode: not connected to GoHighLevel yet, so nothing is saved.</p>') +
      '<p class="nl-done" hidden role="status">You\'re on the list. The next prompt arrives on Monday.</p></form>';
    var f = el.querySelector("form"), err = f.querySelector(".err");
    f.addEventListener("submit", function (e) {
      e.preventDefault(); err.hidden = true;
      if (!f.first_name.value.trim()) { err.textContent = "Add your first name."; err.hidden = false; f.first_name.focus(); return; }
      if (!f.email.value || !f.email.checkValidity()) { err.textContent = "That email doesn't look right."; err.hidden = false; f.email.focus(); return; }
      if (!f.consent.checked) { err.textContent = "Tick the box so we can email you."; err.hidden = false; return; }
      var data = new URLSearchParams({ form_type: "newsletter", first_name: f.first_name.value.trim(), email: f.email.value.trim(), consent: "yes",
        privacy_version: (H.legal || {}).privacyVersion || "", source: location.pathname, joined_at: new Date().toISOString() });
      var done = function () { Array.prototype.forEach.call(f.querySelectorAll("input, button, .nl-consent, .preview"), function (x) { x.hidden = true; }); f.querySelector(".nl-done").hidden = false; if (window.track) window.track("Newsletter"); };
      if (!url) { done(); return; }
      fetch(url, { method: "POST", mode: "no-cors", body: data }).then(done, function () { err.textContent = "We couldn't send that. Check your connection and try again."; err.hidden = false; });
    });
  }
  function init() { Array.prototype.forEach.call(document.querySelectorAll("[data-newsletter]"), render); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
