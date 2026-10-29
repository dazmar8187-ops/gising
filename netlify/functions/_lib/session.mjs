// Signed sessions and magic-link tokens. HMAC-SHA256 with SESSION_SECRET (any long random string).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const COOKIE = "sh_session";
const SESSION_DAYS = 30;
export const LINK_MINUTES = 20;

const b64 = (buf) => Buffer.from(buf).toString("base64url");
const unb64 = (s) => Buffer.from(s, "base64url").toString("utf8");
const secret = () => process.env.SESSION_SECRET || "";
const sign = (data) => createHmac("sha256", secret()).update(data).digest("base64url");

export function seal(payload) {
  const body = b64(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}
export function unseal(token) {
  if (!token || !secret() || typeof token !== "string") return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(unb64(body));
    if (!p.exp || p.exp < Date.now()) return null;
    return p;
  } catch { return null; }
}

// Role from GHL contact tags. "host" beats "mentor" beats member.
export function roleFromTags(tags = []) {
  const t = tags.map((x) => String(x).toLowerCase());
  return t.includes("host") ? "host" : t.includes("mentor") ? "mentor" : "member";
}
export function isMemberTags(tags = []) {
  const t = tags.map((x) => String(x).toLowerCase());
  return t.includes("room-member") || t.includes("founding-member") || t.includes("host") || t.includes("mentor");
}

export function newNonce() { return randomBytes(12).toString("base64url"); }
export function linkToken(contactId, nonce) { return seal({ t: "link", c: contactId, n: nonce, exp: Date.now() + LINK_MINUTES * 60e3 }); }
export function readLinkToken(token) { const p = unseal(token); return p && p.t === "link" ? p : null; }

export function sessionCookie(contactId, role) {
  const value = seal({ t: "session", c: contactId, r: role, exp: Date.now() + SESSION_DAYS * 864e5 });
  return `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}
export function clearCookie() { return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }

export function readSession(req) {
  const raw = req.headers.get("cookie") || "";
  const m = raw.split(/;\s*/).find((c) => c.startsWith(COOKIE + "="));
  if (!m) return null;
  const p = unseal(decodeURIComponent(m.slice(COOKIE.length + 1)));
  return p && p.t === "session" ? { contactId: p.c, role: p.r } : null;
}
