import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthUser } from '../types';

const REMEMBER_KEY = 'epss_remember_login';
const SESSION_ACTIVE_KEY = 'epss_session_active';

/**
 * Old versions kept user accounts in localStorage.
 */
export function purgeLegacyCredentials(): void {
  // Logic removed to ensure zero local storage interaction
}

interface ProfileRow {
  uid: string;
  email: string;
  full_name: string | null;
  username: string | null;
  role: string | null;
  hub: string | null;
  is_admin: boolean | null;
  is_active: boolean | null;
}

async function loadProfile(userId: string, email: string): Promise<AuthUser | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('users')
    .select('uid,email,full_name,username,role,hub,is_admin,is_active')
    .eq('uid', userId)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as ProfileRow;
  if (row.is_active === false) return null;

  return {
    id: row.uid,
    uid: row.uid,
    username: row.username || email.split('@')[0],
    name: row.full_name || email,
    email: row.email || email,
    role: row.role || 'viewer',
    hub: row.hub || '',
    isAdmin: Boolean(row.is_admin)
  };
}

export interface SignInResult {
  user?: AuthUser;
  error?: string;
}

export async function signInWithPassword(
  email: string,
  password: string,
  remember: boolean
): Promise<SignInResult> {
  if (!supabase || !isSupabaseConfigured) {
    return { error: 'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env and rebuild.' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error || !data.user) {
    return { error: 'Invalid email or password.' };
  }

  const profile = await loadProfile(data.user.id, data.user.email || email);
  if (!profile) {
    await supabase.auth.signOut();
    return { error: 'This account has no active profile. Ask the Inventory Administrator to activate it.' };
  }

  try {
    sessionStorage.setItem(SESSION_ACTIVE_KEY, '1');
  } catch {
    // ignore
  }
  return { user: profile };
}

/**
 * Restores the signed-in user after a page reload.
 */
export async function restoreSession(): Promise<AuthUser | null> {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    let session = data.session;
    if (!session) return null;

    const activeThisSession = sessionStorage.getItem(SESSION_ACTIVE_KEY) === '1';
    if (!activeThisSession) {
      await supabase.auth.signOut();
      return null;
    }

    // Check if token is expired or close to expiring (within 30 seconds)
    const expiresAt = session.expires_at ? session.expires_at * 1000 : 0;
    if (expiresAt > 0 && expiresAt <= Date.now() + 30_000) {
      try {
        const { data: refreshed, error } = await supabase.auth.refreshSession();
        if (error || !refreshed.session) {
          console.warn('[AuthService] Stored session has expired and could not be refreshed:', error?.message);
          await signOut();
          return null;
        }
        session = refreshed.session;
      } catch (err) {
        console.warn('[AuthService] Refresh failed during session restoration:', err);
        await signOut();
        return null;
      }
    }

    const profile = await loadProfile(session.user.id, session.user.email || '');
    if (!profile) {
      await supabase.auth.signOut();
      return null;
    }
    return profile;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  try {
    sessionStorage.removeItem(SESSION_ACTIVE_KEY);
    if (supabase) await supabase.auth.signOut();
  } catch {
    // ignore
  }
}

/**
 * Calls back with null when the session ends (sign-out elsewhere, expired refresh token, account removed).
 */
export function onSignedOut(callback: () => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') callback();
  });
  return () => data.subscription.unsubscribe();
}
