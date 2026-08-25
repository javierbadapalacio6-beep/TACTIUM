// Elegibilidad por categoría (nivel/puntos). Portado 1:1 de la app
// (TACTIUM/src/core/services/tournaments.ts) y espejo de la validación de la RPC
// `tournament_signup` en el servidor. IMPORTANTE en la web: el pago online crea
// la inscripción DESPUÉS de cobrar (webhook), así que hay que bloquear aquí lo
// que el servidor rechazaría, o el usuario pagaría sin quedar inscrito.

export type CategoryRuleMode = "points" | "nivel" | "both";

export interface CategoryThreshold {
  puntos: number | null; // máximo de puntos de la pareja (suma) — null = sin tope
  nivel: number | null; // mínimo de nivel de liga de la pareja (suma) — null = sin mínimo
}

export interface CategoryRules {
  mode: CategoryRuleMode;
  // Clave: `${categoría}` (todos los géneros) o `${género}|${categoría}` cuando
  // el club fija umbrales distintos por género. Se resuelve con fallback.
  byCategory: Record<string, CategoryThreshold | null>;
}

/** Umbral de una categoría según el género (fallback: género|cat → cat). */
export function resolveCategoryThreshold(
  rules: CategoryRules | null | undefined,
  category: string | null,
  gender: string | null,
): CategoryThreshold | null {
  if (!rules || !category) return null;
  const bc = rules.byCategory ?? {};
  const byGender = gender ? bc[`${gender}|${category}`] : undefined;
  return (byGender !== undefined ? byGender : bc[category]) ?? null;
}

/**
 * Valida si una pareja puede jugar una categoría. Devuelve `null` si es apta, o
 * un mensaje de error si no cumple. Misma lógica que la RPC `tournament_signup`.
 */
export function checkCategoryEligibility(
  rules: CategoryRules | null | undefined,
  category: string | null,
  gender: string | null,
  pairPoints: number | null,
  pairNivel: number | null,
): string | null {
  if (!rules || !category) return null;
  const t = resolveCategoryThreshold(rules, category, gender);
  if (!t) return null; // LIBRE / sin regla
  const checkPts = rules.mode === "points" || rules.mode === "both";
  const checkNiv = rules.mode === "nivel" || rules.mode === "both";
  if (checkPts && t.puntos != null) {
    if (pairPoints == null)
      return `Indica los puntos de la pareja para la categoría ${category}.`;
    if (pairPoints > t.puntos)
      return `Superáis el máximo de ${t.puntos} puntos de ${category} (sumáis ${pairPoints}).`;
  }
  if (checkNiv && t.nivel != null) {
    if (pairNivel == null)
      return `Indica el nivel de liga de cada jugador para la categoría ${category}.`;
    if (pairNivel < t.nivel)
      return `Necesitáis nivel de liga ≥ ${t.nivel} en ${category} (sumáis ${pairNivel}).`;
  }
  return null;
}
