// Feature flags for Gising Sining House. Every "could add" and "truly great" feature is built behind one of these.
// Defaults are OFF. The host turns them on at /feature-flags.
//   Demo mode: choices are saved in this browser.
//   Live (GHL): choices are saved in the GHL location's custom value "feature_flags" via /api/flags,
//               so every visitor gets the same set.
// Marketing pages: any element with data-flag="id" is shown only when that flag is on,
// and data-flag-off="id" only when it's off.
(function () {
  var LIST = [
    // ----- could add -----
    { id: "messages", group: "could", name: "Direct messages", where: "Members' app", desc: "One-to-one and small-group messages between members, with notifications and blocking." },
    { id: "audio-notes", group: "could", name: "Audio uploads and timestamped notes", where: "Members' app", desc: "Upload a voice memo or demo, play it in the app, and leave notes pinned to a moment in the song." },
    { id: "live-lyrics", group: "could", name: "Live shared lyric sheet", where: "Members' app", desc: "Every writer in a writing room edits the lyric sheet live, with chords above lines and version history." },
    { id: "circles", group: "could", name: "Circles", where: "Members' app", desc: "Apply to a Circle, get a monthly brief, submit songs, get mentor notes, and track pitches." },
    { id: "filipino", group: "could", name: "Filipino and Taglish version", where: "Website", desc: "A Filipino version of the key pages, with a language switch." },
    { id: "events", group: "could", name: "Writers' nights and event tickets", where: "Members' app + website", desc: "Event pages with seat limits, free or paid tickets, check-in, and recordings posted to the Room." },
    { id: "referrals", group: "could", name: "Referrals and gift memberships", where: "Members' app", desc: "Invite links with a reward for both people, and gift memberships." },
    { id: "scholarships", group: "could", name: "Scholarship places", where: "Website", desc: "A scholarships page and application form, and sponsored places shown on camps." },
    { id: "brands", group: "could", name: "Brands and teams page", where: "Website", desc: "A full page for brand songs and team sessions, with a brief form." },
    { id: "articles", group: "could", name: "Notes from the house (articles)", where: "Website", desc: "Articles on craft and the money side, written for search and linked to the newsletter." },
    { id: "public-profiles", group: "could", name: "Shareable member profiles", where: "Members' app + website", desc: "An opt-in public profile link with bio and songs." },
    { id: "booth", group: "could", name: "Booth booking (2027)", where: "Members' app", desc: "A booking calendar for the Manila booth, with monthly allowances for House Members." },
    { id: "native-apps", group: "could", name: "Native iOS and Android apps", where: "App stores", desc: "Store apps built from the same code. Needs Apple and Google developer accounts; the installable phone app covers this until then." },
    // ----- truly great -----
    { id: "song-ledger", group: "great", name: "The Song Ledger", where: "Members' app", desc: "Every song written in the house gets a living record: writers, signed splits, demos, registration status, pitches and earnings." },
    { id: "pitch-pipeline", group: "great", name: "Transparent pitch pipeline", where: "Members' app + admin", desc: "The house pitches songs to artists, labels, sync and brands; members see every pitch, and a dashboard shows what the house's 10% earned." },
    { id: "live-writing-room", group: "great", name: "The live writing room", where: "Members' app", desc: "The call, the shared lyric sheet, track playback, voice memo recording and the ownership form in one window." },
    { id: "smart-pairing", group: "great", name: "Smart Pairing", where: "Members' app + admin", desc: "Matching that learns from finished songs and 'write again' ratings, and suggests cowriters any day." },
    { id: "stave-portfolio", group: "great", name: "Your 5 Keys as a portfolio", where: "Members' app + website", desc: "An opt-in public portfolio of finished, registered and released songs, showing where the writer is on the 5 Keys." },
    { id: "asia-first", group: "great", name: "Asia-first in every detail", where: "Members' app", desc: "App in English, Filipino or Bahasa; peso amounts; GCash, Maya and regional payment options; SMS or Viber reminders." },
    { id: "one-account", group: "great", name: "One account from the Room to the house", where: "Members' app", desc: "Check in at the Manila house with your member pass, see your visits, and get writers' night recordings on your profile." },
    { id: "mentor-network", group: "great", name: "Visiting mentor network", where: "Members' app + admin", desc: "Mentor profiles with availability, session booking, and the Pro Desk queue per mentor." },
    // ----- our versions (Song House ideas, rebuilt the artist-first way) -----
    { id: "where-you-stand", group: "ours", name: "Where You Stand Right Now", where: "Website + members' app", desc: "A free ten-minute check of where your songwriting career stands on each of the five lines, your role in a writing room, and one move for this week. Not a personality test." },
    { id: "credits", group: "ours", name: "Credits", where: "Members' app", desc: "Levels named after the life of a song. Credits come only from what you gave other writers and the songs you finished and signed. Posting earns nothing, and nobody is ranked." },
    { id: "the-shelf", group: "ours", name: "The Shelf", where: "Website + members' app", desc: "Songs written in the house, pay what you want. Every song shows its signed split and where each peso goes, and fans can leave their name for the writers." },
    { id: "house-run", group: "ours", name: "The House Run (merch)", where: "Website", desc: "Small runs printed in Manila. When a design carries a member's line, the writer is credited on the tag and paid a share of every piece." },
    { id: "house-letter", group: "ours", name: "The House Letter", where: "Members' app + admin", desc: "A weekly letter with a rotating byline: the host, a visiting mentor, then a member. The house speaks with many voices, not one founder's." }
  ];
  var KEY = "sh_feature_flags";
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { state = {}; }

  function apply(root) {
    (root || document).querySelectorAll("[data-flag]").forEach(function (el) { el.hidden = !Flags.isOn(el.getAttribute("data-flag")); });
    (root || document).querySelectorAll("[data-flag-off]").forEach(function (el) { el.hidden = Flags.isOn(el.getAttribute("data-flag-off")); });
  }

  var Flags = window.Flags = {
    list: LIST,
    remote: false,
    isOn: function (id) { return !!state[id]; },
    all: function () { return Object.assign({}, state); },
    set: function (id, on) {
      state[id] = !!on;
      try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
      apply();
      if (Flags.remote) return fetch("/api/flags", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ flags: state }) })
        .then(function (r) { if (!r.ok) throw new Error("Only the host can change flags."); return r.json(); });
      return Promise.resolve({ flags: state });
    },
    setAll: function (on) { LIST.forEach(function (f) { state[f.id] = !!on; }); return Flags.set(LIST[0].id, on); },
    // Live: load the shared flags from GHL. Demo (no server): keep this browser's choices.
    load: function () {
      if (!/^https?:/.test(location.protocol)) return Promise.resolve(state);
      return fetch("/api/flags", { credentials: "same-origin" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) {
        if (d && d.mode === "ghl" && d.flags) { Flags.remote = true; state = d.flags; try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
        apply(); return state;
      }).catch(function () { return state; });
    },
    apply: apply
  };
  Flags.ready = Flags.load();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { apply(); }); else apply();
})();
