// Helpers de validación de inputs. Centralizados para que un cambio de
// regla (ej. cap de pts) se aplique en todas las pantallas.

export const PTS_MIN = 0;
// Top mundial federado está sobre los 15000-20000 pts y subiendo. 99999
// es un sanity upper-bound (5 dígitos) contra entradas absurdas (typos, OCR
// mal leído), no un cap real. Si la escala FEP cambia a futuro, sube esto
// (y el maxLength de los inputs de pts) sin tocar nada más.
export const PTS_MAX = 99999;

export const NAME_MAX_LENGTH = 64;
export const TEAM_NAME_MAX_LENGTH = 50;
export const CLUB_NAME_MAX_LENGTH = 60;
export const SEASON_NAME_MAX_LENGTH = 60;
export const OPPONENT_MAX_LENGTH = 60;
export const LOCATION_MAX_LENGTH = 80;

/**
 * Sanitiza un input de puntos FEP:
 *   - Quita caracteres no numéricos.
 *   - Limita el valor a [PTS_MIN, PTS_MAX].
 *   - Si está vacío, devuelve string vacío (NO 0) para que el placeholder
 *     se vea y el caller decida si exigirlo.
 */
export function sanitizePtsInput(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, '');
  if (!digits) return '';
  const n = Math.min(Math.max(parseInt(digits, 10) || 0, PTS_MIN), PTS_MAX);
  return String(n);
}

/**
 * Convierte el input sanitizado a número listo para DB. Devuelve `0` si
 * está vacío (default razonable para puntos).
 */
export function parsePts(raw: string): number {
  const sanitized = sanitizePtsInput(raw);
  return sanitized === '' ? 0 : Number(sanitized);
}

/**
 * Normaliza un nombre antes de enviar a DB: trim + collapse de espacios
 * múltiples + truncado a `maxLength`. Devuelve string vacío si tras trim
 * no queda nada — el caller debe rechazar antes de llamar a la API.
 */
export function normalizeName(
  raw: string,
  maxLength: number = NAME_MAX_LENGTH,
): string {
  const trimmed = raw.trim().replace(/\s+/g, ' ');
  return trimmed.slice(0, maxLength);
}

/**
 * Predicado de validez para un nombre: no vacío tras trim, al menos 2
 * caracteres. Útil para `disabled` en CTAs de guardar.
 */
export function isValidName(raw: string, minLength = 2): boolean {
  return raw.trim().length >= minLength;
}
