import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import * as TeamsApi from '@core/services/teams';
import * as PlayersApi from '@core/services/players';
import * as TeamMembersApi from '@core/services/teamMembers';

import { useAuthStore } from './authStore';
import { useClubStore } from './clubStore';

export type Player = PlayersApi.Player;
export type Team = TeamsApi.Team;
export type Side = PlayersApi.PlayerPosition;
export type TeamMember = TeamMembersApi.TeamMember;
export type TeamRole = TeamMembersApi.TeamRole;

/**
 * Rol efectivo del usuario para el equipo activo.
 * Por defecto se calcula con la prioridad club_admin > captain > player,
 * pero el usuario puede forzar otro modo si tiene varios roles disponibles.
 */
export type ActiveRole = 'club_admin' | 'captain' | 'player' | null;

interface TeamState {
  // Equipo activo (mantengo nombre `team` para no romper consumidores).
  team: Team | null;
  players: Player[];
  // Lista completa de equipos visibles para el usuario.
  teams: Team[];
  // Memberships del usuario en team_members (todas, una vez al cargar).
  memberships: TeamMember[];
  // Rol efectivo derivado para el equipo activo (respeta override).
  activeRole: ActiveRole;
  // Override forzado por el usuario desde Profile. null = automático.
  activeRoleOverride: ActiveRole;
  // ID del equipo activo seleccionado por el usuario.
  activeTeamId: string | null;
  // Vinculación del usuario logueado con una fila concreta de `players` en el
  // equipo activo. Solo es relevante cuando el rol efectivo es 'player'.
  // null = aún no ha reclamado un slot.
  // myPlayerLoaded = false significa "todavía no se ha resuelto" (loading).
  myPlayerId: string | null;
  myPlayerLoaded: boolean;

  isLoading: boolean;
  hasLoadedOnce: boolean;
  isOnboarding: boolean;
  error: string | null;

  loadForUser: () => Promise<void>;
  reset: () => void;
  finishOnboarding: () => void;
  setActiveTeam: (teamId: string) => Promise<void>;
  setActiveRoleOverride: (role: ActiveRole) => Promise<void>;
  refreshMyPlayer: () => Promise<void>;

  createTeam: (input: {
    name: string;
    federation?: string;
    league?: string;
    category?: string;
    group?: string;
    gender?: TeamsApi.TeamGender;
    clubId?: string;
    /**
     * Si true, conserva el valor actual de `isOnboarding` en lugar de
     * forzarlo a `true`. Lo usan los flujos post-onboarding (crear
     * equipo desde el ClubDashboard) para evitar un re-mount completo
     * de MainTabs que invalidaría las pilas de navegación abiertas.
     */
    keepOnboardingState?: boolean;
  }) => Promise<Team>;

  addPlayer: (data: {
    name: string;
    pts: number;
    position: Side;
    available?: boolean;
  }) => Promise<Player>;

  updatePlayer: (id: string, patch: Partial<Player>) => Promise<void>;
  removePlayer: (id: string) => Promise<void>;
  setPlayerAvail: (id: string, available: boolean) => Promise<void>;
  /**
   * Variante para players: usa la RPC `set_player_self_availability`. Solo
   * funciona si el player vinculado coincide con auth.uid(). El captain debe
   * seguir usando `setPlayerAvail`.
   */
  setSelfAvail: (id: string, available: boolean) => Promise<void>;
}

/**
 * Calcula el rol "natural" del usuario para un equipo concreto siguiendo
 * la jerarquía club_admin > captain > player.
 */
function deriveRawRole(
  team: Team | null,
  memberships: TeamMember[],
  clubIds: string[],
): ActiveRole {
  if (!team) return null;
  if (team.club_id && clubIds.includes(team.club_id)) return 'club_admin';
  const m = memberships.find((x) => x.team_id === team.id);
  if (!m) return null;
  if (m.role === 'captain' || m.role === 'admin') return 'captain';
  return 'player';
}

/**
 * Conjunto de roles que el usuario puede asumir teniendo en cuenta:
 *  - clubes donde es admin
 *  - team_members donde es captain/admin/player
 */
