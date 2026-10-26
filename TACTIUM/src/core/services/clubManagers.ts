import { supabase } from '@core/supabase/client';

// Gestores del club por invitación (migración 20261014c). Las RPC y la tabla `club_invitations` aún no están en
// los tipos generados → casts puntuales.

type RpcResult = { data: unknown; error: { message: string } | null };
const rpc = (fn: string, args: Record<string, unknown>) =>
  (supabase.rpc.bind(supabase) as unknown as (f: string, a: Record<string, unknown>) => PromiseLike<RpcResult>)(
    fn,
    args,
  );

export interface ClubManager {
  user_id: string;
  full_name: string | null;
  email: string | null;
  is_owner: boolean;
  joined_at: string;
}

export interface ClubInvitation {
  id: string;
  club_id: string;
  code: string;
  expires_at: string;
}

export async function listClubManagers(clubId: string): Promise<ClubManager[]> {
  const { data, error } = await rpc('list_club_managers', { p_club_id: clubId });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClubManager[];
}

/** Crea un código de un solo uso (7 días) para invitar a un gestor. */
export async function createClubInvitation(clubId: string): Promise<ClubInvitation> {
  const { data, error } = await rpc('create_club_invitation', { p_club_id: clubId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No se pudo crear la invitación');
  return data as ClubInvitation;
}

export async function removeClubManager(clubId: string, userId: string): Promise<void> {
  const { error } = await rpc('remove_club_manager', { p_club_id: clubId, p_user_id: userId });
  if (error) throw new Error(error.message);
}

export type ClubInvitationPreview =
  | { valid: false; reason: 'not_found' | 'used' | 'expired' }
  | {
      valid: true;
      club: { id: string; name: string; logo_url: string | null };
      invited_by: string | null;
      teams_count: number;
    };

export async function previewClubInvitation(code: string): Promise<ClubInvitationPreview> {
  const { data, error } = await rpc('preview_club_invitation', { p_code: code.trim().toUpperCase() });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') return { valid: false, reason: 'not_found' };
  return data as ClubInvitationPreview;
}

export async function redeemClubInvitation(
  code: string,
): Promise<{ club_id: string; club_name: string; already_manager: boolean }> {
  const { data, error } = await rpc('redeem_club_invitation', { p_code: code.trim().toUpperCase() });
  if (error) throw new Error(error.message);
  return data as { club_id: string; club_name: string; already_manager: boolean };
}

/** Texto para mandar la invitación (enlace + código por si no abre el enlace). */
export function clubInviteMessage(clubName: string, code: string): string {
  return (
    `Te invito a gestionar «${clubName}» en TACTIUM: equipos, horarios de local, torneos… lo mismo que yo.\n` +
    `Abre este enlace: https://tactium.io/i/${code}\n` +
    `O, en la app, Perfil › «Tengo un código», escribe: ${code}\n` +
    `Caduca en 7 días y solo vale para una persona.`
  );
}
