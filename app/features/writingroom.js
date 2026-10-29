// Feature: The live writing room (flag "live-writing-room"). In one window: an embedded video call (Jitsi Meet),
// a voice memo recorder, and a track player with A–B looping and speed control, alongside the lyric sheet and the
// ownership form. "Studio view" lays it out as three columns. Memos and tracks are kept in this browser (IndexedDB).
(function () {
  var R = window.Room, FLAG = "live-writing-room";
  var H = function () { return R.h; };
  var st = function () { return R.store("studio", { view: {}, call: {} }); };

  // ---------- IndexedDB for audio ----------
  var dbp = null;
  function idb() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error("no indexedDB"));
      var q = indexedDB.open("stave_studio", 1);
      q.onupgradeneeded = function () { var d = q.result; if (!d.objectStoreNames.contains("memos")) d.createObjectStore("memos", { keyPath: "id" }); if (!d.objectStoreNames.contains("tracks")) d.createObjectStore("tracks", { keyPath: "roomId" }); };
      q.onsuccess = function () { res(q.result); }; q.onerror = function () { rej(q.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) { return idb().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(store, mode), s = t.objectStore(store), out = fn(s); t.oncomplete = function () { res(out && out.result !== undefined ? out.result : out); }; t.onerror = function () { rej(t.error); }; }); }); }
  function memosFor(roomId) { return tx("memos", "readonly", function (s) { return s.getAll(); }).then(function (all) { return (all || []).filter(function (m) { return m.roomId === roomId; }).sort(function (a, b) { return b.at - a.at; }); }); }
  R.studio = { memosFor: memosFor };

  // ---------- markup ----------
  function jitsiUrl(r) { return "https://meet.jit.si/GisingSining-" + encodeURIComponent(r.id) + "#config.startWithAudioMuted=true&config.startWithVideoMuted=true&config.prejoinPageEnabled=false&interfaceConfig.SHOW_JITSI_WATERMARK=false"; }
  function studioPane(r) {
    var h = H(), s = st(), on = !!s.call[r.id], studio = !!s.view[r.id];
    return '<div class="studio-pane" id="studioPane" data-room="' + h.esc(r.id) + '">' +
      '<div class="studio-bar"><p class="eyebrow">Live writing room</p><button class="btn-sm" data-act="lwr-view" data-id="' + h.esc(r.id) + '" aria-pressed="' + studio + '">' + (studio ? "Exit studio view" : "Studio view") + "</button></div>" +
      '<div class="studio-block"><h3>The call</h3>' + (on ? '<div class="call-frame"><iframe title="Video call for this writing room" src="' + h.esc(jitsiUrl(r)) + '" allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen" allowfullscreen></iframe></div>' +
        '<div class="row-wrap"><button class="btn-sm" data-act="lwr-call" data-id="' + h.esc(r.id) + '">Leave the call</button><a class="btn-sm" href="' + h.esc(jitsiUrl(r)) + '" target="_blank" rel="noopener">Open in a new tab</a></div>' :
        '<p class="muted small">Everyone in this room joins the same call, right here next to the lyrics. Microphone and camera start muted.</p><div class="row-wrap"><button class="btn-sm solid" data-act="lwr-call" data-id="' + h.esc(r.id) + '">Start the call in the room</button>' +
        (h.safeUrl(r.call) ? '<a class="btn-sm" href="' + h.esc(h.safeUrl(r.call)) + '" target="_blank" rel="noopener">Use our own call link</a>' : "") + "</div>") + "</div>" +
      '<div class="studio-block"><h3>Voice memos</h3><p class="muted small">Sing the idea before it goes. Memos stay in this room.</p>' +
      '<div class="row-wrap"><button class="btn-sm solid" id="recBtn" data-act="lwr-rec" data-id="' + h.esc(r.id) + '">● Record</button><span class="mono" id="recTime" aria-live="polite"></span></div><ul class="memo-list" id="memoList"><li class="muted small">Loading memos…</li></ul></div>' +
      '<div class="studio-block"><h3>Track</h3><p class="muted small">Load an instrumental or a demo, loop a section and slow it down while you write to it.</p>' +
      '<label class="btn-sm file-btn">Choose a track<input type="file" accept="audio/*" id="trackIn" data-room="' + h.esc(r.id) + '" hidden></label>' +
      '<div id="trackBox" hidden><p class="mono small" id="trackName"></p><audio id="trackAudio" controls preload="metadata"></audio>' +
      '<div class="row-wrap"><button class="btn-sm" data-act="lwr-a">Set A</button><button class="btn-sm" data-act="lwr-b">Set B</button><button class="btn-sm" data-act="lwr-clear">Clear loop</button>' +
      '<label class="speed">Speed<select id="trackSpeed"><option value="0.75">0.75×</option><option value="0.9">0.9×</option><option value="1" selected>1×</option><option value="1.1">1.1×</option></select></label></div><p class="mono small" id="loopInfo">No loop set</p></div></div></div>';
  }

  R.addSlot("write.main", function (r) { return studioPane(r); }, FLAG);

  // ---------- after render: layout + wiring ----------
  var loop = { a: null, b: null }, rec = null, recTimer = null, trackUrl = null;
  function fmt(t) { t = Math.max(0, t || 0); return Math.floor(t / 60) + ":" + String(Math.floor(t % 60)).padStart(2, "0"); }
  function drawMemos(roomId) {
    var ul = document.getElementById("memoList"); if (!ul) return;
    memosFor(roomId).then(function (list) {
      var h = H();
      if (!list.length) { ul.innerHTML = '<li class="muted small">No memos yet.</li>'; return; }
      ul.innerHTML = list.map(function (m) {
        var url = URL.createObjectURL(m.blob), who = R.db.member(m.by) || { name: "" };
        return '<li><div><b>' + h.esc(m.label || "Memo") + '</b><span class="muted small">' + h.esc(who.name) + " · " + h.ago(m.at) + " · " + fmt(m.dur) + '</span></div><audio controls src="' + url + '"></audio><a class="small" href="' + url + '" download="' + h.esc((m.label || "memo").replace(/[^a-z0-9]+/gi, "-")) + '.webm">Download</a><button class="link" data-act="lwr-del" data-id="' + h.esc(m.id) + '">Delete</button></li>';
      }).join("");
    }).catch(function () { ul.innerHTML = '<li class="muted small">This browser can\'t store memos.</li>'; });
  }
  function loadTrack(roomId) {
    tx("tracks", "readonly", function (s) { return s.get(roomId); }).then(function (t) { if (t && t.blob) showTrack(t.blob, t.name); }).catch(function () {});
  }
  function showTrack(blob, name) {
    var a = document.getElementById("trackAudio"); if (!a) return;
    if (trackUrl) URL.revokeObjectURL(trackUrl);
    trackUrl = URL.createObjectURL(blob); a.src = trackUrl;
    document.getElementById("trackBox").hidden = false; document.getElementById("trackName").textContent = name || "Track";
    loop = { a: null, b: null }; info();
  }
  function info() { var el = document.getElementById("loopInfo"); if (el) el.textContent = loop.a == null ? "No loop set" : "Loop " + fmt(loop.a) + " → " + (loop.b == null ? "…" : fmt(loop.b)); }

  R.onRender(function (route, arg) {
    if (route !== "write" || !R.flag(FLAG)) return;
    var r = R.db.room(arg); if (!r) return;
    var pane = document.getElementById("studioPane"), grid = document.querySelector(".write-grid");
    if (pane && grid && st().view[r.id]) {
      grid.classList.add("studio");
      grid.insertBefore(pane, grid.children[1] || null);   // lyric sheet · studio · writers and ownership
    }
    drawMemos(r.id); loadTrack(r.id);
    var a = document.getElementById("trackAudio");
    if (a) a.addEventListener("timeupdate", function () { if (loop.a != null && loop.b != null && a.currentTime >= loop.b) a.currentTime = loop.a; });
    var sp = document.getElementById("trackSpeed");
    if (sp) sp.addEventListener("change", function () { if (a) { a.playbackRate = Number(sp.value); a.preservesPitch = true; } });
    var fi = document.getElementById("trackIn");
    if (fi) fi.addEventListener("change", function () {
      var f = fi.files[0]; if (!f) return;
      showTrack(f, f.name);
      tx("tracks", "readwrite", function (s) { return s.put({ roomId: r.id, blob: f, name: f.name, at: Date.now() }); }).catch(function () {});
    });
  });

  // ---------- actions ----------
  R.onAct("lwr-view", function (el, c) { var s = st(); s.view[c.id] = !s.view[c.id]; R.save(); R.rerender(); });
  R.onAct("lwr-call", function (el, c) { var s = st(); s.call[c.id] = !s.call[c.id]; R.save(); R.rerender(); });
  R.onAct("lwr-a", function () { var a = document.getElementById("trackAudio"); if (a) { loop.a = a.currentTime; if (loop.b != null && loop.b <= loop.a) loop.b = null; info(); } });
  R.onAct("lwr-b", function () { var a = document.getElementById("trackAudio"); if (a && loop.a != null && a.currentTime > loop.a) { loop.b = a.currentTime; a.currentTime = loop.a; info(); } else H().toast("Set A first, then play past it and set B."); });
  R.onAct("lwr-clear", function () { loop = { a: null, b: null }; info(); });
  R.onAct("lwr-del", function (el, c) { tx("memos", "readwrite", function (s) { return s.delete(c.id); }).then(function () { var p = document.getElementById("studioPane"); if (p) drawMemos(p.dataset.room); }); });
  R.onAct("lwr-rec", function (el, c) {
    var btn = el;
    if (rec && rec.state === "recording") { rec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder) { H().toast("This browser can't record audio."); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var chunks = [], started = Date.now();
      rec = new MediaRecorder(stream);
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        clearInterval(recTimer); stream.getTracks().forEach(function (t) { t.stop(); });
        var dur = (Date.now() - started) / 1000, blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        var memo = { id: "m" + Date.now(), roomId: c.id, by: R.db.state.me, at: Date.now(), dur: dur, blob: blob, label: "Memo " + new Date().toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) };
        tx("memos", "readwrite", function (s) { return s.put(memo); }).then(function () { drawMemos(c.id); H().toast("Memo saved."); });
        var b = document.getElementById("recBtn"); if (b) { b.textContent = "● Record"; b.classList.remove("rec-on"); }
        var t = document.getElementById("recTime"); if (t) t.textContent = "";
      };
      rec.start();
      btn.textContent = "■ Stop"; btn.classList.add("rec-on");
      recTimer = setInterval(function () { var t = document.getElementById("recTime"); if (t) t.textContent = "Recording " + fmt((Date.now() - started) / 1000); }, 250);
    }).catch(function () { H().toast("Allow the microphone to record a memo."); });
  });
})();
