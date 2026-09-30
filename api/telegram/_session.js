import { supabaseAdmin } from "./_supabaseAdmin.js";

// Conversation state for multi-step flows, in nexus_bot_sessions
// (0006_bot_sessions.sql). Shape: { flow, step, ...flow-specific data }.
// An empty object means "no flow in progress — show the menu".

export async function getSession(telegramUserId) {
  const { data } = await supabaseAdmin
    .from("nexus_bot_sessions")
    .select("state")
    .eq("channel", "telegram")
    .eq("external_user_id", String(telegramUserId))
    .maybeSingle();
  return data?.state ?? {};
}

export async function setSession(telegramUserId, state) {
  const { error } = await supabaseAdmin
    .from("nexus_bot_sessions")
    .upsert(
      { channel: "telegram", external_user_id: String(telegramUserId), state },
      { onConflict: "channel,external_user_id" }
    );
  if (error) throw error;
}

export async function clearSession(telegramUserId) {
  await setSession(telegramUserId, {});
}
