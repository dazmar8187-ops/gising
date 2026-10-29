// The Room · data layer.
// Demo mode keeps everything in this browser (localStorage) and seeds it with sample members.
// Every read and write goes through `Room.db`, so a real backend (see backend/schema.sql) can replace
// this file without touching the views.
(function () {
  var KEY = "stave_room_demo_v3";

  // Cities members can pick. lat/lng drive the member map.
  var CITIES = [
    ["Manila", "Philippines", 14.5995, 120.9842], ["Quezon City", "Philippines", 14.676, 121.0437],
    ["Makati", "Philippines", 14.5547, 121.0244], ["Pasig", "Philippines", 14.5764, 121.0851],
    ["Cebu City", "Philippines", 10.3157, 123.8854], ["Davao City", "Philippines", 7.1907, 125.4553],
    ["Iloilo City", "Philippines", 10.7202, 122.5621], ["Baguio", "Philippines", 16.4023, 120.596],
    ["Bacolod", "Philippines", 10.6765, 122.9509], ["Jakarta", "Indonesia", -6.2088, 106.8456],
    ["Denpasar, Bali", "Indonesia", -8.6705, 115.2126], ["Kuala Lumpur", "Malaysia", 3.139, 101.6869],
    ["Singapore", "Singapore", 1.3521, 103.8198], ["Bangkok", "Thailand", 13.7563, 100.5018],
    ["Ho Chi Minh City", "Vietnam", 10.8231, 106.6297], ["Hong Kong", "Hong Kong", 22.3193, 114.1694],
    ["Taipei", "Taiwan", 25.033, 121.5654], ["Tokyo", "Japan", 35.6762, 139.6503],
    ["Osaka", "Japan", 34.6937, 135.5023], ["Seoul", "South Korea", 37.5665, 126.978],
    ["Bengaluru", "India", 12.9716, 77.5946], ["Mumbai", "India", 19.076, 72.8777],
    ["Dubai", "United Arab Emirates", 25.2048, 55.2708], ["Sydney", "Australia", -33.8688, 151.2093],
    ["Melbourne", "Australia", -37.8136, 144.9631], ["Auckland", "New Zealand", -36.8485, 174.7633],
    ["London", "United Kingdom", 51.5072, -0.1276], ["Berlin", "Germany", 52.52, 13.405],
    ["Amsterdam", "Netherlands", 52.3676, 4.9041], ["Paris", "France", 48.8566, 2.3522],
    ["Toronto", "Canada", 43.6532, -79.3832], ["Vancouver", "Canada", 49.2827, -123.1207],
    ["New York", "United States", 40.7128, -74.006], ["Los Angeles", "United States", 34.0522, -118.2437],
    ["Austin", "United States", 30.2672, -97.7431], ["Chicago", "United States", 41.8781, -87.6298],
    ["Tucson", "United States", 32.2226, -110.9747], ["Honolulu", "United States", 21.3069, -157.8583],
    ["Mexico City", "Mexico", 19.4326, -99.1332], ["São Paulo", "Brazil", -23.5505, -46.6333],
    ["Lagos", "Nigeria", 6.5244, 3.3792], ["Nairobi", "Kenya", -1.2921, 36.8219]
  ].map(function (c) { return { name: c[0], country: c[1], lat: c[2], lng: c[3] }; });

  var ROLES = ["Words", "Melody", "Guitar or keys", "Production", "Artist"];
  var CATEGORIES = [
    { id: "general", name: "Introductions & general" },
    { id: "prompt", name: "Weekly prompt" },
    { id: "feedback", name: "Feedback Room" },
    { id: "cowrite", name: "Cowrite Board" },
    { id: "money", name: "The Money Side" },
    { id: "wins", name: "Wins" }
  ];

  var DAY = 864e5;
  var now = Date.now();
  var ago = function (h) { return now - h * 3600e3; };

  // Sample members, clearly fictional, so the demo feels inhabited.
  function seedMembers() {
    var m = function (id, name, city, roles, langs, sounds, bio, extra) {
      return Object.assign({ id: id, name: name, city: city, roles: roles, languages: langs, sounds: sounds, bio: bio,
        photo: "", link: "", openToWrite: true, joined: ago(24 * (5 + (id.length * 7) % 30)), founding: true, host: false }, extra || {});
    };
    return [
      m("darryl", "Darryl Saunders", "Manila", ["Words"], ["English"], ["Pop", "Folk"],
        "Host. I run the Room day to day and host the camps. Ask me anything about how the house works.", { host: true, openToWrite: false }),
      m("paul", "Paul K Saunders", "Tucson", ["Words"], ["English"], ["The money side", "Song structure"],
        "Visiting mentor. Forty years in music, from pirate radio and the BBC to A&R and my own label. Ask me about splits, publishing and getting paid.", { mentor: true, openToWrite: false }),
      m("mara", "Mara Santos", "Quezon City", ["Words", "Melody"], ["Filipino", "English", "Taglish"], ["OPM", "Ballad"],
        "Ballads mostly. I write on jeepneys and finish at 2am. Looking for a producer who likes space."),
      m("jun", "Jun Reyes", "Cebu City", ["Production"], ["Bisaya", "Filipino", "English"], ["P-pop", "R&B"],
        "Producer. Tracks first, then I chase a topliner. Two releases this year on my own label."),
      m("ligaya", "Ligaya Cruz", "Davao City", ["Artist", "Guitar or keys"], ["Filipino", "English"], ["Indie folk"],
        "Singer-songwriter. Writing my first EP and trying to finish more than I start."),
      m("bea", "Bea Villanueva", "Pasig", ["Melody"], ["Filipino", "English"], ["OPM", "Pop"],
        "Topliner and vocal coach. Hooks are my thing; words are my weakness. Help."),
      m("sofia", "Sofia Marquez", "Iloilo City", ["Words"], ["Hiligaynon", "Filipino", "English"], ["Ballad", "Worship"],
        "Lyricist. Writing in Hiligaynon because nobody else is."),
      m("ayu", "Ayu Pratama", "Jakarta", ["Melody", "Artist"], ["Bahasa Indonesia", "English"], ["Pop", "Indie"],
        "Topline and vocals. Writing for myself and for other artists in Jakarta."),
      m("arif", "Arif Hakim", "Kuala Lumpur", ["Production"], ["Malay", "English"], ["Electronic", "Sync"],
        "Producer for ads and TV. I want to write songs that last longer than 30 seconds."),
      m("kenji", "Kenji Mori", "Osaka", ["Production", "Guitar or keys"], ["Japanese", "English"], ["City pop", "Funk"],
        "Keys and production. City pop forever."),
      m("hana", "Hana Kim", "Seoul", ["Melody"], ["Korean", "English"], ["K-pop", "R&B"],
        "Topliner. Camp veteran in Seoul, new to writing in English."),
      m("nisha", "Nisha Rao", "Bengaluru", ["Words"], ["English", "Hindi", "Kannada"], ["Indie", "Folk"],
        "Poet turning into a lyricist. Slowly.", { openToWrite: false }),
      m("tom", "Tom Whitlock", "Melbourne", ["Production"], ["English"], ["Sync", "Alt pop"],
        "Producer and mixer. Happy to cut demos for anyone in the room."),
      m("grace", "Grace Okafor", "London", ["Artist", "Words"], ["English", "Yoruba"], ["Soul", "Gospel"],
        "Artist-writer. Releasing monthly singles and learning the business side the hard way."),
      m("dana", "Dana Ruiz", "Los Angeles", ["Words"], ["English", "Spanish"], ["Pop", "Latin pop"],
        "Lyricist and former journalist. I'll find the title in your verse."),
      m("eli", "Eli Turner", "Toronto", ["Guitar or keys", "Melody"], ["English"], ["Folk", "Country"],
        "Guitar player who finally started writing his own songs."),
      m("lia", "Lia Domingo", "Quezon City", ["Words", "Guitar or keys"], ["Filipino", "English"], ["Indie pop", "OPM"],
        "17, Released Class. Writing songs about the commute and my lola. Guardian consent on file.", { under18: true })
    ];
  }

  function seedPosts() {
    var P = function (id, author, cat, hrs, body, extra) {
      return Object.assign({ id: id, author: author, cat: cat, at: ago(hrs), body: body, link: "", feels: [], comments: [], notes: [] }, extra || {});
    };
    return [
      P("p1", "darryl", "general", 70, "Welcome to the founding season. This room is for finishing songs together and telling each other the truth about them. Introduce yourself below: where you are, what you bring to a room, and one song you wish you'd written.", { pinned: true,
        feels: ["mara", "jun", "ayu", "grace", "tom"], comments: [
          { by: "mara", at: ago(68), body: "Mara, Quezon City. Words and melody. The song I wish I wrote: Kathang Isip." },
          { by: "tom", at: ago(60), body: "Tom, Melbourne. Production. Anything by Paul Kelly." }] }),
      P("p2", "mara", "prompt", 30, "Prompt week 1: \"The room you grew up in\". Rough voice memo, verse and chorus. Three objects: the electric fan, Lola's rosary, a calendar from 2009.", { link: "https://soundcloud.com/", feels: ["bea", "sofia", "paul"],
        notes: [{ by: "sofia", at: ago(26), works: "The 2009 calendar. Time stopped and you never had to say it.", tryit: "Let the fan come back in the last chorus, slower.", question: "Who still lives in that room?" }] }),
      P("p3", "jun", "cowrite", 22, "Have a mid-tempo P-pop track at 98 bpm with a big empty pre-chorus. Need a topliner who can write in English and Filipino. Thursday or Friday evening Manila time.", { feels: ["bea", "hana"],
        comments: [{ by: "bea", at: ago(20), body: "Me! Friday 8pm works." }] }),
      P("p4", "grace", "feedback", 18, "New single, mix 3. Is the chorus landing, or is the hook buried? Be honest, it comes out in three weeks.", { link: "https://youtube.com/", feels: ["dana", "tom", "eli"],
        notes: [
          { by: "tom", at: ago(15), works: "The vocal in verse two is the best thing you've cut.", tryit: "Drop the pad under the first two bars of the chorus so the hook hits on its own.", question: "Have you tried it a semitone down?" },
          { by: "dana", at: ago(12), works: "\"Borrowed light\" is a perfect title.", tryit: "Say it in the first line of the chorus, not the last.", question: "What does she do after the song ends?" }] }),
      P("p5", "paul", "money", 40, "Visiting mentor here. Money Side, lesson 1: the split sheet. Names, roles, percentages, signatures, date. Two minutes on the day saves two years of arguing later. Template is in the Academy. In this house, cowrites are 30 / 30 / 30 with 10 to the house on the publishing, and you keep all of your writer's share.", { feels: ["jun", "arif", "grace", "kenji"] }),
      P("p6", "ayu", "wins", 9, "First song from a Pairing just got cut by an artist in Jakarta! Writers: me, Kenji and Sofia. Split sheet signed on day one, so no awkward emails. Thank you, room.", { feels: ["kenji", "sofia", "paul", "mara", "hana", "tom", "grace"],
        comments: [{ by: "paul", at: ago(8), body: "This is exactly what the room is for. Now register it: FILSCAP for Sofia, and your home societies for you and Kenji." }] }),
      P("p7", "eli", "general", 5, "Hi from Toronto. Guitar player, recovering perfectionist. Here to finish things.", { feels: ["ligaya", "mara"] }),
      P("p8", "hana", "prompt", 3, "Prompt week 1, in English for the first time. Be gentle but honest.", { link: "https://soundcloud.com/", feels: ["jun"] })
    ];
  }

  function fresh() {
    return {
      v: 3, me: null,
      members: seedMembers(),
      posts: seedPosts(),
      rsvps: {},               // eventKey -> true
      played: {},              // eventKey -> true (said "I played")
      openTimes: [
        { id: "o1", by: "tom", at: now + 2 * DAY + 3 * 3600e3, mins: 120, note: "Have three track ideas, need words.", bookedBy: null },
        { id: "o2", by: "bea", at: now + 3 * DAY + 10 * 3600e3, mins: 90, note: "Topline session, OPM ballad.", bookedBy: "sofia" },
        { id: "o3", by: "dana", at: now + 4 * DAY + 1 * 3600e3, mins: 60, note: "Title workshop: bring me a verse.", bookedBy: null }
      ],
      rooms: {},               // roomId -> {title, lyrics, notes, call, writers:[ids], signed:{id:true}, public}
      pairing: { optIn: false, signedWeeks: [], others: ["jun", "bea", "sofia", "tom", "ayu", "kenji", "hana", "eli", "ligaya"], groups: [] },
      prodesk: [               // {id, by, title, link, at, status, month, notes}
        { id: "pd1", by: "grace", title: "Borrowed Light (mix 3)", link: "https://youtube.com/", at: ago(30), status: "With a mentor", month: "" },
        { id: "pd2", by: "mara", title: "Electric Fan", link: "https://soundcloud.com/", at: ago(52), status: "With a mentor", month: "" }
      ],
      callLinks: { "House Session": "", "The Round": "" },
      announcements: [],
      selfMilestones: {},      // milestone id -> true
      checklistHidden: false,
      notifications: [
        { id: "n1", at: ago(8), text: "Paul commented on Ayu's win", href: "#/feed/wins", read: false },
        { id: "n2", at: ago(2), text: "This week's prompt is live: The room you grew up in", href: "#/feed/prompt", read: false }
      ]
    };
  }

  var state;
  function load() {
    try { state = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { state = null; }
    if (!state || state.v !== 3) state = fresh();
    // Demos saved before the 16–17 policy: add the sample under-18 member.
    if (!state.members.some(function (x) { return x.id === "lia"; })) state.members.push(seedMembers().filter(function (x) { return x.id === "lia"; })[0]);
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* storage blocked: the demo still works for this visit */ } }
  load();

  var uid = function (p) { return p + Math.random().toString(36).slice(2, 9); };

  var db = {
    get state() { return state; },
    save: save,
    reset: function () { state = fresh(); save(); },
    me: function () { return state.me ? db.member(state.me) : null; },
    member: function (id) { return state.members.filter(function (m) { return m.id === id; })[0]; },
    city: function (name) { return CITIES.filter(function (c) { return c.name === name; })[0]; },

    signUp: function (p) {
      var id = (p.name || "me").toLowerCase().replace(/[^a-z]+/g, "").slice(0, 12) || "me";
      while (db.member(id)) id += "1";
      state.members.push({ id: id, name: p.name, city: p.city || "", roles: [], languages: [], sounds: [], bio: "",
        photo: "", link: "", openToWrite: true, joined: Date.now(), founding: true, host: false, email: p.email || "" });
      state.me = id;
      db.notify("Welcome to the room, " + p.name.split(" ")[0] + ". Six small steps and you're fully in.", "#/feed");
      save(); return id;
    },
    signOut: function () { state.me = null; save(); },
    updateMe: function (patch) { Object.assign(db.me(), patch); save(); },

    addPost: function (p) {
      state.posts.unshift({ id: uid("p"), author: state.me, cat: p.cat, at: Date.now(), body: p.body, link: p.link || "", feels: [], comments: [], notes: [] });
      save();
    },
    toggleFeel: function (postId) {
      var p = db.post(postId), i = p.feels.indexOf(state.me);
      if (i === -1) p.feels.push(state.me); else p.feels.splice(i, 1);
      save();
    },
    post: function (id) { return state.posts.filter(function (p) { return p.id === id; })[0]; },
    addComment: function (postId, body) { db.post(postId).comments.push({ by: state.me, at: Date.now(), body: body }); save(); },
    addNote: function (postId, n) { db.post(postId).notes.push(Object.assign({ by: state.me, at: Date.now() }, n)); save(); },

    rsvp: function (key, on) { if (on) state.rsvps[key] = true; else delete state.rsvps[key]; save(); },
    markPlayed: function (key) { state.played[key] = true; save(); },

    addOpenTime: function (t) { state.openTimes.push(Object.assign({ id: uid("o"), by: state.me, bookedBy: null }, t)); save(); },
    bookOpenTime: function (id) {
      var t = state.openTimes.filter(function (x) { return x.id === id; })[0];
      t.bookedBy = state.me;
      var r = db.openRoom([t.by, state.me], "Cowrite with " + db.member(t.by).name.split(" ")[0]);
      save(); return r;
    },

    openRoom: function (writers, title) {
      var id = uid("r");
      state.rooms[id] = { id: id, title: title || "Untitled song", lyrics: "", notes: "", call: "", writers: writers, signed: {}, public: false, created: Date.now() };
      save(); return id;
    },
    room: function (id) { return state.rooms[id]; },
    myRooms: function () { return Object.keys(state.rooms).map(function (k) { return state.rooms[k]; }).filter(function (r) { return r.writers.indexOf(state.me) !== -1; }); },

    notify: function (text, href) { state.notifications.unshift({ id: uid("n"), at: Date.now(), text: text, href: href || "#/feed", read: false }); save(); },
    markAllRead: function () { state.notifications.forEach(function (n) { n.read = true; }); save(); }
  };

  window.Room = window.Room || {};
  window.Room.db = db;
  window.Room.CITIES = CITIES;
  window.Room.ROLES = ROLES;
  window.Room.CATEGORIES = CATEGORIES;
})();
