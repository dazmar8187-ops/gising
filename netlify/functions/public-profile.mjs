// /api/public-profile?id=<contact id> : a member's opt-in public page (site/member.html).
// Only answers if the member switched their profile or portfolio to public (feature stores
// ext.profiles.public[id] or ext.portfolio.public[id]). Returns { member, songs, stave }.
import * as ghl from "./_lib/ghl.mjs";
import { json, liveMode, toMember, recordsByNs } from "./_lib/house.mjs";
import { isMemberTags } from "./_lib/session.mjs";
import { isUnder18 } from "./_lib/consent.mjs";

export default async (req) => {
  if (!liveMode()) return json({ mode: "demo" }, 503);
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!/^[A-Za-z0-9_-]{2,64}$/.test(id)) return json({ error: "Not found." }, 404);
  const ext = await recordsByNs("ext");
  const store = (ns) => ((ext.find((r) => r.key === ns) || {}).data) || {};
  const profiles = store("profiles"), portfolio = store("portfolio"), ledger = store("ledger");
  const isPublic = !!((profiles.public && profiles.public[id]) || (portfolio.public && portfolio.public[id]));
  if (!isPublic) return json({ error: "Not found." }, 404);
  let contact;
  try { contact = await ghl.getContact(id); } catch { return json({ error: "Not found." }, 404); }
  if (!contact || !isMemberTags(contact.tags)) return json({ error: "Not found." }, 404);
  if (isUnder18(contact, await ghl.fieldsOf(contact))) return json({ error: "Not found." }, 404); // under-18 profiles are never public
  const m = await toMember(contact);
  const songs = (ledger.songs || []).filter((s) => (s.writers || []).includes(id) && ((s.status || {}).registered || (s.status || {}).released))
    .map((s) => ({ id: s.id, title: s.title, writers: s.writers, status: s.status }));
  const memberRecs = await recordsByNs("member");
  const ticks = ((memberRecs.find((r) => r.key === id) || {}).data || {}).selfMilestones || {};
  const done = Object.values(ticks).filter(Boolean).length;
  const member = { id: m.id, name: m.name, city: m.city, roles: m.roles, languages: m.languages, sounds: m.sounds, bio: m.bio, photo: m.photo, link: m.link,
    host: m.host, mentor: m.mentor, founding: m.founding };
  return json({ member, songs, stave: { selfTicks: done } }, 200, { "Cache-Control": "public, max-age=300" });
};
