import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

import { supabase } from '@core/supabase/client';
import { respondAvailability, type AvailabilityStatus } from '@core/services/availability';
import { useAuthStore } from '@store/authStore';
import { toast } from '@store/toastStore';
import { navigationRef } from '@navigation/navigationRef';

/**
 * Botones de las notificaciones de disponibilidad. El servidor manda
 * `categoryId`:
 *   · availability_rsvp    → Voy · Duda · No puedo (sin contestar)
 *   · availability_resolve → Voy · No puedo        (en duda: hay que decidir)
 * Todas abren la app (`opensAppToForeground`): así la respuesta se guarda
 * con la sesión cargada y sin depender de tareas en segundo plano.
 */
export async function registerAvailabilityCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync('availability_rsvp', [
      { identifier: 'yes', buttonTitle: 'Voy', options: { opensAppToForeground: true } },
      { identifier: 'maybe', buttonTitle: 'Duda', options: { opensAppToForeground: true } },
      {
        identifier: 'no',
        buttonTitle: 'No puedo',
        options: { opensAppToForeground: true, isDestructive: true },
      },
    ]);
    await Notifications.setNotificationCategoryAsync('availability_resolve', [
      { identifier: 'yes', buttonTitle: 'Voy', options: { opensAppToForeground: true } },
      {
        identifier: 'no',
        buttonTitle: 'No puedo',
        options: { opensAppToForeground: true, isDestructive: true },
      },
    ]);
  } catch (e) {
    console.warn('registerAvailabilityCategories failed', e);
  }
}

/**
 * MODO MAQUETA: el propio móvil se manda la notificación de disponibilidad
 * a los 5 s (sal de la app y mantenla pulsada para ver los botones).
 */
export async function scheduleTestAvailabilityPush(params: {
  matchdayId: string;
  kind: 'rsvp' | 'resolve';
  jornadaNumber?: number | null;
  opponent?: string | null;
}): Promise<boolean> {
  const perm = await Notifications.getPermissionsAsync();
  let status = perm.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return false;
  const j = params.jornadaNumber != null ? `J${params.jornadaNumber}` : 'La jornada';
  const vs = params.opponent ? ` vs ${params.opponent}` : '';
  await Notifications.scheduleNotificationAsync({
    content: {
      title: params.kind === 'resolve' ? '¿Al final juegas?' : `${j} · ¿Puedes jugar?`,
      body:
        params.kind === 'resolve'
          ? `Estás en duda para ${j}${vs}. Decide antes de mañana.`
          : `${vs.trim() || 'Próxima jornada'}. Contesta con un toque.`,
      data: { type: 'availability_reminder', matchdayId: params.matchdayId },
      categoryIdentifier: params.kind === 'resolve' ? 'availability_resolve' : 'availability_rsvp',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
  return true;
}

/** Ficha del usuario en el equipo de esa jornada (o null). */
export async function myPlayerForMatchday(matchdayId: string, userId: string): Promise<string | null> {
  const { data: md } = await supabase
    .from('matchdays')
    .select('season_id, seasons(team_id)')
    .eq('id', matchdayId)
    .maybeSingle();
  const teamId = (md as unknown as { seasons?: { team_id?: string } } | null)?.seasons?.team_id;
  if (!teamId) return null;
  const { data: pl } = await supabase
    .from('players')
    .select('id')
    .eq('team_id', teamId)
    .eq('user_id', userId)
    .maybeSingle();
  return (pl as { id: string } | null)?.id ?? null;
}

function openAvailability(matchdayId: string) {
  if (!navigationRef.isReady()) return;
  try {
    // Disponibilidad vive en la stack de Inicio (pestaña `Home`, la misma
    // para todos los roles en la barra única).
    navigationRef.navigate('MainTabs', {
      screen: 'Home',
      params: { screen: 'Availability', params: { matchdayId } },
    });
  } catch {
    // Rol sin pestaña Inicio (club): se queda donde está.
  }
}

const LABEL: Record<Exclude<AvailabilityStatus, 'maybe'>, string> = {
  yes: 'Vas',
  no: 'No vas',
};

/**
 * Escucha los toques en notificaciones de disponibilidad (también la que
 * abrió la app en frío) y responde o abre la pantalla. Va dentro del
 * NavigationContainer.
 */
export function AvailabilityPushResponder(): null {
  const response = Notifications.useLastNotificationResponse();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const handled = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!response || !userId) return;
    const data = response.notification.request.content.data as
      | { type?: string; matchdayId?: string }
      | undefined;
    if (data?.type !== 'availability_reminder' || !data.matchdayId) return;

    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handled.current.has(key)) return;
    handled.current.add(key);

    const matchdayId = data.matchdayId;
    const action = response.actionIdentifier;

    if (action === 'yes' || action === 'no') {
      (async () => {
        try {
          const playerId = await myPlayerForMatchday(matchdayId, userId);
          if (!playerId) {
            openAvailability(matchdayId);
            return;
          }
          await respondAvailability({ matchdayId, playerId, status: action });
          toast.success(`${LABEL[action]} a la jornada`, 'Tu capitán ya lo ve.');
        } catch (e: any) {
          toast.error('No se guardó tu respuesta', e?.message ?? 'Ábrela y contesta desde Inicio.');
          openAvailability(matchdayId);
        }
      })();
      return;
    }
    // «Duda» o toque normal: abrir la disponibilidad de esa jornada.
    openAvailability(matchdayId);
  }, [response, userId]);

  return null;
}
