import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  initializeAuth, 
  browserSessionPersistence, 
  browserPopupRedirectResolver, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User,
  Auth
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Singleton Auth initialization with explicit persistence and resolver to prevent assertion failures in iframes
const auth: Auth = (() => {
  const apps = getApps();
  const currentApp = apps.length === 0 ? initializeApp(firebaseConfig) : apps[0];
  
  // Try to get existing auth instance if any
  try {
    const existingAuth = getAuth(currentApp);
    if (existingAuth) return existingAuth;
  } catch (e) {
    // If it fails or doesn't exist, we'll initialize it below
  }

  return initializeAuth(currentApp, {
    persistence: browserSessionPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
})();

const provider = new GoogleAuthProvider();
provider.addScope('https://www.googleapis.com/auth/gmail.send');
provider.addScope('https://www.googleapis.com/auth/gmail.compose');
provider.addScope('https://www.googleapis.com/auth/gmail.modify');
// Force consent prompt so users are presented with the permission checkboxes
provider.setCustomParameters({
  prompt: 'consent'
});

// Flag to indicate if we are in the middle of a sign-in flow.
let isSigningIn = false;
const TOKEN_STORAGE_KEY = 'epss_google_oauth_access_token';

// Cache the access token in memory and localStorage
let cachedAccessToken: string | null = (() => {
  try {
    return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
  } catch {
    return null;
  }
})();

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      try {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      } catch {}
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  if (isSigningIn) {
    console.warn('Sign-in already in progress, ignoring extra request.');
    return null;
  }
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Failed to get access token from Firebase Auth');
    }

    cachedAccessToken = credential.accessToken;
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, credential.accessToken);
    } catch {}
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    // Specifically handle expected user cancellations or closures without printing a noisy console.error
    if (error && (error.code === 'auth/popup-closed-by-user' || error.message?.includes('popup-closed-by-user'))) {
        console.warn('User closed the sign-in popup.');
        return null;
    }
    if (error && (error.code === 'auth/cancelled-popup-request' || error.message?.includes('cancelled-popup-request'))) {
        console.warn('Sign-in popup was cancelled by a newer request.');
        return null;
    }
    if (error && (error.code === 'auth/popup-blocked' || error.message?.includes('popup-blocked'))) {
        console.warn('Sign-in popup was blocked by the browser.');
        return null;
    }
    
    console.error('Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const clearCachedAccessToken = () => {
  cachedAccessToken = null;
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {}
};

export const logout = async () => {
  await auth.signOut();
  clearCachedAccessToken();
};
