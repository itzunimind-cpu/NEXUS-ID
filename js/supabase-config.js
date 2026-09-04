import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Public values from your Supabase project (Project Settings > API).
// The anon key is safe to expose in client-side code — it relies on RLS, not secrecy.
const SUPABASE_URL = "https://YOUR-PROJECT-REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
