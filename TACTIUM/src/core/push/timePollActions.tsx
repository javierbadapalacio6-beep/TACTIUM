import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';

import { useAuthStore } from '@store/authStore';
import { navigationRef } from '@navigation/navigationRef';

/**
 * Avisos de la encuesta de hora. El servidor manda `categoryId: time_poll`
 * en «Nueva encuesta» y «Falta tu voto»: un botón «Votar» que abre la app en
 * la jornada (el voto es multiselección; no se contesta desde la
 * notificación). «Hora fijada» no lleva botones: el toque abre la jornada.
 */
export async function registerTimePollCategories(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync('time_poll', [
      { identifier: 'vote', buttonTitle: 'Votar', options: { opensAppToForeground: true } },
    ]);
  } catch (e) {
    console.warn('registerTimePollCategories failed', e);
  }
}

const TYPES = new Set(['time_poll_open', 'time_poll_reminder', 'time_poll_fixed']);

function openJornada(matchdayId: string) {
  if (!navigationRef.isReady()) return;
  try {
    // La jornada vive en la stack de Inicio (misma pestaña para todos los
    // roles en la barra única). El bloque de la encuesta está en «Previa».
    navigationRef.navigate('MainTabs', {
      screen: 'Home',
      params: { screen: 'Jornada', params: { matchdayId } },
    } as never);
  } catch {
    // Rol sin pestaña Inicio: se queda donde está.
  }
}

/** Toque en un aviso de la encuesta (también el que abre la app en frío). */
export function TimePollPushResponder(): null {
  const response = Notifications.useLastNotificationResponse();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const handled = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!response || !userId) return;
    const data = response.notification.request.content.data as
      | { type?: string; matchdayId?: string }
      | undefined;
    if (!data?.type || !TYPES.has(data.type) || !data.matchdayId) return;
    const key = `${response.notification.request.identifier}:${response.actionIdentifier}`;
    if (handled.current.has(key)) return;
    handled.current.add(key);
    openJornada(data.matchdayId);
  }, [response, userId]);

  return null;
}
