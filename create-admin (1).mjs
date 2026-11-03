// Creates (or promotes) the first administrator account in Supabase Auth.
//
//   node scripts/create-admin.mjs you@example.com "StrongPassw0rd!" "Your Name"
//
// Requires SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env
import { supabaseAdmin, isSupabaseAdminConfigured } from '../server_supabase.js';

const [email, password, name = 'Inventory Administrator'] = process.argv.slice(2);

if (!isSupabaseAdminConfigured) {
  console.error('Supabase is not configured. Fill in .env first (see .env.example).');
  process.exit(1);
}
if (!email || !password) {
  console.error('Usage: node scripts/create-admin.mjs <email> <password> ["Full Name"]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Password must be at least 8 characters.');
  process.exit(1);
}

const cleanEmail = email.trim().toLowerCase();

let userId;
const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
  email: cleanEmail,
  password,
  email_confirm: true,
  user_metadata: { full_name: name }
});

if (createError) {
  // Already exists? Look it up and reset the password instead.
  const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = list?.users?.find((u) => (u.email || '').toLowerCase() === cleanEmail);
  if (listError || !existing) {
    console.error('Could not create user:', createError.message);
    process.exit(1);
  }
  userId = existing.id;
  const { error: pwError } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (pwError) {
    console.error('Could not update password:', pwError.message);
    process.exit(1);
  }
  console.log('User already existed - password updated.');
} else {
  userId = created.user.id;
}

const { error: profileError } = await supabaseAdmin.from('users').upsert(
  {
    uid: userId,
    email: cleanEmail,
    full_name: name,
    username: cleanEmail.split('@')[0],
    role: 'Inventory Administrator',
    hub: 'Head Office',
    is_admin: true,
    is_active: true
  },
  { onConflict: 'uid' }
);
if (profileError) {
  console.error('Profile upsert failed (did you run supabase_auth_and_sync.sql?):', profileError.message);
  process.exit(1);
}
console.log(`Administrator ready: ${cleanEmail}`);
