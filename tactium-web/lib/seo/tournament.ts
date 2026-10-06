import type { Metadata } from "next";
import { cache } from "react";

import { SITE_URL } from "@/lib/site";
import { supabaseAnon } from "@/lib/supabase/anon";

/**
 * Ficha de torneo en servidor: título, descripción, canónica y OG propios.
 * Lee `public_get_tournament` (RPC anon, la misma que la vista), así que
 * funciona para cualquier torneo con enlace directo, también los de demo.
 */

export interface TournamentHead {
  id: string;
  name: string;
  location: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: string;
  description?: string | null;
}

export const loadTournamentHead = cache(async (id: string): Promise<TournamentHead | null> => {
  const sb = supabaseAnon();
  if (!sb || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const { data, error } = await sb.rpc("public_get_tournament", { p_id: id });
    if (error) return null;
    const row = (Array.isArray(data) ? data[0] : data) as TournamentHead | null;
    return row ?? null;
  } catch {
    return null;
  }
});

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function dayMonth(iso: string): { d: number; m: string; y: number } | null {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return null;
  return { d, m: MESES[m - 1], y };
}

/** «31 de agosto – 6 de septiembre de 2026», «10 de octubre de 2026». */
export function tournamentDates(starts: string | null, ends: string | null): string | null {
  const a = starts ? dayMonth(starts) : null;
  const b = ends ? dayMonth(ends) : null;
  if (!a) return null;
  if (!b || (a.d === b.d && a.m === b.m && a.y === b.y)) return `${a.d} de ${a.m} de ${a.y}`;
  if (a.m === b.m && a.y === b.y) return `${a.d}–${b.d} de ${a.m} de ${a.y}`;
  return `${a.d} de ${a.m} – ${b.d} de ${b.m} de ${b.y}`;
}

export function tournamentMetadata(id: string, t: TournamentHead | null): Metadata {
  const path = `/torneos/${id}`;
  if (!t) {
    return { title: "Torneo", alternates: { canonical: path }, robots: { index: false, follow: true } };
  }
  const dates = tournamentDates(t.starts_on, t.ends_on);
  const where = t.location?.split("·")[0]?.trim() || null;
  const title = [t.name, dates].filter(Boolean).join(" · ");
  const description = [
    `Torneo de pádel${where ? ` en ${where}` : ""}${dates ? `, ${dates}` : ""}.`,
    t.status === "open"
      ? "Inscripción abierta: apúntate online."
      : "Cuadros, horarios y resultados en directo.",
    "Síguelo sin cuenta en TACTIUM.",
  ].join(" ");
  return {
    title,
    description,
    alternates: { canonical: path },
    // Un borrador no se enseña aunque alguien tenga el enlace.
    robots: t.status === "draft" ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      locale: "es_ES",
      url: `${SITE_URL}${path}`,
      siteName: "TACTIUM",
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}
