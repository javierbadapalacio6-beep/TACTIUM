/**
 * Rango de fechas de una jornada tal y como lo publica la Federación («23 - 25 Oct»).
 *
 * El club local fija el día y la hora exactos mucho después de que salga el calendario, así que
 * mientras tanto la jornada se conoce por su fin de semana. Espejo de `fmtRango` / `fcpRangeStart`
 * de la app (`ligaParts.tsx`, `timePolls.ts`).
 */

/** «23 - 25 Oct» → «23-25 oct»; «30 Oct - 1 Nov» → «30 oct-1 nov». */
export function fmtRango(r: string | null | undefined): string {
  const s = (r ?? "").trim();
  if (!s) return "";
  return s.replace(/\s*-\s*/g, "-").replace(/[A-Za-zÁÉÍÓÚáéíóú]+/g, (w) => w.toLowerCase());
}

const MESES: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5, jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

/**
 * Primer día del rango («23 - 25 Oct» → 'YYYY-10-23'; «30 Oct - 1 Nov» → 'YYYY-10-30'). El año es el de
 * la próxima vez que cae esa fecha (hasta un mes atrás). null si no se entiende.
 */
export function fcpRangeStart(range: string | null | undefined, now: Date = new Date()): string | null {
  const s = (range ?? "").trim().toLowerCase();
  const first = s.match(/^(\d{1,2})\s*([a-záéíóú]{3})?/);
  if (!first) return null;
  const day = Number(first[1]);
  const mon = MESES[first[2] ?? ""] ?? MESES[(s.match(/([a-záéíóú]{3})\s*$/) ?? [])[1] ?? ""];
  if (mon == null || day < 1 || day > 31) return null;
  let year = now.getFullYear();
  if (new Date(year, mon, day, 12).getTime() < now.getTime() - 30 * 86_400_000) year += 1;
  return `${year}-${String(mon + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
