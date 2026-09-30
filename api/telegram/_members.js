import { supabaseAdmin, SITE_URL } from "./_supabaseAdmin.js";

const MEMBER_FIELDS = "id, to_id, auth_user_id, role, display_name, telegram_user_id, nexus_tos (id, to_id, organisation_name)";

// The active TO membership this Telegram account is linked to, or null.
export async function findMemberByTelegram(telegramUserId) {
  const { data } = await supabaseAdmin
    .from("nexus_to_members")
    .select(MEMBER_FIELDS)
    .eq("telegram_user_id", telegramUserId)
    .is("removed_at", null)
    .maybeSingle();
  return data;
}

export async function findMemberByAuthUser(authUserId) {
  const { data } = await supabaseAdmin
    .from("nexus_to_members")
    .select(MEMBER_FIELDS)
    .eq("auth_user_id", authUserId)
    .is("removed_at", null)
    .maybeSingle();
  return data;
}

// Binds a Telegram account to a membership. Callers must already have
// checked that this Telegram account isn't linked to a different active
// member (the partial unique index would reject it anyway).
export async function linkTelegram(memberId, telegramUserId) {
  const { error } = await supabaseAdmin
    .from("nexus_to_members")
    .update({ telegram_user_id: telegramUserId, telegram_linked_at: new Date().toISOString() })
    .eq("id", memberId);
  return !error;
}

// One-time link that opens set-password.html already signed in, so the
// member can choose their own website password. Generated here and sent in
// the Telegram chat — Supabase doesn't email it.
export async function createSetPasswordLink(authUserId) {
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(authUserId);
  if (userError || !userData?.user?.email) return null;
  const { data, error } = await supabaseAdmin.auth.admin.generateLink({
    type: "recovery",
    email: userData.user.email,
    options: { redirectTo: `${SITE_URL}/set-password.html` },
  });
  if (error) return null;
  return data.properties.action_link;
}

export async function fetchValidInvite(code) {
  const { data } = await supabaseAdmin
    .from("nexus_to_invites")
    .select("id, to_id, role, expires_at, consumed_at, nexus_tos (to_id, organisation_name)")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (!data || data.consumed_at || new Date(data.expires_at) < new Date()) return null;
  return data;
}
