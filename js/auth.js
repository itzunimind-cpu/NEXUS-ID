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

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Returns the caller's own nexus_tos row, or null if they haven't completed
// registration yet. Relies on the public SELECT policy — filtering by
// auth_user_id here is a query convenience, not the security boundary.
export async function fetchMyToProfile() {
  const session = await getSession();
  if (!session) return null;
  const { data, error } = await supabase
    .from("nexus_tos")
    .select("id, to_id, to_ign, to_uid, to_real_name, organisation_name, created_at")
    .eq("auth_user_id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
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
export async function createTournament({ name, game, format, start_date, end_date, max_players }) {
  const profile = await fetchMyToProfile();
  if (!profile) throw new Error("Complete TO registration first.");

  const { data, error } = await supabase
    .from("nexus_tournaments")
    .insert({
      name,
      game,
      format: format || null,
      start_date: start_date || null,
      end_date: end_date || null,
      max_players: max_players || null,
      created_by_to_id: profile.id,
    })
    .select("id, name, game")
    .single();
  if (error) throw error;
  return data;
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