function deriveAvailableRoles(
  memberships: TeamMember[],
  clubIds: string[],
): ActiveRole[] {
  const set = new Set<ActiveRole>();
  if (clubIds.length > 0) set.add('club_admin');
  if (memberships.some((m) => m.role === 'captain' || m.role === 'admin')) {
    set.add('captain');
  }
  if (memberships.some((m) => m.role === 'player')) {
    set.add('player');
  }
  return Array.from(set);
}

/**
 * Devuelve true si el rol pedido es válido para el equipo activo concreto.
 */
function roleAppliesToTeam(
  role: Exclude<ActiveRole, null>,
  team: Team | null,
  memberships: TeamMember[],
  clubIds: string[],
): boolean {
  if (!team) return role === 'club_admin' && clubIds.length > 0;
  if (role === 'club_admin') {
    return !!team.club_id && clubIds.includes(team.club_id);
  }
  const m = memberships.find((x) => x.team_id === team.id);
  if (!m) return false;
  if (role === 'captain') return m.role === 'captain' || m.role === 'admin';
  if (role === 'player') return m.role === 'player';
  return false;
}

/**
 * Aplica el override al raw role: si el override es válido para el equipo
 * activo, gana. Si no, fallback al cálculo natural.
 */
function deriveActiveRole(
  team: Team | null,
  memberships: TeamMember[],
  clubIds: string[],
  override: ActiveRole,
): ActiveRole {
  const raw = deriveRawRole(team, memberships, clubIds);
  if (override && roleAppliesToTeam(override, team, memberships, clubIds)) {
    return override;
  }
  return raw;
}

/**
 * Encuentra el primer equipo donde el usuario tiene un membership con el rol
 * indicado. Útil al cambiar de modo: si activeTeam no aplica, saltamos a uno
 * que sí.
 */
/**
 * Resuelve el slot de plantilla del usuario logueado en el equipo activo.
 * Devuelve `null` si el rol efectivo no es 'player' (no aplica gating) o si
 * todavía no ha reclamado un slot. Si no hay user autenticado devuelve null
 * y deja `loaded=false` para que el llamador no asuma que está resuelto.
 */
async function resolveMyPlayerId(
  team: Team | null,
  role: ActiveRole,
): Promise<{ id: string | null; loaded: boolean }> {
  if (!team) return { id: null, loaded: true };
  if (role !== 'player') return { id: null, loaded: true };
  const userId = useAuthStore.getState().user?.id;
  if (!userId) return { id: null, loaded: false };
  try {
    const me = await PlayersApi.fetchMyPlayer(team.id, userId);
    return { id: me?.id ?? null, loaded: true };
  } catch (e) {
    console.warn('resolveMyPlayerId failed', e);
    return { id: null, loaded: true };
  }
}

