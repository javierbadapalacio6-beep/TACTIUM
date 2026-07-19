import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useThemeStore } from '@store/themeStore';
import { darkColors, lightColors, type Palette } from './colors';
import { makeTypography } from './typography';

/** Esquema efectivo tras resolver el modo 'system' contra el del iPhone. */
export function useResolvedScheme(): 'light' | 'dark' {
  const mode = useThemeStore((s) => s.mode);
  const system = useColorScheme(); // 'light' | 'dark' | null
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

/** Paleta activa. Úsala en pantallas migradas al tema dinámico:
 *    const c = useColors();
 *    const styles = useMemo(() => makeStyles(c), [c]);
 */
export function useColors(): Palette {
  return useResolvedScheme() === 'light' ? lightColors : darkColors;
}

export function useIsDark(): boolean {
  return useResolvedScheme() === 'dark';
}

/** Escala tipográfica del tema activo (colores ligados a la paleta). */
export function useTypography() {
  const c = useColors();
  return useMemo(() => makeTypography(c), [c]);
}
