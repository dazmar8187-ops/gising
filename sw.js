// Gising Sining House service worker. HTML: network first (fresh content, offline fallback).
// /assets/ and /app/ static files: cache first. Never caches /api/ or anything that isn't a GET.
var CACHE = "gising-sining-v8";
var PRECACHE = ["/", "/index.html", "/room.html", "/camps.html", "/404.html", "/assets/site.css", "/assets/config.js", "/assets/flags.js", "/assets/icons/icon-192.png", "/app/", "/app/app.css", "/app/app.js", "/app/data.js", "/app/core.js"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return Promise.all(PRECACHE.map(function (u) { return c.add(u).catch(function () {}); })); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.indexOf("/api/") === 0 || url.pathname.indexOf("/.netlify/") === 0) return;
  var isPage = req.mode === "navigate" || (req.headers.get("accept") || "").indexOf("text/html") !== -1;
  if (isPage) {
    e.respondWith(fetch(req).then(function (res) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); return res; })
      .catch(function () { return caches.match(req).then(function (r) { return r || caches.match("/404.html"); }); }));
    return;
  }
  if (url.pathname.indexOf("/assets/") === 0 || url.pathname.indexOf("/app/") === 0) {
    e.respondWith(caches.match(req).then(function (hit) {
      var net = fetch(req).then(function (res) { if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); } return res; });
      return hit || net;
    }));
  }
});
