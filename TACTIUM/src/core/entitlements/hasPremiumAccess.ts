import type { Database } from '@core/supabase/database.types';
import { PREMIUM_STATUSES } from '@core/subscriptions/plans';

export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type TeamRole = Database['public']['Enums']['team_role'];

// Información mínima que necesita la función pura. Mantenerla así (en vez
// de pasar el Team entero) facilita testing y desacopla del shape de DB.
export interface EntitlementContext {
  userId: string | null;
  // Rol del user en el team. `null` si no es miembro del team.
  role: TeamRole | null;
  // `null` si el team no pertenece a ningún club.
  clubId: string | null;
  // Subscripciones del usuario y de los clubs que ve. La función filtra
  // localmente — el caller debe asegurarse de que las haya cargado.
  subscriptions: Subscription[];
}

export type EntitlementResult =
  | { allowed: true; source: 'player_free' | 'club_inherited' | 'captain_self' }
  | { allowed: false; reason: 'no_user' | 'no_subscription' };

/**
 * Decide si un user tiene acceso premium para un team concreto.
 *
 * Mismo orden de resolución que `fn_has_premium_access` en DB (mantenerlas
 * sincronizadas):
 *
 *   1. Si el team pertenece a un club con subscripción premium activa → true
 *      (heredado). Cubre `club_admin` y a los `captain` de ese club.
 *   2. Si el user es `player` en ese team → true (los players son siempre
 *      free, da igual el estado de subs).
 *   3. Si el user es `captain`/`admin` y tiene una sub `captain` propia
 *      activa → true.
 *   4. Cualquier otro caso → false.
 *
 * `now` parameterizable para testing determinista.
 */
export function hasPremiumAccess(
  ctx: EntitlementContext,
  now: Date = new Date(),
): EntitlementResult {
  if (!ctx.userId) {
    return { allowed: false, reason: 'no_user' };
  }

  // 1) Herencia desde club
  if (ctx.clubId) {
    const hit = ctx.subscriptions.find(
      (s) =>
        s.subject_type === 'club' &&
        s.subject_id === ctx.clubId &&
        PREMIUM_STATUSES.includes(s.status) &&
        new Date(s.current_period_end) > now,
    );
    if (hit) return { allowed: true, source: 'club_inherited' };
  }

  // 2) Player siempre free
  if (ctx.role === 'player') {
    return { allowed: true, source: 'player_free' };
  }

  // 3) Captain/admin con sub propia
  if (ctx.role === 'captain' || ctx.role === 'admin') {
    const hit = ctx.subscriptions.find(
      (s) =>
        s.subject_type === 'user' &&
        s.subject_id === ctx.userId &&
        s.plan_tier === 'captain' &&
        PREMIUM_STATUSES.includes(s.status) &&
        new Date(s.current_period_end) > now,
    );
    if (hit) return { allowed: true, source: 'captain_self' };
  }

  return { allowed: false, reason: 'no_subscription' };
}

/**
 * Helper: cuenta días restantes de trial para la sub más relevante.
 * Útil para `TrialExpiringBanner`. Devuelve `null` si no hay trial activo.
 */
export function daysUntilTrialEnd(
  subscriptions: Subscription[],
  now: Date = new Date(),
): number | null {
  const trialSub = subscriptions
    .filter((s) => s.status === 'trialing' && s.trial_end)
    .map((s) => ({
      sub: s,
      end: new Date(s.trial_end as string),
    }))
    .filter((x) => x.end > now)
    .sort((a, b) => a.end.getTime() - b.end.getTime())[0];

  if (!trialSub) return null;

  const ms = trialSub.end.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
