// Scheduled: every Monday 08:00 Manila (00:00 UTC). Writes this week's digest text into the GHL custom value
// "weekly_digest" and tags every member "digest-due", so the GHL workflow "Weekly digest" emails
// {{custom_values.weekly_digest}} and removes the tag.
import * as ghl from "./_lib/ghl.mjs";
import { liveMode, weekNo, pairingTag, recordsByNs, allMemberContacts, json, siteUrl } from "./_lib/house.mjs";

const PROMPTS = ["The room you grew up in", "A text you never sent", "Jeepney window", "The other side", "One chord", "Before the storm",
  "Taglish / mixed tongue", "Small hours job", "Title first", "Thank-you song", "The bridge", "Cowrite week"]; // keep in step with config.js room.prompts

export async function run(now = Date.now()) {
  const week = Math.max(0, weekNo(now));
  const [members, prodesk, rooms] = await Promise.all([allMemberContacts(), recordsByNs("prodesk"), recordsByNs("room")]);
  const weekAgo = now - 7 * 864e5;
  const newRooms = rooms.filter((r) => r.data && r.data.created >= weekAgo).length;
  const notesBack = prodesk.filter((r) => r.data && r.data.status === "Notes back").length;
  const text = [`This week's prompt: ${PROMPTS[week % PROMPTS.length]}. Post by Sunday.`,
    `Say "I'm in" for the Pairing by Monday night: ${siteUrl()}/app/#/cowrites`,
    `Last week: ${newRooms} new writing room${newRooms === 1 ? "" : "s"} opened, ${notesBack} Pro Desk song${notesBack === 1 ? "" : "s"} with notes back so far.`].join("\n");
  await ghl.setCustomValue("weekly_digest", text);
  for (const c of members) {
    try { await ghl.removeTags(c.id, ["digest-due"]); } catch { /* not present */ }
    await ghl.addTags(c.id, ["digest-due"]);
  }
  return { week, members: members.length, pairingTag: pairingTag(week) };
}

export default async () => {
  if (!liveMode()) return json({ mode: "demo" });
  return json(await run());
};

export const config = { schedule: "0 0 * * 1" };
