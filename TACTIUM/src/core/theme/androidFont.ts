import { Platform } from 'react-native';

/**
 * Fuente de la app en ANDROID. iPhone usa San Francisco y Android, por defecto, Roboto (o la del fabricante: MiSans,
 * One UI…), más ancha y con otras métricas: los mismos estilos salen más apretados, con más «…» y con otro peso.
 * Con Inter en Android el texto se parece al de iPhone en ancho y claridad. En Android cada peso es una fuente
 * distinta, así que se cargan los cuatro que usa la app y `interFamilyFor` traduce `fontWeight` → familia.
 *
 * Las fuentes se cargan en tiempo de ejecución, así que llegan por OTA. `expo-font` y las fuentes se piden con
 * `require` protegido: si un binario no trajera el módulo nativo, la app sigue con la fuente del sistema en vez de
 * caerse al arrancar (misma precaución que view-shot y expo-sharing).
 */
export const USE_INTER = Platform.OS === 'android';

type UseFonts = (map: Record<string, unknown>) => [boolean, Error | null];
let useFontsImpl: UseFonts | null = null;
let fontMap: Record<string, unknown> | null = null;
if (USE_INTER) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    useFontsImpl = (require('expo-font') as { useFonts: UseFonts }).useFonts;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const inter = require('@expo-google-fonts/inter') as Record<string, unknown>;
    fontMap = {
      Inter_400Regular: inter.Inter_400Regular,
      Inter_500Medium: inter.Inter_500Medium,
      Inter_600SemiBold: inter.Inter_600SemiBold,
      Inter_700Bold: inter.Inter_700Bold,
    };
  } catch {
    useFontsImpl = null;
    fontMap = null;
  }
}

let ready = false;

/** Carga Inter. En iOS (o si el módulo no está) no hace nada y devuelve true. */
export function useInterFont(): boolean {
  // La decisión es la misma en cada render (depende solo del módulo), así que no cambia el orden de los hooks.
  if (!USE_INTER || !useFontsImpl || !fontMap) return true;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [loaded, error] = useFontsImpl(fontMap);
  if (loaded) ready = true;
  return loaded || !!error;
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
