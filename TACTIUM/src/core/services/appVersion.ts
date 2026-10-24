import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { supabase } from '@core/supabase/client';

/** Número de build REAL del binario (ver `buildNumber` en SettingsScreen:
 *  `Constants.nativeBuildVersion` llega vacío en Android y bajo una OTA). */
export function currentBuild(): number {
  let raw: string | null | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    raw = (require('expo-application') as { nativeBuildVersion?: string | null })?.nativeBuildVersion;
  } catch {
    /* módulo no disponible */
  }
  const n = parseInt(String(raw ?? Constants.nativeBuildVersion ?? ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * ¿Hay que obligar a actualizar? Pregunta a la BD el build mínimo de esta
 * tienda. Ante CUALQUIER duda (sin red, error, build ilegible) devuelve false:
 * mejor dejar usar la app que bloquearla por un fallo nuestro.
 */
export async function isUpdateRequired(): Promise<boolean> {
  try {
    const build = currentBuild();
    if (!build) return false;
    const timeout = new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000));
    // RPC nueva sin tipos generados: se llama sin tipar (igual que en fcpUpload).
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: string,
    ) => Promise<{ data: unknown; error: unknown }>;
    const { data, error } = await Promise.race([rpc('get_app_min_build'), timeout]);
    if (error || !data) return false;
    const min = Number((data as { ios?: number; android?: number })[Platform.OS === 'ios' ? 'ios' : 'android']);
    return Number.isFinite(min) && min > 0 && build < min;
  } catch {
    return false;
  }
}

export const STORE_URL =
  Platform.OS === 'ios'
    ? 'https://apps.apple.com/es/app/tactium/id6769825905'
    : 'https://play.google.com/store/apps/details?id=io.tactium.app';
