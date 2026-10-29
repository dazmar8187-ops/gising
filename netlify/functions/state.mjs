// /api/state : everything the house tools need, in the same shape as Room.db.state (site/app/data.js).
//   GET  → the signed-in member's view of the house.
//   PUT  → write-through of the parts that member may change (only the parts sent are touched).
//
// Where each part lives in GHL:
//   profile            contact fields (city is the standard field; roles, languages, sounds, bio, music_link,
//                      open_to_write, photo_url are custom fields); photo uploaded to the media library
//   pairing opt-in     tag pairing-in-wk<N> on the contact
//   writing rooms      House record ns=room,     key=<room id>,  owner=<creator contact id>
//   Pro Desk           House record ns=prodesk,  key=<entry id>, owner=<member contact id>
//   open times         House record ns=opentime, key=<id>,       owner=<member contact id>
//   member data        House record ns=member,   key=<contact id> (stave ticks, seats, notifications)
//   Pairing groups     House record ns=pairing,  key=wk<N>
//   feature stores     House record ns=ext,      key=<namespace> (shared by the whole house)
//   messages           House record ns=dm,       key=<thread id>, owner=<creator>; blocks: ns=dmblock, key=<contact id>
//                      (private: never in the shared feature stores; each member gets only their own threads)
//   call links         location custom value "call_links"
import * as ghl from "./_lib/ghl.mjs";
import { json, body, requireMember, isStaff, weekNo, pairingTag, toMember, profileToFields, recordsByNs, upsertRecord, siteUrl, allMemberContacts } from "./_lib/house.mjs";

// Feature stores only the host and mentors may change (everyone can still read them).
const STAFF_EXT = new Set(["pitch", "pitches", "mentors", "checkins", "circles-admin", "events-admin"]);
const PRIVATE_EXT = new Set(["messages"]); // handled by the Messages code below, never stored as a shared record
const MAX_JSON = 60000; // ASSUMPTION: keep each record's json under ~60k characters (GHL's large-text limit isn't published).

// Messages and writers aged 16 or 17 (terms.html#young): if anyone in a conversation is under 18,
// every adult in it must be the host or a mentor. The app applies the same rule (features/messages.js).
export function dmAllowed(ids, byId) {
  const ms = ids.map((id) => byId.get(id));
  if (ms.some((m) => !m)) return false;
  if (!ms.some((m) => m.under18)) return true;
  return ms.every((m) => m.under18 || m.host || m.mentor);
}
const hasMinor = (t, byId) => (t.members || []).some((id) => (byId.get(id) || {}).under18);

// Re-add a tag so a GHL "tag added" workflow fires again for repeat notifications.
async function notifyTag(contactId, tag, fields) {
  if (fields) await ghl.setFields(contactId, fields);
  try { await ghl.removeTags(contactId, [tag]); } catch { /* not present yet */ }
  await ghl.addTags(contactId, [tag]);
}

