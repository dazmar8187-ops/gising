// Writers aged 16 and 17 (terms.html#young): nothing opens until a parent or guardian consents.
//
// On the GHL contact:
//   age_band                "18+" or "16-17" (from the join, camp and Academy forms)
//   guardian_email          where the consent link goes
//   guardian_consent_link   the link the GHL workflow "Guardian consent request" emails to {{contact.guardian_email}}
//   guardian_consent_nonce / guardian_consent_sent_at   one live link at a time, at most one email an hour
//   guardian_consent_at / guardian_name / guardian_relationship / guardian_consent_version   the consent record
// Tags: guardian-consent-pending (waiting), guardian-consent-requested (re-added to fire the email),
//       guardian-consent-given (consent recorded; fires the Room invite), guardian-consent-declined.
import * as ghl from "./ghl.mjs";
import { seal, unseal, newNonce } from "./session.mjs";

export const CONSENT_DAYS = 14;
const GAP = 3600e3;
const low = (tags) => (tags || []).map((t) => String(t).toLowerCase());

export function isUnder18(contact, fields) {
  return (fields && fields.age_band === "16-17") || low(contact.tags).includes("under-18");
}
export const hasConsent = (contact) => low(contact.tags).includes("guardian-consent-given");
export const needsConsent = (contact, fields) => isUnder18(contact, fields) && !hasConsent(contact);

export const consentToken = (contactId, nonce) => seal({ t: "guardian", c: contactId, n: nonce, exp: Date.now() + CONSENT_DAYS * 864e5 });
export function readConsentToken(token) { const p = unseal(token); return p && p.t === "guardian" ? p : null; }

const validEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(e || ""));

// Writes a fresh consent link to the contact and re-adds the tag that makes GHL email it to the guardian.
// Returns "sent", "recent" (one went out within the hour), "no-guardian-email" or "not-needed".
export async function requestConsent(contact, fields, siteUrl, { force = false } = {}) {
  if (!needsConsent(contact, fields)) return "not-needed";
  if (!validEmail(fields.guardian_email)) {
    await ghl.addTags(contact.id, ["guardian-consent-pending", "guardian-email-missing"]);
    return "no-guardian-email";
  }
  if (!force && fields.guardian_consent_sent_at && Date.now() - Number(fields.guardian_consent_sent_at) < GAP) return "recent";
  const nonce = newNonce();
  await ghl.setFields(contact.id, {
    guardian_consent_link: `${siteUrl}/guardian.html?t=${encodeURIComponent(consentToken(contact.id, nonce))}`,
    guardian_consent_nonce: nonce,
    guardian_consent_sent_at: Date.now()
  });
  try { await ghl.removeTags(contact.id, ["guardian-consent-requested"]); } catch { /* not present */ }
  await ghl.addTags(contact.id, ["guardian-consent-pending", "guardian-consent-requested"]);
  return "sent";
}
