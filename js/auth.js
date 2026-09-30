import { supabase } from "./supabase-config.js";

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signUpTo(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Without this, the confirmation link falls back to Supabase's configured
    // Site URL (the landing page), which no longer loads the Supabase client
    // at all — the session token in that redirect would just be dropped.
    // Goes straight to onboarding (not login) since confirming establishes a
    // session directly — to-onboarding.html's own requireSession()/profile
    // check still redirects to login if that session detection ever fails.
    options: { emailRedirectTo: `${window.location.origin}/to-onboarding.html` },
  });
  if (error) throw error;
  return data; // data.session is null if email confirmation is required
}

export async function signInTo(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signInWithOtp(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false },
  });
  if (error) throw error;
}

export async function verifyOtp(email, token) {
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
  return data;
}

// Sets a new password for the logged-in user — used by set-password.html
// after arriving through the one-time link the Telegram bot sends.
export async function setPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Returns the TO the caller is an active member of (as owner or admin), or
// null if they haven't created or joined one yet. Same shape as before
// members existed (id = nexus_tos.id, etc.), plus member_id/role/display_name,
// so existing callers keep working. See 0007_to_members.sql.
export async function fetchMyToProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("nexus_to_members")
    .select("id, role, display_name, telegram_user_id, telegram_linked_at, nexus_tos (id, to_id, to_ign, to_uid, to_real_name, organisation_name, created_at)")
    .eq("auth_user_id", session.user.id)
    .is("removed_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...data.nexus_tos,
    member_id: data.id,
    role: data.role,
    display_name: data.display_name,
    telegram_linked_at: data.telegram_user_id ? data.telegram_linked_at : null,
  };
}

// Creates the nexus_tos row for the currently authenticated user — this is
// the actual "TO registration" step that generates their TO- id.
// auth_user_id must be set explicitly to satisfy the RLS insert policy
// ((select auth.uid()) = auth_user_id); email is intentionally not part of
// this payload, it's read from the session server-side, never re-entered.
export async function createToProfile({ to_ign, to_uid, to_real_name, organisation_name }) {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated.");
  const { data, error } = await supabase
    .from("nexus_tos")
    .insert({
      auth_user_id: session.user.id,
      to_ign,
      to_uid,
      to_real_name: to_real_name || null,
      organisation_name,
    })
    .select("id, to_id, to_ign, organisation_name")
    .single();
  if (error) throw error;
  return data;
}

// Creates a new Nexus ID (nexus_players row) plus its first linked game
// account (nexus_player_game_accounts row). Two inserts, not a transaction —
// consistent with the rest of this client-side model, which leans on RLS
// per-table rather than DB transactions.
export async function createPlayer({ real_name, game, in_game_uid, in_game_name }) {
  const profile = await fetchMyToProfile();
  if (!profile) throw new Error("Complete TO registration first.");

  const { data: player, error: playerError } = await supabase
    .from("nexus_players")
    .insert({ real_name: real_name || null, created_by_to_id: profile.id })
    .select("id, nx_id, real_name")
    .single();
  if (playerError) throw playerError;

  const { error: accountError } = await supabase
    .from("nexus_player_game_accounts")
    .insert({ player_id: player.id, game, in_game_uid, in_game_name, created_by_to_id: profile.id });
  if (accountError) throw accountError;

  return player;
}

// Creates a new persistent team (nexus_teams row). Rosters are built
// separately via nexus_team_members — not part of this call.
export async function createTeam({ team_name }) {
  const profile = await fetchMyToProfile();
  if (!profile) throw new Error("Complete TO registration first.");

  const { data, error } = await supabase
    .from("nexus_teams")
    .insert({ team_name, created_by_to_id: profile.id })
    .select("id, tm_id, team_name")
    .single();
  if (error) throw error;
  return data;
}

