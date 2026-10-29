// Shared helpers: responses, sign-in guard, member mapping and the Room's week number.
import * as ghl from "./ghl.mjs";
import { readSession, roleFromTags, isMemberTags } from "./session.mjs";
import { needsConsent, isUnder18 } from "./consent.mjs";

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });

export function liveMode() { return ghl.configured() && !!process.env.SESSION_SECRET; }

export async function body(req) {
  try { return await req.json(); } catch { return {}; }
}

// Signed-in member, with fresh tags from GHL (so removing "host" in GHL takes effect immediately).
export async function requireMember(req) {
  if (!liveMode()) return { error: json({ mode: "demo" }, 503) };
  const s = readSession(req);
  if (!s) return { error: json({ error: "Sign in first." }, 401) };
  const contact = await ghl.getContact(s.contactId);
  if (!contact || !isMemberTags(contact.tags)) return { error: json({ error: "This email isn't a member of the Room." }, 403) };
  if (needsConsent(contact, await ghl.fieldsOf(contact))) return { error: json({ error: "We're waiting for your parent or guardian's consent. We've emailed them a link.", consent: "pending" }, 403) };
  return { contact, role: roleFromTags(contact.tags), id: contact.id };
}
export const isStaff = (role) => role === "host" || role === "mentor";

// Same numbering as the app: week 0 starts Monday 12 October 2026, 00:00 Manila (UTC+8).
const MNL = 8 * 3600e3, DAY = 864e5, WEEK = 7 * DAY;
export function weekStart(ms) {
  const d = new Date(ms + MNL);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - MNL;
  return midnight - ((d.getUTCDay() + 6) % 7) * DAY;
}
export function weekNo(ms = Date.now()) { return Math.floor((weekStart(ms) - (Date.UTC(2026, 9, 12) - MNL)) / WEEK); }
export const pairingTag = (n) => `pairing-in-wk${n}`;

// Everyone in the Room: union of the member tags, de-duplicated by contact id.
// Writers aged 16 or 17 are left out until a parent or guardian has consented.
export const MEMBER_TAGS = ["room-member", "founding-member", "host", "mentor"];
export async function allMemberContacts() {
  const lists = await Promise.all(MEMBER_TAGS.map((t) => ghl.searchContactsByTag(t)));
  const byId = new Map();
  for (const c of lists.flat()) byId.set(c.id, c);
  const all = [...byId.values()];
  const ok = await Promise.all(all.map(async (c) => !needsConsent(c, await ghl.fieldsOf(c))));
  return all.filter((c, i) => ok[i]);
}

const list = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);

// GHL contact → the member shape the app uses (site/app/data.js).
export async function toMember(c) {
  const f = await ghl.fieldsOf(c);
  const tags = (c.tags || []).map((t) => String(t).toLowerCase());
  return {
    id: c.id,
    name: c.contactName || [c.firstName, c.lastName].filter(Boolean).join(" ") || c.name || "Member",
    city: c.city || f.city || "",
    roles: list(f.roles), languages: list(f.languages), sounds: list(f.sounds),
    bio: f.bio || "", photo: f.photo_url || "", link: f.music_link || "",
    openToWrite: (f.open_to_write || "yes") !== "no",
    joined: c.dateAdded ? Date.parse(c.dateAdded) : Date.now(),
    founding: tags.includes("founding-member"), host: tags.includes("host"), mentor: tags.includes("mentor"),
    under18: isUnder18(c, f)
  };
}

// App member profile → GHL contact fields.
export function profileToFields(p) {
  const out = {};
  if ("roles" in p) out.roles = (p.roles || []).join(", ");
  if ("languages" in p) out.languages = (p.languages || []).join(", ");
  if ("sounds" in p) out.sounds = (p.sounds || []).join(", ");
  if ("bio" in p) out.bio = String(p.bio || "").slice(0, 400);
  if ("link" in p) out.music_link = /^https?:\/\//i.test(p.link || "") ? p.link : "";
  if ("openToWrite" in p) out.open_to_write = p.openToWrite ? "yes" : "no";
  return out;
}

// House records: { ns, key, owner, json }. Parsed helpers.
export const parse = (r) => { try { return JSON.parse((r && r.properties && r.properties.json) || "null"); } catch { return null; } };
export async function recordsByNs(ns) {
  const recs = await ghl.searchRecords(ns);
  return recs.map((r) => ({ id: r.id, key: r.properties.key, owner: r.properties.owner, data: parse(r) }));
}
export async function upsertRecord(ns, key, owner, data, existing) {
  const props = { ns, key, owner: owner || "", json: JSON.stringify(data) };
  if (existing) return ghl.updateRecord(existing.id, props);
  return ghl.createRecord(props);
}

// The same grouping as "Build groups" in the app's admin: one producer per group where possible.
export function buildGroups(members) {
  const prod = members.filter((m) => (m.roles || []).includes("Production")).map((m) => m.id);
  const rest = members.filter((m) => !(m.roles || []).includes("Production")).map((m) => m.id);
  const groups = [];
  while (prod.length + rest.length >= 3) {
    const g = [];
    if (prod.length) g.push(prod.shift());
    while (g.length < 3 && rest.length) g.push(rest.shift());
    while (g.length < 3 && prod.length) g.push(prod.shift());
    groups.push(g);
  }
  const left = prod.concat(rest);
  if (left.length && groups.length) left.forEach((id, i) => groups[i % groups.length].push(id));
  return groups;
}

export const BRIEFS = ["A goodbye at an airport, told by the person who stays behind.", "The first song you'd play on a long drive home.",
  "Write the chorus as a text message that was never sent.", "A love song set entirely in a convenience store at 3am.",
  "Thank someone who will never hear it.", "A song about leaving, with a chorus that wants to stay."];

export const siteUrl = () => (process.env.URL || process.env.SITE_URL || "https://gising.netlify.app").replace(/\/$/, "");
