/**
 * Reglas de marcador de pádel compartidas por la botonera de juegos
 * (Resultados de liga y Amistosos). Puras: sin React ni Supabase.
 */

export interface SetScore {
  us: number | null;
  them: number | null;
}

export const emptySets = (n = 3): SetScore[] =>
  Array.from({ length: n }, () => ({ us: null, them: null }));

/** Un set está cerrado cuando tiene los dos lados y hay un ganador. */
export const isSetDone = (s: SetScore): boolean =>
  s.us !== null && s.them !== null && s.us !== s.them;

/**
 * ¿Es un resultado posible en pádel? 6-0…6-4, 7-5 o 7-6. Un super tie-break
 * (algún lado por encima de 7) se da por bueno si llega a 10 con 2 de ventaja.
 * Solo avisa: nunca bloquea el guardado.
 */
export function isPlausibleSet(us: number, them: number): boolean {
  const hi = Math.max(us, them);
  const lo = Math.min(us, them);
  if (hi > 7) return hi >= 10 && hi - lo >= 2 && (hi === 10 || hi - lo === 2);
  if (hi === 6) return lo <= 4;
  if (hi === 7) return lo === 5 || lo === 6;
  return false;
}

export interface MatchSummary {
  usSets: number;
  themSets: number;
  /** Alguien ha ganado 2 sets. */
  decided: boolean;
  won: boolean;
}

export function summarize(sets: SetScore[]): MatchSummary {
  let usSets = 0;
  let themSets = 0;
  for (const s of sets) {
    if (!isSetDone(s)) continue;
    if ((s.us as number) > (s.them as number)) usSets++;
    else themSets++;
  }
  return {
    usSets,
    themSets,
    decided: usSets >= 2 || themSets >= 2,
    won: usSets > themSets,
  };
}

/** Con 2-0 tras dos sets, el tercero sobra (salvo que ya tenga algo apuntado). */
export function thirdSetNeeded(sets: SetScore[]): boolean {
  const third = sets[2];
  if (third && (third.us !== null || third.them !== null)) return true;
  const [a, b] = sets;
  if (!a || !b || !isSetDone(a) || !isSetDone(b)) return true;
  const aUs = (a.us as number) > (a.them as number);
  const bUs = (b.us as number) > (b.them as number);
  return aUs !== bUs;
}

/** «6-4 6-3» desde nuestra perspectiva, solo con los sets que tienen marcador. */
export const setsLine = (sets: SetScore[]): string =>
  sets
    .filter((s) => s.us !== null && s.them !== null)
    .map((s) => `${s.us}-${s.them}`)
    .join(' ');
