/**
 * Tandas: los partidos de un enfrentamiento que se juegan a la misma hora. Espejo de `core/utils/tandas.ts` de la app.
 *
 * Liga Cántabra (normativa VII.3 y XI.3.1): masculino = 5 parejas, como mucho 3 tandas, entrada 5-4-1-2-3; femenino =
 * 4 parejas, como mucho 2 tandas, entrada 4-3-1-2. «3-2» = las tres primeras parejas (en orden de entrada) a la hora
 * de inicio y las otras dos una hora después.
 */

/** Parejas por enfrentamiento según el género del equipo. */
export const pairsFor = (gender?: string | null): number => (gender === "femenino" ? 4 : 5);
/** Máximo de tandas por enfrentamiento. */
export const maxTandasFor = (gender?: string | null): number => (gender === "femenino" ? 2 : 3);
const entryOrder = (gender?: string | null): number[] => (gender === "femenino" ? [4, 3, 1, 2] : [5, 4, 1, 2, 3]);

function compositionsOf(n: number): number[][] {
  if (n <= 0) return [];
  if (n === 1) return [[1]];
  const out: number[][] = [];
  for (let first = 1; first <= n; first++) {
    if (first === n) out.push([n]);
    else for (const rest of compositionsOf(n - first)) out.push([first, ...rest]);
  }
  return out;
}

/** ¿«3-2» vale para N parejas? */
export function isValidTandas(value: string, total: number): boolean {
  if (!value) return false;
  const parts = value.split("-").map((s) => Number(s.trim()));
  if (parts.some((p) => !Number.isInteger(p) || p < 1)) return false;
  return parts.reduce((a, b) => a + b, 0) === total;
}

/** Tandas posibles para un equipo, de «todos a la vez» a más repartidas. */
export function tandasChoices(gender?: string | null): string[] {
  return compositionsOf(pairsFor(gender))
    .filter((p) => p.length <= maxTandasFor(gender))
    .sort((a, b) => {
      if (a.length !== b.length) return a.length - b.length;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
      return 0;
    })
    .map((p) => p.join("-"));
}

const joinPairs = (nums: number[]): string =>
  nums.length <= 1 ? nums.join("") : `${nums.slice(0, -1).join(", ")} y ${nums[nums.length - 1]}`;
const addHours = (hhmm: string, h: number): string => {
  const [hh, mm] = hhmm.split(":").map(Number);
  return `${String((hh + h) % 24).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

/** Una línea por tanda: «17:30 · parejas 5, 4 y 1». Sin hora de inicio: «1.ª tanda · parejas …». */
export function describeTandas(value: string, gender?: string | null, start?: string | null): string[] {
  if (!isValidTandas(value, pairsFor(gender))) return [];
  const order = entryOrder(gender);
  let i = 0;
  return value.split("-").map((n, idx) => {
    const group = order.slice(i, i + Number(n));
    i += Number(n);
    const when = start ? addHours(start, idx) : `${idx + 1}.ª tanda`;
    return `${when} · ${group.length === 1 ? "pareja" : "parejas"} ${joinPairs(group)}`;
  });
}

/** Versión corta para una línea: «10:30 (5, 4, 1) · 11:30 (2, 3)». La hora de cada tanda es ORIENTATIVA (inicio + 1 h por tanda). */
export function describeTandasShort(value: string, gender?: string | null, start?: string | null): string {
  if (!isValidTandas(value, pairsFor(gender))) return "";
  const order = entryOrder(gender);
  let i = 0;
  return value
    .split("-")
    .map((n, idx) => {
      const group = order.slice(i, i + Number(n));
      i += Number(n);
      return `${start ? addHours(start, idx) : `${idx + 1}.ª`} (${group.join(", ")})`;
    })
    .join(" · ");
}