function findFirstTeamForRole(
  role: Exclude<ActiveRole, null>,
  teams: Team[],
  memberships: TeamMember[],
  clubIds: string[],
): Team | null {
  if (role === 'club_admin') {
    return teams.find((t) => t.club_id && clubIds.includes(t.club_id)) ?? null;
  }
  for (const t of teams) {
    const m = memberships.find((x) => x.team_id === t.id);
    if (!m) continue;
    if (role === 'captain' && (m.role === 'captain' || m.role === 'admin')) return t;
    if (role === 'player' && m.role === 'player') return t;
  }
  return null;
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set, get) => ({
      team: null,
      players: [],
      teams: [],
      memberships: [],
      activeRole: null,
      activeRoleOverride: null,
      activeTeamId: null,
      myPlayerId: null,
      myPlayerLoaded: false,
      isLoading: false,
      hasLoadedOnce: false,
      isOnboarding: false,
      error: null,

      loadForUser: async () => {
        set({ isLoading: true, error: null });
        try {
          const [teams, memberships] = await Promise.all([
            TeamsApi.fetchMyTeams(),
            TeamMembersApi.fetchMyMemberships(),
          ]);

          if (teams.length === 0) {
            set({
              team: null,
              players: [],
              teams: [],
              memberships,
              activeRole: null,
              activeTeamId: null,
              myPlayerId: null,
              myPlayerLoaded: true,
              isLoading: false,
              hasLoadedOnce: true,
              isOnboarding: false,
            });
            return;
          }

          const persistedId = get().activeTeamId;
          const team =
            (persistedId && teams.find((t) => t.id === persistedId)) || teams[0];
          const players = await PlayersApi.fetchPlayers(team.id);

          const clubIds = useClubStore.getState().clubs.map((c) => c.id);
          const override = get().activeRoleOverride;
          const activeRole = deriveActiveRole(team, memberships, clubIds, override);

          const myPlayer = await resolveMyPlayerId(team, activeRole);

          set({
            team,
            activeTeamId: team.id,
            players,
            teams,
            memberships,
            activeRole,
            myPlayerId: myPlayer.id,
            myPlayerLoaded: myPlayer.loaded,
            isLoading: false,
            hasLoadedOnce: true,
          });
        } catch (e: any) {
          set({ error: e.message, isLoading: false, hasLoadedOnce: true });
        }
      },

      reset: () =>
        set({
          team: null,
          players: [],
          teams: [],
          memberships: [],
          activeRole: null,
          activeRoleOverride: null,
          activeTeamId: null,
          myPlayerId: null,
          myPlayerLoaded: false,
          isLoading: false,
          hasLoadedOnce: false,
          isOnboarding: false,
          error: null,
        }),

      finishOnboarding: () => set({ isOnboarding: false }),

      setActiveTeam: async (teamId) => {
        const teams = get().teams;
        const team = teams.find((t) => t.id === teamId);
        if (!team) throw new Error('Equipo no encontrado');
        const players = await PlayersApi.fetchPlayers(team.id);
        const clubIds = useClubStore.getState().clubs.map((c) => c.id);
        const memberships = get().memberships;

        // Si el override actual ya no aplica al nuevo team, se limpia.
        let override = get().activeRoleOverride;
        if (override && !roleAppliesToTeam(override, team, memberships, clubIds)) {
          override = null;
        }
        const activeRole = deriveActiveRole(team, memberships, clubIds, override);

        // Reset claim hasta resolver — evita ventana en la que el gate
        // antiguo decida sobre el nuevo equipo.
        set({
          team,
          activeTeamId: team.id,
          players,
          activeRole,
          activeRoleOverride: override,
          myPlayerId: null,
          myPlayerLoaded: false,
        });

        const myPlayer = await resolveMyPlayerId(team, activeRole);
        set({ myPlayerId: myPlayer.id, myPlayerLoaded: myPlayer.loaded });
      },

      setActiveRoleOverride: async (role) => {
        const { teams, memberships, team } = get();
        const clubIds = useClubStore.getState().clubs.map((c) => c.id);

        // Override = null → vuelve al cálculo automático
        if (role === null) {
          const activeRole = deriveActiveRole(team, memberships, clubIds, null);
          set({ activeRoleOverride: null, activeRole, myPlayerLoaded: false });
          const myPlayer = await resolveMyPlayerId(team, activeRole);
          set({ myPlayerId: myPlayer.id, myPlayerLoaded: myPlayer.loaded });
          return;
        }

        // Si el equipo activo ya cumple el rol pedido, basta con marcar override
        if (team && roleAppliesToTeam(role, team, memberships, clubIds)) {
          set({
            activeRoleOverride: role,
            activeRole: role,
            myPlayerLoaded: false,
          });
          const myPlayer = await resolveMyPlayerId(team, role);
          set({ myPlayerId: myPlayer.id, myPlayerLoaded: myPlayer.loaded });
          return;
        }

        // Si no, buscar un equipo válido para ese rol y cambiar
        const target = findFirstTeamForRole(role, teams, memberships, clubIds);
        if (!target) {
          // No hay teams compatibles → silently se mantiene el estado actual
          return;
        }
        const players = await PlayersApi.fetchPlayers(target.id);
        set({
          team: target,
          activeTeamId: target.id,
          players,
          activeRoleOverride: role,
          activeRole: role,
          myPlayerId: null,
          myPlayerLoaded: false,
        });
        const myPlayer = await resolveMyPlayerId(target, role);
        set({ myPlayerId: myPlayer.id, myPlayerLoaded: myPlayer.loaded });
      },

      refreshMyPlayer: async () => {
        const { team, activeRole } = get();
        const myPlayer = await resolveMyPlayerId(team, activeRole);
        set({ myPlayerId: myPlayer.id, myPlayerLoaded: myPlayer.loaded });
      },

      createTeam: async (input) => {
        const team = await TeamsApi.createTeam(input);
        const memberships = await TeamMembersApi.fetchMyMemberships();
        const clubIds = useClubStore.getState().clubs.map((c) => c.id);
        const override = get().activeRoleOverride;
        const activeRole = deriveActiveRole(team, memberships, clubIds, override);
        set((s) => ({
          team,
          activeTeamId: team.id,
          teams: [...s.teams, team],
          players: [],
          memberships,
          activeRole,
          isOnboarding: input.keepOnboardingState ? s.isOnboarding : true,
        }));
        return team;
      },

      addPlayer: async (data) => {
        const team = get().team;
        if (!team) throw new Error('No team selected');
        const player = await PlayersApi.createPlayer(team.id, data);
        set((s) => ({
          players: [...s.players, player].sort((a, b) => b.pts - a.pts),
        }));
        return player;
      },

      updatePlayer: async (id, patch) => {
        const updated = await PlayersApi.updatePlayer(id, patch);
        set((s) => ({
          players: s.players
            .map((p) => (p.id === id ? updated : p))
            .sort((a, b) => b.pts - a.pts),
        }));
      },

      removePlayer: async (id) => {
        await PlayersApi.deletePlayer(id);
        set((s) => ({ players: s.players.filter((p) => p.id !== id) }));
      },

      setPlayerAvail: async (id, available) => {
        set((s) => ({
          players: s.players.map((p) =>
            p.id === id ? { ...p, available } : p,
          ),
        }));
        try {
          await PlayersApi.setPlayerAvailability(id, available);
        } catch (e) {
          set((s) => ({
            players: s.players.map((p) =>
              p.id === id ? { ...p, available: !available } : p,
            ),
          }));
          throw e;
        }
      },

      setSelfAvail: async (id, available) => {
        set((s) => ({
          players: s.players.map((p) =>
            p.id === id ? { ...p, available } : p,
          ),
        }));
        try {
          await PlayersApi.setSelfAvailability(id, available);
        } catch (e) {
          set((s) => ({
            players: s.players.map((p) =>
              p.id === id ? { ...p, available: !available } : p,
            ),
          }));
          throw e;
        }
      },
    }),
    {
      name: 'tactium-team-active',
      storage: createJSONStorage(() => AsyncStorage),
      // Persistimos selección de equipo y override de rol en TODOS los
      // entornos. El resto del state (jugadores, etc.) viene de red.
      partialize: (s) => ({
        activeTeamId: s.activeTeamId,
        activeRoleOverride: s.activeRoleOverride,
      }),
    },
  ),
);

