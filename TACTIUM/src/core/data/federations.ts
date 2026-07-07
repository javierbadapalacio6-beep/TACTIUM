// Federaciones autonómicas de pádel de España (incluye FEP a nivel nacional).
// Fuente: federaciones afiliadas a la Federación Española de Pádel (FEP).
export interface Federation {
  code: string;
  name: string;
  shortName: string;
  region: string;
}

export type TeamGender = 'masculino' | 'femenino' | 'mixto';

// Default cuando ni la liga ni la federación tienen regla específica.
// 3 partidos por jornada es el formato dominante en España (Cataluña,
// Andalucía, Valencia, CyL, CLM, Aragón, Baleares, Gipuzkoa, etc.).
export const DEFAULT_COURTS = 3;

// Reglas por federación. Devuelven nº de partidos por jornada (= nº de
// parejas a alinear) según el género del equipo. Reflejan el formato más
// frecuente de la liga regular autonómica. Si una federación maneja varios
// formatos (Extremadura, Navarra, País Vasco), aquí se elige el "default" y
// los formatos alternativos viven en LEAGUE_RULES.
const FEDERATION_RULES: Record<string, Partial<Record<TeamGender, number>>> = {
  // Nacional — referencia normativa FEP
  FEP:    { masculino: 5, femenino: 5 },

  // Modelo dominante 3 partidos
  FAP:    { masculino: 3, femenino: 3 },
  FAraP:  { masculino: 3, femenino: 3 },
  FBP:    { masculino: 3, femenino: 3 },
  FCatP:  { masculino: 3, femenino: 3 },
  FPCLM:  { masculino: 3, femenino: 3 },
  FPCyL:  { masculino: 3, femenino: 3 },
  FPCV:   { masculino: 3, femenino: 3 },

  // Modelo 5 partidos
  FCanP:  { masculino: 5, femenino: 5 },
  FGP:    { masculino: 5, femenino: 5 },
  FMP:    { masculino: 5, femenino: 5 },

  // Modelos asimétricos / híbridos
  FCantP: { masculino: 5, femenino: 4 }, // 5 M, 4 F
  FMurP:  { masculino: 5, femenino: 3 }, // 5 M, 3 F (Normativa Técnica histórica)
  FPPA:   { masculino: 4, femenino: 4 }, // Asturias estrenó formato 4 en 2025

  // Default federativo, override esperado por liga
  FExP:   { masculino: 3, femenino: 3 }, // Liga MBK domina; Cto. concentrado vía LEAGUE_RULES
  FNP:    { masculino: 5, femenino: 5 }, // Cto. Reyno; Liga Foral vía LEAGUE_RULES
  EPF:    { masculino: 3, femenino: 3 }, // Conservador; Bizkaia/Gipuzkoa/Araba vía LEAGUE_RULES

  // Sin liga por equipos en 2026 — fallback al default
  FRP:    { masculino: 3, femenino: 3 },

  // Sin datos públicos — fallback al default dominante
  FPCe:   { masculino: 3, femenino: 3 },
  FPMe:   { masculino: 3, femenino: 3 },
};

// Override por nombre de liga. Permite distinguir formatos dentro de una
// misma federación (Cto. Reyno vs Liga Foral, Liga MBK vs Cto. extremeño,
// Bizkaia vs Gipuzkoa vs Araba dentro de EPF) y soportar ligas privadas
// que no dependen de federación (LAPI, SNP, etc.).
//
// El match es case-insensitive por substring sobre `team.league`. El primer
// patrón que matchea gana, así que el orden importa: poner los más
// específicos antes que los genéricos.
interface LeagueRule {
  pattern: string;
  rules: Partial<Record<TeamGender, number>>;
}

