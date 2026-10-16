/*
 * Partes puras (sin Supabase ni navegador) del enlace público de disponibilidad:
 * la URL, la fecha larga y el texto que el capitán pega en el grupo. Se usan en
 * servidor (metadatos, imagen OG) y en cliente. Espejo en la app:
 * TACTIUM/src/core/services/availabilityLink.ts (si cambia el texto, cambiar los dos).
 */

export function availabilityPath(token: string): string {
  return `/d/${token}`;
}

export function availabilityUrl(token: string): string {
  return `https://tactium.io${availabilityPath(token)}`;
}

/** «domingo 3 de mayo» desde un `YYYY-MM-DD`. */
import { fmtRango } from "@/lib/fcp-range";

export function longDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const date = new Date(d + "T00:00:00");
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
}

export function availabilityShareText(o: {
  opponent: string;
  jornada: number | null;
  date: string | null;
  time: string | null;
  isHome: boolean | null;
  token: string;
  /** Fin de semana que da la Federación («23 - 25 Oct») mientras no hay fecha exacta. */
  range?: string | null;
}): string {
  const fecha = longDate(o.date);
  const hora = o.time ? o.time.slice(0, 5) : null;
  const lines = [
    `🎾 ¿Puedes jugar${o.jornada != null ? ` la jornada ${o.jornada}` : " la próxima jornada"}?`,
    `🆚 ${o.opponent}`,
    fecha
      ? `📅 ${fecha}${hora ? ` · ${hora}` : ""}`
      : o.range
        ? `📅 ${fmtRango(o.range)} (día y hora por confirmar)`
        : null,
    o.isHome == null ? null : o.isHome ? "🏠 En casa" : "🚗 Fuera",
    "",
    "Dime si vas con un toque, sin app 👇",
    availabilityUrl(o.token),
  ];
  return lines.filter((l) => l !== null).join("\n");
}
