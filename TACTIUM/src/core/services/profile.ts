import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

export type Profile = Database['public']['Tables']['profiles']['Row'];

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
