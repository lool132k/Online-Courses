import { createClient } from '@supabase/supabase-js';

// No cookies: public catalogue, rate counters and recovery must not replace a login session.
export function publicSupabase() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PUBLISHABLE_KEY) throw new Error('AUTH_NOT_CONFIGURED');
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
