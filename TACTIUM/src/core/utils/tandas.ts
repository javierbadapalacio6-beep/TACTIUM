/**
 * Tandas: distribución de las parejas del equipo en turnos horarios
 * dentro de la jornada. Se almacena como string "N-N-N" donde cada N
 * es el número de parejas que juegan en esa tanda.
 *
 * Ejemplos para 3 parejas (federación FEP estándar):
 *   "1-1-1"  3 tandas, una pareja por tanda (formato más común amateur)
 *   "1-2"    Pista 1 juega primero, P2+P3 juegan juntas después
 *   "2-1"    P1+P2 primero, P3 después
 *   "3"      Las 3 parejas a la vez (formato Madrid Liga Amateur, ej.)
 *
 * Combinatoria: para N parejas hay 2^(N-1) composiciones posibles.
 *   N=3 →  4 combinaciones
 *   N=4 →  8 combinaciones
 *   N=5 → 16 combinaciones
 *   N=6 → 32 combinaciones (a partir de aquí es mucho — paginar en UI)
 */

/**
 * Genera TODAS las composiciones (en sentido combinatorio: tuplas
 * ordenadas de enteros positivos que suman n) de un entero positivo.
 *
 * Implementación iterativa con backtracking: cada composición se
 * construye prefijando un valor `first` (1..n) y recursando sobre
 * (n - first).
 */
export function compositionsOf(n: number): number[][] {
  if (n <= 0) return [];
  if (n === 1) return [[1]];
  const result: number[][] = [];
  for (let first = 1; first <= n; first++) {
    if (first === n) {
      result.push([n]);
    } else {
      const rest = compositionsOf(n - first);
      for (const r of rest) {
        result.push([first, ...r]);
      }
    }
  }
  return result;
}

/**
 * Misma generación pero devuelve la versión string ("N-N-N") y ordena
 * de "menos tandas" a "más tandas" — la primera opción suele ser la
 * más natural ("todos a la vez"), las últimas las más fragmentadas.
 */
export function tandasOptions(n: number): string[] {
  if (n <= 0) return [];
  return compositionsOf(n)
    .sort((a, b) => {
      // 1º: número de tandas asc (menos partes primero)
      if (a.length !== b.length) return a.length - b.length;
      // 2º: lexicográfico para estabilidad
      for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return a[i] - b[i];
      }
      return 0;
    })
    .map((parts) => parts.join('-'));
}

/**
 * Valida que un string de tandas matchee con el número total de parejas.
 * Devuelve true si el formato es "N-N-N..." y la suma === total.
 * Útil para defensive check al guardar (por si el cliente envía mal).
 */
export function isValidTandas(value: string, total: number): boolean {
  if (!value) return false;
  const parts = value.split('-').map((s) => Number(s.trim()));
  if (parts.some((p) => !Number.isInteger(p) || p < 1)) return false;
  const sum = parts.reduce((a, b) => a + b, 0);
  return sum === total;
}
