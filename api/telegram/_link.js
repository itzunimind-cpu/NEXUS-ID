import { supabaseAdmin } from "./_supabaseAdmin.js";

// Matches a bare code, or Telegram's deep-link form "/start <code>" (what the
// bot receives when a TO taps the dashboard's t.me/<bot>?start=<code> link).
const CODE_PATTERN = /^\s*(?:\/start\s+)?([0-9a-f]{10})\s*$/i;

// Phase 0's entire conversation: link a Telegram account to an existing TO's
// nexus_tos row via a short-lived code generated on the web dashboard. Later
// phases replace the reply strings below with the real root menu.
//
// Takes a `reply` callback instead of importing sendText so the flow logic
// doesn't depend on Telegram's send API directly.
export async function handleIncomingMessage({ telegramUserId, text, reply }) {
  const { data: existingLink } = await supabaseAdmin
    .from("nexus_to_telegram_links")
    .select("nexus_tos (to_id, organisation_name)")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();

  const codeMatch = text.match(CODE_PATTERN);

  if (existingLink && !codeMatch) {
    const { to_id, organisation_name } = existingLink.nexus_tos;
    await reply(`You're connected as ${organisation_name} (${to_id}). More features are coming soon.`);
    return;
  }

  if (!codeMatch) {
    await reply(
      'Welcome to NexusID! To connect your TO account, open your dashboard and tap "Connect Telegram". The link it gives you works for 15 minutes.'
    );
    return;
  }

  const code = codeMatch[1].toUpperCase();
  const { data: linkCode } = await supabaseAdmin
    .from("nexus_bot_link_codes")
    .select("id, to_id, expires_at, consumed_at")
    .eq("code", code)
    .maybeSingle();

  if (!linkCode || linkCode.consumed_at || new Date(linkCode.expires_at) < new Date()) {
    await reply("That link isn't valid or has expired. Get a new one from your dashboard and try again.");
    return;
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
    return;
  }

  // Upsert on to_id: a TO re-linking from a new Telegram account replaces
  // their old link rather than failing.
  const { error: linkError } = await supabaseAdmin
    .from("nexus_to_telegram_links")
    .upsert(
      { to_id: linkCode.to_id, telegram_user_id: telegramUserId, linked_at: new Date().toISOString() },
      { onConflict: "to_id" }
    );

  if (linkError) {
    // Most likely cause: this Telegram account is already linked to a
    // different TO (unique constraint on telegram_user_id).
    await reply("This Telegram account is already connected to a different NexusID TO account.");
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from("nexus_tos")
    .select("to_id, organisation_name")
    .eq("id", linkCode.to_id)
    .single();

  await reply(`Connected! You're now linked as ${profile.organisation_name} (${profile.to_id}). More features are coming soon.`);
}
