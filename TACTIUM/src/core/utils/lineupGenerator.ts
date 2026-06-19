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

export interface GenerateOptions {
  /** Química por historial. Si se pasa, se prioriza mantener parejas ganadoras. */
  stats?: PairStatsMap;
  /** Emparejar respetando Drive+Revés. false = emparejar solo por nivel. */
  usePosition?: boolean;
  /** true (def): la pareja más fuerte a la pista 1 (pirámide). */
  strongestOnCourt1?: boolean;
  /**
   * Cómo se forman las parejas:
   *   'strong'  (def) · fuerte-con-fuerte: los dos de más puntos juntos.
   *   'balanced'      · fuerte+flojo: cada fuerte arrastra a uno de menos
   *                     puntos (el mejor con el peor, 2º mejor con 2º peor…),
   *                     siempre respetando posición si usePosition.
   */
  pairing?: 'strong' | 'balanced';
}

interface ChosenPair {
  a: Player;
  b: Player;
  tier: number;
}

/**
 * Emparejado FUERTE-CON-FUERTE (greedy): coge la mejor pareja disponible por
 * tier de posición → química → puntos combinados, sin solapar jugadores.
 */
function selectStrong(
  avail: Player[],
  courts: number,
  usePosition: boolean,
  stats: PairStatsMap | undefined,
): ChosenPair[] {
  const candidates: Candidate[] = [];
  for (let i = 0; i < avail.length; i++) {
    for (let j = i + 1; j < avail.length; j++) {
      const a = avail[i];
      const b = avail[j];
      candidates.push({
        a,
        b,
        tier: usePosition ? positionTier(a, b) : 1,
        chem: chemistryBonus(a.id, b.id, stats),
        pts: a.pts + b.pts,
      });
    }
  }
  candidates.sort((x, y) => {
    if (x.tier !== y.tier) return y.tier - x.tier;
    if (x.chem !== y.chem) return y.chem - x.chem;
    return y.pts - x.pts;
  });

  const used = new Set<string>();
  const chosen: ChosenPair[] = [];
  for (const c of candidates) {
    if (chosen.length >= courts) break;
    if (used.has(c.a.id) || used.has(c.b.id)) continue;
    used.add(c.a.id);
    used.add(c.b.id);
    chosen.push({ a: c.a, b: c.b, tier: c.tier });
  }
  return chosen;
}

/**
 * Emparejado EQUILIBRADO (fuerte+flojo): coge al jugador más fuerte sin
 * emparejar y lo junta con el compañero compatible MÁS FLOJO (mejor tier de
 * posición → menos puntos → química). Repite. Así cada pareja lleva un fuerte
 * arrastrando a uno de menos nivel y las pistas quedan más igualadas.
 */
