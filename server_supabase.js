import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using the SERVICE ROLE key.
// This key bypasses Row Level Security: it must only ever live in the server's
// environment (.env on the server / hosting dashboard), never in the browser
// bundle and never in a committed file.
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

const isValidUrl = (u) => {
  if (!u) return false;
  try {
    const parsed = new URL(u);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.host !== '';
  } catch (e) {
    return false;
  }
};

export const isSupabaseAdminConfigured = Boolean(
  url && 
  serviceKey && 
  isValidUrl(url) &&
  !url.includes('your-project-id') && 
  !serviceKey.includes('your-service')
);

let adminClient = null;
if (isSupabaseAdminConfigured) {
  try {
    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
  } catch (err) {
    console.error('[Supabase] CRITICAL: Failed to initialize Admin Client:', err.message);
  }
}

export const supabaseAdmin = adminClient;

if (!isSupabaseAdminConfigured) {
  console.warn(
    '[Supabase] SERVICE ROLE configuration is missing or invalid. ' +
    'Backend data sync and admin auth features will be disabled. ' +
    'Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set correctly in your environment.'
  );
}

