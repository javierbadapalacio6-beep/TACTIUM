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

  // Mutaciones
  refresh: (userId: string) => Promise<void>;
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
    });
  },

  isPremium: (userId, role, team) => {
    return hasPremiumAccess({
      userId,
      role,
      clubId: team?.club_id ?? null,
      teamCovered: team?.covered ?? false,
      subscriptions: get().subscriptions,
    });
  },

  trialDaysLeft: () => {
    return daysUntilTrialEnd(get().subscriptions);
  },

  hasAnyActiveSub: () => {
    return get().subscriptions.some((s) =>
      PREMIUM_STATUSES.includes(s.status),
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
    subscriptions: state.subscriptions,
  });
}
