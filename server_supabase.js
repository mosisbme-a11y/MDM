import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');



let rawUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
if (rawUrl && !rawUrl.startsWith('http://') && !rawUrl.startsWith('https://')) {
  rawUrl = `https://${rawUrl.replace(/\.supabase\.co$/, '')}.supabase.co`;
}
const url = rawUrl;
// Server-only secret. Set SUPABASE_SERVICE_ROLE_KEY in your environment (Vercel project settings / .env). Never hard-code it.
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

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
