import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';

import { supabase } from '@core/supabase/client';
import { SUB_VISIBLE_COLS } from '@core/services/subscriptions';
import { PREMIUM_STATUSES } from '@core/subscriptions/plans';
import {
  hasPremiumAccess,
  daysUntilTrialEnd,
  type Subscription,
  type EntitlementResult,
  type TeamRole,
} from '@core/entitlements/hasPremiumAccess';
import {
  fetchTeamCaptainCoverage,
  type TeamCaptainCoverage,
} from '@core/services/teamCaptains';

// ── Selectors helpers ──────────────────────────────────────────────────────

export interface TeamLikeForEntitlement {
  id: string;
  club_id: string | null;
  // Cobertura dura para equipos de club (ver hasPremiumAccess). Opcional para
  // no romper callers que pasan un team mínimo; se trata como no-cubierto.
  covered?: boolean;
}

export interface MembershipLike {
  team_id: string;
  user_id: string;
  role: TeamRole;
}

interface State {
  // Subs visibles (mix de DB + optimistic). RLS ya filtra a lo del user.
  subscriptions: Subscription[];
  loading: boolean;
  lastSyncedAt: number | null;
  realtimeChannel: RealtimeChannel | null;
  // «El plan Capitán cubre al equipo»: cobertura por equipo independiente
  // (RPC `team_captain_coverage`), indexada por team_id. Incluye la lista de
  // capitanes para el bloque «Capitanes · 2 de 3».
  teamCoverage: Record<string, TeamCaptainCoverage>;

  // Mutaciones
  refresh: (userId: string) => Promise<void>;
  // Recarga la cobertura de un equipo (o de todos si no se pasa). Devuelve la
  // fila del equipo pedido, si la hay.
  refreshTeamCoverage: (teamId?: string | null) => Promise<TeamCaptainCoverage | null>;
  subscribeRealtime: (userId: string) => void;
  unsubscribeRealtime: () => void;
  addOptimistic: (sub: Subscription) => void;
  reset: () => void;

  // Selectors (no state, sólo helpers en el store para ergonomía).
  isPremium: (
    userId: string | null,
    role: TeamRole | null,
    team: TeamLikeForEntitlement | null,
  ) => EntitlementResult;
  trialDaysLeft: () => number | null;
  hasAnyActiveSub: () => boolean;
}

