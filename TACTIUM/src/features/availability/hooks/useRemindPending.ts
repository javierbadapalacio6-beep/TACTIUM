import { useCallback, useState } from 'react';
import { Alert, Share } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import * as AvailabilityApi from '@core/services/availability';
import { usePremiumGate } from '@core/hooks/usePremiumGate';
import { toast } from '@store/toastStore';
import type { RootStackParamList } from '@navigation/types';

export const REMIND_COOLDOWN_MS = 12 * 3_600_000;

/** Próximo recordatorio automático (9:00 o 21:00, hora del dispositivo). */
export function nextAutoReminder(now = new Date()): string {
  const h = now.getHours();
  if (h < 9) return 'hoy 9:00';
  if (h < 21) return 'hoy 21:00';
  return 'mañana 9:00';
}

/**
 * «Recordar ahora» del capitán. Premium (gate en cliente + servidor) y como
 * mucho 1 vez cada 12 h por jornada. A los pendientes SIN la app les prepara
 * un mensaje para WhatsApp.
 */
export function useRemindPending(params: {
  matchdayId: string | null | undefined;
  opponent?: string | null;
  jornadaNumber?: number | null;
  lastReminder: Date | null;
  setLastReminder: (d: Date) => void;
}) {
  const { matchdayId, opponent, jornadaNumber, lastReminder, setLastReminder } = params;
  const gate = usePremiumGate();
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [sending, setSending] = useState(false);

  const cooldownUntil =
    lastReminder && Date.now() - lastReminder.getTime() < REMIND_COOLDOWN_MS
      ? new Date(lastReminder.getTime() + REMIND_COOLDOWN_MS)
      : null;

  const shareWithoutApp = useCallback(
    async (names: string[]) => {
      const j = jornadaNumber != null ? `la J${jornadaNumber}` : 'la próxima jornada';
      const vs = opponent ? ` contra ${opponent}` : '';
      const message =
        `${names.join(', ')}: ¿podéis jugar ${j}${vs}? ` +
        'Contestadme por aquí o descargad TACTIUM para responder con un toque: https://tactium.io';
      try {
        await Share.share({ message });
      } catch {
        // cancelado
      }
    },
    [jornadaNumber, opponent],
  );

  const run = useCallback(async () => {
    if (!matchdayId || sending) return;
    setSending(true);
    try {
      const res = await AvailabilityApi.remindPending(matchdayId);
      setLastReminder(new Date());
      toast.success(
        res.reminded === 0
          ? 'Nadie con la app tiene la respuesta pendiente'
          : `Recordatorio enviado a ${res.reminded} ${res.reminded === 1 ? 'jugador' : 'jugadores'}`,
      );
      if (res.withoutApp.length > 0) {
        const names = res.withoutApp.map((p) => p.name);
        Alert.alert(
          `${names.length} sin la app`,
          `${names.join(', ')} no ${names.length === 1 ? 'tiene' : 'tienen'} TACTIUM. ¿Les escribes por WhatsApp?`,
          [
            { text: 'Ahora no', style: 'cancel' },
            { text: 'Preparar mensaje', onPress: () => shareWithoutApp(names) },
          ],
        );
      }
    } catch (e) {
      if (e instanceof AvailabilityApi.RemindError && e.kind === 'premium') {
        nav.navigate('Paywall', { intent: 'availability_remind' });
      } else if (e instanceof AvailabilityApi.RemindError && e.kind === 'cooldown') {
        if (e.nextAllowedAt) setLastReminder(new Date(e.nextAllowedAt.getTime() - REMIND_COOLDOWN_MS));
        toast.info('Ya recordaste hace poco', 'Podrás volver a hacerlo en unas horas.');
      } else {
        toast.error('No se pudo enviar el recordatorio', (e as Error)?.message);
      }
    } finally {
      setSending(false);
    }
  }, [matchdayId, sending, setLastReminder, shareWithoutApp, nav]);

  // El gate abre el paywall sin plan; con plan, ejecuta.
  const remind = gate(run, 'availability_remind');

  return { remind, sending, cooldownUntil, shareWithoutApp };
}
