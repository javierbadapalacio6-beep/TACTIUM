import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { useSubscriptionStore } from '@store/subscriptionStore';

import type { RootStackParamList } from '@navigation/types';

/**
 * Hook que devuelve un `gate(fn, intent?)` helper:
 *
 *   - Si el user actual TIENE premium en el team activo → invoca `fn()`.
 *   - Si NO → navega a PaywallScreen con `intent` para tracking.
 *
 * Pensado para CTAs ya estilados que no se pueden reemplazar por
 * `PremiumGateButton` (porque tienen visual condicional, iconos, etc.).
 *
 * Ejemplo:
 *
 *   const gate = usePremiumGate();
 *   <Pressable onPress={gate(handleSave, 'lineup_save')}>
 *     ...
 *   </Pressable>
 */
export function usePremiumGate() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const role = useTeamStore((s) => s.activeRole);
  const team = useTeamStore((s) => s.team);
  const isPremiumFn = useSubscriptionStore((s) => s.isPremium);

  return useCallback(
    (fn: () => void | Promise<void>, intent?: string) => {
      return () => {
        const result = isPremiumFn(
          userId,
          role === 'club_admin' ? 'admin' : role,
          team ? { id: team.id, club_id: team.club_id } : null,
        );
        if (!result.allowed) {
          navigation.navigate('Paywall', { intent });
          return;
        }
        fn();
      };
    },
    [userId, role, team, isPremiumFn, navigation],
  );
}

/**
 * Variante boolean del gate: devuelve directamente si el user tiene premium.
 * Útil para gating de vistas (renderizar un banner vs el contenido real).
 */
export function useIsPremium(): boolean {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const role = useTeamStore((s) => s.activeRole);
  const team = useTeamStore((s) => s.team);
  const isPremiumFn = useSubscriptionStore((s) => s.isPremium);
  const result = isPremiumFn(
    userId,
    role === 'club_admin' ? 'admin' : role,
    team ? { id: team.id, club_id: team.club_id } : null,
  );
  return result.allowed;
}