function selectBalanced(
  avail: Player[],
  courts: number,
  usePosition: boolean,
  stats: PairStatsMap | undefined,
): ChosenPair[] {
  const pool = [...avail].sort((x, y) => y.pts - x.pts); // fuerte primero
  const used = new Set<string>();
  const chosen: ChosenPair[] = [];

  while (chosen.length < courts) {
    const strong = pool.find((p) => !used.has(p.id));
    if (!strong) break;

    let best: { cand: Player; tier: number; chem: number } | null = null;
    for (const cand of pool) {
      if (cand.id === strong.id || used.has(cand.id)) continue;
      const tier = usePosition ? positionTier(strong, cand) : 1;
      const chem = chemistryBonus(strong.id, cand.id, stats);
      if (!best) {
        best = { cand, tier, chem };
        continue;
      }
      if (tier !== best.tier) {
        if (tier > best.tier) best = { cand, tier, chem };
        continue;
      }
      if (cand.pts !== best.cand.pts) {
        if (cand.pts < best.cand.pts) best = { cand, tier, chem }; // el más flojo
        continue;
      }
      if (chem > best.chem) best = { cand, tier, chem };
    }
    if (!best) break; // queda un impar sin compañero → al banquillo

    used.add(strong.id);
    used.add(best.cand.id);
    chosen.push({ a: strong, b: best.cand, tier: best.tier });
  }
  return chosen;
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
  options: GenerateOptions = {},
): GenerateResult {
  const {
    stats,
    usePosition = true,
    strongestOnCourt1 = true,
    pairing = 'strong',
  } = options;
  const warnings: string[] = [];
  const avail = players.filter((p) => p.available && p.active);

  // Selección de parejas según el modo (n pequeño: plantillas amateur < ~20).
  const chosen =
    pairing === 'balanced'
      ? selectBalanced(avail, courts, usePosition, stats)
      : selectStrong(avail, courts, usePosition, stats);

  const used = new Set<string>();
  chosen.forEach((c) => {
    used.add(c.a.id);
    used.add(c.b.id);
  });

  // Pirámide: parejas de más a menos puntos → pista 1..N. Si el usuario
  // prefiere la pareja fuerte abajo, invertimos el orden de pistas.
  chosen.sort((p, q) => q.a.pts + q.b.pts - (p.a.pts + p.b.pts));
  if (!strongestOnCourt1) chosen.reverse();

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

/** Una alternativa de alineación lista para previsualizar y aplicar. */
export interface LineupOption {
  /** id estable de la estrategia. */
  key: string;
  /** nombre corto para la tarjeta (p.ej. "Pirámide"). */
  label: string;
  /** descripción de una línea. */
  hint: string;
  result: GenerateResult;
  /**
   * true si el orden de pistas es por puntos descendente (compatible con el
   * Auto-orden de la pantalla). false → el orden es intencional (sacrificio /
   * equilibrada abajo) y NO debe re-piramidarse al editar.
   */
  pyramidOrder: boolean;
}

/** Firma del orden de pistas+parejas, para deduplicar alternativas iguales. */
function slotsSignature(r: GenerateResult): string {
  return r.slots
    .map((s) => `${s.court}:${s.playerAId ?? '-'}+${s.playerBId ?? '-'}`)
    .join('|');
}

/**
 * Genera VARIAS alternativas de alineación para que el capitán elija (con
 * preview, sin confirmar nada). Cada estrategia es una forma distinta de
 * emparejar y/o ordenar; se deduplican las que salen idénticas (común en
 * plantillas pequeñas o muy homogéneas).
 *
 * IMPORTANTE — orden obligatorio (`mustOrder`): en muchas federaciones las
 * parejas DEBEN ir ordenadas por puntos (la de más suma en la pista 1). Ahí
 * una pareja fuerte JAMÁS puede ir abajo, así que NO se ofrecen las estrategias
 * que rompen ese orden (Sacrificio / Equilibrada ↓). La forma LEGAL de que un
 * jugador top no caiga en las primeras parejas es emparejarlo con uno flojo:
 * la suma de la pareja baja y el orden por puntos la coloca sola más abajo
 * (eso es justo lo que hace "Equilibrada").
 *
 *  · Pirámide      — fuerte-con-fuerte, las mejores parejas arriba.
 *  · Equilibrada   — fuerte+flojo en cada pareja; el orden por puntos baja a
 *                    los top sin romper la pirámide (legal con orden obligatorio).
 *  · Química       — (solo si hay historial) prioriza parejas que más ganan.
 *  · Sacrificio    — (solo SIN orden obligatorio) fuertes en las últimas pistas.
 *  · Equilibrada ↓ — (solo SIN orden obligatorio) fuerte+flojo, top abajo.
 */
export function generateLineupOptions(
  players: Player[],
  courts: number,
  opts: { stats?: PairStatsMap; usePosition?: boolean; mustOrder?: boolean } = {},
): LineupOption[] {
  const { stats, usePosition = true, mustOrder = false } = opts;
  const base = { usePosition };

  const raw: LineupOption[] = [
    {
      key: 'piramide',
      label: 'Pirámide',
      hint: 'Las parejas más fuertes en las primeras pistas',
      pyramidOrder: true,
      result: generateLineup(players, courts, {
        ...base,
        pairing: 'strong',
        strongestOnCourt1: true,
      }),
    },
    {
      key: 'equilibrada',
      label: 'Equilibrada',
      hint: mustOrder
        ? 'Empareja a los de más puntos con los de menos: el top baja de pista sin romper el orden'
        : 'Cada pareja: uno de más puntos y otro de menos',
      // Ordena por puntos de pareja descendente → compatible con el orden
      // obligatorio (y con el Auto-orden de la pantalla).
      pyramidOrder: true,
      result: generateLineup(players, courts, {
        ...base,
        pairing: 'balanced',
        strongestOnCourt1: true,
      }),
    },
  ];

  if (stats && stats.size > 0) {
    raw.push({
      key: 'quimica',
      label: 'Química',
      hint: 'Prioriza las parejas que más ganan juntas',
      pyramidOrder: true,
      result: generateLineup(players, courts, {
        ...base,
        pairing: 'strong',
        strongestOnCourt1: true,
        stats,
      }),
    });
  }

  // Estrategias que rompen el orden por puntos: SOLO cuando la federación no
  // exige orden (si no, serían ilegales y no se muestran).
  if (!mustOrder) {
    raw.push(
      {
        key: 'sacrificio',
        label: 'Sacrificio',
        hint: 'Las parejas más fuertes en las últimas pistas',
        pyramidOrder: false,
        result: generateLineup(players, courts, {
          ...base,
          pairing: 'strong',
          strongestOnCourt1: false,
        }),
      },
      {
        key: 'equilibrada-abajo',
        label: 'Equilibrada ↓',
        hint: 'Empareja más y menos puntos; las parejas fuertes en las últimas pistas',
        pyramidOrder: false,
        result: generateLineup(players, courts, {
          ...base,
          pairing: 'balanced',
          strongestOnCourt1: false,
        }),
      },
    );
  }

  // Deduplica alternativas que salen idénticas (no aportan elección real).
  const seen = new Set<string>();
  const out: LineupOption[] = [];
  for (const o of raw) {
    const sig = slotsSignature(o.result);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push(o);
  }
  return out;
}
