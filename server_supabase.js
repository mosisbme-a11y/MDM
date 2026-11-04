import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '.env');
const envExamplePath = path.join(__dirname, 'env.example');



const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://oyfhffheomcrrcmerodx.supabase.co').trim();
const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95ZmhmZmhlb21jcnJjbWVyb2R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzY5Mjg2NywiZXhwIjoyMTA5MjY4ODY3fQ.WIkME2B7LmHYQ60K0yzpglaZZp18Vu9U_yxtr8FILwU').trim();

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

