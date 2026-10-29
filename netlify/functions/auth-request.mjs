// /api/auth-request : POST { email } → emails a sign-in link (via a GHL workflow).
// The link is written to the contact's custom field room_login_link and the tag "room-login-requested" is
// (re-)added; the GHL workflow "Room sign-in link" emails {{contact.room_login_link}} and removes the tag.
// Always answers the same way, so nobody can use this to find out who is a member.
import * as ghl from "./_lib/ghl.mjs";
import { json, body, liveMode, siteUrl } from "./_lib/house.mjs";
import { isMemberTags, linkToken, newNonce } from "./_lib/session.mjs";
import { needsConsent, requestConsent } from "./_lib/consent.mjs";

const SAME = { ok: true, message: "If that email belongs to a member, a sign-in link is on its way. It works for 20 minutes. If you're 16 or 17, we need your parent or guardian's consent first, so we'll email them instead." };
const MIN_GAP = 60e3; // one link a minute per email

export default async (req) => {
  if (!liveMode()) return json({ mode: "demo" }, 503);
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const b = await body(req);
  const email = String((b && b.email) || "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "That email doesn't look right." }, 400);
  const contact = await ghl.findContactByEmail(email);
  if (!contact || !isMemberTags(contact.tags)) return json(SAME);
  const fields = await ghl.fieldsOf(contact);
  // 16- or 17-year-old without consent yet: (re)send the guardian's consent link, never a sign-in link.
  if (needsConsent(contact, fields)) { await requestConsent(contact, fields, siteUrl()); return json(SAME); }
  if (fields.room_login_sent_at && Date.now() - Number(fields.room_login_sent_at) < MIN_GAP) return json(SAME);
  const nonce = newNonce();
  const link = `${siteUrl()}/api/auth-verify?t=${encodeURIComponent(linkToken(contact.id, nonce))}`;
  await ghl.setFields(contact.id, { room_login_link: link, room_login_nonce: nonce, room_login_sent_at: Date.now() });
  try { await ghl.removeTags(contact.id, ["room-login-requested"]); } catch { /* not present */ }
  await ghl.addTags(contact.id, ["room-login-requested"]);
  return json(SAME);
};
