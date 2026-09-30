import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "https://jzqmscrmeywckzodgjre.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set.");
}

// Service-role client — bypasses RLS entirely. Every authorization check for
// a bot-originated write (Telegram account linked? owns this tournament?
// still inside the 48h edit window?) must happen in the flow code that uses
// this client, not in the database. Never import this module from anything
// that ships to the browser.
export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// A fresh, throwaway client for sending/verifying email codes. verifyOtp()
// signs the client in as that user, after which its database calls would run
// as the user (under RLS) instead of as the service role — so never do it on
// the shared supabaseAdmin client.
export function createAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const SITE_URL = process.env.SITE_URL || "https://nexus-id-mot-i-soft.vercel.app";
