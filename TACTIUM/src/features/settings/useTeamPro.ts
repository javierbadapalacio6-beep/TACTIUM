import { useEffect, useState } from 'react';

import { supabase } from '@core/supabase/client';
import { isLiveSub } from '@core/subscriptions/plans';
import { useSubscriptionStore } from '@store/subscriptionStore';
import type { Team } from '@store/teamStore';

/**
 * ¿El equipo tiene Pro? Para enseñárselo al JUGADOR («Tu equipo tiene Pro»),
 * sin decir quién paga.
 *
 *  · Equipo de club: sub del club viva y equipo cubierto. El jugador puede
 *    leer la sub de su club (política `subs_club_member_read`).
 *  · Equipo independiente: la sub es del capitán y su fila no se puede leer.
 *    Se pregunta a `fn_has_premium_access` (SECURITY DEFINER, ya expuesta) por
 *    el dueño del equipo.
 *
 * `null` = aún no se sabe (o la consulta falló): no se afirma nada.
 */
export function useTeamPro(team: Team | null, enabled = true): boolean | null {
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const [pro, setPro] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled || !team) {
      setPro(null);
      return;
    }
    let cancelled = false;
    if (team.club_id) {
      const clubLive = subscriptions.some(
        (s) => s.subject_type === 'club' && s.subject_id === team.club_id && isLiveSub(s),
      );
      setPro(clubLive && !!team.covered);
      return;
    }
    setPro(null);
    supabase
      .rpc('fn_has_premium_access', { p_user_id: team.owner_id, p_team_id: team.id })
      .then(({ data, error }) => {
        if (!cancelled) setPro(error ? null : data === true);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, team, subscriptions]);

  return pro;
}
