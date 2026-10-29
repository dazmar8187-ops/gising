// One place to change the name, the GoHighLevel links, the app links and the prices.
// Every page loads this file; anything marked data-brand picks up HOUSE.brand.
window.HOUSE = {
  brand: "Gising Sining House",

  // GoHighLevel connection for the join form.
  //   webhookUrl:  Automation > Workflows > trigger "Inbound Webhook" > copy the URL here.
  //   communityUrl: Memberships > Communities > your group > the member login / join link.
  // While webhookUrl is empty the join form runs in preview mode and saves nothing.
  ghl: {
    webhookUrl: "",
    communityUrl: "",
    // A second Inbound Webhook workflow for camp applications (can be the same URL;
    // every camp application is sent with form_type = "camp-application").
    campWebhookUrl: "",
    // GHL payment link for the ₱5,000 Camp 01 deposit. Leave blank to hide the "pay deposit now" button.
    campDepositUrl: ""
  },

  // Newsletter (free weekly prompt) and service bookings also go to GHL Inbound Webhooks.
  // Leave blank and the forms run in preview mode. Each submission carries form_type so one workflow can route them.
  forms: {
    newsletterWebhookUrl: "",   // form_type = "newsletter"
    bookingWebhookUrl: "",      // form_type = "service-booking"
    reportWebhookUrl: "",       // form_type = "report" (moderation, from the website)
    academyWebhookUrl: ""       // Second Chance Academy: form_type = "academy-application" / "-referral" / "-sponsor" / "-mentor". Blank uses ghl.webhookUrl.
  },

  // Prices are hidden everywhere while these are null. Set a number (pesos) to show it, and a GHL payment link to sell it.
  prices: {
    onlineRoom: null, houseMember: null,
    dayCamp: null, twoDayCamp: null, retreatCamp01: null,
    songReview: null, reviewPlus: null, mentorSession: null, proCowrite: null, demo: null, registration: null
  },
  paymentLinks: {
    onlineRoom: "", dayCamp: "", twoDayCamp: "", songReview: "", reviewPlus: "", mentorSession: "", proCowrite: "", demo: "", registration: ""
  },

  // Analytics stays off until a domain is set here (Plausible: privacy-friendly, no cookie banner needed).
  analytics: { plausibleDomain: "" },

  // Contact channels shown on the contact page. Leave blank to hide one.
  contact: { email: "", messenger: "", viber: "", whatsapp: "", instagram: "", facebook: "" },

  // Versions of the legal documents members accept at sign-up (recorded on their GHL contact).
  legal: { privacyVersion: "2026-10b-draft", termsVersion: "2026-10b-draft", memberAgreementVersion: "2026-10b-draft" },

  // The GHL community app. Leave blank to hide the buttons.
  apps: {
    ios: "",
    android: ""
  },

  founding: {
    // Shown on the join and welcome pages. Update when the date is set.
    ends: "31 March 2027"
  },

  // The online room's week, in Manila time (UTC+8, no daylight saving). Drives the "now in the room"
  // panel and the week table on room.html. day: 0 = Sunday … 6 = Saturday. monthly: first such day of the month.
  room: {
    schedule: [
      { day: 1, time: "09:00", mins: 30, room: "E", title: "The prompt drops", text: "A new prompt and one craft tip in the Desk. Post by Sunday." },
      { day: 2, time: "09:00", mins: 30, room: "G", title: "The Pairing", text: "This week's trios, briefs and split sheets go to everyone who opted in." },
      { day: 3, time: "20:00", mins: 60, room: "D", title: "House Session", live: true, text: "An hour, live, rotating through the rooms: craft, cowriting, demos, the money side. Recorded." },
      { day: 6, time: "10:00", mins: 90, room: "B", title: "The Round · Asia sitting", live: true, monthly: true, text: "Play a song, hear the room, get notes in real time. First Saturday of the month." },
      { day: 6, time: "20:00", mins: 90, room: "B", title: "The Round · World sitting", live: true, monthly: true, text: "The same Round, timed for Europe and the US morning." },
      { day: 0, time: "23:59", mins: 1, room: "F", title: "The prompt closes", text: "Last call for this week's songs. Monday morning, a roundup goes up in Wins." }
    ],
    // The weekly prompt shown on room.html. Week 1 starts on promptsStart (a Monday); keep it in step with
    // what's posted in the GHL community (ghl/prompts.md).
    promptsStart: "2026-10-12",
    prompts: ["The room you grew up in", "A text you never sent", "Jeepney window", "The other side", "One chord", "Before the storm",
      "Taglish / mixed tongue", "Small hours job", "Title first", "Thank-you song", "The bridge", "Cowrite week"]
  },

  // Online Room monthly price by region, in pesos. All prices are shown in ₱.
  // Members outside the Philippines pay more; the difference supports the Manila house
  // and funds scholarship places. "fallback" covers any country not listed.
  regions: [
    { id: "ph",   name: "Philippines",                         price: 790,
      countries: ["Philippines"] },
    { id: "asia", name: "Southeast & South Asia",              price: 990,
      countries: ["Indonesia", "Malaysia", "Thailand", "Vietnam", "Cambodia", "Myanmar", "Laos", "Timor-Leste", "China", "India", "Pakistan", "Bangladesh", "Sri Lanka", "Nepal"] },
    { id: "hub",  name: "Singapore, East Asia & the Gulf",     price: 1490,
      countries: ["Singapore", "Brunei", "Hong Kong", "Macau", "Taiwan", "Japan", "South Korea", "United Arab Emirates", "Saudi Arabia", "Qatar", "Kuwait", "Bahrain", "Oman", "Israel"] },
    { id: "west", name: "US, Canada, UK, Europe, Australia & NZ", price: 1790,
      countries: ["United States", "Canada", "United Kingdom", "Ireland", "Germany", "France", "Netherlands", "Belgium", "Luxembourg", "Switzerland", "Austria", "Spain", "Portugal", "Italy", "Sweden", "Norway", "Denmark", "Finland", "Iceland", "Elsewhere in Europe", "Australia", "New Zealand"] },
    { id: "row",  name: "Rest of the world",                   price: 990, fallback: true,
      countries: ["Mexico", "Brazil", "Colombia", "Argentina", "Chile", "Peru", "Elsewhere in Latin America", "South Africa", "Nigeria", "Kenya", "Ghana", "Elsewhere in Africa", "Somewhere else"] }
  ],

  // Camp 01. Update "taken" by hand as places are confirmed; the page shows what's left.
  camp01: {
    name: "Camp 01 · Tagaytay",
    dates: "10–14 or 17–21 March 2027",
    pods: [
      { id: "a", name: "Pod A", dates: "Wed 10 – Sun 14 March 2027" },
      { id: "b", name: "Pod B", dates: "Wed 17 – Sun 21 March 2027" }
    ],
    applyBy: "31 January 2027",
    standardPrice: 64000,
    deposit: 5000,
    balanceDue: "2027-02-01",  // last plan payment; plans pay on the 1st of each month
    privateRoom: 9000,
    tiers: [
      { id: "circle", name: "Founding Circle", places: 12, taken: 0, price: 53500, freeMonths: 12 },
      { id: "second", name: "Founding Twelve",  places: 12, taken: 0, price: 56500, freeMonths: 6 }
    ]
  },

};

