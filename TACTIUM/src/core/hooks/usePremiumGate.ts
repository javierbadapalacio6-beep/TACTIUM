import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import { clubCoverage } from '@core/entitlements/coverage';
import { PREMIUM_STATUSES } from '@core/subscriptions/plans';

import type { RootStackParamList } from '@navigation/types';

export interface GateTeam {
  id: string;
  club_id: string | null;
  covered?: boolean;
  name?: string;
}

type GateFn = () => void | Promise<void>;

/**
 * Núcleo del gate: dado un equipo CONCRETO, decide si corre la acción, ofrece
 * cubrir el equipo (cobertura dura), propone mejorar el plan, o manda al
 * paywall por falta de sub. Lo comparten el gate del equipo activo
 * (`usePremiumGate`) y el gate por-equipo (`useTeamGate`).
 */
function useGateRunner() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const role = useTeamStore((s) => s.activeRole);
  const teams = useTeamStore((s) => s.teams);
  const coverTeamAction = useTeamStore((s) => s.coverTeam);
  const isPremiumFn = useSubscriptionStore((s) => s.isPremium);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  return useCallback(
    (team: GateTeam | null, fn: GateFn, intent?: string) => {
      const result = isPremiumFn(
        userId,
        role === 'club_admin' ? 'admin' : role,
        team
          ? { id: team.id, club_id: team.club_id, covered: team.covered }
          : null,
      );
      if (result.allowed) {
        fn();
        return;
      }

      // Cobertura dura: el club paga pero ESTE equipo no está cubierto.
      if (result.reason === 'not_covered' && team) {
        const cov = clubCoverage(team.club_id, teams, subscriptions);
        const name = team.name ?? 'Este equipo';
        if (cov.hasFreeSlot) {
          Alert.alert(
            'Cubrir este equipo',
            `"${name}" pasará a estar cubierto por tu plan (${cov.used + 1}/${
              cov.quota
            }). Es permanente: para gestionar otros equipos tendrás que mejorar el plan.`,
            [
              { text: 'Cancelar', style: 'cancel' },
              {
                text: 'Cubrir y continuar',
                onPress: async () => {
                  try {
                    await coverTeamAction(team.id);
                    await fn();
                  } catch (e: any) {
                    toast.error(
                      'No se pudo cubrir',
                      e?.message ?? 'Inténtalo de nuevo.',
                    );
                  }
                },
              },
            ],
          );
        } else {
          Alert.alert(
            'Plan completo',
            `Tu plan cubre ${cov.quota} ${
              cov.quota === 1 ? 'equipo' : 'equipos'
            } y ya los usas todos. Mejora el plan para gestionar más.`,
            [
              { text: 'Ahora no', style: 'cancel' },
              {
                text: 'Mejorar plan',
                onPress: () =>
                  navigation.navigate('Paywall', { intent: intent ?? 'upgrade' }),
              },
            ],
          );
        }
        return;
      }

      // Sin sub → paywall normal.
      navigation.navigate('Paywall', { intent });
    },
    [userId, role, teams, subscriptions, coverTeamAction, isPremiumFn, navigation],
  );
}

/**
 * Gate del EQUIPO ACTIVO. Devuelve `gate(fn, intent?)` → onPress listo.
 * Para CTAs de las pantallas del capitán (Home/Jornada/Lineup/Seasons), que
 * operan sobre el team activo.
 */
export function usePremiumGate() {
  const run = useGateRunner();
  const team = useTeamStore((s) => s.team);
  return useCallback(
    (fn: GateFn, intent?: string) => () =>
      run(
        team
          ? {
              id: team.id,
              club_id: team.club_id,
              covered: team.covered,
              name: team.name,
            }
          : null,
        fn,
        intent,
      ),
    [run, team],
  );
}

/**
 * Gate por EQUIPO CONCRETO. Devuelve `gate(team, fn, intent?)` → onPress.
 * Para la gestión de club (ClubDashboard / TeamMembersSheet), donde se actúa
 * sobre un equipo que NO es necesariamente el activo — por eso no vale el
 * gate del team activo.
 */
export function useTeamGate() {
  const run = useGateRunner();
  return useCallback(
    (team: GateTeam, fn: GateFn, intent?: string) => () =>
      run(team, fn, intent),
    [run],
  );
}

/**
 * ¿El usuario tiene ALGUNA suscripción activa? Reactivo (se repinta al cambiar
 * las subs). Role-agnóstico y sin depender de un equipo — útil en el onboarding,
 * donde aún puede no haber team, para decidir si ofrecer el volcado automático.
 */
export function useHasActiveSub(): boolean {
  return useSubscriptionStore((s) =>
    s.subscriptions.some((x) => PREMIUM_STATUSES.includes(x.status)),
  );
}

/**
 * Variante boolean del gate (equipo activo): si el user tiene premium.
 * Útil para gating de vistas (banner vs contenido real).
 */
export function useIsPremium(): boolean {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const role = useTeamStore((s) => s.activeRole);
  const team = useTeamStore((s) => s.team);
  const isPremiumFn = useSubscriptionStore((s) => s.isPremium);
  // Suscribirse a `subscriptions` hace el hook REACTIVO: `isPremiumFn` lee la
  // lista actual, pero sin esto el componente no repinta al cambiar las subs
  // (p.ej. al volver del paywall con la prueba iniciada).
  useSubscriptionStore((s) => s.subscriptions);
  const result = isPremiumFn(
    userId,
    role === 'club_admin' ? 'admin' : role,
    team ? { id: team.id, club_id: team.club_id, covered: team.covered } : null,
  );
  return result.allowed;
}
