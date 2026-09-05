import { supabase } from "./supabase-config.js";

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signUpTo(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
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
