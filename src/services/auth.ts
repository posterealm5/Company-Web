import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Profile } from '../types/database';
import type { Session, User } from '@supabase/supabase-js';

/**
 * Auth Service
 * Handles user authentication operations via Supabase Auth.
 */

/** Sign up with email and password */
export async function signUp(
  email: string,
  password: string,
  fullName?: string
): Promise<{ user: User | null; session: Session | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { user: null, session: null, error: 'Supabase is not configured' };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) {
    return { user: null, session: null, error: error.message };
  }

  return { user: data.user, session: data.session, error: null };
}

/** Sign in with email and password */
export async function signIn(
  email: string,
  password: string
): Promise<{ user: User | null; error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { user: null, error: 'Supabase is not configured' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { user: null, error: error.message };
  }

  return { user: data.user, error: null };
}

/** Sign out the current user */
export async function signOut(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase is not configured' };
  }

  const { error } = await supabase.auth.signOut();
  return { error: error?.message || null };
}

/** Get the current session */
export async function getSession(): Promise<Session | null> {
  if (!isSupabaseConfigured()) return null;

  const { data } = await supabase.auth.getSession();
  return data.session;
}

/** Get the current user */
export async function getCurrentUser(): Promise<User | null> {
  if (!isSupabaseConfigured()) return null;

  const { data } = await supabase.auth.getUser();
  return data.user;
}

/** Get user profile from the profiles table */
export async function getUserProfile(userId: string): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user profile:", error.message);
      return null;
    }

    return data;
  } catch (err) {
    console.error("Exception during profile fetch:", err);
    return null;
  }
}

/** Update user profile */
export async function updateProfile(
  userId: string,
  email: string,
  updates: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url'>>
): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ 
      id: userId,
      email: email,
      ...updates, 
      updated_at: new Date().toISOString() 
    }, {
      onConflict: 'id'
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating profile:', error.message);
    throw new Error(error.message);
  }

  return data;
}

/**
 * Listen for auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
) {
  const { data } = supabase.auth.onAuthStateChange(callback);
  return data.subscription.unsubscribe;
}

/** Sign in with Google */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase is not configured' };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
    },
  });

  return { error: error?.message || null };
}

/** Send password reset email */
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase is not configured' };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  return { error: error?.message || null };
}

/** Update user password */
export async function updatePassword(password: string): Promise<{ error: string | null }> {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase is not configured' };
  }

  const { error } = await supabase.auth.updateUser({
    password: password,
  });

  return { error: error?.message || null };
}