const LEAGUE_RULES: LeagueRule[] = [
  // Ligas privadas — verificado contra normativas oficiales 2025-26 (jul 2026).
  // ¡ORDEN CRÍTICO!: 'qsnp' y 'snp seniors' contienen 'snp', deben ir antes.
  //
  // LAPI: 3 partidos por enfrentamiento (Normativa España 2025-26).
  { pattern: 'lapi', rules: { masculino: 3, femenino: 3, mixto: 3 } },
  // QSNP (QSeries): liga de PAREJAS — 1 único partido por enfrentamiento.
  { pattern: 'qsnp',    rules: { masculino: 1, femenino: 1, mixto: 1 } },
  { pattern: 'qseries', rules: { masculino: 1, femenino: 1, mixto: 1 } },
  // SNP Seniors: 3 partidos, 6 jugadores (+40 años; pareja debe sumar ≥90).
  { pattern: 'snp seniors', rules: { masculino: 3, femenino: 3, mixto: 3 } },
  { pattern: 'seniors',     rules: { masculino: 3, femenino: 3, mixto: 3 } },
  // SNP: 5 partidos, 10 jugadores por eliminatoria (Normativa XII, epígrafe 15).
  { pattern: 'snp',  rules: { masculino: 5, femenino: 5, mixto: 5 } },

  // Extremadura — campeonatos oficiales concentrados (5M/3F)
  { pattern: 'campeonato extremeño',  rules: { masculino: 5, femenino: 3 } },
  { pattern: 'campeonato fexpadel',   rules: { masculino: 5, femenino: 3 } },

  // Navarra — Liga Foral por zonas territoriales (2 partidos)
  { pattern: 'liga foral',     rules: { masculino: 2, femenino: 2 } },
  { pattern: 'comunidad foral',rules: { masculino: 2, femenino: 2 } },

  // País Vasco — territorios históricos
  // Bizkaia: 5 partidos en categorías altas (1ª-5ª M), 3 en bajas y todas F.
  // Sin awareness de categoría, asumimos categoría alta para masculino.
  { pattern: 'bizkaia',  rules: { masculino: 5, femenino: 3 } },
  { pattern: 'vizcaya',  rules: { masculino: 5, femenino: 3 } },
  { pattern: 'gipuzkoa', rules: { masculino: 3, femenino: 3 } },
  { pattern: 'guipuzcoa',rules: { masculino: 3, femenino: 3 } },
  { pattern: 'araba',    rules: { masculino: 3, femenino: 3 } },
  { pattern: 'alava',    rules: { masculino: 3, femenino: 3 } },
];

/**
 * Devuelve el nº de partidos por jornada (= nº de parejas a alinear) para
 * un equipo según su federación, liga y género. Prioridad de resolución:
 *
 *   1. LEAGUE_RULES (override por nombre de liga, incluye ligas privadas
 *      como LAPI/SNP y sub-formatos territoriales como Bizkaia/Liga Foral).
 *   2. FEDERATION_RULES (default federativo por género).
 *   3. DEFAULT_COURTS (3, formato dominante).
 *
 * El nombre `getCourtsForCompetition` se mantiene por estabilidad de API,
 * aunque conceptualmente representa "partidos por jornada".
 */
export function getCourtsForCompetition(
  federationCode: string | null | undefined,
  leagueName: string | null | undefined,
  gender: TeamGender | null | undefined,
): number {
  const g = gender ?? 'masculino';

  if (leagueName) {
    const ln = leagueName.toLowerCase();

    // Formato personalizado embebido en el nombre de liga (p. ej.
    // "Liga de mi club · 4 partidos · sin orden"). Lo explícito gana
    // a cualquier patrón de liga conocida.
    const custom = ln.match(CUSTOM_COURTS_RE);
    if (custom) {
      const n = parseInt(custom[1], 10);
      if (n >= 1 && n <= 6) return n;
    }

    for (const rule of LEAGUE_RULES) {
      if (ln.includes(rule.pattern)) {
        const v = rule.rules[g];
        if (typeof v === 'number') return v;
      }
    }
  }

  if (federationCode) {
    const v = FEDERATION_RULES[federationCode]?.[g];
    if (typeof v === 'number') return v;
  }

  return DEFAULT_COURTS;
}

// ─── Orden por fuerza de pareja ────────────────────────────────────────
// Reglas de algunas federaciones (FEP standard, Madrid, Galicia, Canarias…):
// la pareja 1 debe sumar más o igual puntos combinados que la 2, ésta más
// o igual que la 3, etc. Otras (ligas privadas, comerciales) no validan.
//
// Default: TRUE (alineado con la Normativa Técnica FEP).
// Override por liga cuando se sabe que NO se exige.

const STRENGTH_ORDER_BY_FEDERATION: Record<string, boolean> = {
  // Vacío de momento: todas las federaciones autonómicas heredan el default
  // (true) porque siguen la normativa FEP. Si en el futuro alguna explicita
  // que NO valida, se añade aquí con `false`.
};

interface LeagueStrengthRule {
  pattern: string;
  required: boolean;
}

