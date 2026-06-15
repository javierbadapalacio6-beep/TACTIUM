import { PLAN_BY_TIER, PREMIUM_STATUSES } from '@core/subscriptions/plans';
import type { Subscription } from './hasPremiumAccess';

export interface CoverageInfo {
  /** Equipos que cubre el plan del club (0 si no hay sub activa). */
  quota: number;
  /** Equipos del club ya cubiertos (permanentes). */
  used: number;
  /** ¿Queda alguna plaza libre para cubrir un equipo más? */
  hasFreeSlot: boolean;
  /** ¿El club tiene una sub activa? (false → no es problema de cobertura). */
  hasActiveSub: boolean;
}

interface TeamLike {
  club_id: string | null;
  covered?: boolean;
}

/**
 * Estado de cobertura de un club: cuántos equipos cubre su tier y cuántos lleva
 * usados. Base para decidir, ante un equipo no cubierto, si se puede cubrir
 * (queda plaza) o hay que mejorar el plan.
 */
export function clubCoverage(
  clubId: string | null,
  teams: TeamLike[],
  subscriptions: Subscription[],
  now: Date = new Date(),
): CoverageInfo {
  if (!clubId) {
    return { quota: 0, used: 0, hasFreeSlot: false, hasActiveSub: false };
  }
  const sub = subscriptions.find(
    (s) =>
      s.subject_type === 'club' &&
      s.subject_id === clubId &&
      PREMIUM_STATUSES.includes(s.status) &&
      new Date(s.current_period_end) > now,
  );
  const quota = sub ? PLAN_BY_TIER[sub.plan_tier].teamQuota : 0;
  const used = teams.filter((t) => t.club_id === clubId && t.covered).length;
  return {
    quota,
    used,
    hasFreeSlot: used < quota,
    hasActiveSub: Boolean(sub),
  };
}
