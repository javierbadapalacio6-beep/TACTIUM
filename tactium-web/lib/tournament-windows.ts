/**
 * Franjas de juego por tipo de día (entre semana / fin de semana / festivos). Espejo de los helpers del mismo
 * nombre de `TACTIUM/src/core/services/tournaments.ts` (app). Un torneo antiguo, con una sola ventana
 * (start_time / end_time), sigue funcionando: `windowForDay` cae en ella.
 */

export interface PlayWindow {
  from: string; // "HH:MM"
  to: string; // "HH:MM"
}
export type DayKind = "weekday" | "weekend" | "holiday";
export type PlayWindows = Record<DayKind, PlayWindow>;

export const DAY_KINDS: DayKind[] = ["weekday", "weekend", "holiday"];

export const DAY_KIND_LABEL: Record<DayKind, string> = {
  weekday: "Entre semana",
  weekend: "Fin de semana",
  holiday: "Festivos",
};

/** Valores de partida al crear un torneo: tardes entre semana y casi todo el día en sábado/domingo/festivo. */
export const DEFAULT_PLAY_WINDOWS: PlayWindows = {
  weekday: { from: "17:00", to: "23:00" },
  weekend: { from: "10:00", to: "20:00" },
  holiday: { from: "10:00", to: "20:00" },
};

export const hhmmToMinutes = (s: string): number => {
  const [h, m] = (s || "").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const minutesToHhmm = (n: number): string =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;

/** ¿Todas las franjas tienen el fin después del inicio? */
export const playWindowsValid = (w: PlayWindows): boolean =>
  DAY_KINDS.every((k) => hhmmToMinutes(w[k].to) > hhmmToMinutes(w[k].from));

/** Tipo de un día (ISO "YYYY-MM-DD"): festivo si el club lo marcó; si no, sábado/domingo = fin de semana. */
export function dayKindOf(iso: string, holidays?: string[] | null): DayKind {
  if (holidays?.includes(iso)) return "holiday";
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6 ? "weekend" : "weekday";
}

/** Ventana de juego de un día. Sin franjas por tipo de día: la global de siempre. */
export function windowForDay(
  t: {
    play_windows?: PlayWindows | null;
    holidays?: string[] | null;
    start_time?: string | null;
    end_time?: string | null;
  },
  iso: string,
): PlayWindow {
  const w = t.play_windows?.[dayKindOf(iso, t.holidays)];
  if (w?.from && w?.to && hhmmToMinutes(w.to) > hhmmToMinutes(w.from)) return w;
  return { from: (t.start_time || "09:00").slice(0, 5), to: (t.end_time || "22:00").slice(0, 5) };
}

/** Rango global (primer inicio, último final) de las ventanas que usan esos días; sin días, de las tres. */
export function windowsSpan(w: PlayWindows, days: string[] = [], holidays: string[] = []): PlayWindow {
  const kinds: DayKind[] = days.length
    ? Array.from(new Set(days.map((d) => dayKindOf(d, holidays))))
    : DAY_KINDS;
  const list = kinds.map((k) => w[k]).filter((x) => x?.from && x?.to);
  if (!list.length) return { from: "09:00", to: "22:00" };
  return {
    from: minutesToHhmm(Math.min(...list.map((x) => hhmmToMinutes(x.from)))),
    to: minutesToHhmm(Math.max(...list.map((x) => hhmmToMinutes(x.to)))),
  };
}

/** Días ISO entre dos fechas ISO (ambas incluidas; máximo 60). */
export function isoDaysBetween(start: string | null | undefined, end: string | null | undefined): string[] {
  if (!start) return [];
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const out: string[] = [];
  const d = parse(start);
  const last = end ? parse(end) : parse(start);
  let guard = 0;
  while (d.getTime() <= last.getTime() && guard < 60) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out;
}

/** Resumen corto: «L–V 17:00–23:00 · S–D 10:00–20:00». Sin franjas por tipo de día: «desde 09:00». */
export function describePlayWindows(t: {
  play_windows?: PlayWindows | null;
  holidays?: string[] | null;
  start_time?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
}): string {
  if (!t.play_windows) return t.start_time ? `desde ${t.start_time.slice(0, 5)}` : "";
  const days = isoDaysBetween(t.starts_on, t.ends_on);
  const kinds: DayKind[] = days.length
    ? DAY_KINDS.filter((k) => days.some((d) => dayKindOf(d, t.holidays) === k))
    : ["weekday", "weekend"];
  const short: Record<DayKind, string> = { weekday: "L–V", weekend: "S–D", holiday: "festivos" };
  return kinds.map((k) => `${short[k]} ${t.play_windows![k].from}–${t.play_windows![k].to}`).join(" · ");
}
