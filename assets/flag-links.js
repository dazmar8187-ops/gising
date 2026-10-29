// Adds links to flagged website pages (brands, notes, scholarships, events) when their flag is on,
// and the EN | FIL language switch when "filipino" is on. Include after flags.js on every marketing page.
// Works from the site root, /notes/ and /fil/ because every link is built from this script's own URL.
(function () {
  var me = document.currentScript || document.querySelector('script[src*="flag-links.js"]');
  var base = me ? me.src.replace(/assets\/flag-links\.js.*$/, "") : "";
  var LINKS = [
    { flag: "events", href: "events.html", label: "Events", nav: true },
    { flag: "articles", href: "notes/", label: "Notes", nav: true },
    { flag: "brands", href: "brands.html", label: "For brands" },
    { flag: "scholarships", href: "scholarships.html", label: "Scholarships" },
    { flag: "where-you-stand", href: "where-you-stand.html", label: "Where You Stand" },
    { flag: "the-shelf", href: "shelf.html", label: "The Shelf" },
    { flag: "house-run", href: "merch.html", label: "Merch" }
  ];
  var on = function (id) { return !!(window.Flags && window.Flags.isOn(id)); };

  function ensureCss() {
    if (document.querySelector('link[href*="flagpages.css"]')) return;
    var l = document.createElement("link"); l.rel = "stylesheet"; l.href = base + "assets/flagpages.css"; document.head.appendChild(l);
  }

  function render() {
    ensureCss();
    // footer links: into the footer link list if the page has one, otherwise as a row in the footer
    var list = document.querySelector("footer .footer-links ul");
    var foot = document.querySelector("footer .wrap");
    if (list) {
      list.querySelectorAll("li[data-flag-link]").forEach(function (li) { li.remove(); });
      LINKS.filter(function (l) { return on(l.flag); }).forEach(function (l) {
        var li = document.createElement("li"); li.setAttribute("data-flag-link", l.flag);
        li.innerHTML = '<a href="' + base + l.href + '">' + l.label + "</a>"; list.appendChild(li);
      });
    } else if (foot) {
      var box = foot.querySelector(".flag-links");
      if (!box) { box = document.createElement("span"); box.className = "flag-links"; foot.appendChild(box); }
      box.innerHTML = LINKS.filter(function (l) { return on(l.flag); }).map(function (l) { return '<a href="' + base + l.href + '">' + l.label + "</a>"; }).join("");
      box.hidden = !box.innerHTML;
    }
    // header nav: at most two extra items
    var ul = document.querySelector("header.nav ul");
    if (ul) {
      ul.querySelectorAll("li[data-flag-link]").forEach(function (li) { li.remove(); });
      var have = function (href) {
        var target = new URL(base + href, location.href).href.replace(/index\.html$/, "");
        var here = location.href.split("#")[0].split("?")[0].replace(/index\.html$/, "");
        if (here === target) return true;
        return Array.prototype.some.call(ul.querySelectorAll("a[href]"), function (a) { return a.href.split("#")[0].replace(/index\.html$/, "") === target; });
      };
      LINKS.filter(function (l) { return l.nav && on(l.flag) && !have(l.href); }).slice(0, 2).forEach(function (l) {
        var li = document.createElement("li"); li.setAttribute("data-flag-link", l.flag);
        li.innerHTML = '<a href="' + base + l.href + '">' + l.label + "</a>"; ul.appendChild(li);
      });
    }
    // language switch
    var navWrap = document.querySelector("header.nav .wrap");
    var old = document.querySelector(".lang-switch[data-injected]");
    if (old) old.remove();
    if (on("filipino") && navWrap) {
      var load = window.StaveLang ? Promise.resolve() : new Promise(function (res) {
        var s = document.createElement("script"); s.src = base + "assets/lang.js"; s.onload = res; s.onerror = res; document.head.appendChild(s);
      });
      load.then(function () {
        if (!window.StaveLang || document.querySelector(".lang-switch[data-injected]")) return;
        var sw = window.StaveLang.switcher(base); sw.setAttribute("data-injected", "");
        var actions = navWrap.querySelector(".nav-actions") || navWrap.lastElementChild;
        navWrap.insertBefore(sw, actions);
      });
    }
  }

  function start() { render(); if (window.Flags && window.Flags.ready) window.Flags.ready.then(render, render); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
