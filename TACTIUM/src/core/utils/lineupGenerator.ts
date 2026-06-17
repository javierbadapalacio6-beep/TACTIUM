/**
 * Generador de alineaciones consciente de la posición.
 *
 * El resto de la pantalla (Auto-orden, equilibrio, sugerencia de cambio)
 * solo mira `pts` y es CIEGA a la posición: puede emparejar dos Drive o dos
 * Revés. Este módulo cubre ese hueco — empareja respetando Drive+Revés y,
 * opcionalmente, da preferencia a parejas con buena química histórica.
 *
 * Es puro y sin dependencias de React/Supabase para poder testarse y
 * reutilizarse. La química (% de victorias juntos) entra como un mapa
 * OPCIONAL: en la Fase 1 no se pasa y el generador funciona solo con
 * posición + puntos; en la Fase 2 se le enchufa `PairStatsMap`.
 */

import type { Player } from '@store/teamStore';

export interface GeneratedSlot {
  court: number;
  playerAId: string | null;
  playerBId: string | null;
}

export interface PairStat {
  wins: number;
  played: number;
}

/** key canónica (orden-independiente) de una pareja para indexar química. */
export type PairStatsMap = Map<string, PairStat>;

export interface GenerateResult {
  slots: GeneratedSlot[];
  /** Avisos legibles para el capitán (parejas no ideales, faltan jugadores…). */
  warnings: string[];
  /** Ids de los jugadores que se quedan en el banquillo. */
  benchIds: string[];
}

/** key canónica de una pareja: ids ordenados para que {a,b} == {b,a}. */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

const isDrive = (p: Player) => p.position === 'Drive';
const isReves = (p: Player) => p.position === 'Revés';

/**
 * Tier de compatibilidad de posición de una pareja. Mayor = mejor.
 *   3 · Drive + Revés (ideal)
 *   2 · uno de ellos es Ambos (comodín)
 *   1 · Ambos + Ambos
 *   0 · misma posición fija (Drive+Drive o Revés+Revés) — solo si no queda otra
 */
function positionTier(a: Player, b: Player): number {
  const aFixed = isDrive(a) || isReves(a);
  const bFixed = isDrive(b) || isReves(b);
  if (aFixed && bFixed) {
    return a.position !== b.position ? 3 : 0;
  }
  // Al menos uno es Ambos.
  if (!aFixed && !bFixed) return 1; // Ambos + Ambos
  return 2; // fijo + Ambos
}

/**
 * Bonus de química [0..1] aproximado: cuánto "premia" mantener juntos a dos
 * jugadores según su historial. Pondera por nº de partidos jugados para no
 * fiarnos de una sola muestra (1-0 no es lo mismo que 8-2).
 */
function chemistryBonus(
  a: string,
  b: string,
  stats: PairStatsMap | undefined,
): number {
  if (!stats) return 0;
  const s = stats.get(pairKey(a, b));
  if (!s || s.played === 0) return 0;
  const winRate = s.wins / s.played;
  // Confianza: satura hacia 1 a partir de ~4 partidos juntos.
  const confidence = Math.min(1, s.played / 4);
  return winRate * confidence;
}

interface Candidate {
  a: Player;
  b: Player;
  tier: number;
  chem: number;
  pts: number;
}

/**
 * Genera una alineación completa a partir de los jugadores disponibles.
 *
 * Estrategia (greedy, explicable):
 *  1. Construye todas las parejas posibles y las puntúa con prioridad
 *     léxica: TIER de posición primero, luego química, luego puntos.
 *  2. Selecciona parejas sin solapar jugadores hasta llenar las pistas,
 *     cogiendo siempre la mejor disponible.
 *  3. Ordena las parejas resultantes por puntos combinados (pirámide) y
 *     coloca al de más puntos como jugador A — consistente con el
 *     `sortByPoints` de la pantalla.
 *
 * @param players  plantilla completa (se filtra por available && active).
 * @param courts   número de pistas a rellenar.
 * @param stats    química opcional (Fase 2).
 */
export function generateLineup(
  players: Player[],
  courts: number,
  stats?: PairStatsMap,
): GenerateResult {
  const warnings: string[] = [];
  const avail = players.filter((p) => p.available && p.active);

  // Todas las parejas candidatas (n pequeño: plantillas amateur < ~20).
  const candidates: Candidate[] = [];
  for (let i = 0; i < avail.length; i++) {
    for (let j = i + 1; j < avail.length; j++) {
      const a = avail[i];
      const b = avail[j];
      candidates.push({
        a,
        b,
        tier: positionTier(a, b),
        chem: chemistryBonus(a.id, b.id, stats),
        pts: a.pts + b.pts,
      });
    }
  }

  // Orden léxico: tier desc → química desc → puntos desc.
  candidates.sort((x, y) => {
    if (x.tier !== y.tier) return y.tier - x.tier;
    if (x.chem !== y.chem) return y.chem - x.chem;
    return y.pts - x.pts;
  });

  const used = new Set<string>();
  const chosen: { a: Player; b: Player; tier: number }[] = [];
  for (const c of candidates) {
    if (chosen.length >= courts) break;
    if (used.has(c.a.id) || used.has(c.b.id)) continue;
    used.add(c.a.id);
    used.add(c.b.id);
    chosen.push({ a: c.a, b: c.b, tier: c.tier });
  }

  // Pirámide: parejas de más a menos puntos → pista 1..N.
  chosen.sort((p, q) => q.a.pts + q.b.pts - (p.a.pts + p.b.pts));

  const slots: GeneratedSlot[] = chosen.map((pair, idx) => {
    // Jugador de más puntos como A (consistente con sortByPoints de la UI).
    const [a, b] =
      pair.a.pts >= pair.b.pts ? [pair.a, pair.b] : [pair.b, pair.a];
    if (pair.tier === 0) {
      warnings.push(
        `Pareja ${idx + 1}: dos ${a.position} (no había ${
          isDrive(a) ? 'revés' : 'drive'
        } disponible)`,
      );
    }
    return { court: idx + 1, playerAId: a.id, playerBId: b.id };
  });

  // Pistas que no se han podido llenar por falta de jugadores.
  for (let c = chosen.length; c < courts; c++) {
    slots.push({ court: c + 1, playerAId: null, playerBId: null });
  }
  if (chosen.length < courts) {
    const faltan = courts - chosen.length;
    warnings.push(
      `Faltan jugadores disponibles para ${faltan} pareja${
        faltan > 1 ? 's' : ''
      }.`,
    );
  }

  const benchIds = avail.filter((p) => !used.has(p.id)).map((p) => p.id);

  return { slots, warnings, benchIds };
}
