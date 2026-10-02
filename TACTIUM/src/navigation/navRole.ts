import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';

/**
 * Rol de NAVEGACIÓN: la barra es la misma para todos (Inicio · Competir · ＋ ·
 * Equipo · Perfil); lo que cambia por rol es el CONTENIDO de cada pestaña.
 *
 *   organizer → club en modo «solo torneos» (club_admin sin gestión de equipos)
 *   club      → club_admin con gestión de equipos
 *   captain   → capitán con equipo
 *   player    → jugador de un equipo
 *   solo      → jugador suelto, sin equipo
 */
export type NavRole = 'organizer' | 'club' | 'captain' | 'player' | 'solo';

export function navRoleOf(input: {
  activeRole: string | null;
  hasTeam: boolean;
  tournamentsOnly: boolean;
}): NavRole {
  if (input.activeRole === 'club_admin') {
    return input.tournamentsOnly ? 'organizer' : 'club';
  }
  if (!input.hasTeam) return 'solo';
  return input.activeRole === 'captain' ? 'captain' : 'player';
}

export function useNavRole(): NavRole {
  const activeRole = useTeamStore((s) => s.activeRole);
  const hasTeam = useTeamStore((s) => !!s.team);
  const tournamentsOnly = useClubStore(
    (s) => selectActiveClub(s)?.tournaments_only ?? false,
  );
  return navRoleOf({ activeRole, hasTeam, tournamentsOnly });
}

/** Lo mismo, fuera de React (p. ej. al tocar una notificación). */
export function currentNavRole(): NavRole {
  const t = useTeamStore.getState();
  const club = selectActiveClub(useClubStore.getState());
  return navRoleOf({
    activeRole: t.activeRole,
    hasTeam: !!t.team,
    tournamentsOnly: club?.tournaments_only ?? false,
  });
}
