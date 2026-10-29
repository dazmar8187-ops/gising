// Scheduled: every Tuesday 09:00 Manila (01:00 UTC). Builds this week's Pairing groups.
// Reads contacts tagged pairing-in-wk<N>, makes groups of three (a producer in each where possible),
// creates a writing-room record per group, saves the groups, then tags each writer "pairing-grouped" with
// pairing_group_link set, so the GHL workflow "Pairing group" emails them.
import * as ghl from "./_lib/ghl.mjs";
import { liveMode, weekNo, pairingTag, toMember, recordsByNs, upsertRecord, buildGroups, BRIEFS, siteUrl, json } from "./_lib/house.mjs";

export async function run(now = Date.now()) {
  const week = weekNo(now);
  const contacts = await ghl.searchContactsByTag(pairingTag(week));
  const members = await Promise.all(contacts.map(toMember));
  const groups = buildGroups(members);
  const pairing = await recordsByNs("pairing");
  const roomIds = [];
  for (let i = 0; i < groups.length; i++) {
    const id = `pw${week}g${i + 1}`;
    const room = { id, title: `Pairing · week ${Math.max(week + 1, 1)} · group ${i + 1}`, lyrics: "", notes: "", call: "", writers: groups[i], signed: {}, public: false, created: now, brief: BRIEFS[i % BRIEFS.length], source: "pairing" };
    await upsertRecord("room", id, groups[i][0], room, null);
    roomIds.push(id);
    for (const w of groups[i]) {
      await ghl.setFields(w, { pairing_group_link: `${siteUrl()}/app/#/write/${id}` });
      try { await ghl.removeTags(w, ["pairing-grouped"]); } catch { /* not present */ }
      await ghl.addTags(w, ["pairing-grouped"]);
    }
  }
  await upsertRecord("pairing", `wk${week}`, "", { groups: roomIds, at: now, builtBy: "schedule" }, pairing.find((r) => r.key === `wk${week}`));
  return { week, people: members.length, groups: roomIds.length };
}

export default async () => {
  if (!liveMode()) return json({ mode: "demo" });
  return json(await run());
};

export const config = { schedule: "0 1 * * 2" };
