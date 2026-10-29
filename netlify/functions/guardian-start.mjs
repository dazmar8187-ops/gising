// /api/guardian-start : called by a GHL workflow "Webhook" action when a 16- or 17-year-old joins, reserves a camp
// place or applies to the Academy. Sends the guardian consent request (see _lib/consent.mjs).
//   POST, header x-house-key: <GHL_WEBHOOK_SECRET>, JSON body with the contact id (GHL sends contact_id) or email.
// The host can also resend from /admin (POST with a signed-in host session and { contactId }).
import * as ghl from "./_lib/ghl.mjs";
import { json, body, liveMode, siteUrl } from "./_lib/house.mjs";
import { readSession } from "./_lib/session.mjs";
import { requestConsent } from "./_lib/consent.mjs";
import { timingSafeEqual } from "node:crypto";

function keyOk(req) {
  const want = process.env.GHL_WEBHOOK_SECRET || "", got = req.headers.get("x-house-key") || new URL(req.url).searchParams.get("key") || "";
  if (!want || want.length !== got.length) return false;
  return timingSafeEqual(Buffer.from(want), Buffer.from(got));
}

export default async (req) => {
  if (!liveMode()) return json({ mode: "demo" }, 503);
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const s = readSession(req);
  const viaHost = !!s && s.role === "host";
  if (!keyOk(req) && !viaHost) return json({ error: "Not allowed." }, 401);
  const b = await body(req);
  // ASSUMPTION: GHL's workflow webhook body carries contact_id (and email) at the top level.
  const id = b.contactId || b.contact_id || (b.contact && b.contact.id) || b.id || "";
  const email = String(b.email || (b.contact && b.contact.email) || "").trim().toLowerCase();
  let contact = null;
  if (id) { try { contact = await ghl.getContact(id); } catch { contact = null; } }
  if (!contact && email) contact = await ghl.findContactByEmail(email);
  if (!contact) return json({ error: "Contact not found." }, 404);
  if (viaHost) { const host = await ghl.getContact(s.contactId); if (!host || !(host.tags || []).map(String).map((t) => t.toLowerCase()).includes("host")) return json({ error: "Not allowed." }, 401); }
  const result = await requestConsent(contact, await ghl.fieldsOf(contact), siteUrl(), { force: viaHost });
  return json({ ok: true, result });
};
