// The Shelf (flag "the-shelf"): songs written in the house, pay what you want.
// Shared by shelf.html and the members' app (app/features/shelf.js).
// The rule: a song goes on the shelf only when every writer has signed its split. Money from the shelf goes to the
// writers in the shares they signed. The house takes nothing from the shelf; only the card or wallet fee comes off.
// window.HouseShelf = { FEE, examples, card(song, opts), breakdown(song, amount) }
(function () {
  var FEE = 0.03; // card, GCash or Maya fee, roughly. Confirm against the real payment provider before launch.

  // Example songs, shown until real songs are on the shelf. Writer names are the demo members.
  var EXAMPLES = [
    { id: "s-borrowed-light", title: "Borrowed Light", writers: ["Grace Okafor", "Dana Ruiz", "Tom Whitlock"], cities: "London · Los Angeles · Melbourne",
      written: "Written in the Pairing, week 2", registered: "PRS and FILSCAP", note: "A song about the people who carry you without being asked.", example: true },
    { id: "s-electric-fan", title: "Electric Fan", writers: ["Mara Santos", "Bea Villanueva", "Jun Reyes"], cities: "Quezon City · Pasig · Cebu City",
      written: "Written in the Pairing, week 6", registered: "FILSCAP", note: "Taglish, 2am, a Manila summer, and an electric fan doing its best.", example: true },
    { id: "s-window-seat", title: "Window Seat", writers: ["Ayu Pratama", "Kenji Mori", "Sofia Marquez"], cities: "Jakarta · Osaka · Iloilo City",
      written: "Written across three time zones", registered: "Registration in progress", note: "Three writers who've never been in the same room.", example: true }
  ];

  function money(n) {
    var v = Number(n) || 0;
    try { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: v % 1 ? 2 : 0 }).format(v); }
    catch (e) { return "₱" + v.toLocaleString(); }
  }
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  // Where a payment goes: the fee first, then the writers in their signed shares (equal unless the song says otherwise).
  function breakdown(song, amount) {
    var a = Number(amount) || 0, fee = Math.round(a * FEE * 100) / 100, rest = a - fee;
    var shares = song.shares || song.writers.map(function () { return 100 / song.writers.length; });
    var ws = song.writers.map(function (w, i) { return { name: w, pct: shares[i], amount: Math.round(rest * shares[i]) / 100 }; });
    // Rounding leftovers (a centavo or two) go to the first writer, so the parts always add up to the payment.
    var sum = fee; ws.forEach(function (w) { sum += w.amount; });
    if (ws.length) ws[0].amount = Math.round((ws[0].amount + a - sum) * 100) / 100;
    return { fee: fee, house: 0, writers: ws };
  }

  function card(song, opts) {
    opts = opts || {};
    var b = breakdown(song, 100);
    return '<article class="sh-card" id="' + esc(song.id) + '">' +
      '<div class="sh-top"><p class="eyebrow">' + esc(song.written || "Written in the house") + (song.example ? ' · <span class="sh-ex">example</span>' : "") + "</p>" +
      "<h3>" + esc(song.title) + "</h3><p class=\"sh-by\">" + esc(song.writers.join(", ")) + "</p>" + (song.cities ? '<p class="sh-cities">' + esc(song.cities) + "</p>" : "") +
      (song.note ? '<p class="sh-note">' + esc(song.note) + "</p>" : "") + "</div>" +
      '<dl class="sh-facts"><div><dt>Split</dt><dd>Signed by all ' + song.writers.length + " writers</dd></div><div><dt>Registered</dt><dd>" + esc(song.registered || "Not yet") + "</dd></div></dl>" +
      '<div class="sh-where"><p class="sh-where-h">Where ' + money(100) + " goes</p>" +
      '<div class="sh-bar" aria-hidden="true">' + b.writers.map(function (w, i) { return '<span style="flex:' + w.amount + '" class="w' + (i % 4) + '"></span>'; }).join("") + '<span style="flex:' + b.fee + '" class="fee"></span></div>' +
      "<ul>" + b.writers.map(function (w) { return "<li>" + esc(w.name.split(" ")[0]) + " <b>" + money(w.amount) + "</b></li>"; }).join("") +
      "<li>Payment fee <b>" + money(b.fee) + "</b></li><li>The house <b>" + money(0) + "</b></li></ul></div>" +
      '<div class="sh-actions">' + (song.link ? '<a class="btn ghost" href="' + esc(song.link) + '" target="_blank" rel="noopener">Listen</a>' : '<span class="btn ghost is-off" aria-disabled="true">' + (song.example ? "No audio: example" : "Listen soon") + "</span>") +
      '<button class="btn" type="button" data-support="' + esc(song.id) + '">Support this song</button></div></article>';
  }

  window.HouseShelf = { FEE: FEE, examples: EXAMPLES, card: card, breakdown: breakdown, money: money };
})();
