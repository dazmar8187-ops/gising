// /api/auth-logout : signs out (clears the session cookie).
import { json } from "./_lib/house.mjs";
import { clearCookie } from "./_lib/session.mjs";

export default async () => json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
