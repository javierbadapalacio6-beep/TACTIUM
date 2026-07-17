import { supabase } from '@core/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Database } from '@core/supabase/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Fija el "nombre de usuario" (nombre corto) del user logueado. Persiste en
 * `profiles.username` (fuente de verdad, futura búsqueda social) y lo espeja
 * en `user_metadata.username` para que toda la app lo lea de forma síncrona
 * desde la sesión (igual que `full_name`). Pasar cadena vacía lo borra
 * (vuelve a mostrarse el nombre completo). Devuelve el user actualizado.
 */
export async function setMyUsername(username: string): Promise<User | null> {
  const value = username.trim() || null;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  const { error: pErr } = await supabase
    .from('profiles')
    .update({ username: value } as never)
    .eq('id', userId);
  if (pErr) {
    // 23505 = unique_violation → el nombre ya lo usa otra persona.
    if ((pErr as { code?: string }).code === '23505') {
      throw new Error('Ese nombre de usuario ya está en uso. Prueba otro.');
    }
    throw pErr;
  }

  // El updateUser dispara USER_UPDATED → el authStore refresca `user` solo.
  const { data, error: uErr } = await supabase.auth.updateUser({
    data: { username: value },
  });
  if (uErr) throw uErr;
  return data.user ?? null;
}

export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Fija la bio/descripción del perfil (≤160). Vacío = la borra. Solo vive en
 * `profiles.bio` (se muestra en el perfil público vía RPC).
 */
export async function setMyBio(bio: string): Promise<void> {
  const value = bio.trim() || null;
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sin sesión activa');
  const { error } = await supabase
    .from('profiles')
    .update({ bio: value } as never)
    .eq('id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Actualiza el flag `notifications_enabled` del profile del user logueado.
 * RLS permite que el propio user modifique su perfil.
 */
export async function setNotificationsEnabled(
  enabled: boolean,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sin sesión activa');
  const { error } = await supabase
    .from('profiles')
    .update({ notifications_enabled: enabled })
    .eq('id', userId);
  if (error) throw error;
}

/**
 * Persiste en la CUENTA la elección "jugador suelto" (F8). Tolerante a
 * que la migración 20260708_solo_mode.sql no esté aplicada (no lanza).
 */
export async function setSoloModeRemote(v: boolean): Promise<void> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return;
    await supabase
      .from('profiles')
      .update({ solo_mode: v } as never)
      .eq('id', userId);
  } catch {
    // best-effort
  }
}

/** Lee el flag de jugador suelto de la cuenta (false si no existe aún). */
export async function getSoloModeRemote(): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) return false;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) return false;
    return Boolean((data as { solo_mode?: boolean } | null)?.solo_mode);
  } catch {
    return false;
  }
}

/**
 * Elimina la cuenta del user logueado. Llama a la RPC SECURITY DEFINER
 * `delete_my_account` que:
 *  - Borra SIEMPRE (Apple 5.1.1(v): la eliminación debe poder completarse).
 *    Si hay sub activa de App Store/Google Play, esa sigue viva y se cancela
 *    aparte — el cliente avisa antes. Devuelve `had_active_subscription`.
 *  - Hace DELETE FROM auth.users → CASCADE limpia profiles, clubs, teams,
 *    seasons, matchdays, lineups, etc.
 *
 * Requisito Apple Guideline 5.1.1(v) y Google equivalente: si la app
 * permite registro, DEBE permitir eliminar la cuenta desde la propia app.
 *
 * Tras llamar, el caller debe hacer `signOut()` para limpiar el JWT
 * caducado del cliente.
 */
/**
 * Volcado completo de datos personales del user logueado (GDPR Art.20
 * portability). Llama a la RPC SECURITY DEFINER `export_my_data` y
 * devuelve el JSON tal cual. El caller decide qué hacer con él
 * (compartirlo via Share sheet, mostrar en pantalla, etc.).
 */
export async function exportMyData(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.rpc('export_my_data');
  if (error) throw error;
  return (data ?? {}) as Record<string, unknown>;
}

export async function deleteMyAccount(): Promise<void> {
  // El RPC borra la cuenta SIEMPRE (Apple 5.1.1(v) exige que la eliminación
  // pueda completarse). Si había una sub activa de App Store/Google Play,
  // esa sigue viva y se cancela aparte — el cliente ya lo avisa antes de
  // llamar aquí. Solo propagamos errores reales (red, auth).
  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}
