/**
 * Devuelve true si la fecha/hora actual es >= la fecha/hora programada
 * del partido. Si el matchday no tiene fecha programada, devuelve false
 * (no permitimos resultados sin fecha conocida).
 */
export function isMatchStarted(
  md: { match_date: string | null; match_time: string | null },
  now: Date = new Date(),
): boolean {
  if (!md.match_date) return false;
  // match_date es ISO 'YYYY-MM-DD'. match_time es 'HH:MM:SS' o null.
  // Sin hora fijada, asumimos 00:00 (toda la jornada del día queda permitida).
  const time = md.match_time ?? '00:00:00';
  const datetime = new Date(`${md.match_date}T${time}`);
  if (Number.isNaN(datetime.getTime())) return false;
  return now.getTime() >= datetime.getTime();
}

/**
 * Solo se pueden editar resultados si el partido ha empezado y el acta
 * no ha sido cerrada todavía.
 */
export function canEnterResults(
  md: {
    match_date: string | null;
    match_time: string | null;
    status: 'upcoming' | 'in_progress' | 'finished';
  },
  now: Date = new Date(),
): boolean {
  return md.status !== 'finished' && isMatchStarted(md, now);
}

/**
 * Estado visual de una jornada para listas y badges:
 *  - 'played'        → ya tiene outcome (V/E/D registrado, acta cerrada)
 *  - 'pending-acta'  → fecha del partido en pasado, pero sin outcome todavía
 *                     (típico al meter jornadas retroactivas)
 *  - 'upcoming'      → fecha futura o sin fecha → "próxima"
 */
export type MatchdayVisualState = 'played' | 'pending-acta' | 'upcoming';

export function matchdayState(
  md: {
    match_date: string | null;
    match_time: string | null;
    outcome: 'win' | 'draw' | 'loss' | null;
  },
  now: Date = new Date(),
): MatchdayVisualState {
  if (md.outcome !== null) return 'played';
  return isMatchStarted(md, now) ? 'pending-acta' : 'upcoming';
}

/**
 * Devuelve el marcador del set en orden físico Local-Visitante
 * (como se ve en un acta o en un periódico).
 *
 * En BD `us`/`them` son siempre nuestro equipo / rival, independientemente
 * de dónde se juegue. Para mostrarlo como marcador "L-V" mapeamos:
 *   is_home=true  → izquierda=us,   derecha=them
 *   is_home=false → izquierda=them, derecha=us
 *
 * Si alguno de los dos valores no está, usa el placeholder (default "·").
 */
export function formatSetScore(
  us: number | null,
  them: number | null,
  isHome: boolean,
  placeholder = '·',
): string {
  const usStr = us !== null ? String(us) : placeholder;
  const themStr = them !== null ? String(them) : placeholder;
  return isHome ? `${usStr}-${themStr}` : `${themStr}-${usStr}`;
}
