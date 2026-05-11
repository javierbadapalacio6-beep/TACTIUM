import { supabase } from '@core/supabase/client';
import type { Session, User, AuthError } from '@supabase/supabase-js';

export type { Session, User, AuthError };

export async function signUpWithPassword(
  email: string,
  password: string,
  fullName?: string,
) {
  return supabase.auth.signUp({
    email,
    password,
    options: {
      data: fullName ? { full_name: fullName } : undefined,
    },
  });
}

export async function signInWithPassword(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  return supabase.auth.signOut();
}

export async function getSession() {
  return supabase.auth.getSession();
}

export async function getUser() {
  return supabase.auth.getUser();
}
