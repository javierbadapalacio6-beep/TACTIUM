import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

import { supabase } from '@core/supabase/client';

// La tabla `push_tokens` aún no está en database.types.ts (generado). Casteamos
// el acceso para no arrastrar el `any` por toda la app; cuando regeneremos los
// tipos se puede quitar.
const pushTokens = () => supabase.from('push_tokens' as never);

// Mostrar el aviso aunque la app esté en primer plano.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Canal Android obligatorio para notificaciones (importancia alta = heads-up).
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Avisos del equipo',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#00DF82',
  });
}

function resolveProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId
  );
}

/** ¿Ya concedió el permiso de notificaciones? (sin pedirlo). */
export async function getPushPermission(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  if (!Device.isDevice) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

/**
 * Pide permiso (si hace falta), obtiene el Expo push token y lo guarda en
 * `push_tokens` para el usuario logueado. Devuelve si quedó concedido.
 * Idempotente: upsert por token; re-login en el mismo device reasigna el token
 * al nuevo usuario.
 */
export async function registerForPushNotifications(
  userId: string,
): Promise<{ granted: boolean }> {
  // En simulador/emulador no hay push real.
  if (!Device.isDevice) return { granted: false };

  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== 'granted') return { granted: false };

  try {
    const projectId = resolveProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenData.data;

    await pushTokens().upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        device_name: Device.deviceName ?? null,
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: 'token' } as never,
    );
    return { granted: true };
  } catch (e) {
    console.warn('registerForPushNotifications failed', e);
    return { granted: false };
  }
}

/**
 * Dispara un aviso push a la plantilla vía la edge function `send-push`.
 * Best-effort: la edge function valida en servidor que el llamante es el
 * capitán y resuelve los destinatarios. No bloquea la acción del usuario.
 */
export async function notifyPush(
  type: 'matchday_created' | 'lineup_published' | 'schedule_set',
  matchdayId: string,
): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', {
      body: { type, matchdayId },
    });
  } catch (e) {
    console.warn('notifyPush failed', type, e);
  }
}

/**
 * Avisa a los inscritos de un torneo (in-app + push) cuando el club publica el
 * cuadro o el horario. La edge function valida que el llamante es admin del
 * club y resuelve destinatarios. Best-effort, no bloquea.
 */
export async function notifyTournamentPush(
  type: 'tournament_bracket' | 'tournament_schedule',
  tournamentId: string,
): Promise<void> {
  try {
    await supabase.functions.invoke('send-push', {
      body: { type, tournamentId },
    });
  } catch (e) {
    console.warn('notifyTournamentPush failed', type, e);
  }
}

/**
 * Al iniciar sesión: si el permiso YA está concedido, refresca el token en
 * silencio (por si cambió de dispositivo o de usuario). Nunca pregunta: el
 * permiso se pide en la pantalla de Avisos (paso 3 del onboarding, o el modal
 * `PushPrompt` una vez para quien no pasa por él), donde se explica qué llega.
 */
export async function refreshPushTokenIfGranted(userId: string): Promise<void> {
  if (!Device.isDevice) return;
  const status = await getPushPermission();
  if (status !== 'granted') return;
  await registerForPushNotifications(userId);
}

// ── Pantalla de Avisos vista (una vez por usuario y dispositivo) ──────────
// Quien ya la vio (activara o dijera «Ahora no») no la vuelve a ver. Si el
// almacenamiento falla, se da por NO vista: lo peor es enseñarla otra vez.
const promptKey = (userId: string) => `tactium-push-prompt-seen:${userId}`;

export async function hasSeenPushPrompt(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(promptKey(userId))) === '1';
  } catch {
    return false;
  }
}

export async function markPushPromptSeen(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(promptKey(userId), '1');
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/**
 * Borra el token de ESTE dispositivo (al cerrar sesión) para que el siguiente
 * usuario del device no herede los avisos del anterior.
 */
export async function unregisterPushToken(): Promise<void> {
  if (!Device.isDevice) return;
  try {
    const projectId = resolveProjectId();
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await pushTokens()
      .delete()
      .eq('token' as never, tokenData.data as never);
  } catch (e) {
    console.warn('unregisterPushToken failed', e);
  }
}
