// Feature: Asia-first in every detail (flag "asia-first"). The app in English, Filipino or Bahasa Indonesia; peso
// amounts everywhere (Room.money); the payment options members in each country will see when payments open; and a
// reminder channel preference (email, SMS, Viber or WhatsApp). Data: Room.store("asia", { lang, remind, phone }).
// Live: the language and reminder choice are saved to the member's GHL contact. GHL sends SMS natively;
// Viber and WhatsApp need GHL's WhatsApp integration or a connector (see ghl/SETUP.md).
(function () {
  var R = window.Room, FLAG = "asia-first";
  var H = function () { return R.h; };
  var st = function () { return R.store("asia", { lang: "en", remind: "email", phone: "" }); };

  R.money = R.money || function (n) {
    var v = Number(n) || 0;
    try { return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: v % 1 ? 2 : 0 }).format(v); } catch (e) { return "₱" + v.toLocaleString(); }
  };

  // Exact-match dictionary for menu labels, page titles, headings and buttons.
  var DICT = {
    fil: {
      "Feed": "Feed", "Calendar": "Kalendaryo", "Cowrites": "Cowrite", "Members": "Mga Miyembro", "Map": "Mapa", "The 5 Keys": "Ang 5 Keys", "Academy": "Akademya",
      "Profile": "Profile", "Website": "Website", "Admin": "Admin", "Ledger": "Ledger", "Pitches": "Mga pitch", "Member pass": "Member pass", "Mentors": "Mga mentor",
      "Member map": "Mapa ng mga miyembro", "Writing room": "Writing room", "Your profile": "Iyong profile", "The Ledger": "Ang Ledger",
      "Save my seat": "I-save ang upuan ko", "Seat saved ✓": "Naka-save ang upuan ✓", "Post": "I-post", "Give notes": "Magbigay ng notes", "Send notes": "Ipadala ang notes",
      "Open a new room": "Magbukas ng bagong room", "Book it": "I-book", "Save profile": "I-save ang profile", "Sign out": "Mag-sign out", "Add to calendar": "Idagdag sa kalendaryo",
      "Post a time you're open": "Mag-post ng oras na libre ka", "Open your writing room": "Buksan ang writing room mo", "Sign": "Pumirma", "Post for notes": "I-post para sa notes",
      "COWRITES": "COWRITE", "MEMBERS": "MGA MIYEMBRO", "THE 5 KEYS": "ANG 5 KEYS", "Cowrites ": "Cowrite", "Open times": "Mga libreng oras", "Lyric sheet": "Lyric sheet",
      "The writers": "Ang mga sumulat", "Ownership form": "Kasunduan sa pagmamay-ari", "Finished a draft?": "Tapos na ang draft?", "Your journey": "Ang iyong paglalakbay",
      "Write with two new people this week.": "Sumulat kasama ang dalawang bagong tao ngayong linggo.", "Rate your cowrites": "I-rate ang mga cowrite mo",
      "Writers you'd click with": "Mga manunulat na babagay sa iyo", "Suggest a cowrite": "Magmungkahi ng cowrite", "Welcome home": "Maligayang pagdating"
    },
    id: {
      "Feed": "Beranda", "Calendar": "Kalender", "Cowrites": "Menulis bersama", "Members": "Anggota", "Map": "Peta", "The 5 Keys": "5 Keys", "Academy": "Akademi",
      "Profile": "Profil", "Website": "Situs", "Admin": "Admin", "Ledger": "Buku lagu", "Pitches": "Pitch", "Member pass": "Kartu anggota", "Mentors": "Mentor",
      "Member map": "Peta anggota", "Writing room": "Ruang menulis", "Your profile": "Profil kamu", "The Ledger": "Buku lagu",
      "Save my seat": "Simpan kursi saya", "Seat saved ✓": "Kursi tersimpan ✓", "Post": "Kirim", "Give notes": "Beri catatan", "Send notes": "Kirim catatan",
      "Open a new room": "Buka ruang baru", "Book it": "Pesan", "Save profile": "Simpan profil", "Sign out": "Keluar", "Add to calendar": "Tambah ke kalender",
      "Post a time you're open": "Bagikan waktu luang kamu", "Open your writing room": "Buka ruang menulis kamu", "Sign": "Tanda tangan", "Post for notes": "Kirim untuk catatan",
      "COWRITES": "MENULIS BERSAMA", "MEMBERS": "ANGGOTA", "THE 5 KEYS": "5 KEYS", "Open times": "Waktu luang", "Lyric sheet": "Lembar lirik",
      "The writers": "Para penulis", "Ownership form": "Formulir kepemilikan", "Finished a draft?": "Draf sudah selesai?", "Your journey": "Perjalanan kamu",
      "Write with two new people this week.": "Menulis dengan dua orang baru minggu ini.", "Rate your cowrites": "Nilai sesi menulis bersama kamu",
      "Writers you'd click with": "Penulis yang cocok dengan kamu", "Suggest a cowrite": "Ajak menulis bersama", "Welcome home": "Selamat datang"
    }
  };
  var NAMES = { en: "English", fil: "Filipino", id: "Bahasa Indonesia" };

  function translate() {
    var lang = R.flag(FLAG) ? st().lang : "en", dict = DICT[lang];
    document.documentElement.lang = lang === "fil" ? "fil" : lang === "id" ? "id" : "en";
    var els = document.querySelectorAll(".side a span, #topTitle, #view h1, #view h2, #view h3, #view button, #view a.btn-sm, #view .eyebrow, #view label.switch");
    els.forEach(function (el) {
      // only plain-text elements (or a switch label's text node) are translated
      var node = null;
      if (el.matches("label.switch")) { node = Array.prototype.filter.call(el.childNodes, function (n) { return n.nodeType === 3 && n.nodeValue.trim(); })[0]; if (!node) return; }
      else if (el.children.length) return;
      var target = node || el, cur = (node ? node.nodeValue : el.textContent).trim();
      var orig = el.dataset.en || cur;
      if (!el.dataset.en) el.dataset.en = orig;
      var next = dict && dict[orig] ? dict[orig] : orig;
      if (cur !== next) { if (node) node.nodeValue = " " + next; else target.textContent = next; }
    });
  }
  R.onRender(function () { translate(); });

  var METHODS = [
    ["Philippines", "GCash, Maya, cards and online banking"], ["Indonesia", "DANA, OVO, GoPay, bank transfer and cards"],
    ["Malaysia", "Touch 'n Go eWallet, FPX online banking and cards"], ["Singapore", "PayNow and cards"], ["Everywhere else", "Cards (your bank converts from pesos)"]
  ];
  R.addSlot("me.after", function () {
    var h = H(), s = st(), me = R.db.me(), c = me && R.db.city(me.city), country = c ? c.country : "";
    return '<form class="panel asia-panel" data-form="asia"><p class="eyebrow">Language, payments and reminders</p><h2>Make the Room yours</h2>' +
      '<label>App language<select name="lang">' + Object.keys(NAMES).map(function (k) { return '<option value="' + k + '"' + (s.lang === k ? " selected" : "") + ">" + NAMES[k] + "</option>"; }).join("") + "</select></label>" +
      '<label>Remind me about sessions and Pairings by<select name="remind">' + [["email", "Email"], ["sms", "SMS"], ["viber", "Viber"], ["whatsapp", "WhatsApp"]].map(function (o) { return '<option value="' + o[0] + '"' + (s.remind === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" +
      '<label>Mobile number (for SMS, Viber or WhatsApp)<input name="phone" type="tel" value="' + h.esc(s.phone) + '" placeholder="+63 9xx xxx xxxx" autocomplete="tel"></label>' +
      '<div class="asia-pay"><p class="small"><b>When payments open</b>, every price is in pesos and you can pay the way you usually do:</p><ul>' +
      METHODS.map(function (m) { return '<li class="' + (m[0] === country ? "here" : "") + '"><b>' + m[0] + "</b> · " + m[1] + "</li>"; }).join("") + "</ul></div>" +
      '<button class="btn-sm solid">Save</button></form>';
  }, FLAG);

  R.onForm("asia", function (f, v) {
    var s = st(), phone = v("phone");
    if (v("remind") !== "email" && !/^\+?[0-9 ()-]{7,}$/.test(phone)) { H().toast("Add a mobile number for " + v("remind").toUpperCase() + " reminders."); return; }
    s.lang = DICT[v("lang")] || v("lang") === "en" ? v("lang") : "en"; s.remind = v("remind"); s.phone = phone;
    R.save(); H().toast(s.lang === "fil" ? "Na-save." : s.lang === "id" ? "Tersimpan." : "Saved."); R.rerender();
  });
})();
