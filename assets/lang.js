// EN | FIL language switch. Maps each page to its twin under /fil/ and back.
// Pages without a Filipino twin switch to the Filipino homepage.
(function () {
  var TWINS = ["index.html", "room.html", "camps.html", "join.html"];
  function current(base) {
    var rel = location.href.split("#")[0].split("?")[0];
    rel = rel.indexOf(base) === 0 ? rel.slice(base.length) : rel.replace(/^.*\//, "");
    if (rel === "" || rel === "fil/") rel += "index.html";
    return rel;
  }
  window.StaveLang = {
    isFil: function (base) { return current(base).indexOf("fil/") === 0; },
    twin: function (base) {
      var rel = current(base);
      if (rel.indexOf("fil/") === 0) {
        var en = rel.slice(4);
        return base + (TWINS.indexOf(en) !== -1 ? en : "index.html");
      }
      return base + "fil/" + (TWINS.indexOf(rel) !== -1 ? rel : "index.html");
    },
    switcher: function (base) {
      var fil = this.isFil(base), other = this.twin(base);
      var el = document.createElement("span"); el.className = "lang-switch"; el.setAttribute("role", "group"); el.setAttribute("aria-label", fil ? "Wika" : "Language");
      el.innerHTML = fil
        ? '<a href="' + other + '" lang="en" hreflang="en">EN</a><span aria-current="true" lang="fil">FIL</span>'
        : '<span aria-current="true" lang="en">EN</span><a href="' + other + '" lang="fil" hreflang="fil">FIL</a>';
      el.addEventListener("click", function (e) {
        var a = e.target.closest("a"); if (!a) return;
        try { localStorage.setItem("sh_lang", fil ? "en" : "fil"); } catch (err) {}
      });
      return el;
    }
  };
})();
