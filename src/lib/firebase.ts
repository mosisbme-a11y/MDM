/**
 * Firebase has been fully replaced by Supabase Cloud Storage.
 * This file is maintained as a stub so legacy imports resolve cleanly.
 */
import { supabase } from './supabase';

export const db = null; // Firebase Firestore is disabled on this system
export const auth = null;
export const storage = null;

export const isFirebaseActive = false;
export default supabase;