export default async (req) => {
  const who = await requireMember(req);
  if (who.error) return who.error;
  const { contact, role, id: me } = who;
  const staff = isStaff(role);
  const week = weekNo();

  if (req.method === "GET") {
    const [memberContacts, rooms, prodesk, members, pairing, opentimes, ext, callLinks, dms, dmBlocks] = await Promise.all([
      allMemberContacts(),
      recordsByNs("room"), recordsByNs("prodesk"), recordsByNs("member"), recordsByNs("pairing"), recordsByNs("opentime"), recordsByNs("ext"),
      ghl.getJsonValue("call_links", { "House Session": "", "The Round": "" }),
      recordsByNs("dm"), recordsByNs("dmblock")
    ]);
    // Make sure the signed-in member is in the list even if search indexing lags.
    const byId = new Map();
    for (const c of memberContacts.concat([contact])) byId.set(c.id, c);
    const memberList = await Promise.all([...byId.values()].map(toMember));
    const optedIn = await ghl.searchContactsByTag(pairingTag(week));
    const mine = (members.find((r) => r.key === me) || {}).data || {};
    const groupRec = pairing.find((r) => r.key === `wk${week}`);
    const roomMap = {};
    for (const r of rooms) {
      const room = r.data; if (!room) continue;
      if (staff || room.public || (room.writers || []).includes(me)) roomMap[room.id] = room;
    }
    const groups = (groupRec && groupRec.data && groupRec.data.groups) || [];
    const myGroupRoom = groups.find((rid) => roomMap[rid] && roomMap[rid].writers.includes(me)) || null;
    const extOut = {};
    for (const r of ext) if (r.data && !PRIVATE_EXT.has(r.key)) extOut[r.key] = r.data;
    // Messages: your threads, plus (for the host, as safeguarding lead) any thread with an under-18 member.
    const byIdM = new Map(memberList.map((m) => [m.id, m]));
    const blocks = {};
    for (const r of dmBlocks) {
      const list = (r.data && r.data.list) || [];
      if (r.key === me) blocks[me] = list; else if (list.includes(me)) blocks[r.key] = [me];
    }
    extOut.messages = {
      seeded: true, blocked: blocks,
      threads: dms.map((r) => r.data).filter((t) => t && Array.isArray(t.members) && (t.members.includes(me) || (role === "host" && hasMinor(t, byIdM))))
    };
    return json({
      v: 3, mode: "ghl", me, role,
      members: memberList,
      posts: [], announcements: [],
      rooms: roomMap,
      pairing: { optIn: (contact.tags || []).includes(pairingTag(week)), others: optedIn.map((c) => c.id).filter((x) => x !== me), groups, room: myGroupRoom, week, signedWeeks: [] },
      prodesk: prodesk.map((r) => r.data).filter((p) => p && (staff || p.by === me)),
      openTimes: opentimes.map((r) => r.data).filter(Boolean),
      callLinks,
      selfMilestones: mine.selfMilestones || {}, rsvps: mine.rsvps || {}, played: mine.played || {},
      checklistHidden: !!mine.checklistHidden, notifications: mine.notifications || [],
      ext: extOut
    });
  }

  if (req.method !== "PUT") return json({ error: "Use GET or PUT." }, 405);
  const b = await body(req);
  const saved = [], notes = [];

  // Profile → contact
  if (b.profile && typeof b.profile === "object") {
    const p = b.profile, patch = {};
    if (p.name) { const parts = String(p.name).trim().split(/\s+/); patch.firstName = parts.shift(); patch.lastName = parts.join(" "); }
    if ("city" in p) patch.city = String(p.city || "").slice(0, 80);
    const fields = profileToFields(p);
    if (p.photo && /^data:image\//.test(p.photo)) fields.photo_url = (await ghl.uploadDataUrl(p.photo, `member-${me}.jpg`)) || "";
    else if (p.photo === "") fields.photo_url = "";
    if (Object.keys(fields).length) patch.customFields = Object.entries(fields).map(([key, field_value]) => ({ key, field_value }));
    if (Object.keys(patch).length) await ghl.updateContact(me, patch);
    saved.push("profile");
  }

  // Member data (stave ticks, seats saved, notifications)
  if (b.member && typeof b.member === "object") {
    const recs = await recordsByNs("member");
    const existing = recs.find((r) => r.key === me);
    const cur = (existing && existing.data) || {};
    const keep = ["selfMilestones", "rsvps", "played", "checklistHidden", "notifications"];
    const next = { ...cur };
    for (const k of keep) if (k in b.member) next[k] = b.member[k];
    if (Array.isArray(next.notifications)) next.notifications = next.notifications.slice(0, 50);
    await upsertRecord("member", me, me, next, existing);
    saved.push("member");
  }

  // Pairing opt-in → tag for this week
  if (b.pairing && "optIn" in b.pairing) {
    if (b.pairing.optIn) await ghl.addTags(me, [pairingTag(week)]); else await ghl.removeTags(me, [pairingTag(week)]);
    saved.push("pairing");
  }

  // Writing rooms. Writers may edit their rooms; only the signer can sign (staff may do anything).
  if (b.rooms && typeof b.rooms === "object") {
    const recs = await recordsByNs("room");
    for (const room of Object.values(b.rooms)) {
      if (!room || !room.id || !Array.isArray(room.writers)) continue;
      const existing = recs.find((r) => r.key === room.id);
      const cur = existing && existing.data;
      if (cur && !staff && !(cur.writers || []).includes(me)) continue;
      if (!cur && !staff && !room.writers.includes(me)) continue;
      const next = { ...room, signed: { ...((cur && cur.signed) || {}) } };
      if (staff) Object.assign(next.signed, room.signed || {});
      else if (room.signed && room.signed[me]) next.signed[me] = true;
      if (cur && !staff) next.writers = cur.writers; // members can't add or remove writers after the room exists
      const text = JSON.stringify(next);
      if (text.length > MAX_JSON) next.lyrics = String(next.lyrics || "").slice(0, MAX_JSON - (text.length - String(next.lyrics || "").length) - 100);
      await upsertRecord("room", room.id, (cur && existing.owner) || me, next, existing);
      // New room with other writers → invite them (GHL workflow "Room invite" emails the link).
      if (!cur) for (const w of next.writers.filter((x) => x !== me)) await notifyTag(w, "room-invite", { room_invite_link: `${siteUrl()}/app/#/write/${room.id}` });
    }
    saved.push("rooms");
  }

  // Pro Desk: members add their own songs; staff write notes back.
  if (Array.isArray(b.prodesk)) {
    const recs = await recordsByNs("prodesk");
    for (const e of b.prodesk) {
      if (!e || !e.id) continue;
      const existing = recs.find((r) => r.key === e.id);
      const cur = existing && existing.data;
      if (!cur) {
        if (e.by !== me) continue;
        await upsertRecord("prodesk", e.id, me, { ...e, status: "With a mentor", notes: null }, null);
        await notifyTag(me, "prodesk-submitted", { prodesk_title: e.title || "" });
      } else if (staff && e.notes && cur.status !== "Notes back") {
        await upsertRecord("prodesk", e.id, cur.by, { ...cur, notes: e.notes, status: "Notes back" }, existing);
        await notifyTag(cur.by, "prodesk-notes-back", { prodesk_title: cur.title || "", prodesk_link: `${siteUrl()}/app/#/academy` });
      }
    }
    saved.push("prodesk");
  }

  // Open times: post your own; book someone else's if it's free.
  if (Array.isArray(b.openTimes)) {
    const recs = await recordsByNs("opentime");
    for (const t of b.openTimes) {
      if (!t || !t.id) continue;
      const existing = recs.find((r) => r.key === t.id);
      const cur = existing && existing.data;
      if (!cur && t.by === me) await upsertRecord("opentime", t.id, me, t, null);
      else if (cur && !cur.bookedBy && t.bookedBy === me && cur.by !== me) {
        await upsertRecord("opentime", t.id, cur.by, { ...cur, bookedBy: me }, existing);
        await notifyTag(cur.by, "open-time-booked", { open_time_booked_by: contact.contactName || contact.firstName || "A member" });
      } else if (cur && (cur.by === me || staff)) await upsertRecord("opentime", t.id, cur.by, { ...cur, ...t, by: cur.by }, existing);
    }
    saved.push("openTimes");
  }

  // Messages: append-only for the people in each thread, with the under-18 rule and blocks enforced here.
  if (b.ext && b.ext.messages && typeof b.ext.messages === "object") {
    const m = b.ext.messages;
    const [dms, dmBlocks, people] = await Promise.all([recordsByNs("dm"), recordsByNs("dmblock"), allMemberContacts().then((cs) => Promise.all(cs.map(toMember)))]);
    const byIdM = new Map(people.map((p) => [p.id, p]));
    const blockedMe = (id) => (((dmBlocks.find((r) => r.key === id) || {}).data || {}).list || []).includes(me);
    if (m.blocked && Array.isArray(m.blocked[me])) {
      const list = m.blocked[me].filter((id) => typeof id === "string" && byIdM.has(id)).slice(0, 500);
      await upsertRecord("dmblock", me, me, { list }, dmBlocks.find((r) => r.key === me));
    }
    let refused = 0;
    for (const t of Array.isArray(m.threads) ? m.threads.slice(0, 200) : []) {
      if (!t || typeof t.id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(t.id) || !Array.isArray(t.members)) continue;
      const existing = dms.find((r) => r.key === t.id), cur = existing && existing.data;
      const members = cur ? cur.members : [...new Set(t.members.map(String))];
      if (!members.includes(me)) continue;                       // only people in a thread can write to it
      if (!cur && (members.length < 2 || members.length > 6)) continue;
      if (!dmAllowed(members, byIdM)) { refused++; continue; }   // under-18 rule (also catches unknown or pending members)
      const others = members.filter((id) => id !== me);
      if (others.length === 1 && blockedMe(others[0])) continue;
      const have = (cur && cur.msgs) || [];
      const lastAt = have.length ? have[have.length - 1].at : 0;
      const fresh = (Array.isArray(t.msgs) ? t.msgs : []).filter((x) => x && x.by === me && Number(x.at) > lastAt && typeof x.body === "string")
        .slice(-20).map((x) => ({ by: me, at: Math.min(Number(x.at), Date.now()), body: x.body.slice(0, 2000) }));
      const read = { ...((cur && cur.read) || {}) };
      if (t.read && t.read[me]) read[me] = Math.min(Number(t.read[me]) || 0, Date.now());
      if (cur && !fresh.length && read[me] === (cur.read || {})[me]) continue;
      let next = { id: t.id, members, name: cur ? cur.name : String(t.name || "").slice(0, 60), read, msgs: have.concat(fresh) };
      while (JSON.stringify(next).length > MAX_JSON && next.msgs.length > 1) next = { ...next, msgs: next.msgs.slice(1) };
      await upsertRecord("dm", t.id, (existing && existing.owner) || me, next, existing);
    }
    saved.push("messages");
    if (refused) notes.push("Members under 18 can message each other, the host and mentors only.");
  }

  // Feature stores (one shared record per namespace)
  if (b.ext && typeof b.ext === "object") {
    const recs = await recordsByNs("ext");
    for (const [ns, data] of Object.entries(b.ext)) {
      if (!/^[a-z0-9-]{1,40}$/.test(ns) || PRIVATE_EXT.has(ns)) continue;
      if (STAFF_EXT.has(ns) && !staff) continue;
      if (JSON.stringify(data).length > MAX_JSON) continue;
      await upsertRecord("ext", ns, me, data, recs.find((r) => r.key === ns));
    }
    saved.push("ext");
  }

  // Staff only: call links and this week's Pairing groups
  if (staff && b.callLinks && typeof b.callLinks === "object") {
    const clean = {};
    for (const [k, v] of Object.entries(b.callLinks)) clean[k] = /^https?:\/\//i.test(v || "") ? v : "";
    await ghl.setCustomValue("call_links", JSON.stringify(clean));
    saved.push("callLinks");
  }
  if (staff && Array.isArray(b.groups)) {
    const recs = await recordsByNs("pairing");
    await upsertRecord("pairing", `wk${week}`, me, { groups: b.groups, builtBy: me, at: Date.now() }, recs.find((r) => r.key === `wk${week}`));
    saved.push("groups");
  }

  return json(notes.length ? { ok: true, saved, notes } : { ok: true, saved });
};
