/**
 * Pistas por competición — COPIA de TACTIUM/src/core/data/federations.ts
 * (getCourtsForCompetition y sus reglas). Si cambia allí, cambiar aquí: la
 * web y la app tienen que decir lo mismo («Necesitas 6 para 3 pistas»).
 */
export type TeamGender = 'masculino' | 'femenino' | 'mixto';

// Default cuando ni la liga ni la federación tienen regla específica.
// 3 partidos por jornada es el formato dominante en España (Cataluña,
// Andalucía, Valencia, CyL, CLM, Aragón, Baleares, Gipuzkoa, etc.).
export const DEFAULT_COURTS = 3;

// Formato personalizado en el nombre de liga: «… · 4 partidos · …».
const CUSTOM_COURTS_RE = /(\d)\s*partido/i;

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
