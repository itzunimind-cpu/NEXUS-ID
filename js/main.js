import { supabase } from "./supabase-config.js";

supabase.auth.getSession().then(({ error }) => {
  if (error) {
    console.error("Supabase connection failed:", error.message);
  } else {
    console.log("Supabase client connected.");
  }
});
