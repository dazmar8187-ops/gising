// Makes the site and the Room installable as a phone app.
// Registers /sw.js (http/https only) and shows an "Install the app" button wherever there's an element with data-install.
(function () {
  if (!/^https?:/.test(location.protocol)) return;
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js").catch(function () {}); });
  }
  var deferred = null;
  var standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  var ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  function slots() { return Array.prototype.slice.call(document.querySelectorAll("[data-install]")); }
  function show() {
    if (standalone) return;
    slots().forEach(function (el) {
      if (el.dataset.ready) return; el.dataset.ready = "1";
      if (deferred) {
        var b = document.createElement("button"); b.type = "button"; b.className = "btn ghost"; b.textContent = "Install the app";
        b.addEventListener("click", function () { deferred.prompt(); deferred.userChoice.then(function () { deferred = null; b.remove(); }); });
        el.appendChild(b); el.hidden = false;
      } else if (ios) {
        var p = document.createElement("p"); p.className = "note-small"; p.textContent = "On iPhone: tap Share, then “Add to Home Screen” to install the app.";
        el.appendChild(p); el.hidden = false;
      }
    });
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; slots().forEach(function (el) { delete el.dataset.ready; el.innerHTML = ""; }); show(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show); else show();
})();