(function () {
  var h = window.HOUSE;

  h.peso = function (n) { return "₱" + Number(n).toLocaleString("en-PH"); };
  h.regionFor = function (country) {
    for (var i = 0; i < h.regions.length; i++) {
      if (h.regions[i].countries.indexOf(country) !== -1) return h.regions[i];
    }
    return h.regions.filter(function (r) { return r.fallback; })[0];
  };
  h.lowestPrice = function () {
    return Math.min.apply(null, h.regions.map(function (r) { return r.price; }));
  };

  function apply() {
    document.querySelectorAll("[data-brand]").forEach(function (el) { el.textContent = h.brand; });
    document.querySelectorAll("[data-founding-ends]").forEach(function (el) { el.textContent = h.founding.ends; });
    document.querySelectorAll("[data-price]").forEach(function (el) {
      var key = el.getAttribute("data-price");
      if (key === "from") el.textContent = h.peso(h.lowestPrice());
      else if (h.prices[key] != null) el.textContent = h.peso(h.prices[key]);
    });
    // Region price table: <tbody data-region-table>
    document.querySelectorAll("[data-region-table]").forEach(function (tb) {
      tb.innerHTML = "";
      h.regions.forEach(function (r) {
        var tr = document.createElement("tr");
        var a = document.createElement("td"); a.textContent = r.name;
        var b = document.createElement("td"); b.className = "n"; b.textContent = h.peso(r.price) + "/month";
        tr.appendChild(a); tr.appendChild(b); tb.appendChild(tr);
      });
    });
    if (document.title.indexOf("Gising Sining House") !== -1) document.title = document.title.replace("Gising Sining House", h.brand);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply); else apply();
})();
