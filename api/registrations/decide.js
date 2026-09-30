import { supabaseAdmin } from "../telegram/_supabaseAdmin.js";
import { findMemberByAuthUser } from "../telegram/_members.js";
import { decideRegistration } from "../telegram/_registrations.js";

// POST /api/registrations/decide  { registrationId, approve }
// Authorization: Bearer <the logged-in TO's Supabase access token>
//
// The website's Approve / Reject buttons. A server endpoint rather than a
// client UPDATE so a web decision also sends the applicant their Telegram
// message, through the same code path as the bot's review screen.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const { data: userData, error: userError } = token
    ? await supabaseAdmin.auth.getUser(token)
    : { data: null, error: true };
  if (userError || !userData?.user) {
    res.status(401).json({ error: "Log in again." });
    return;
  }

  const member = await findMemberByAuthUser(userData.user.id);
  if (!member) {
    res.status(403).json({ error: "You're not part of a TO account." });
    return;
  }

  const { registrationId, approve } = req.body || {};
  if (!Number.isInteger(registrationId) || typeof approve !== "boolean") {
    res.status(400).json({ error: "Bad request." });
    return;
  }

  const result = await decideRegistration({ member, registrationId, approve });
  res.status(result.ok ? 200 : 409).json(result.ok ? { message: result.message } : { error: result.message });
}