// Creates a new tournament (nexus_tournaments row). Matches/results/roster
// are separate follow-up work — this only creates the tournament shell.
export async function createTournament({ name, game, format, stage, prize_pool, start_date, end_date, max_players }) {
  const profile = await fetchMyToProfile();
  if (!profile) throw new Error("Complete TO registration first.");

  const { data, error } = await supabase
    .from("nexus_tournaments")
    .insert({
      name,
      game,
      format: format || null,
      stage: stage || null,
      prize_pool: prize_pool || null,
      start_date: start_date || null,
      end_date: end_date || null,
      max_players: max_players || null,
      created_by_to_id: profile.id,
    })
    .select("id, name, game")
    .single();
  if (error) throw error;

  // Best-effort activity-log entry — the tournament is already created at this
  // point, so a logging failure shouldn't surface as a tournament-creation error.
  await supabase.from("nexus_activity_log").insert({
    to_id: profile.id,
    tournament_id: data.id,
    event_type: "tournament_created",
    detail: data.name,
  });

  return data;
}

// Adds an existing player to an existing team's roster. Any authenticated TO
// may do this (2026-09-05 decision: cross-TO shared rosters) — only removal
// is restricted to the team's own creator.
export async function addTeamMember({ team_id, player_id }) {
  const profile = await fetchMyToProfile();
  if (!profile) throw new Error("Complete TO registration first.");

  const { data, error } = await supabase
    .from("nexus_team_members")
    .insert({ team_id, player_id, added_by_to_id: profile.id })
    .select("id, joined_at")
    .single();
  if (error) throw error;
  return data;
}

// Soft-removes a player from a team's active roster by setting left_at —
// preserves join/leave history instead of deleting the row. RLS only allows
// this for the team's own creator (0004_team_roster_removal.sql).
export async function removeTeamMember({ membership_id }) {
  const { error } = await supabase
    .from("nexus_team_members")
    .update({ left_at: new Date().toISOString() })
    .eq("id", membership_id);
  if (error) throw error;
}

// Creates a new match (nexus_matches row) under a tournament.
export async function createMatch({ tournament_id, match_number, map, played_at }) {
  const profile = await fetchMyToProfile();
  if (!profile) throw new Error("Complete TO registration first.");

  const { data, error } = await supabase
    .from("nexus_matches")
    .insert({ tournament_id, match_number, map: map || null, played_at: played_at || null, created_by_to_id: profile.id })
    .select("id, match_number, map, played_at")
    .single();
  if (error) throw error;
  return data;
}

// Moves a tournament through its draft/active/concluded lifecycle.
export async function updateTournamentStatus({ tournament_id, status }) {
  const { error } = await supabase
    .from("nexus_tournaments")
    .update({ status })
    .eq("id", tournament_id);
  if (error) throw error;
}

// Logs one participation row per squad member for a single match — one
// placement shared by the whole squad, individual kills per player. A single
// multi-row INSERT is one Postgres statement, so it's already atomic (all
// rows succeed or none do) without needing a manual transaction wrapper.
// team_id may be null for a solo (non-squad) entry — pass a single-entry array.
export async function logParticipations({ match_id, team_id, placement, entries }) {
  const profile = await fetchMyToProfile();
  if (!profile) throw new Error("Complete TO registration first.");

  const rows = entries.map(({ player_id, kills }) => ({
    match_id,
    team_id: team_id || null,
    player_id,
    placement: placement === "" || placement === null ? null : Number(placement),
    kills: Number(kills) || 0,
    logged_by_to_id: profile.id,
  }));

  const { data, error } = await supabase.from("nexus_participations").insert(rows).select("id");
  if (error) throw error;
  return data;
}

// Edits already-logged participation rows (placement/kills only — matches
// nexus_participations' column-level update grant) within the 48h window.
// One UPDATE per row; RLS blocks any row whose 48h window has closed.
export async function updateParticipations({ updates }) {
  for (const { id, placement, kills } of updates) {
    const { error } = await supabase
      .from("nexus_participations")
      .update({
        placement: placement === "" || placement === null ? null : Number(placement),
        kills: Number(kills) || 0,
      })
      .eq("id", id);
    if (error) throw error;
  }
}

