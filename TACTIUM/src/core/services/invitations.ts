import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';

// `multi_use` y `uses` son de la migración 20260905b y aún no están en los
// tipos generados. Opcionales para no romper con clientes/tipos antiguos.
export type TeamInvitation =
  Database['public']['Tables']['team_invitations']['Row'] & {
    multi_use?: boolean | null;
    uses?: number | null;
  };
export type InvitableRole = Extract<
  Database['public']['Enums']['team_role'],
  'captain' | 'player'
>;

/**
 * Lista las invitaciones de un equipo. RLS solo deja ver al admin del team.
 */
export async function fetchTeamInvitations(
  teamId: string,
): Promise<TeamInvitation[]> {
  const { data, error } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Versión extendida con el perfil del usuario que canjeó cada código
 * (cuando `used_by` está poblado). Hace dos queries y mergea — no hay
 * FK declarada entre `team_invitations.used_by` y `profiles`, así que
 * PostgREST no puede hacer el join implícito.
 */
export interface TeamInvitationWithRedeemer extends TeamInvitation {
  redeemer: { id: string; full_name: string | null; email: string | null } | null;
}

export async function fetchTeamInvitationsWithRedeemers(
  teamId: string,
): Promise<TeamInvitationWithRedeemer[]> {
  const invitations = await fetchTeamInvitations(teamId);
  const userIds = Array.from(
    new Set(
      invitations
        .map((i) => i.used_by)
        .filter((u): u is string => u !== null),
    ),
  );
  if (userIds.length === 0) {
    return invitations.map((i) => ({ ...i, redeemer: null }));
  }
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds);
  if (error) throw error;
  const byId = new Map(
    (profiles ?? []).map((p) => [p.id, p] as const),
  );
  return invitations.map((i) => ({
    ...i,
    redeemer: i.used_by ? byId.get(i.used_by) ?? null : null,
  }));
}

/**
 * Crea una invitación. La BD genera el code y valida is_team_admin.
 */
export async function createInvitation(
  teamId: string,
  role: InvitableRole = 'captain',
): Promise<TeamInvitation> {
  const { data, error } = await supabase.rpc('create_team_invitation', {
    target_team: teamId,
    target_role: role,
  });
  if (error) throw error;
  if (!data) throw new Error('No se pudo crear la invitación');
  return data as unknown as TeamInvitation;
}

/**
 * Elimina una invitación. Solo admins del team (RLS).
 */
export async function revokeInvitation(invitationId: string): Promise<void> {
  const { error } = await supabase
    .from('team_invitations')
    .delete()
    .eq('id', invitationId);
  if (error) throw error;
}

/**
 * Canjea un code: añade al usuario al team_members y marca la invitación.
 */
export async function redeemInvitation(
  code: string,
): Promise<TeamInvitation> {
  const trimmed = code.trim().toUpperCase();
  const { data, error } = await supabase.rpc('redeem_team_invitation', {
    invitation_code: trimmed,
  });
  if (error) throw error;
  if (!data) throw new Error('No se pudo canjear el código');
  return data as unknown as TeamInvitation;
}

export function isInvitationActive(inv: TeamInvitation): boolean {
  if (new Date(inv.expires_at) <= new Date()) return false;
  // El código compartido del equipo no se consume: sigue activo por muchos
  // jugadores que lo hayan usado.
  return isSharedCode(inv) || inv.used_at === null;
}

/** ¿Es el código de jugador COMPARTIDO del equipo (reutilizable)? */
export function isSharedCode(inv: TeamInvitation): boolean {
  return inv.multi_use === true && inv.role === 'player';
}

/**
 * Genera un código de jugador NUEVO para el equipo e invalida el anterior.
 * Para cuando el de siempre se ha filtrado fuera del equipo.
 */
export async function rotatePlayerCode(teamId: string): Promise<TeamInvitation> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc('rotate_team_player_code', {
    target_team: teamId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error('No se pudo generar el código');
  return data as TeamInvitation;
}

// ── Enlace de invitación + mensaje para compartir ──────────────────────────
// El enlace `tactium.io/i/{CODE}` abre la app (enlace universal) o, sin app, la
// vista previa en la web. El mensaje es IDÉNTICO en la app y en la web.

/** Enlace público de invitación (con https). */
export function inviteUrl(code: string): string {
  return `https://tactium.io/i/${code.trim().toUpperCase()}`;
}

/** Enlace para pintar en pantalla (sin https). */
export function inviteUrlDisplay(code: string): string {
  return `tactium.io/i/${code.trim().toUpperCase()}`;
}

/** Mensaje para WhatsApp / compartir. */
export function buildInviteMessage(
  teamName: string | null | undefined,
  code: string,
  role: InvitableRole = 'player',
): string {
  const team = teamName?.trim() || 'Nuestro equipo';
  const cta =
    role === 'captain' ? 'Únete como capitán aquí:' : 'Únete a la plantilla aquí:';
  const c = code.trim().toUpperCase();
  return (
    `🎾 ${team} ya está en TACTIUM: jornadas, alineaciones y resultados en un sitio.\n\n` +
    `${cta}\n${inviteUrl(c)}\n\n` +
    `(o en la app con el código ${c})`
  );
}

// ── Vista previa de una invitación (RPC `preview_team_invitation`) ─────────
// Funciona sin sesión (anon): la usa también el deep link `tactium.io/i/{code}`.

export type InvitationInvalidReason = 'not_found' | 'used' | 'expired';

export interface InvitationRosterSlot {
  id: string;
  name: string;
  position: string | null;
  pts: number | null;
  claimed: boolean;
}

export interface InvitationPreviewTeam {
  id: string;
  name: string;
  logo_url: string | null;
  league: string | null;
  category: string | null;
  group_name: string | null;
  federation: string | null;
}

export type InvitationPreview =
  | { valid: false; reason: InvitationInvalidReason }
  | {
      valid: true;
      role: InvitableRole;
      team: InvitationPreviewTeam;
      club_name: string | null;
      captain_name: string | null;
      players_count: number;
      next_matchday: {
        jornada: number | null;
        date: string | null;
        opponent: string | null;
      } | null;
      roster?: InvitationRosterSlot[] | null;
    };

export async function previewInvitation(
  code: string,
): Promise<InvitationPreview> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc('preview_team_invitation', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object') {
    return { valid: false, reason: 'not_found' };
  }
  return data as InvitationPreview;
}

/** Texto claro para cada motivo de invitación no válida. */
export function invalidInvitationMessage(
  reason: InvitationInvalidReason,
): { title: string; body: string } {
  switch (reason) {
    case 'used':
      return {
        title: 'Este código ya se ha usado',
        body: 'Era de un solo uso. Pide a quien te invitó un código nuevo.',
      };
    case 'expired':
      return {
        title: 'Este código ha caducado',
        body: 'Pide a quien te invitó que te envíe uno nuevo.',
      };
    default:
      return {
        title: 'Código no válido',
        body: 'Revisa que esté bien escrito: son 8 letras y números.',
      };
  }
}