const STRENGTH_ORDER_BY_LEAGUE: LeagueStrengthRule[] = [
  // Verificado contra normativas 2025-26. ¡ORDEN CRÍTICO!: patrones que
  // contienen 'snp' van antes que 'snp'.
  { pattern: 'lapi',         required: false },
  // QSNP: 1 solo partido → orden irrelevante.
  { pattern: 'qsnp',         required: false },
  { pattern: 'qseries',      required: false },
  // SNP y SNP Seniors: el sistema oficial ordena las parejas AUTOMÁTICAMENTE
  // por suma de puntos ranking SNP (pareja 1 = mayor suma; el capitán no
  // puede alterarlo, solo reordenar bloques empatados). Nuestra validación
  // P1 ≥ P2 ≥ … por puntos combinados replica exactamente esa semántica,
  // usando los pts del equipo como proxy del ranking SNP.
  { pattern: 'snp',          required: true },
  { pattern: 'myburgerking', required: false },
  { pattern: 'popeyes',      required: false },
];

/**
 * Indica si la competición exige que las parejas se alineen en orden
 * estricto descendente de puntos combinados (P1 ≥ P2 ≥ P3 …).
 * Resolución: liga > federación > default(true).
 */
export function requiresStrengthOrder(
  federationCode: string | null | undefined,
  leagueName: string | null | undefined,
  _gender: TeamGender | null | undefined,
): boolean {
  if (leagueName) {
    const ln = leagueName.toLowerCase();

    // Formato personalizado embebido en el nombre de liga: lo explícito
    // ("sin orden" / "con orden") gana a cualquier patrón conocido.
    if (CUSTOM_NO_ORDER_RE.test(ln)) return false;
    if (CUSTOM_WITH_ORDER_RE.test(ln)) return true;

    for (const rule of STRENGTH_ORDER_BY_LEAGUE) {
      if (ln.includes(rule.pattern)) return rule.required;
    }
  }
  if (federationCode && federationCode in STRENGTH_ORDER_BY_FEDERATION) {
    return STRENGTH_ORDER_BY_FEDERATION[federationCode];
  }
  return true;
}

// Listado mostrado al usuario al crear equipo/club. No incluye la FEP
// nacional porque las ligas oficiales se juegan bajo la federación
// autonómica; FEP sigue existiendo en `FEDERATION_RULES` como referencia
// normativa default si alguna pantalla lo necesita.
export const FEDERATIONS: Federation[] = [
  { code: 'FAP',   name: 'Federación Andaluza de Pádel',                    shortName: 'FAP',   region: 'Andalucía' },
  { code: 'FAraP', name: 'Federación Aragonesa de Pádel',                   shortName: 'FAraP', region: 'Aragón' },
  { code: 'FPPA',  name: 'Federación de Pádel del Principado de Asturias',  shortName: 'FPPA',  region: 'Asturias' },
  { code: 'FBP',   name: 'Federació Balear de Pàdel',                       shortName: 'FBP',   region: 'Illes Balears' },
  { code: 'FCanP', name: 'Federación Canaria de Pádel',                     shortName: 'FCanP', region: 'Canarias' },
  { code: 'FCantP',name: 'Federación Cántabra de Pádel',                    shortName: 'FCantP',region: 'Cantabria' },
  { code: 'FPCLM', name: 'Federación de Pádel de Castilla-La Mancha',       shortName: 'FPCLM', region: 'Castilla-La Mancha' },
  { code: 'FPCyL', name: 'Federación de Pádel de Castilla y León',          shortName: 'FPCyL', region: 'Castilla y León' },
  { code: 'FCatP', name: 'Federació Catalana de Pàdel',                     shortName: 'FCatP', region: 'Cataluña' },
  { code: 'FExP',  name: 'Federación Extremeña de Pádel',                   shortName: 'FExP',  region: 'Extremadura' },
  { code: 'FGP',   name: 'Federación Galega de Pádel',                      shortName: 'FGP',   region: 'Galicia' },
  { code: 'FMP',   name: 'Federación Madrileña de Pádel',                   shortName: 'FMP',   region: 'Comunidad de Madrid' },
  { code: 'FMurP', name: 'Federación de Pádel de la Región de Murcia',      shortName: 'FMurP', region: 'Región de Murcia' },
  { code: 'FNP',   name: 'Federación Navarra de Pádel',                     shortName: 'FNP',   region: 'Navarra' },
  { code: 'EPF',   name: 'Euskadiko Pádel Federazioa',                      shortName: 'EPF',   region: 'País Vasco' },
  { code: 'FRP',   name: 'Federación Riojana de Pádel',                     shortName: 'FRP',   region: 'La Rioja' },
  { code: 'FPCV',  name: 'Federació de Pàdel de la Comunitat Valenciana',   shortName: 'FPCV',  region: 'Comunitat Valenciana' },
  { code: 'FPCe',  name: 'Federación de Pádel de Ceuta',                    shortName: 'FPCe',  region: 'Ceuta' },
  { code: 'FPMe',  name: 'Federación de Pádel de Melilla',                  shortName: 'FPMe',  region: 'Melilla' },
];

