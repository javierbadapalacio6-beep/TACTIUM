import { useFonts } from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { Platform } from 'react-native';

/**
 * Fuente de la app en ANDROID. iPhone usa San Francisco y Android, por defecto, Roboto (o la del fabricante: MiSans,
 * One UI…), más ancha y con otras métricas: los mismos estilos salen más apretados, con más «…» y con otro peso.
 * Con Inter en Android el texto se parece al de iPhone en ancho y claridad. En Android cada peso es una fuente
 * distinta, así que se cargan los cuatro que usa la app y `familyFor` traduce `fontWeight` → familia.
 * Las fuentes se cargan en tiempo de ejecución (no hace falta build para cambiarlas).
 */
export const USE_INTER = Platform.OS === 'android';

let ready = false;
export const interReady = () => ready;

/** Carga Inter. En iOS no hace nada y devuelve true. */
export function useInterFont(): boolean {
  const [loaded, error] = useFonts(
    USE_INTER ? { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } : {},
  );
  const ok = !USE_INTER || loaded || !!error;
  if (USE_INTER && loaded) ready = true;
  return ok;
}

/** Familia de Inter para un peso. null si no toca cambiarla (mono u otra fuente propia). */
export function interFamilyFor(fontFamily: unknown, fontWeight: unknown): string | null {
  if (!USE_INTER || !ready) return null;
  const fam = typeof fontFamily === 'string' ? fontFamily : '';
  // Respeta las fuentes propias (monoespaciada de las etiquetas); cambia las del sistema.
  if (fam && !/^(sans-serif|sans-serif-medium|System|Roboto)$/i.test(fam)) return null;
  const w = String(fontWeight ?? '400');
  if (w === '500') return 'Inter_500Medium';
  if (w === '600') return 'Inter_600SemiBold';
  if (w === '700' || w === '800' || w === '900' || w === 'bold') return 'Inter_700Bold';
  return 'Inter_400Regular';
}
