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

// ─── Liga Cántabra (normativa VII.3 y XI.3.1) ────────────────────────────────
// Masculino: 5 parejas, como mucho 3 tandas, entrada 5-4-1-2-3. Femenino: 4 parejas, como mucho 2 tandas, entrada
// 4-3-1-2. «3-2» = las tres primeras parejas (en orden de entrada) a la hora de inicio y las otras dos una hora después.

/** Parejas por enfrentamiento según el género del equipo. */
export const pairsFor = (gender?: string | null): number => (gender === 'femenino' ? 4 : 5);
/** Máximo de tandas por enfrentamiento. */
export const maxTandasFor = (gender?: string | null): number => (gender === 'femenino' ? 2 : 3);
const ENTRY_ORDER = (gender?: string | null): number[] => (gender === 'femenino' ? [4, 3, 1, 2] : [5, 4, 1, 2, 3]);

/** Tandas posibles para un equipo (de «todos a la vez» a más repartidas). */
export function tandasChoices(gender?: string | null): string[] {
  return tandasOptions(pairsFor(gender)).filter((v) => v.split('-').length <= maxTandasFor(gender));
}

const joinPairs = (nums: number[]): string =>
  nums.length <= 1 ? nums.join('') : `${nums.slice(0, -1).join(', ')} y ${nums[nums.length - 1]}`;
const addHours = (hhmm: string, h: number): string => {
  const [hh, mm] = hhmm.split(':').map(Number);
  return `${String((hh + h) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

/** Una línea por tanda: «17:30 · parejas 5, 4 y 1». Sin hora de inicio: «1.ª tanda · parejas …». */
export function describeTandas(value: string, gender?: string | null, start?: string | null): string[] {
  if (!isValidTandas(value, pairsFor(gender))) return [];
  const order = ENTRY_ORDER(gender);
  let i = 0;
  return value.split('-').map((n, idx) => {
    const group = order.slice(i, i + Number(n));
    i += Number(n);
    const when = start ? addHours(start, idx) : `${idx + 1}.ª tanda`;
    return `${when} · ${group.length === 1 ? 'pareja' : 'parejas'} ${joinPairs(group)}`;
  });
}

/**
 * Versión corta de `describeTandas` para una sola línea: «10:30 (5, 4, 1) · 11:30 (2, 3)». La hora de
 * cada tanda es ORIENTATIVA (hora de inicio + 1 h por tanda): la normativa fija el reparto, no la hora exacta.
 */
export function describeTandasShort(value: string, gender?: string | null, start?: string | null): string {
  if (!isValidTandas(value, pairsFor(gender))) return '';
  const order = ENTRY_ORDER(gender);
  let i = 0;
  return value
    .split('-')
    .map((n, idx) => {
      const group = order.slice(i, i + Number(n));
      i += Number(n);
      return `${start ? addHours(start, idx) : `${idx + 1}.ª`} (${group.join(', ')})`;
    })
    .join(' · ');
}

/**
 * Cuándo entra la pareja de una pista según las tandas (normativa VII.3: entrada 5-4-1-2-3 / 4-3-1-2, de hora en hora).
 * «≈10:30» si hay hora de inicio (orientativa: los retrasos de los partidos anteriores la mueven), «1.ª tanda» si no.
 */
export function tandaWhenForCourt(
  value: string | null | undefined,
  gender: string | null | undefined,
  court: number,
  start?: string | null,
): string | null {
  if (!value || !isValidTandas(value, pairsFor(gender))) return null;
  const order = ENTRY_ORDER(gender);
  let i = 0;
  const parts = value.split('-').map(Number);
  for (let idx = 0; idx < parts.length; idx++) {
    if (order.slice(i, i + parts[idx]).includes(court)) return start ? `≈${addHours(start, idx)}` : `${idx + 1}.ª tanda`;
    i += parts[idx];
  }
  return null;
}
