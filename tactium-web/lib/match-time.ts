/** Un encuentro dura como mucho esto (cinco parejas, a veces se alarga). Pasado el plazo, ya no está «en juego». */
export const MATCH_WINDOW_MS = 5 * 60 * 60 * 1000;

const startOf = (date: string | null, time: string | null): number =>
  date ? new Date(`${date}T${time ?? "00:00:00"}`).getTime() : NaN;

/** ¿Ha llegado la hora del partido? (sin hora, cuenta desde las 00:00). */
export function isMatchStarted(date: string | null, time: string | null, now: number): boolean {
  const t = startOf(date, time);
  return !Number.isNaN(t) && now >= t;
}

/** Terminado por tiempo: pasaron 5 h desde la hora; sin hora, al acabar el día. */
export function isMatchOver(date: string | null, time: string | null, now: number): boolean {
  const t = startOf(date, time);
  if (Number.isNaN(t)) return false;
  return now >= t + (time ? MATCH_WINDOW_MS : 24 * 60 * 60 * 1000);
}
