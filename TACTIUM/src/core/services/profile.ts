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
