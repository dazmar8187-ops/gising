// /api/auth-verify?t=… : the link from the sign-in email. Checks it, signs the member in, sends them to the app.
// Links work once: the nonce on the contact is cleared after use.
import * as ghl from "./_lib/ghl.mjs";
import { liveMode } from "./_lib/house.mjs";
import { readLinkToken, sessionCookie, roleFromTags, isMemberTags } from "./_lib/session.mjs";
import { needsConsent } from "./_lib/consent.mjs";

const page = (msg, status) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Gising Sining House</title><body style="font-family:system-ui,sans-serif;background:#EEF0EA;color:#14221F;padding:40px;max-width:560px;margin:auto"><h1 style="font-size:1.6rem">${msg}</h1><p><a href="/app/">Back to the Room</a></p></body>`, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });

export default async (req) => {
  if (!liveMode()) return page("Sign-in isn't switched on yet.", 503);
  const t = new URL(req.url).searchParams.get("t");
  const p = readLinkToken(t);
  if (!p) return page("That sign-in link has expired. Ask for a new one.", 400);
  const contact = await ghl.getContact(p.c);
  if (!contact || !isMemberTags(contact.tags)) return page("This email isn't a member of the Room.", 403);
  const fields = await ghl.fieldsOf(contact);
  if (needsConsent(contact, fields)) return page("We're waiting for your parent or guardian's consent. We've emailed them a link.", 403);
  if (!fields.room_login_nonce || fields.room_login_nonce !== p.n) return page("That sign-in link has already been used. Ask for a new one.", 400);
  await ghl.setFields(contact.id, { room_login_nonce: "", room_login_link: "" });
  const role = roleFromTags(contact.tags);
  return new Response(null, { status: 302, headers: { Location: role === "host" || role === "mentor" ? "/app/#/admin" : "/app/", "Set-Cookie": sessionCookie(contact.id, role) } });
};
