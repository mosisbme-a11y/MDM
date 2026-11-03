import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using the SERVICE ROLE key.
// This key bypasses Row Level Security: it must only ever live in the server's
// environment (.env on the server / hosting dashboard), never in the browser
// bundle and never in a committed file.
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseAdminConfigured = Boolean(
  url && serviceKey && !url.includes('your-project-id') && !serviceKey.includes('your-service')
);

export const supabaseAdmin = isSupabaseAdminConfigured
  ? createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

if (!isSupabaseAdminConfigured) {
  console.error(
    '[Supabase] SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are not set. ' +
    'Login and data sync will not work until they are configured in .env.'
  );
}
