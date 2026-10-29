// Feature: The Shelf in the members' app (flag "the-shelf"). Members put songs on the public shelf (shelf.html)
// once every writer has signed the split. Cards and the money breakdown come from assets/shelf.js.
// Songs come from the Song Ledger when it's on; otherwise the shelf shows the examples.
// Data: Room.store("shelf", { on: { <song id>: { by, at } } }).
(function () {
  var R = window.Room, FLAG = "the-shelf", S = window.HouseShelf;
  var H = function () { return R.h; };
  if (!S) return;
  var st = function () { return R.store("shelf", { on: {} }); };
  var name = function (id) { return (R.db.member(id) || { name: "A writer" }).name; };
  var allSigned = function (song) { return song.writers.every(function (w) { return song.splits && song.splits.signed && song.splits.signed[w]; }); };
  var ledgerOn = function () { return R.ledger && R.flag("song-ledger"); };

  function asCard(song) {
    var pub = (song.splits && song.splits.publishing) || {}, total = 0;
    song.writers.forEach(function (w) { total += Number(pub[w]) || 0; });
    return { id: song.id, title: song.title, writers: song.writers.map(name), link: song.status.link || "",
      shares: total ? song.writers.map(function (w) { return 100 * (Number(pub[w]) || 0) / total; }) : null,
      written: "Written in the house", registered: song.status.registered ? (song.status.registeredWith || "Yes") : "Not yet" };
  }

  function render() {
    var esc = H().esc, me = R.db.state.me, on = st().on;
    var shelf = ledgerOn() ? R.ledger.songs().filter(function (s) { return on[s.id] && allSigned(s); }).map(asCard) : [];
    var mine = ledgerOn() ? R.ledger.mine(me) : [];
    return '<div class="page-h"><p class="eyebrow">Gising Sining House · the Shelf</p><h1>The Shelf</h1><p class="lead">Songs written in the house, pay what you want. Fans see exactly where their money goes: to the writers, in the shares they signed. The house takes nothing from the shelf.</p></div>' +
      '<section class="panel"><div class="panel-h"><h2>Your songs</h2><a class="btn-sm" href="../shelf.html" target="_blank" rel="noopener">See the public shelf</a></div>' +
      (!ledgerOn() ? '<p class="muted">Your songs come from the Song Ledger. When the Ledger is switched on, every song you\'ve written here appears, ready to go on the shelf.</p>' :
        !mine.length ? '<p class="muted">No songs yet. Finish one in a writing room and sign the split, and it shows up here.</p>' :
        '<ul class="sh-mine">' + mine.map(function (s) {
          var ok = allSigned(s), isOn = !!on[s.id];
          return "<li><div><b>" + esc(s.title) + '</b><span class="small muted">' + s.writers.map(function (w) { return esc(name(w).split(" ")[0]); }).join(", ") + " · " + (ok ? "split signed by everyone" : "waiting on signatures") + "</span></div>" +
            (ok ? '<label class="switch"><input type="checkbox" data-act="sh-toggle" data-id="' + esc(s.id) + '"' + (isOn ? " checked" : "") + '><span></span> On the shelf</label>' :
              '<span class="chip">Sign first</span>') + "</li>";
        }).join("") + "</ul>") +
      '<p class="small muted">A song goes on the shelf only when every writer has signed. Any writer on the song can put it on or take it off.</p></section>' +
      '<h2 class="sec-t">' + (shelf.length ? "On the shelf now" : "How a song looks on the shelf") + '</h2><div class="sh-list">' + (shelf.length ? shelf : S.examples).map(function (c) { return S.card(c); }).join("") + "</div>";
  }

  R.registerRoute("shelf", { title: "The Shelf", flag: FLAG, render: render });
  R.addNav({ id: "shelf", href: "#/shelf", label: "The Shelf", flag: FLAG, icon: '<path d="M3 20h18M5 20V8M9 20V5M13 20V9M17 20l-2-12 3-.5 2 12"/>' });

  R.onAct("sh-toggle", function (el, c) {
    var song = R.ledger && R.ledger.song(c.id); if (!song || !allSigned(song) || song.writers.indexOf(R.db.state.me) === -1) { el.checked = false; return; }
    if (el.checked) st().on[c.id] = { by: R.db.state.me, at: Date.now() }; else delete st().on[c.id];
    R.save(); H().toast(el.checked ? "\"" + song.title + "\" is on the shelf." : "Taken off the shelf."); R.rerender();
  });
  // Support buttons inside the app open the public page, where fans pay.
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-support]"); if (!b || !document.querySelector(".sh-list")) return;
    H().toast("Fans support songs on the public shelf. Payment opens soon.");
  });
})();
