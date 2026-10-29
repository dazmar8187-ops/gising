// Feature: audio uploads with timestamped notes (flag "audio-notes").
// A track belongs to a feed post ("post:<id>") or a writing room ("room:<id>").
// Demo: track details in Room.store("audio"); the audio file itself in IndexedDB (localStorage is too small).
// Live (GHL): files need uploading to the GHL media library through the server (see report).
(function () {
  var FLAG = "audio-notes";
  var H = function () { return Room.h; };
  var cur = { id: null, el: null, url: null };

  function st() {
    var s = Room.store("audio", { tracks: {}, seeded: false });
    if (!s.seeded) {
      s.tracks["post:p4"] = { id: "a-demo", name: "Borrowed Light (mix 3).wav", by: "grace", at: Date.now() - 18 * 3600e3, demo: true, dur: 12,
        notes: [{ by: "tom", at: Date.now() - 15 * 3600e3, t: 4.2, text: "Pad comes in here and buries the hook. Drop it for two bars." },
                { by: "dana", at: Date.now() - 12 * 3600e3, t: 8.6, text: "This is where the title should land." }] };
      s.seeded = true; Room.save();
    }
    return s;
  }
  var trackFor = function (owner) { return st().tracks[owner]; };
  function trackById(id) { var t = st().tracks; for (var k in t) if (t[k].id === id) return t[k]; return null; }

  // ---- IndexedDB for the files ----
  var dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("no indexedDB"));
      var r = indexedDB.open("stave_audio", 1);
      r.onupgradeneeded = function () { r.result.createObjectStore("files"); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function putFile(id, blob) { return idb().then(function (d) { return new Promise(function (res, rej) { var tx = d.transaction("files", "readwrite"); tx.objectStore("files").put(blob, id); tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; }); }); }
  function getFile(id) { return idb().then(function (d) { return new Promise(function (res, rej) { var q = d.transaction("files").objectStore("files").get(id); q.onsuccess = function () { res(q.result || null); }; q.onerror = function () { rej(q.error); }; }); }); }

  // A short demo melody rendered straight to a WAV blob, so the seeded track plays without a file.
  function demoWav(secs) {
    var rate = 22050, n = rate * secs, data = new Int16Array(n);
    var notes = [261.6, 329.6, 392, 440, 392, 329.6, 293.7, 329.6, 392, 523.3, 440, 392];
    for (var i = 0; i < n; i++) {
      var t = i / rate, k = Math.floor(t) % notes.length, f = notes[k], local = t - Math.floor(t);
      var env = Math.min(1, local * 20) * Math.exp(-local * 2.2);
      data[i] = Math.round(0.28 * 32767 * env * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t)) / 1.3);
    }
    var buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
    var w = function (o, s) { for (var j = 0; j < s.length; j++) v.setUint8(o + j, s.charCodeAt(j)); };
    w(0, "RIFF"); v.setUint32(4, 36 + n * 2, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, n * 2, true);
    new Int16Array(buf, 44).set(data);
    return new Blob([buf], { type: "audio/wav" });
  }
  function blobFor(t) { return t.demo ? Promise.resolve(demoWav(t.dur || 12)) : getFile(t.id); }

  var fmt = function (s) { s = Math.max(0, Math.floor(s || 0)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

  function player(owner, t) {
    var h = H(), esc = h.esc, dur = t.dur || 0;
    var markers = t.notes.map(function (n, i) {
      var pct = dur ? Math.min(100, 100 * n.t / dur) : 0;
      return '<button type="button" class="ap-mark" style="left:' + pct + '%" data-act="ap-seek" data-id="' + esc(t.id) + '" data-key="' + n.t + '" title="' + esc(fmt(n.t) + " · " + n.text) + '" aria-label="Jump to note at ' + fmt(n.t) + '"></button>';
    }).join("");
    return '<div class="ap" data-track="' + esc(t.id) + '">' +
      '<div class="ap-row"><button type="button" class="ap-play" data-act="ap-play" data-id="' + esc(t.id) + '" aria-label="Play">▶</button>' +
      '<div class="ap-bar" data-act="ap-bar" data-id="' + esc(t.id) + '" role="slider" aria-label="Position" aria-valuemin="0" aria-valuemax="' + Math.round(dur) + '" aria-valuenow="0" tabindex="0"><i class="ap-fill"></i>' + markers + "</div>" +
      '<span class="ap-time"><span class="ap-cur">0:00</span> / ' + fmt(dur) + "</span></div>" +
      '<p class="ap-name">' + esc(t.name) + " · " + esc((Room.db.member(t.by) || {}).name || "") + (t.demo ? " · demo audio" : "") + "</p>" +
      (t.notes.length ? '<ul class="ap-notes">' + t.notes.slice().sort(function (a, b) { return a.t - b.t; }).map(function (n) {
        return '<li><button type="button" class="ap-ts" data-act="ap-seek" data-id="' + esc(t.id) + '" data-key="' + n.t + '">' + fmt(n.t) + "</button> " + h.who(n.by) + " <span>" + esc(n.text) + "</span></li>";
      }).join("") + "</ul>" : "") +
      '<form class="ap-note" data-form="ap-note" data-id="' + esc(t.id) + '"><label class="sr-only" for="apn-' + esc(t.id) + '">Note at the current moment</label><input id="apn-' + esc(t.id) + '" name="text" maxlength="200" required placeholder="Note at the current moment (pause where you mean)"><button class="btn-sm">Add note</button></form></div>';
  }
  function uploader(owner, label) {
    var id = "au-" + owner.replace(/\W/g, "");
    return '<div class="ap-up"><label class="btn-sm" for="' + id + '">' + label + '</label><input type="file" id="' + id + '" accept="audio/*" data-audio-owner="' + H().esc(owner) + '" hidden></div>';
  }

  Room.addSlot("post.after", function (p) {
    var t = trackFor("post:" + p.id);
    if (t) return player("post:" + p.id, t);
    if (p.author === Room.db.state.me && (p.cat === "feedback" || p.cat === "prompt" || p.cat === "wins")) return uploader("post:" + p.id, "Add audio to this post");
    return "";
  }, FLAG);
  Room.addSlot("write.main", function (r) {
    var t = trackFor("room:" + r.id);
    return '<div class="ap-room"><h3>Demo and voice memos</h3>' + (t ? player("room:" + r.id, t) : "") + uploader("room:" + r.id, t ? "Replace the audio" : "Upload a voice memo or demo") + "</div>";
  }, FLAG);

  // uploads
  document.addEventListener("change", function (e) {
    var inp = e.target; if (!inp.dataset || !inp.dataset.audioOwner || !inp.files || !inp.files[0]) return;
    var file = inp.files[0], owner = inp.dataset.audioOwner;
    if (file.size > 40 * 1024 * 1024) { H().toast("That file is over 40 MB. Try an MP3."); return; }
    var id = "a" + Date.now();
    var probe = new Audio(), url = URL.createObjectURL(file);
    probe.preload = "metadata"; probe.src = url;
    probe.onloadedmetadata = function () { finish(probe.duration); }; probe.onerror = function () { finish(0); };
    function finish(d) {
      URL.revokeObjectURL(url);
      putFile(id, file).then(function () {
        st().tracks[owner] = { id: id, name: file.name, by: Room.db.state.me, at: Date.now(), dur: isFinite(d) ? d : 0, notes: [] };
        Room.save(); H().toast("Audio added."); Room.rerender();
      }, function () { H().toast("This browser couldn't store the file."); });
    }
  });

  function stop() { if (cur.el) { cur.el.pause(); } }
  function ui(id) { return document.querySelector('.ap[data-track="' + id + '"]'); }
  function tick() {
    if (!cur.el) return;
    var box = ui(cur.id); if (!box) return;
    var d = cur.el.duration || (trackById(cur.id) || {}).dur || 1;
    box.querySelector(".ap-fill").style.width = Math.min(100, 100 * cur.el.currentTime / d) + "%";
    box.querySelector(".ap-cur").textContent = fmt(cur.el.currentTime);
    box.querySelector(".ap-bar").setAttribute("aria-valuenow", Math.round(cur.el.currentTime));
    box.querySelector(".ap-play").textContent = cur.el.paused ? "▶" : "❚❚";
  }
  function load(id) {
    if (cur.id === id && cur.el) return Promise.resolve(cur.el);
    stop(); if (cur.url) URL.revokeObjectURL(cur.url);
    var t = trackById(id); if (!t) return Promise.reject(new Error("no track"));
    return blobFor(t).then(function (b) {
      if (!b) throw new Error("missing file");
      cur.url = URL.createObjectURL(b); cur.id = id; cur.el = new Audio(cur.url);
      cur.el.addEventListener("timeupdate", tick); cur.el.addEventListener("ended", tick); cur.el.addEventListener("pause", tick); cur.el.addEventListener("play", tick);
      cur.el.addEventListener("loadedmetadata", function () { if (!t.dur && isFinite(cur.el.duration)) { t.dur = cur.el.duration; Room.save(); } });
      return cur.el;
    });
  }
  Room.onAct("ap-play", function (el, c) {
    load(c.id).then(function (a) { if (a.paused) a.play().catch(function () {}); else a.pause(); tick(); },
      function () { H().toast("This audio was uploaded in another browser, so it can't play here."); });
  });
  Room.onAct("ap-seek", function (el, c) {
    var t = parseFloat(c.key) || 0;
    load(c.id).then(function (a) { a.currentTime = t; a.play().catch(function () {}); tick(); }, function () { H().toast("This audio isn't stored in this browser."); });
  });
  Room.onAct("ap-bar", function (el, c) {
    if (c.event.target.classList.contains("ap-mark")) return;
    var r = el.getBoundingClientRect(), pct = Math.max(0, Math.min(1, (c.event.clientX - r.left) / r.width));
    var t = trackById(c.id);
    load(c.id).then(function (a) { a.currentTime = pct * (a.duration || t.dur || 0); tick(); });
  });
  document.addEventListener("keydown", function (e) {
    var bar = e.target.closest && e.target.closest(".ap-bar"); if (!bar || !cur.el || cur.id !== bar.dataset.id) return;
    if (e.key === "ArrowRight") { cur.el.currentTime += 5; tick(); e.preventDefault(); }
    if (e.key === "ArrowLeft") { cur.el.currentTime -= 5; tick(); e.preventDefault(); }
  });
  Room.onForm("ap-note", function (f, v) {
    var t = trackById(f.dataset.id); if (!t || !v("text")) return;
    var at = cur.id === t.id && cur.el ? cur.el.currentTime : 0;
    t.notes.push({ by: Room.db.state.me, at: Date.now(), t: Math.round(at * 10) / 10, text: v("text") });
    Room.save(); H().toast("Note pinned at " + fmt(at) + "."); Room.rerender();
  });
  // stop playback when leaving the page that shows the track
  Room.onRender(function () { if (cur.id && !ui(cur.id)) stop(); else tick(); });
})();
