import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@core/supabase/client';
import * as TeamsApi from '@core/services/teams';
import * as PlayersApi from '@core/services/players';
import * as TeamMembersApi from '@core/services/teamMembers';
import { hasCasualHistory } from '@core/services/casualMatches';
import { setSoloModeRemote, getSoloModeRemote } from '@core/services/profile';

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
  // Equipos donde el usuario tiene una ficha de jugador vinculada. Permite
  // ofrecer modo Jugador a un capitán que también juega en su equipo.
  myPlayerTeamIds: string[];

  isLoading: boolean;
  hasLoadedOnce: boolean;
  isOnboarding: boolean;
  // Modo jugador suelto (F8): el usuario entra SIN equipo (amistosos +
  // stats + canje de codigos). Se desactiva solo al unirse a un equipo.
  soloMode: boolean;
  // Flujo "de jugador a gestor": muestra la elección SOLO con las cards
  // de crear equipo/club y un volver. Transitorio (no se persiste).
  soloUpgrade: boolean;
  error: string | null;

  loadForUser: () => Promise<void>;
  setSoloMode: (v: boolean) => void;
  setSoloUpgrade: (v: boolean) => void;
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

  /** Cubre un equipo de club con el plan (permanente) y recarga teams. */
  coverTeam: (teamId: string) => Promise<void>;
  /** Cubre varios equipos de golpe (recarga una sola vez al final). */
  coverTeams: (teamIds: string[]) => Promise<void>;

  /** Borra un equipo (cascada) y recarga teams. */
  deleteTeam: (teamId: string) => Promise<void>;

  /**
   * Actualiza ajustes del equipo activo (categoría, grupo, nombre) y refresca
   * `team` + `teams` en memoria sin recargar todo. Útil para corregir datos
   * que se pusieron mal al crear o completar el grupo cuando ya se sorteó.
   */
  updateTeamSettings: (patch: {
    name?: string;
    category?: string | null;
    group_name?: string | null;
  }) => Promise<void>;

  addPlayer: (data: {
    name: string;
    pts: number;
    position: Side;
    available?: boolean;
    alias?: string | null;
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

  // ── Realtime ──────────────────────────────────────────────────────────
  // Canal Supabase suscrito a cambios en `players` del team activo. El
  // caso clave es que un player se marque (no) disponible desde su móvil
  // y el captain lo vea en su Lineup/Availability sin recargar.
  playersChannel: RealtimeChannel | null;
  /**
   * Sustituye el canal previo (si lo hay) por uno nuevo filtrado al teamId
   * dado. Llamar con teamId distinto al actual cierra el viejo y abre uno
   * nuevo. Refresca `players` ante cualquier evento INSERT/UPDATE/DELETE.
   */
  subscribePlayersRealtime: (teamId: string) => void;
  unsubscribePlayersRealtime: () => void;
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
  playerTeamIds: string[] = [],
): ActiveRole[] {
  const set = new Set<ActiveRole>();
  if (clubIds.length > 0) set.add('club_admin');
  if (memberships.some((m) => m.role === 'captain' || m.role === 'admin')) {
    set.add('captain');
  }
  // 'player' si tiene una membresía player O una ficha de jugador vinculada
  // (caso capitán-que-juega en su propio equipo).
  if (memberships.some((m) => m.role === 'player') || playerTeamIds.length > 0) {
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
  playerTeamIds: string[] = [],
): boolean {
  if (!team) return role === 'club_admin' && clubIds.length > 0;
  if (role === 'club_admin') {
    return !!team.club_id && clubIds.includes(team.club_id);
  }
  const m = memberships.find((x) => x.team_id === team.id);
  if (!m) return false;
  if (role === 'captain') return m.role === 'captain' || m.role === 'admin';
  // Un capitán con ficha de jugador vinculada en este equipo puede pasar a
  // modo Jugador aunque su membresía sea captain.
  if (role === 'player') {
    return m.role === 'player' || playerTeamIds.includes(team.id);
  }
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
  playerTeamIds: string[] = [],
): ActiveRole {
  const raw = deriveRawRole(team, memberships, clubIds);
  if (
    override &&
    roleAppliesToTeam(override, team, memberships, clubIds, playerTeamIds)
  ) {
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
  playerTeamIds: string[] = [],
): Team | null {
  if (role === 'club_admin') {
    return teams.find((t) => t.club_id && clubIds.includes(t.club_id)) ?? null;
  }
  for (const t of teams) {
    const m = memberships.find((x) => x.team_id === t.id);
    if (!m) continue;
    if (role === 'captain' && (m.role === 'captain' || m.role === 'admin')) return t;
    if (
      role === 'player' &&
      (m.role === 'player' || playerTeamIds.includes(t.id))
    )
      return t;
  }
  return null;
}

// Module-level guard contra race conditions en `setActiveTeam`. Cada
// llamada actualiza esta ref antes de empezar el fetch; los sets que
// vienen detrás solo se aplican si su teamId sigue siendo "el último
// pedido". Sin esto, taps rápidos entre teams dejaban la pantalla en
// blanco al pisarse las promises (player con team_id desfasado).
let lastSetActiveTeamRequest: string | null = null;

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
      myPlayerTeamIds: [],
      isLoading: false,
      hasLoadedOnce: false,
      isOnboarding: false,
      soloMode: false,
      soloUpgrade: false,
      error: null,

      setSoloMode: (v) => {
        set({ soloMode: v });
        // La cuenta recuerda la elección en cualquier dispositivo.
        void setSoloModeRemote(v);
      },
      setSoloUpgrade: (v) => set({ soloUpgrade: v }),

      loadForUser: async () => {
        set({ isLoading: true, error: null });
        try {
          const uid = useAuthStore.getState().user?.id ?? null;
          const [teams, memberships, myPlayerTeamIds] = await Promise.all([
            TeamsApi.fetchMyTeams(),
            TeamMembersApi.fetchMyMemberships(),
            uid
              ? PlayersApi.fetchMyPlayerTeamIds(uid)
              : Promise.resolve<string[]>([]),
          ]);

          if (teams.length === 0) {
            // Organizador de torneos: club creado en modo "solo torneos" (sin
            // equipos). Aunque no tenga equipo, es un club_admin y entra al
            // menú recortado (Torneos + Perfil), no al onboarding ni al modo
            // suelto de jugador. Los torneos cuelgan del club, así que existe
            // un club aunque no haya equipos.
            const orgClub = useClubStore
              .getState()
              .clubs.find((cl) => cl.tournaments_only);
            if (orgClub) {
              if (get().soloMode || get().soloUpgrade)
                set({ soloMode: false, soloUpgrade: false });
              set({
                team: null,
                players: [],
                teams: [],
                memberships,
                activeRole: 'club_admin',
                activeRoleOverride: null,
                activeTeamId: null,
                myPlayerId: null,
                myPlayerLoaded: true,
                myPlayerTeamIds: [],
                isLoading: false,
                hasLoadedOnce: true,
                isOnboarding: false,
              });
              return;
            }

            // Jugador suelto que vuelve a entrar: su elección local se
            // borró en el logout, pero si su cuenta ya tiene amistosos
            // entra directo a su modo sin re-pasar por la bienvenida.
            const solo =
              !get().soloUpgrade &&
              (get().soloMode ||
                (await getSoloModeRemote()) ||
                (await hasCasualHistory()));
            set({
              soloMode: solo,
              team: null,
              players: [],
              teams: [],
              memberships,
              activeRole: null,
              activeTeamId: null,
              myPlayerId: null,
              myPlayerLoaded: true,
              myPlayerTeamIds: [],
              isLoading: false,
              hasLoadedOnce: true,
              isOnboarding: false,
            });
            return;
          }

          // Tener equipo desactiva el modo suelto (se unio por invitacion).
          if (get().soloMode || get().soloUpgrade)
            set({ soloMode: false, soloUpgrade: false });

          const persistedId = get().activeTeamId;
          const team =
            (persistedId && teams.find((t) => t.id === persistedId)) || teams[0];
          const players = await PlayersApi.fetchPlayers(team.id);

          const clubIds = useClubStore.getState().clubs.map((c) => c.id);
          const override = get().activeRoleOverride;
          const activeRole = deriveActiveRole(
            team,
            memberships,
            clubIds,
            override,
            myPlayerTeamIds,
          );

          const myPlayer = await resolveMyPlayerId(team, activeRole);

          set({
            team,
            activeTeamId: team.id,
            players,
            teams,
            memberships,
            myPlayerTeamIds,
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

      reset: () => {
        const ch = get().playersChannel;
        if (ch) ch.unsubscribe();
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
          myPlayerTeamIds: [],
          isLoading: false,
          hasLoadedOnce: false,
          isOnboarding: false,
          // El modo suelto es una elección POR USUARIO: al cerrar sesión se
          // limpia para que la siguiente cuenta no lo herede del dispositivo.
          soloMode: false,
          soloUpgrade: false,
          error: null,
          playersChannel: null,
        });
      },

      finishOnboarding: () => set({ isOnboarding: false }),

      setActiveTeam: async (teamId) => {
        const teams = get().teams;
        const team = teams.find((t) => t.id === teamId);
        if (!team) throw new Error('Equipo no encontrado');

        // Race-condition guard: si el user hace tap rápido entre teams
        // (típico al navegar Club ↔ ClubTeams ↔ Equipo en cascada), dos
        // `setActiveTeam` corren en paralelo y la promise que termina
        // segunda pisa el state correcto → pantallas en blanco porque
        // `team.id !== players[0].team_id`. Trackeamos el último teamId
        // pedido en una ref de módulo y descartamos los sets desfasados.
        lastSetActiveTeamRequest = teamId;

        // Optimistic primer set: cambiamos team + activeTeamId YA y
        // limpiamos players/myPlayer para que las pantallas vean estado
        // de "cargando" en lugar de datos del team anterior.
        set({
          team,
          activeTeamId: team.id,
          players: [],
          myPlayerId: null,
          myPlayerLoaded: false,
        });

        const players = await PlayersApi.fetchPlayers(team.id);
        if (lastSetActiveTeamRequest !== teamId) return;

        const clubIds = useClubStore.getState().clubs.map((c) => c.id);
        const memberships = get().memberships;
        const playerTeamIds = get().myPlayerTeamIds;
        let override = get().activeRoleOverride;
        if (
          override &&
          !roleAppliesToTeam(override, team, memberships, clubIds, playerTeamIds)
        ) {
          override = null;
        }
        const activeRole = deriveActiveRole(
          team,
          memberships,
          clubIds,
          override,
          playerTeamIds,
        );

        if (lastSetActiveTeamRequest !== teamId) return;
        set({ players, activeRole, activeRoleOverride: override });

        const myPlayer = await resolveMyPlayerId(team, activeRole);
        if (lastSetActiveTeamRequest !== teamId) return;
        set({ myPlayerId: myPlayer.id, myPlayerLoaded: myPlayer.loaded });
      },

      setActiveRoleOverride: async (role) => {
        const { teams, memberships, team, myPlayerTeamIds } = get();
        const clubIds = useClubStore.getState().clubs.map((c) => c.id);

        // Override = null → vuelve al cálculo automático
        if (role === null) {
          const activeRole = deriveActiveRole(
            team,
            memberships,
            clubIds,
            null,
            myPlayerTeamIds,
          );
          set({ activeRoleOverride: null, activeRole, myPlayerLoaded: false });
          const myPlayer = await resolveMyPlayerId(team, activeRole);
          set({ myPlayerId: myPlayer.id, myPlayerLoaded: myPlayer.loaded });
          return;
        }

        // Si el equipo activo ya cumple el rol pedido, basta con marcar override
        if (
          team &&
          roleAppliesToTeam(role, team, memberships, clubIds, myPlayerTeamIds)
        ) {
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
        const target = findFirstTeamForRole(
          role,
          teams,
          memberships,
          clubIds,
          myPlayerTeamIds,
        );
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
        const activeRole = deriveActiveRole(
          team,
          memberships,
          clubIds,
          override,
          get().myPlayerTeamIds,
        );
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

      coverTeam: async (teamId) => {
        await TeamsApi.coverTeam(teamId);
        // Recargamos para traer el flag `covered` actualizado a todos los teams.
        await get().loadForUser();
      },

      coverTeams: async (teamIds) => {
        if (!teamIds.length) return;
        // Secuencial: `cover_team` valida el cupo por llamada, así que si por
        // lo que fuera se pidieran de más, las que exceden fallan sin romper
        // las que sí caben.
        for (const id of teamIds) {
          await TeamsApi.coverTeam(id).catch((e) =>
            console.warn('coverTeam failed', id, e),
          );
        }
        await get().loadForUser();
      },

      updateTeamSettings: async (patch) => {
        const team = get().team;
        if (!team) return;
        const updated = await TeamsApi.updateTeam(team.id, patch);
        set((s) => ({
          team: s.team?.id === updated.id ? updated : s.team,
          teams: s.teams.map((t) => (t.id === updated.id ? updated : t)),
        }));
      },

      deleteTeam: async (teamId) => {
        await TeamsApi.deleteTeam(teamId);
        // loadForUser se auto-cura: si el equipo borrado era el activo, elige
        // otro (o deja null si no quedan).
        await get().loadForUser();
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

      // ── Realtime: players del team activo ────────────────────────────
      playersChannel: null,

      subscribePlayersRealtime: (teamId) => {
        // Cierra el canal previo si existía (típico al cambiar de equipo
        // activo o al re-login con otro usuario). `removeChannel` libera
        // la referencia interna del cliente — `unsubscribe()` solo cierra
        // el WS, y reusar el mismo topic luego lanza:
        //   "cannot add postgres_changes callbacks after subscribe()".
        const existing = get().playersChannel;
        if (existing) supabase.removeChannel(existing);

        // Refetch completo de players ante cualquier evento. La lista por
        // equipo es pequeña (<30) así que un refetch es más simple y
        // robusto que aplicar el diff manualmente (especialmente para
        // INSERT/DELETE que requerirían reordenar). RLS ya filtra a lo
        // que el user puede ver.
        const refresh = async () => {
          try {
            const players = await PlayersApi.fetchPlayers(teamId);
            // Solo aplicamos si seguimos en el mismo team activo — un
            // evento late de un team anterior no debe pisar el actual.
            if (get().activeTeamId === teamId) {
              set({ players });
            }
          } catch (e) {
            console.warn('players realtime refresh', e);
          }
        };

        // Sufijo random en el topic: en dev StrictMode dispara este
        // efecto dos veces y reusar el mismo nombre devuelve el canal
        // anterior medio-vivo, que ya está marcado como suscrito.
        const topic = `players:team:${teamId}:${Math.random().toString(36).slice(2, 8)}`;
        const channel = supabase
          .channel(topic)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'players',
              filter: `team_id=eq.${teamId}`,
            },
            refresh,
          )
          .subscribe();
        set({ playersChannel: channel });
      },

      unsubscribePlayersRealtime: () => {
        const ch = get().playersChannel;
        if (ch) {
          supabase.removeChannel(ch);
          set({ playersChannel: null });
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
        soloMode: s.soloMode,
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
  playerTeamIds: string[] = [],
): ActiveRole[] => deriveAvailableRoles(memberships, clubIds, playerTeamIds);
