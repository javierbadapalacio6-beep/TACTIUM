import type { Palette } from '@core/theme';
import type { AvailabilityStatus } from '@core/services/availability';

/** `#RRGGBB` + alfa → `rgba()`. */
export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Color de cada estado: Voy = acento, Duda = warning, No = error. */
export function statusColor(c: Palette, s: AvailabilityStatus | null): string {
  if (s === 'yes') return c.accent;
  if (s === 'maybe') return c.warning;
  if (s === 'no') return c.error;
  return c.textFaint;
}
