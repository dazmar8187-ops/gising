// Where You Stand Right Now (flag "where-you-stand"). Shared by where-you-stand.html and the members' app (app/features/standing.js).
// Twenty statements, four on each line of the stave, read where a writer's career stands today.
// Five writing-room questions give their role in a room. Nothing here is a personality type: it's a baseline.
// window.WhereYouStand = { lines, statements, scale, roleQuestions, roles, score(answers), result(answers) }
(function () {
  var LINES = [
    { key: "E", name: "Establish", room: "The Desk", ask: "Is the foundation there: finished songs, signed splits, registered work?",
      move: "Pick your five best songs and write one sentence about what each is about. Register any that are finished this week.",
      where: { label: "Registering your songs", href: "notes/registering-your-songs.html", app: "#/feed/prompt", appLabel: "This week's prompt" } },
    { key: "G", name: "Grow", room: "The Cowrite Room", ask: "Are you writing with other people and getting better from it?",
      move: "Say \"I'm in\" for Tuesday's Pairing and write with someone you haven't met.",
      where: { label: "Your first cowrite", href: "notes/your-first-cowrite.html", app: "#/cowrites", appLabel: "The Pairing" } },
    { key: "B", name: "Book", room: "The Round", ask: "Are your songs being heard by people in a room?",
      move: "Choose the three songs you'd play tonight, then sign up to play one at the next Round.",
      where: { label: "Events", href: "events.html", app: "#/calendar", appLabel: "The next Round" } },
    { key: "D", name: "Deliver", room: "The Booth", ask: "Can you take a song all the way to something you could pitch?",
      move: "Send one song to the Pro Desk, then post the rewrite. Don't start a new song until you have.",
      where: { label: "Reviews and mentor sessions", href: "services.html", app: "#/academy", appLabel: "The Pro Desk" } },
    { key: "F", name: "Flourish", room: "The Porch", ask: "Do you understand the money, and can you keep going?",
      move: "Read the note on the writer's share and the publisher's share, then check who collects yours.",
      where: { label: "Writer's share, publisher's share", href: "notes/writers-share-publishers-share.html", app: "#/academy", appLabel: "The Money Side" } }
  ];

  var STATEMENTS = [
    ["E", "I could play you five finished songs today."],
    ["E", "I can say what each of my best songs is about in one sentence."],
    ["E", "Every song I've written with someone has a signed split sheet."],
    ["E", "My finished songs are registered with FILSCAP or my home society."],
    ["G", "I've written a song with someone I didn't already know."],
    ["G", "I can take a hard note on a song without defending it."],
    ["G", "The notes I give other writers are specific, not just \"nice\"."],
    ["G", "I finish more songs than I abandon."],
    ["B", "I've played my own songs to people I don't know."],
    ["B", "I know which three songs I'd play at a writers' night tonight."],
    ["B", "I can talk between songs without apologising for them."],
    ["B", "I know where the writers' nights are in my city."],
    ["D", "I can take a song from a voice memo to a demo someone could pitch."],
    ["D", "After notes, I rewrite the song rather than starting a new one."],
    ["D", "My demos let the song lead, not the production."],
    ["D", "I know what a pitch demo needs, and what it doesn't."],
    ["F", "I know the difference between the writer's share and the publisher's share."],
    ["F", "I've earned money from a song I wrote."],
    ["F", "I have a writing rhythm that survives a busy month."],
    ["F", "I know who I'd ask when a contract lands in my inbox."]
  ].map(function (s, i) { return { id: "s" + (i + 1), line: s[0], text: s[1] }; });

  var SCALE = [{ v: 0, label: "Not yet" }, { v: 1, label: "A little" }, { v: 2, label: "Mostly" }, { v: 3, label: "Yes" }];

  var ROLE_QS = [
    { id: "r1", text: "A blank page at a cowrite. What do you reach for first?", opts: { pen: "A title, or a line", tune: "A melody to hum", build: "A chord loop or a beat", shape: "\"What's this about, and who's it for?\"" } },
    { id: "r2", text: "The song is stuck. What do you do?", opts: { pen: "Rewrite the line that isn't true yet", tune: "Change where the melody goes", build: "Change the groove or the key", shape: "Cut verse two and get to the chorus sooner" } },
    { id: "r3", text: "Afterwards, what are you proudest of?", opts: { pen: "The line people quote back", tune: "The part people hum on the way home", build: "How it sounds", shape: "That it's finished" } },
    { id: "r4", text: "The note you give most often:", opts: { pen: "\"Say it plainer.\"", tune: "\"The melody wants to lift there.\"", build: "\"The track is fighting the vocal.\"", shape: "\"We've already said that. Cut it.\"" } },
    { id: "r5", text: "Your voice memos are mostly:", opts: { pen: "Lines, spoken or typed", tune: "Humming", build: "Loops and sounds", shape: "Notes to yourself about how the song should go" } }
  ];

  var ROLES = {
    pen: { name: "The Pen", brings: "The line that makes the song true. You hear when a lyric is pretending.",
      trips: "Falling for a line the song doesn't need, and defending it past the point it helps.",
      pair: "The Tune", money: "In this house the writers on a song split it equally, so don't bargain line by line. Your words are worth the same share as the melody." },
    tune: { name: "The Tune", brings: "The part people sing back. You find where a line wants to lift.",
      trips: "Reaching for the same melodic shape song after song.",
      pair: "The Pen", money: "Date your melody memos and keep them. A dated voice memo is your simplest record of what you wrote and when." },
    build: { name: "The Builder", brings: "A sound that makes a song feel finished early, so everyone in the room writes better.",
      trips: "An impressive track with a song nobody can quite remember.",
      pair: "The Shape", money: "Producing isn't automatically writing. Agree before the session whether you're writing, producing or both, and sign the split sheet before the first line." },
    shape: { name: "The Shape", brings: "You know what to cut, and you get songs over the line.",
      trips: "Editing before there's enough on the page to edit.",
      pair: "The Builder", money: "Finishers should register. Make it your job to register the song the same week it's done." }
  };

  function score(answers) {
    var lines = {};
    LINES.forEach(function (L) { lines[L.key] = { got: 0, of: 0 }; });
    STATEMENTS.forEach(function (s) {
      var a = answers[s.id];
      if (a === undefined || a === null || a === "") return;
      lines[s.line].got += Number(a); lines[s.line].of += 3;
    });
    var out = {};
    Object.keys(lines).forEach(function (k) { out[k] = lines[k].of ? Math.round(100 * lines[k].got / lines[k].of) : 0; });
    var tally = { pen: 0, tune: 0, build: 0, shape: 0 };
    ROLE_QS.forEach(function (q) { if (tally[answers[q.id]] !== undefined) tally[answers[q.id]]++; });
    var order = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a]; });
    return { lines: out, role: order[0], second: tally[order[1]] > 0 ? order[1] : null, tally: tally };
  }

  function result(answers) {
    var sc = score(answers);
    var byScore = LINES.slice().sort(function (a, b) { return sc.lines[b.key] - sc.lines[a.key]; });
    // The open line is the lowest one, and the lower line wins a tie: the stave is climbed from E.
    var open = LINES.slice().sort(function (a, b) { return sc.lines[a.key] - sc.lines[b.key] || LINES.indexOf(a) - LINES.indexOf(b); })[0];
    var even = sc.lines[byScore[0].key] === sc.lines[open.key];
    return { scores: sc.lines, strong: byScore[0], open: open, even: even, role: ROLES[sc.role], roleId: sc.role, second: sc.second ? ROLES[sc.second] : null, at: Date.now() };
  }

  function complete(answers) {
    return STATEMENTS.every(function (s) { return answers[s.id] !== undefined && answers[s.id] !== ""; }) &&
      ROLE_QS.every(function (q) { return !!answers[q.id]; });
  }

  // The result's headline. When every line scores the same there is no strong line, so say so and start at E.
  function headline(r) {
    var L = function (k) { return LINES.filter(function (x) { return x.key === k; })[0]; };
    var strong = L(r.strong.key || r.strong), open = L(r.open.key || r.open);
    if (r.even || strong.key === open.key) return "Level on all five lines at " + r.scores[open.key] + ". Start on " + open.key + " · " + open.name + ".";
    return "Strong on " + strong.key + " · " + strong.name + ". Open on " + open.key + " · " + open.name + ".";
  }

  window.WhereYouStand = { headline: headline, lines: LINES, statements: STATEMENTS, scale: SCALE, roleQuestions: ROLE_QS, roles: ROLES, score: score, result: result, complete: complete };
})();