export const useSubscriptionStore = create<State>((set, get) => ({
  subscriptions: [],
  loading: false,
  lastSyncedAt: null,
  realtimeChannel: null,
  teamCoverage: {},

  refreshTeamCoverage: async (teamId) => {
    try {
      const rows = await fetchTeamCaptainCoverage(teamId ?? null);
      set((s) => {
        const next = teamId ? { ...s.teamCoverage } : {};
        if (teamId) delete next[teamId];
        for (const r of rows) next[r.team_id] = r;
        // Lista nueva de subs (mismas filas) para que los hooks suscritos a
        // `subscriptions` se repinten también al cambiar la cobertura.
        return { teamCoverage: next, subscriptions: [...s.subscriptions] };
      });
      return teamId ? rows.find((r) => r.team_id === teamId) ?? null : null;
    } catch (e) {
      console.warn('subscriptionStore:refreshTeamCoverage', e);
      return null;
    }
  },

  refresh: async (userId) => {
    if (!userId) return;
    set({ loading: true });
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(SUB_VISIBLE_COLS)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Conservamos las optimistic locales junto a las de DB, pero
      // DEDUPLICAMOS por subject: si para un mismo `(subject_type, subject_id)`
      // hay tanto fila DB como optimistic, mantenemos la optimistic. Esto
      // permite que el mock dev refleje cambios de plan al instante sin
      // que el siguiente refresh "resucite" la fila DB original.
      // Cast vía unknown: el select con string explícito no preserva el
      // tipo `Subscription` (PII revocada a nivel DB). Ningún consumer
      // del store lee revenuecat_customer_id ni original_transaction_id.
      const dbSubs = ((data ?? []) as unknown) as Subscription[];
      // Cobertura por equipo (plan Capitán compartido). No es fatal.
      const coverageRows = await fetchTeamCaptainCoverage().catch((e) => {
        console.warn('subscriptionStore:teamCoverage', e);
        return null;
      });
      const optimistic = get().subscriptions.filter((s) =>
        s.id.startsWith('optimistic_'),
      );
      const optimisticKeys = new Set(
        optimistic.map((s) => `${s.subject_type}:${s.subject_id}`),
      );
      const dedupedDb = dbSubs.filter(
        (s) => !optimisticKeys.has(`${s.subject_type}:${s.subject_id}`),
      );
      set({
        subscriptions: [...dedupedDb, ...optimistic],
        ...(coverageRows
          ? {
              teamCoverage: Object.fromEntries(
                coverageRows.map((r) => [r.team_id, r]),
              ),
            }
          : {}),
        loading: false,
        lastSyncedAt: Date.now(),
      });
    } catch (e) {
      console.warn('subscriptionStore:refresh', e);
      set({ loading: false });
    }
  },

  subscribeRealtime: (userId) => {
    if (!userId) return;
    const existing = get().realtimeChannel;
    if (existing) {
      existing.unsubscribe();
    }
    // Nos suscribimos a TODOS los cambios en subscriptions; RLS filtra lo
    // que vemos, así que solo recibimos eventos de rows que ya nos
    // pertenecían. Cuando llega un evento, refrescamos.
    const channel = supabase
      .channel(`subscriptions:user:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'subscriptions' },
        () => {
          get().refresh(userId);
        },
      )
      .subscribe();
    set({ realtimeChannel: channel });
  },

  unsubscribeRealtime: () => {
    const ch = get().realtimeChannel;
    if (ch) {
      ch.unsubscribe();
      set({ realtimeChannel: null });
    }
  },

  addOptimistic: (sub) => {
    // Reemplaza cualquier sub previa con el mismo subject (sea optimistic o
    // de DB). Un subject solo puede tener UNA sub activa simultáneamente —
    // si llega una nueva (p.ej. cambio de plan durante el trial), pisa la
    // anterior para que SubscriptionScreen / Profile muestren la actual.
    // Esto replica el upsert por `original_transaction_id` del webhook real.
    set((s) => {
      const filtered = s.subscriptions.filter(
        (existing) =>
          !(
            existing.subject_type === sub.subject_type &&
            existing.subject_id === sub.subject_id
          ),
      );
      return { subscriptions: [...filtered, sub] };
    });
  },

  reset: () => {
    const ch = get().realtimeChannel;
    if (ch) ch.unsubscribe();
    set({
      subscriptions: [],
      loading: false,
      lastSyncedAt: null,
      realtimeChannel: null,
      teamCoverage: {},
    });
  },

  isPremium: (userId, role, team) => {
    return hasPremiumAccess({
      userId,
      role,
      clubId: team?.club_id ?? null,
      teamCovered: team?.covered ?? false,
      teamCaptainCover: captainCoverFor(get().teamCoverage, team),
      subscriptions: get().subscriptions,
    });
  },

  trialDaysLeft: () => {
    return daysUntilTrialEnd(get().subscriptions);
  },

  hasAnyActiveSub: () => {
    // Mirar SOLO el status deja pasar filas zombi: una sub que el webhook dejó
    // en 'active' con el periodo ya vencido (pasa cuando conviven la fila que
    // crea el cliente al comprar y la que crea el webhook). La BD ya exige
    // `current_period_end > now()` en fn_has_premium_access; aquí igual, para
    // que cliente y servidor digan lo mismo.
    const now = Date.now();
    return get().subscriptions.some(
      (s) =>
        PREMIUM_STATUSES.includes(s.status) &&
        new Date(s.current_period_end).getTime() > now,
    );
  },
}));

// ── Selectors derivados para consumir desde componentes ─────────────────────

/**
 * Hook helper: ¿el user actual tiene premium en el team activo?
 * Devuelve `EntitlementResult` con razón si está bloqueado.
 *
 * Para usar en pantallas, lee `useSubscriptionStore(...)` directamente con
 * un selector que incluya los datos del user/team/role del momento.
 * Este helper sólo está aquí como ejemplo del patrón esperado.
 */
export function selectIsPremium(
  state: State,
  userId: string | null,
  role: TeamRole | null,
  team: TeamLikeForEntitlement | null,
): EntitlementResult {
  return hasPremiumAccess({
    userId,
    role,
    clubId: team?.club_id ?? null,
    teamCovered: team?.covered ?? false,
    teamCaptainCover: captainCoverFor(state.teamCoverage, team),
    subscriptions: state.subscriptions,
  });
}

function captainCoverFor(
  coverage: Record<string, TeamCaptainCoverage>,
  team: TeamLikeForEntitlement | null,
): { coveredUntil: string } | null {
  if (!team || team.club_id) return null;
  const row = coverage[team.id];
  return row?.covered && row.period_end ? { coveredUntil: row.period_end } : null;
}
