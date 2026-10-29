// /api/guardian-consent : the parent or guardian's side of consent for writers aged 16 and 17 (site/guardian.html).
//   GET  ?t=…  → { writer, guardian } (first name and a masked email) so the page can say who it's about.
//   POST { t, decision: "give" | "decline", guardian_name, relationship, signature, confirm: {...}, version }
// Links last 14 days and work once. Consent tags the contact guardian-consent-given (the GHL workflow then sends
// the Room invite) and leaves a note with the full record on the contact.
import * as ghl from "./_lib/ghl.mjs";
import { json, body, liveMode } from "./_lib/house.mjs";
import { readConsentToken, isUnder18, hasConsent } from "./_lib/consent.mjs";

const RELATIONSHIPS = ["parent", "legal-guardian"];
const CONFIRMS = ["isGuardian", "terms", "agreement", "privacy", "join"];
const mask = (e) => String(e || "").replace(/^(.).*(@.*)$/, "$1•••$2");
const clean = (s, n) => String(s || "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, n);

async function load(t) {
  const p = readConsentToken(t);
  if (!p) return { error: json({ error: "This consent link has expired. Ask the writer to sign in again and we'll send a new one." }, 400) };
  let contact;
  try { contact = await ghl.getContact(p.c); } catch { contact = null; }
  if (!contact) return { error: json({ error: "We couldn't find this application." }, 404) };
  const fields = await ghl.fieldsOf(contact);
  if (hasConsent(contact)) return { error: json({ error: "Consent has already been given. Thank you.", done: true }, 409) };
  if (!isUnder18(contact, fields)) return { error: json({ error: "Consent isn't needed for this writer." }, 409) };
  if (!fields.guardian_consent_nonce || fields.guardian_consent_nonce !== p.n) return { error: json({ error: "This consent link has already been used or replaced by a newer one. Check for a more recent email." }, 400) };
  return { contact, fields };
}

export default async (req) => {
  if (!liveMode()) return json({ mode: "demo" }, 503);

  if (req.method === "GET") {
    const r = await load(new URL(req.url).searchParams.get("t"));
    if (r.error) return r.error;
    return json({ writer: r.contact.firstName || "the writer", guardian: mask(r.fields.guardian_email) });
  }
  if (req.method !== "POST") return json({ error: "Use GET or POST." }, 405);

  const b = await body(req);
  const r = await load(b.t);
  if (r.error) return r.error;
  const { contact } = r;

  if (b.decision === "decline") {
    await ghl.setFields(contact.id, { guardian_consent_nonce: "", guardian_consent_link: "" });
    await ghl.addTags(contact.id, ["guardian-consent-declined"]);
    await ghl.addNote(contact.id, `Parent or guardian declined consent on ${new Date().toISOString()}.`, "Guardian consent declined");
    return json({ ok: true, decision: "decline" });
  }
  if (b.decision !== "give") return json({ error: "Choose to give or decline consent." }, 400);

  const name = clean(b.guardian_name, 80), signature = clean(b.signature, 80), relationship = String(b.relationship || "");
  if (name.length < 3) return json({ error: "Add your full name." }, 400);
  if (!RELATIONSHIPS.includes(relationship)) return json({ error: "Choose your relationship to the writer." }, 400);
  const c = b.confirm || {};
  if (!CONFIRMS.every((k) => c[k] === true)) return json({ error: "Tick every box to give consent." }, 400);
  if (signature.toLowerCase().replace(/\s+/g, " ") !== name.toLowerCase().replace(/\s+/g, " ")) return json({ error: "Type your full name exactly as above to sign." }, 400);

  const at = new Date().toISOString(), version = clean(b.version, 40) || "unknown";
  await ghl.setFields(contact.id, {
    guardian_consent_at: at, guardian_name: name, guardian_relationship: relationship, guardian_consent_version: version,
    guardian_consent_nonce: "", guardian_consent_link: ""
  });
  try { await ghl.removeTags(contact.id, ["guardian-consent-pending", "guardian-consent-requested", "guardian-consent-declined", "guardian-email-missing"]); } catch { /* some not present */ }
  await ghl.addTags(contact.id, ["guardian-consent-given"]);
  await ghl.addNote(contact.id,
    `Guardian consent given ${at} by ${name} (${relationship}), signed by typing their name. Confirmed: is the parent or legal guardian; ` +
    `read and agrees to the terms (incl. writers aged 16 and 17), co-signs the member agreement and split sheets, read the privacy policy, ` +
    `consents to the writer joining. Document version ${version}. IP country: ${req.headers.get("x-country") || "unknown"}.`,
    "Guardian consent given");
  return json({ ok: true, decision: "give" });
};