// The bot's @username, without the "@". Placeholder until the bot is created
// via @BotFather — update this to the real username before going live.
export const TELEGRAM_BOT_USERNAME = "NexusIDBot";

// Generates a short-lived (15 min) Telegram linking code for the current
// member and returns it with a one-tap t.me deep link. Opening that link
// sends "/start <code>" to the bot, which links this member's Telegram
// account — the code is only ever consumed server-side by the Telegram
// webhook (service role), never by a client UPDATE (see
// 0005_telegram_to_linking.sql / 0007_to_members.sql).
export async function generateTelegramLinkCode() {
  const profile = await fetchMyToProfile();
  if (!profile) throw new Error("Complete TO registration first.");

  const { data, error } = await supabase
    .from("nexus_bot_link_codes")
    .insert({ to_id: profile.id })
    .select("code, expires_at")
    .single();
  if (error) throw error;
  return { ...data, deepLink: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${data.code}` };
}

// Returns { linked_at } if the current member has linked Telegram, else null.
export async function fetchMyTelegramLink() {
  const profile = await fetchMyToProfile();
  return profile?.telegram_linked_at ? { linked_at: profile.telegram_linked_at } : null;
}

// Active members of the caller's TO, owner first.
export async function fetchMyToMembers() {
  const profile = await fetchMyToProfile();
  if (!profile) return [];
  const { data, error } = await supabase
    .from("nexus_to_members")
    .select("id, role, display_name, telegram_user_id, joined_at")
    .eq("to_id", profile.id)
    .is("removed_at", null)
    .order("joined_at");
  if (error) throw error;
  return data;
}

// Owner only (enforced by RLS). Soft-remove via removed_at — the removed
// person loses access immediately, and their login can later join another TO.
export async function removeToMember(memberId) {
  const { error } = await supabase
    .from("nexus_to_members")
    .update({ removed_at: new Date().toISOString() })
    .eq("id", memberId);
  if (error) throw error;
}

// Owner only (enforced by RLS). Returns both invite links for one code.
export async function createToInvite() {
  const profile = await fetchMyToProfile();
  if (!profile) throw new Error("Complete TO registration first.");
  const { data, error } = await supabase
    .from("nexus_to_invites")
    .insert({ to_id: profile.id })
    .select("code, expires_at")
    .single();
  if (error) throw error;
  return {
    ...data,
    telegramLink: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=inv_${data.code}`,
    webLink: `${window.location.origin}/join.html?code=${data.code}`,
  };
}

// Joins the TO behind an invite code as the logged-in user. Returns its TO- id.
export async function acceptToInvite(code, name) {
  const { data, error } = await supabase.rpc("accept_to_invite", { invite_code: code, member_name: name });
  if (error) throw error;
  return data;
}

// An invite code picked up by join.html before the visitor had a login.
// Kept across the login/signup/email-confirmation round trip so they land
// back on join.html instead of TO onboarding.
const PENDING_INVITE_KEY = "nexusid_pending_invite";

export function setPendingInvite(code) {
  try { localStorage.setItem(PENDING_INVITE_KEY, code); } catch {}
}

export function getPendingInvite() {
  try { return localStorage.getItem(PENDING_INVITE_KEY); } catch { return null; }
}

export function clearPendingInvite() {
  try { localStorage.removeItem(PENDING_INVITE_KEY); } catch {}
}

// Where a freshly logged-in user should go next.
export async function postLoginDestination() {
  const profile = await fetchMyToProfile();
  if (profile) return "/to-dashboard.html";
  const invite = getPendingInvite();
  return invite ? `/join.html?code=${encodeURIComponent(invite)}` : "/to-onboarding.html";
}

// Redirect guard for pages that require a logged-in TO. Returns the session
// if present; otherwise sends the browser to the login page and returns null.
export async function requireSession() {
  const session = await getSession();
  if (!session) {
    window.location.href = "/to-login.html";
    return null;
  }
  return session;
}
