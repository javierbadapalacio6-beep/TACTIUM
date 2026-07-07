// Nº de partidos por jornada (= nº de parejas/pistas a alinear) según
// federación/liga/género. Portado de la app móvil (core/data/federations.ts).
// Mantener en sync con esa fuente hasta que extraigamos un paquete compartido.

export type TeamGender = "masculino" | "femenino" | "mixto";

export const DEFAULT_COURTS = 3;

const FEDERATION_RULES: Record<string, Partial<Record<TeamGender, number>>> = {
  FEP: { masculino: 5, femenino: 5 },
  FAP: { masculino: 3, femenino: 3 },
  FAraP: { masculino: 3, femenino: 3 },
  FBP: { masculino: 3, femenino: 3 },
  FCatP: { masculino: 3, femenino: 3 },
  FPCLM: { masculino: 3, femenino: 3 },
  FPCyL: { masculino: 3, femenino: 3 },
  FPCV: { masculino: 3, femenino: 3 },
  FCanP: { masculino: 5, femenino: 5 },
  FGP: { masculino: 5, femenino: 5 },
  FMP: { masculino: 5, femenino: 5 },
  FCantP: { masculino: 5, femenino: 4 },
  FMurP: { masculino: 5, femenino: 3 },
  FPPA: { masculino: 4, femenino: 4 },
  FExP: { masculino: 3, femenino: 3 },
  FNP: { masculino: 5, femenino: 5 },
  EPF: { masculino: 3, femenino: 3 },
  FRP: { masculino: 3, femenino: 3 },
  FPCe: { masculino: 3, femenino: 3 },
  FPMe: { masculino: 3, femenino: 3 },
};

const LEAGUE_RULES: { pattern: string; rules: Partial<Record<TeamGender, number>> }[] = [
  { pattern: "lapi", rules: { masculino: 3, femenino: 3 } },
  { pattern: "snp", rules: { masculino: 3, femenino: 3 } },
  { pattern: "campeonato extremeño", rules: { masculino: 5, femenino: 3 } },
  { pattern: "campeonato fexpadel", rules: { masculino: 5, femenino: 3 } },
  { pattern: "liga foral", rules: { masculino: 2, femenino: 2 } },
  { pattern: "comunidad foral", rules: { masculino: 2, femenino: 2 } },
  { pattern: "bizkaia", rules: { masculino: 5, femenino: 3 } },
  { pattern: "vizcaya", rules: { masculino: 5, femenino: 3 } },
  { pattern: "gipuzkoa", rules: { masculino: 3, femenino: 3 } },
  { pattern: "guipuzcoa", rules: { masculino: 3, femenino: 3 } },
  { pattern: "araba", rules: { masculino: 3, femenino: 3 } },
  { pattern: "alava", rules: { masculino: 3, femenino: 3 } },
];

export function getCourtsForCompetition(
  federationCode: string | null | undefined,
  leagueName: string | null | undefined,
  gender: TeamGender | null | undefined,
): number {
  const g = gender ?? "masculino";
  if (leagueName) {
    const ln = leagueName.toLowerCase();
    for (const rule of LEAGUE_RULES) {
      if (ln.includes(rule.pattern)) {
        const v = rule.rules[g];
        if (typeof v === "number") return v;
      }
    }
  }
  if (federationCode) {
    const v = FEDERATION_RULES[federationCode]?.[g];
    if (typeof v === "number") return v;
  }
  return DEFAULT_COURTS;
}