// Selectores derivados ergonómicos para las pantallas.
export const selectIsClubAdmin = (s: TeamState): boolean =>
  s.activeRole === 'club_admin';
// Captain = SOLO el modo activo captain. El club_admin previamente devolvía
// true aquí (jerarquía) pero el modelo cambió: el club_admin VE TODO de
// TODOS los equipos del club pero NO EDITA (es vista global, no gestión
// operativa). Para editar, el gestor debe cambiar a Modo Capitán desde
// Profile (los triggers DB lo hacen captain automático de cada team que
// creó). Decisión 2026-05-16 — ver memory tactium-role-model.
export const selectIsCaptain = (s: TeamState): boolean =>
  s.activeRole === 'captain';
export const selectIsPlayer = (s: TeamState): boolean =>
  s.activeRole === 'player';

/**
 * Helper PURA para derivar los roles disponibles del usuario combinando
 * memberships (teamStore) y clubs (clubStore).
 *
 * IMPORTANTE: NO usar como selector de zustand directamente — devuelve un
 * array nuevo en cada llamada y provoca un loop infinito de re-render.
 * En componentes hay que suscribirse a `memberships` y `clubs` por separado
 * y memoizar con `useMemo`.
 */
export const computeAvailableRoles = (
  memberships: TeamMember[],
  clubIds: string[],
): ActiveRole[] => deriveAvailableRoles(memberships, clubIds);
