import { createClient } from "@supabase/supabase-js";
import { config } from "./env";

// Public client (for verifying user tokens)
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey
);

// Admin client (service role — server-side only, never expose)
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

export const bucket = config.supabase.buckets;
