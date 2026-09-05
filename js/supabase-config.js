import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Public values from your Supabase project (Project Settings > API).
// The publishable key is safe to expose in client-side code — it relies on RLS, not secrecy.
const SUPABASE_URL = "https://jzqmscrmeywckzodgjre.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_B_nJA8ILtzPlHVm0yPZS2A_VZ8ze9dO";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
