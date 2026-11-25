import { createClient } from "@supabase/supabase-js";

// Public values only: the publishable key is meant for the browser.
// Data is protected by the row-level security rules set up in the SQL editor.
export const SUPABASE_URL = "https://mvaxvzlkxolwujovrphr.supabase.co";
export const SUPABASE_KEY = "sb_publishable_RR5kUIsA7KQileWWU0lxFw_3Euv5M4X";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
