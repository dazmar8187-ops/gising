// /api/report : POST { target, targetType, reason, url } → moderation report.
// Adds a note on the reported member (or on the reporter, if the report isn't about a member) and the tag
// "report-open", which the GHL workflow "Moderation report" turns into a task for the host.
// Signed-in members only, so reports can be followed up.
import * as ghl from "./_lib/ghl.mjs";
import { json, body, requireMember } from "./_lib/house.mjs";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const who = await requireMember(req);
  if (who.error) return who.error;
  const b = await body(req);
  const reason = String(b.reason || "").trim().slice(0, 1000);
  if (!reason) return json({ error: "Say what happened." }, 400);
  const text = `Report from ${who.contact.contactName || who.contact.firstName || who.id} (${who.id})\nAbout: ${b.targetType || "item"} ${b.target || ""}\nWhere: ${b.url || ""}\n\n${reason}`;
  let onContact = who.id;
  if (b.targetType === "member" && b.target) { try { await ghl.getContact(b.target); onContact = b.target; } catch { /* keep reporter */ } }
  await ghl.addNote(onContact, text, "Room moderation report");
  await ghl.addTags(onContact, ["report-open"]);
  return json({ ok: true, message: "Thanks. The host has it and will follow up." });
};
