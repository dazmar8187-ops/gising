// /api/flags : shared feature flags, stored in the GHL location custom value "feature_flags" (JSON).
//   GET  → { mode: "ghl", flags }   (anyone; the website needs them to show or hide features)
//   POST → { flags } from the host only
// In demo mode → { mode: "demo" } and the browser keeps its own choices (assets/flags.js).
import * as ghl from "./_lib/ghl.mjs";
import { json, body, liveMode, requireMember } from "./_lib/house.mjs";

export default async (req) => {
  if (!liveMode()) return json({ mode: "demo" });
  if (req.method === "GET") return json({ mode: "ghl", flags: await ghl.getJsonValue("feature_flags", {}) });
  if (req.method !== "POST") return json({ error: "Use GET or POST." }, 405);
  const who = await requireMember(req);
  if (who.error) return who.error;
  if (who.role !== "host") return json({ error: "Only the host can change feature flags." }, 403);
  const b = await body(req);
  const clean = {};
  for (const [k, v] of Object.entries((b && b.flags) || {})) if (/^[a-z0-9-]{1,40}$/.test(k)) clean[k] = !!v;
  await ghl.setCustomValue("feature_flags", JSON.stringify(clean));
  return json({ mode: "ghl", flags: clean });
};
