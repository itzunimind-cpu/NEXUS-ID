import { supabaseAdmin } from "./_supabaseAdmin.js";
import { findMemberByAuthUser, findMemberByTelegram, linkTelegram } from "./_members.js";

// A bare code, or Telegram's deep-link form "/start <code>" (what the bot
// receives when a TO taps the dashboard's t.me/<bot>?start=<code> link).
export const LINK_CODE_PATTERN = /^\s*(?:\/start\s+)?([0-9a-f]{10})\s*$/i;

// Links this Telegram account to the member who generated the code on the
// web dashboard's "Connect Telegram" card. Returns true once linked, so the
// caller can show the member menu.
export async function redeemLinkCode({ telegramUserId, code, reply }) {
  const { data: linkCode } = await supabaseAdmin
    .from("nexus_bot_link_codes")
    .select("id, auth_user_id, expires_at, consumed_at")
    .eq("code", code.toUpperCase())
    .maybeSingle();

  // Codes minted before 0007 have no auth_user_id; they expire within 15
  // minutes anyway, so just ask for a fresh one.
  if (!linkCode?.auth_user_id || linkCode.consumed_at || new Date(linkCode.expires_at) < new Date()) {
    await reply("That link isn't valid or has expired. Get a new one from your dashboard and try again.");
    return false;
  }

  const member = await findMemberByAuthUser(linkCode.auth_user_id);
  if (!member) {
    await reply("That login isn't part of a TO account anymore.");
    return false;
  }

  const existing = await findMemberByTelegram(telegramUserId);
  if (existing && existing.id !== member.id) {
    await reply("This Telegram account is already connected to a different NexusID TO account.");
    return false;
  }

  // Consume first, conditionally, so the same code can't be redeemed twice
  // by two messages arriving at once.
  const { data: consumed } = await supabaseAdmin
    .from("nexus_bot_link_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", linkCode.id)
    .is("consumed_at", null)
    .select("id");
  if (!consumed?.length) {
    await reply("That link has already been used. Get a new one from your dashboard and try again.");
    return false;
  }

  if (!(await linkTelegram(member.id, telegramUserId))) {
    await reply("This Telegram account is already connected to a different NexusID TO account.");
    return false;
  }

  await reply(`Connected! You're linked to ${member.nexus_tos.organisation_name} (${member.nexus_tos.to_id}).`);
  return true;
}
