import { supabaseAdmin } from "../_supabaseAdmin.js";
import { sendText } from "../_send.js";

const CODE_PATTERN = /^\s*(\d{6})\s*$/;

// Phase 0's entire conversation: link a WhatsApp number to an existing TO's
// nexus_tos row via a short-lived code generated on the web dashboard. Later
// phases replace the two reply strings below with the real root menu.
export async function handleIncomingMessage({ from, text }) {
  const { data: linkedTo } = await supabaseAdmin
    .from("nexus_tos")
    .select("to_id, organisation_name")
    .eq("whatsapp_phone_e164", from)
    .maybeSingle();

  if (linkedTo) {
    await sendText(
      from,
      `You're connected as ${linkedTo.organisation_name} (${linkedTo.to_id}). More features are coming soon.`
    );
    return;
  }

  const codeMatch = text.match(CODE_PATTERN);
  if (!codeMatch) {
    await sendText(
      from,
      'Welcome to NexusID! To connect your TO account, open your dashboard, tap "Connect WhatsApp" to get a 6-digit code, then send that code here within 15 minutes.'
    );
    return;
  }

  const code = codeMatch[1];
  const { data: linkCode } = await supabaseAdmin
    .from("nexus_wa_link_codes")
    .select("id, to_id, expires_at, consumed_at")
    .eq("code", code)
    .maybeSingle();

  if (!linkCode || linkCode.consumed_at || new Date(linkCode.expires_at) < new Date()) {
    await sendText(from, "That code isn't valid or has expired. Generate a new one from your dashboard and try again.");
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("nexus_tos")
    .update({ whatsapp_phone_e164: from })
    .eq("id", linkCode.to_id);

  if (updateError) {
    // Most likely cause: this phone number is already linked to a different
    // TO (unique constraint on whatsapp_phone_e164).
    await sendText(from, "This phone number is already connected to a different NexusID TO account.");
    return;
  }

  await supabaseAdmin
    .from("nexus_wa_link_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", linkCode.id);

  const { data: profile } = await supabaseAdmin
    .from("nexus_tos")
    .select("to_id, organisation_name")
    .eq("id", linkCode.to_id)
    .single();

  await sendText(
    from,
    `Connected! You're now linked as ${profile.organisation_name} (${profile.to_id}). More features are coming soon.`
  );
}