// ─── Tipos de competición (selector de creación de equipo) ──────────────
// Client-side sobre el esquema actual: cada preset escribe un valor
// canónico en `team.league` que los motores de arriba ya saben interpretar.
// La plantilla personalizada embebe su formato en el propio nombre de liga
// ("Mi liga · 4 partidos · sin orden") — legible para el usuario y parseable
// por CUSTOM_COURTS_RE / CUSTOM_NO_ORDER_RE sin necesidad de migración.

const CUSTOM_COURTS_RE = /(\d)\s*partido/i;
const CUSTOM_NO_ORDER_RE = /sin\s+orden/i;
const CUSTOM_WITH_ORDER_RE = /con\s+orden/i;

export type CompetitionKind =
  | 'federada'
  | 'snp'
  | 'snp_seniors'
  | 'lapi'
  | 'personalizada';

export interface CompetitionPreset {
  id: CompetitionKind;
  label: string;
  /** Valor canónico para team.league; null = lo define el usuario. */
  leagueValue: string | null;
  needsFederation: boolean;
  /** Resumen corto del formato para selector y preview. */
  blurb: string;
}

// Formatos verificados contra normativas oficiales 2025-26
// (ver docs/formatos-snp-verificados.md).
export const COMPETITION_PRESETS: CompetitionPreset[] = [
  {
    id: 'federada',
    label: 'Federada',
    leagueValue: null,
    needsFederation: true,
    blurb: 'Liga oficial de tu federación autonómica',
  },
  {
    id: 'snp',
    label: 'SNP',
    leagueValue: 'SNP',
    needsFederation: false,
    blurb: '5 partidos · orden automático por puntos',
  },
  {
    id: 'snp_seniors',
    label: 'SNP Seniors',
    leagueValue: 'SNP Seniors',
    needsFederation: false,
    blurb: '3 partidos · +40 años',
  },
  {
    id: 'lapi',
    label: 'LAPI',
    leagueValue: 'LAPI',
    needsFederation: false,
    blurb: '3 partidos · cruces por sorteo',
  },
  {
    id: 'personalizada',
    label: 'Otra liga',
    leagueValue: null,
    needsFederation: false,
    blurb: 'Interempresas, liga de club… tú defines el formato',
  },
];

export function getCompetitionPreset(id: CompetitionKind): CompetitionPreset {
  return COMPETITION_PRESETS.find((p) => p.id === id) ?? COMPETITION_PRESETS[0];
}

/**
 * Compone el valor de team.league para la plantilla personalizada.
 * El formato queda embebido de forma legible y parseable:
 * "Liga interempresas · 4 partidos · sin orden".
 */
export function composeCustomLeague(
  name: string,
  courts: number,
  strengthOrder: boolean,
): string {
  const base = name.trim() || 'Liga propia';
  const orden = strengthOrder ? 'con orden' : 'sin orden';
  return `${base} · ${courts} partidos · ${orden}`;
}

/**
 * Resumen del formato efectivo ("5 partidos · orden de fuerza") para
 * previews. Única fuente de verdad: los mismos motores que usa la alineación.
 */
export function describeCompetitionFormat(
  federationCode: string | null | undefined,
  leagueName: string | null | undefined,
  gender: TeamGender | null | undefined,
): string {
  const courts = getCourtsForCompetition(federationCode, leagueName, gender);
  const order = requiresStrengthOrder(federationCode, leagueName, gender);
  return `${courts} ${courts === 1 ? 'partido' : 'partidos'} · ${
    order ? 'orden de fuerza' : 'sin orden de fuerza'
  }`;
}
