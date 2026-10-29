// Analytics: loads Plausible only when HOUSE.analytics.plausibleDomain is set (privacy-friendly, no cookies).
// window.track(name, props) is always safe to call; it does nothing until analytics is on.
(function () {
  var cfg = (window.HOUSE && window.HOUSE.analytics) || {};
  window.plausible = window.plausible || function () { (window.plausible.q = window.plausible.q || []).push(arguments); };
  window.track = function (name, props) {
    if (!cfg.plausibleDomain) return;
    try { window.plausible(name, props ? { props: props } : undefined); } catch (e) {}
  };
  if (!cfg.plausibleDomain || !/^https?:/.test(location.protocol)) return;
  var s = document.createElement("script");
  s.defer = true; s.src = "https://plausible.io/js/script.js"; s.setAttribute("data-domain", cfg.plausibleDomain);
  document.head.appendChild(s);
})();
