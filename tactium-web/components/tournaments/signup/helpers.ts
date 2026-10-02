// Utilidades puras del asistente de inscripción a torneos (web).

import {
  resolveCategoryThreshold,
  type CategoryRules,
} from "@/lib/tournament-eligibility";

/* Torneo real (RPC pública) y su forma normalizada para el formulario. */
export interface RealTournament {
  name: string;
  club_name?: string | null;
  location: string | null;
  starts_on: string | null;
  ends_on: string | null;
  entry_fee: number | null;
  fee_currency: string | null;
  signup_code: string | null;
  category: string | null;
  categories: string[] | null;
  gender: string | null;
  genders: string[] | null;
}
export interface NormTournament {
  name: string;
  club: string | null;
  place: string | null;
  dates: string | null;
  fee: string | null;
  code: string;
  categories: string[];
  genders: string[];
}

export const capitalize = (s: string) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

/** Nombre + al menos un apellido (2 palabras). Se exige cuando NO hay respaldo
 *  de la Federación (si lo hay, el nombre canónico ya viene completo). */
export const isFullName = (s: string) =>
  s.trim().split(/\s+/).filter((w) => w.length > 1).length >= 2;

/** Email con pinta razonable (validación suave, el server no depende de esto). */
export const looksLikeEmail = (s: string) => /.+@.+\..+/.test(s.trim());

/** Cifras de un teléfono (para exigir un mínimo de 9). */
export const phoneDigits = (s: string) => s.replace(/\D/g, "").length;

/** Valida el género REAL (FCP) contra la división del torneo. Solo bloquea
 *  cuando se conoce el género (jugador confirmado en la Federación); sin dato
 *  no se puede saber, así que no bloquea. */
export function genderMismatch(
  divisionDb: string,
  players: ("M" | "F" | null)[],
): string | null {
  const known = players.filter((g): g is "M" | "F" => g === "M" || g === "F");
  if (divisionDb === "masculino" && known.some((g) => g === "F"))
    return "Este torneo es masculino: la pareja debe ser de hombres.";
  if (divisionDb === "femenino" && known.some((g) => g === "M"))
    return "Este torneo es femenino: la pareja debe ser de mujeres.";
  return null;
}

const DOW_ABBR = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Días REALES del torneo (de starts_on a ends_on) para el grid de
 *  disponibilidad. Sin fechas -> [] (no se pinta un horario inventado). */
export function buildSignupDays(
  startsOn: string | null,
  endsOn: string | null,
): string[] {
  if (!startsOn) return [];
  const parse = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };
  const start = parse(startsOn);
  const end = endsOn ? parse(endsOn) : start;
  const out: string[] = [];
  const d = new Date(start);
  let g = 0;
  while (d.getTime() <= end.getTime() && g < 21) {
    out.push(`${DOW_ABBR[d.getDay()]} ${d.getDate()}`);
    d.setDate(d.getDate() + 1);
    g++;
  }
  return out;
}

export interface Franja {
  from: number;
  to: number;
  /** «09:00–10:00»: el mismo formato que guarda la app. */
  label: string;
}

/** Franjas de 1 h dentro de la ventana diaria del torneo. Copia 1:1 de
 *  `hourlyFranjas` de la app (TACTIUM/src/core/services/tournaments.ts): la
 *  disponibilidad se guarda como «Vie 24 09:00–10:00», que es lo que entiende
 *  el planificador del horario. Sin datos → 09:00–22:00. */
export function hourlyFranjas(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): Franja[] {
  const [sh, sm] = (startTime || "09:00").split(":").map(Number);
  const [eh, em] = (endTime || "22:00").split(":").map(Number);
  const start = (sh || 9) * 60 + (sm || 0);
  const end = (eh || 22) * 60 + (em || 0);
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const out: Franja[] = [];
  for (let t = start; t + 60 <= end; t += 60)
    out.push({ from: t, to: t + 60, label: `${hhmm(t)}–${hhmm(t + 60)}` });
  return out;
}

export function fmtDates(a: string | null, b: string | null): string | null {
  const f = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  };
  const da = f(a);
  const db = f(b);
  if (da && db && da !== db) return `${da} – ${db}`;
  return da || db || null;
}

export const SIGNUP_GENDER_DB: Record<string, string> = {
  Masculino: "masculino",
  Femenino: "femenino",
  Mixto: "mixto",
};

/** ¿Las reglas del torneo miran el nivel? Si no, no se pide el campo. */
export const rulesUseNivel = (rules: CategoryRules | null) =>
  !!rules && (rules.mode === "nivel" || rules.mode === "both");

/** Versión corta del motivo de `checkCategoryEligibility` para la tarjeta. */
export function shortEligibility(msg: string): string {
  let m = msg.match(/máximo de (\d+) puntos .*\(sumáis (\d+)\)/);
  if (m) return `Máximo ${m[1]} pts · sumáis ${m[2]}`;
  m = msg.match(/≥ (\d+) .*\(sumáis (\d+)\)/);
  if (m) return `Nivel mínimo ${m[1]} · sumáis ${m[2]}`;
  if (/^Indica los puntos/.test(msg)) return "Faltan los puntos de la pareja";
  if (/^Indica el nivel/.test(msg)) return "Falta el nivel (liga o circuito)";
  return msg;
}

/** Límites de una categoría en una línea («Hasta 300 pts · nivel ≥ 6»). */
export function describeThreshold(
  rules: CategoryRules | null,
  category: string,
  gender: string | null,
): string {
  const t = resolveCategoryThreshold(rules, category, gender);
  if (!rules || !t) return "Sin límite de puntos";
  const parts: string[] = [];
  if ((rules.mode === "points" || rules.mode === "both") && t.puntos != null)
    parts.push(`Hasta ${t.puntos} pts`);
  if ((rules.mode === "nivel" || rules.mode === "both") && t.nivel != null)
    parts.push(`nivel ≥ ${t.nivel}`);
  return parts.length ? capitalize(parts.join(" · ")) : "Sin límite de puntos";
}
