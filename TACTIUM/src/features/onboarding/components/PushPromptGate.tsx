import React, { useEffect, useRef } from 'react';

import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { getPushPermission, hasSeenPushPrompt } from '@core/push';
import { navigationRef } from '@navigation/navigationRef';

// Margen tras entrar en la app (o volver a las pestañas) antes de abrir el
// modal: que se vea primero dónde se está.
const SETTLE_MS = 1500;

/**
 * Abre UNA vez la pantalla de Avisos (`PushPrompt`) a quien no pasa por el
 * onboarding de equipo: jugadores invitados después de unirse y reclamar su
 * ficha, y cuentas que ya existían con el permiso sin decidir. El capitán y el
 * club la ven como paso 3 del onboarding y allí queda marcada como vista.
 *
 * Cuándo: ya dentro de la app CON equipo, con la ficha reclamada si es
 * jugador (si no, `PlayerClaimGate` tiene su hoja abierta) y solo cuando la
 * raíz son las pestañas, nunca encima de otro modal (Paywall, JoinTeam…). Si
 * en ese momento hay otro encima, espera a que se vuelva a las pestañas.
 */
export const PushPromptGate: React.FC = () => {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const team = useTeamStore((s) => s.team);
  const activeRole = useTeamStore((s) => s.activeRole);
  const myPlayerId = useTeamStore((s) => s.myPlayerId);
  const myPlayerLoaded = useTeamStore((s) => s.myPlayerLoaded);
  const shown = useRef(false);

  const claimPending = activeRole === 'player' && myPlayerId === null;
  const ready = !!userId && !!team && myPlayerLoaded && !claimPending;

  useEffect(() => {
    if (!ready || !userId || shown.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe: (() => void) | undefined;

    const onTabs = () => {
      if (!navigationRef.isReady()) return false;
      const root = navigationRef.getRootState();
      return root?.routes[root.index ?? 0]?.name === 'MainTabs';
    };

    const open = () => {
      if (cancelled || shown.current || !onTabs()) return;
      shown.current = true;
      unsubscribe?.();
      navigationRef.navigate('PushPrompt');
    };

    (async () => {
      if (await hasSeenPushPrompt(userId)) return;
      // Concedido o denegado: no hay nada que pedir (el token concedido ya lo
      // refresca App.tsx al iniciar sesión).
      if ((await getPushPermission()) !== 'undetermined') return;
      if (cancelled) return;
      timer = setTimeout(open, SETTLE_MS);
      // Si al vencer el margen había otro modal encima, se reintenta cuando
      // cambie la navegación (con el mismo margen al volver a las pestañas).
      unsubscribe = navigationRef.addListener('state', () => {
        if (shown.current || !onTabs()) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(open, SETTLE_MS);
      });
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe?.();
    };
  }, [ready, userId]);

  return null;
};
