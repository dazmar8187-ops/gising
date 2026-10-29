// /api/members : the member directory for signed-in members (public profile fields only, no emails or phones).
import { json, requireMember, toMember, allMemberContacts } from "./_lib/house.mjs";

export default async (req) => {
  const who = await requireMember(req);
  if (who.error) return who.error;
  const members = await Promise.all((await allMemberContacts()).map(toMember));
  return json({ members });
};
