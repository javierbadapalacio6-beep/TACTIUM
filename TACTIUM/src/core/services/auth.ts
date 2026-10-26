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

/**
 * Cambia la contraseña con la sesión abierta. Primero comprueba la actual (entrando de nuevo con ella) para que
 * quien coja el móvil con la sesión abierta no pueda cambiarla sin saberla. Solo cuentas con email y contraseña.
 */
export async function changePassword(
  email: string,
  current: string,
  next: string,
): Promise<{ error?: string }> {
  const { error: bad } = await supabase.auth.signInWithPassword({ email, password: current });
  if (bad) return { error: 'La contraseña actual no es correcta.' };
  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };
  return {};
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
