// Feature: live shared lyric sheet (flag "live-lyrics").
// Replaces the writing room's lyric box. Edits sync live between open windows (BroadcastChannel) and the editor
// also watches Room.db, so changes arriving from the server sync later show up too. Chords mode renders
// [C] [Am] tokens above the words. Version history: automatic every 2 minutes of editing, plus manual saves.
(function () {
  var FLAG = "live-lyrics";
  var H = function () { return Room.h; };
  var ch = null, poll = null, beat = null, openRoom = null, seen = {}, tabId = Math.random().toString(36).slice(2);
  try { ch = new BroadcastChannel("stave-lyrics"); } catch (e) { ch = null; }

  var vstore = function () { return Room.store("lyricsVersions", { rooms: {}, chords: {} }); };
  var versions = function (rid) { var s = vstore(); return (s.rooms[rid] = s.rooms[rid] || []); };

  // "[C]Hold the [Am]line" -> chord line above the lyric line
  function chordsHtml(text) {
    var esc = H().esc;
    return (text || "").split("\n").map(function (line) {
      if (line.indexOf("[") === -1) return '<div class="cl-line"><span class="cl-words">' + (esc(line) || "&nbsp;") + "</span></div>";
      var chords = "", words = "", re = /\[([^\]]{1,8})\]/g, lastI = 0, m;
      while ((m = re.exec(line))) {
        var seg = line.slice(lastI, m.index); words += seg;
        while (chords.length < words.length) chords += " ";
        chords += m[1] + " "; lastI = re.lastIndex;
      }
      words += line.slice(lastI);
      return '<div class="cl-line"><span class="cl-chords">' + esc(chords.replace(/\s+$/, "")) + '</span><span class="cl-words">' + (esc(words) || "&nbsp;") + "</span></div>";
    }).join("");
  }

  function editors(rid) {
    var now = Date.now(), list = [];
    Object.keys(seen).forEach(function (k) { var p = seen[k]; if (p.room === rid && now - p.at < 15000) list.push(p); });
    return list;
  }
  function presenceHtml(rid) {
    var h = H(), me = Room.db.state.me, others = editors(rid);
    var chips = ['<span class="ll-who">' + h.avatar(Room.db.me(), 22) + " You</span>"].concat(others.map(function (p) {
      var m = Room.db.member(p.by) || { name: "Someone", id: "x" };
      return '<span class="ll-who">' + h.avatar(m, 22) + " " + h.esc(p.by === me ? "You (another window)" : h.first(m.name)) + "</span>";
    }));
    return '<span class="ll-dot" aria-hidden="true"></span> Editing now: ' + chips.join("");
  }

  Room.addSlot("write.lyrics", function (r) {
    var esc = H().esc, chordsOn = !!vstore().chords[r.id], vs = versions(r.id);
    return '<div class="ll" data-room="' + esc(r.id) + '">' +
      '<div class="ll-bar"><p class="ll-presence" id="llPresence" aria-live="polite">' + presenceHtml(r.id) + "</p>" +
      '<div class="ll-tools"><label class="switch small"><input type="checkbox" data-act="ll-chords" data-id="' + esc(r.id) + '"' + (chordsOn ? " checked" : "") + '><span></span> Chords</label>' +
      '<button type="button" class="btn-sm" data-act="ll-save" data-id="' + esc(r.id) + '">Save version</button>' +
      '<button type="button" class="btn-sm" data-act="ll-hist" data-id="' + esc(r.id) + '" aria-expanded="false">History (' + vs.length + ")</button></div></div>" +
      (chordsOn ? '<p class="muted small">Put chords in square brackets before the word they land on: <code>[C]Hold the [Am]line</code>.</p>' : "") +
      '<div class="ll-panes' + (chordsOn ? " two" : "") + '"><textarea class="lyrics" id="llText" data-field="lyrics" data-id="' + esc(r.id) + '" data-ll="1" placeholder="Verse 1&#10;&#10;Chorus&#10;" aria-label="Lyric sheet, shared live with the other writers">' + esc(r.lyrics) + "</textarea>" +
      (chordsOn ? '<div class="ll-preview" id="llPreview" aria-label="Lyrics with chords">' + chordsHtml(r.lyrics) + "</div>" : "") + "</div>" +
      '<div class="ll-history" id="llHist" hidden>' + histHtml(r.id) + "</div></div>";
  }, FLAG);

  function histHtml(rid) {
    var h = H(), vs = versions(rid);
    if (!vs.length) return '<p class="muted">No versions yet. One is saved automatically every two minutes while you write, or press Save version.</p>';
    return '<ul class="ll-vlist">' + vs.slice().reverse().map(function (v, i) {
      var idx = vs.length - 1 - i, firstLine = (v.text || "").split("\n").filter(Boolean)[0] || "(empty)";
      return "<li><div><b>" + new Date(v.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) + "</b> · " + h.esc((Room.db.member(v.by) || {}).name || "") + (v.auto ? " · auto" : "") +
        '<br><span class="muted small">' + h.esc(firstLine.slice(0, 70)) + '</span></div><button type="button" class="btn-sm" data-act="ll-restore" data-id="' + h.esc(rid) + '" data-key="' + idx + '">Restore</button></li>';
    }).join("") + "</ul>";
  }

  function snapshot(rid, auto) {
    var r = Room.db.room(rid); if (!r) return false;
    var vs = versions(rid), lastV = vs[vs.length - 1];
    if (lastV && lastV.text === r.lyrics) return false;
    vs.push({ at: Date.now(), by: Room.db.state.me, text: r.lyrics || "", auto: !!auto });
    if (vs.length > 30) vs.splice(0, vs.length - 30);
    Room.save(); return true;
  }
  function send(msg) { if (ch) { msg.tab = tabId; try { ch.postMessage(msg); } catch (e) {} } }
  function setText(text) {
    var ta = document.getElementById("llText"); if (!ta || ta.value === text) return;
    var focused = document.activeElement === ta, s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = text;
    if (focused) { try { ta.setSelectionRange(Math.min(s, text.length), Math.min(e, text.length)); } catch (err) {} }
    var pv = document.getElementById("llPreview"); if (pv) pv.innerHTML = chordsHtml(text);
  }

  // typing: keep the room saved (app.js handles data-field), broadcast, auto-snapshot
  Room.onInput(function (e) {
    var t = e.target; if (!t.dataset || !t.dataset.ll || !Room.flag(FLAG)) return false;
    var rid = t.dataset.id, r = Room.db.room(rid);
    var pv = document.getElementById("llPreview"); if (pv) pv.innerHTML = chordsHtml(t.value);
    send({ type: "edit", room: rid, text: t.value, by: Room.db.state.me, at: Date.now() });
    var vs = versions(rid), lastV = vs[vs.length - 1];
    if (r && (!lastV || Date.now() - lastV.at > 120000)) { r.lyrics = t.value; snapshot(rid, true); }
    return false; // let app.js save room.lyrics as usual
  });

  if (ch) ch.onmessage = function (ev) {
    var m = ev.data || {}; if (m.tab === tabId) return;
    seen[m.tab] = { room: m.room, by: m.by, at: Date.now() };
    if (m.type === "edit" && Room.flag(FLAG)) {
      var r = Room.db.room(m.room);
      if (r) { r.lyrics = m.text; Room.db.save(); }
      if (openRoom === m.room) setText(m.text);
    }
    if (openRoom === m.room) { var p = document.getElementById("llPresence"); if (p) p.innerHTML = presenceHtml(m.room); }
  };

  function start(rid) {
    stopAll(); openRoom = rid;
    send({ type: "hello", room: rid, by: Room.db.state.me, at: Date.now() });
    beat = setInterval(function () {
      send({ type: "hello", room: rid, by: Room.db.state.me, at: Date.now() });
      var p = document.getElementById("llPresence"); if (p) p.innerHTML = presenceHtml(rid);
    }, 5000);
    // watch the stored room too: picks up changes from other tabs' saves and, live, from the server sync
    poll = setInterval(function () {
      var ta = document.getElementById("llText"), r = Room.db.room(rid);
      if (!ta || !r) return;
      if (document.activeElement !== ta && typeof r.lyrics === "string" && r.lyrics !== ta.value) setText(r.lyrics);
    }, 3000);
  }
  function stopAll() { clearInterval(beat); clearInterval(poll); beat = poll = null; openRoom = null; }
  window.addEventListener("storage", function (e) {
    if (!openRoom || e.key !== "stave_room_demo_v3" || !e.newValue) return;
    try { var r = JSON.parse(e.newValue).rooms[openRoom]; if (r && document.activeElement !== document.getElementById("llText")) { Room.db.room(openRoom).lyrics = r.lyrics; setText(r.lyrics); } } catch (err) {}
  });

  Room.onRender(function (route, arg) {
    if (route === "write" && Room.flag(FLAG) && document.getElementById("llText")) start(arg); else stopAll();
  });

  Room.onAct("ll-chords", function (el, c) { vstore().chords[c.id] = el.checked; Room.save(); Room.rerender(); });
  Room.onAct("ll-save", function (el, c) {
    var ta = document.getElementById("llText"), r = Room.db.room(c.id); if (ta && r) r.lyrics = ta.value;
    H().toast(snapshot(c.id, false) ? "Version saved." : "Nothing new to save since the last version.");
    var hb = document.querySelector('[data-act="ll-hist"]'); if (hb) hb.textContent = "History (" + versions(c.id).length + ")";
    var hist = document.getElementById("llHist"); if (hist) hist.innerHTML = histHtml(c.id);
  });
  Room.onAct("ll-hist", function (el, c) {
    var hist = document.getElementById("llHist"); if (!hist) return;
    hist.innerHTML = histHtml(c.id); hist.hidden = !hist.hidden; el.setAttribute("aria-expanded", String(!hist.hidden));
  });
  Room.onAct("ll-restore", function (el, c) {
    var v = versions(c.id)[+c.key], r = Room.db.room(c.id); if (!v || !r) return;
    snapshot(c.id, false); // keep what was there before restoring
    r.lyrics = v.text; Room.save(); setText(v.text);
    send({ type: "edit", room: c.id, text: v.text, by: Room.db.state.me, at: Date.now() });
    H().toast("Version restored. The text before it was saved as a version too.");
    var hist = document.getElementById("llHist"); if (hist) hist.innerHTML = histHtml(c.id);
  });
})();
