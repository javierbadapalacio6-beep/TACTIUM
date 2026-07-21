import { Platform, Alert } from 'react-native';
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

// Evita repetir el priming varias veces en la misma sesión de app.
let primedThisSession = false;

/**
 * Tras iniciar sesión: si ya hay permiso, refresca el token; si está sin
 * decidir, muestra un mensaje de valor ("priming") ANTES del diálogo del SO
 * para maximizar el opt-in. Si lo denegó, no insiste (tendría que ir a Ajustes).
 */
export async function maybePromptForPush(userId: string): Promise<void> {
  if (!Device.isDevice) return;
  const status = await getPushPermission();

  if (status === 'granted') {
    await registerForPushNotifications(userId);
    return;
  }
  if (status === 'denied') return;
  if (primedThisSession) return;
  primedThisSession = true;

  Alert.alert(
    'Activa los avisos de tu equipo',
    'Recibe al instante cuando hay nueva jornada y disponibilidad que confirmar, y cuando se publica la alineación.',
    [
      { text: 'Ahora no', style: 'cancel' },
      {
        text: 'Activar',
        onPress: () => {
          registerForPushNotifications(userId).catch(() => {});
        },
      },
    ],
  );
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
