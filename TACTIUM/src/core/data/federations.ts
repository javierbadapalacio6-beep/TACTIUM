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
  // Ligas privadas. TODO: confirmar formato real con cada organización.
  { pattern: 'lapi', rules: { masculino: 3, femenino: 3 } },
  { pattern: 'snp',  rules: { masculino: 3, femenino: 3 } },

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
  // Ligas privadas: el capitán suele tener libertad táctica.
  { pattern: 'lapi',         required: false },
  { pattern: 'snp',          required: false },
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
