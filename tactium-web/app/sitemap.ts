import type { MetadataRoute } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";

import { fcpGroupPath, fcpTeamPath, FCP_SLUG } from "@/lib/seo/fcp";
import { SITE_URL } from "@/lib/site";
import { supabaseAnon } from "@/lib/supabase/anon";

/**
 * Sitemap: las páginas fijas más TODAS las fichas federativas (grupos y
 * equipos). Sin ellas Google sólo conocía nueve URLs; con ellas conoce cada
 * clasificación y cada equipo de la Liga Cántabra desde 2021.
 *
 * Se regenera cada hora (ISR): la temporada en curso cambia cada jornada y
 * el `lastModified` real es lo que hace que el buscador vuelva a pasar.
 */
export const revalidate = 3600;

const FIXED: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
  { url: `${SITE_URL}/torneos`, changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE_URL}/federacion`, changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE_URL}/federacion/${FCP_SLUG}`, changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE_URL}/comunidad`, changeFrequency: "weekly", priority: 0.6 },
  { url: `${SITE_URL}/pro`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/legal/privacidad`, changeFrequency: "yearly", priority: 0.2 },
  { url: `${SITE_URL}/legal/terminos`, changeFrequency: "yearly", priority: 0.2 },
  { url: `${SITE_URL}/legal/eliminar-cuenta`, changeFrequency: "yearly", priority: 0.2 },
];

/** PostgREST corta a 1000 filas por petición: se pagina hasta agotar. */
async function fetchAll<T>(
  sb: SupabaseClient,
  table: string,
  columns: string,
  pageSize = 1000,
  max = 20000
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await sb
      .from(table)
      .select(columns)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < pageSize) break;
  }
  return out;
}

type GrupoRow = { id_grupo: string; temporada: string | null; updated_at: string | null };
type EquipoRow = { id_equipo: number; updated_at: string | null };

function newest(a: string | null | undefined, b: string | null | undefined): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const fixed = FIXED.map((e) => ({ ...e, lastModified: now }));

  const sb = supabaseAnon();
  if (!sb) return fixed;

  try {
    const [grupos, clasificacion, inscripciones] = await Promise.all([
      fetchAll<GrupoRow>(sb, "fcp_grupos", "id_grupo, temporada, updated_at"),
      fetchAll<EquipoRow>(sb, "fcp_clasificacion", "id_equipo, updated_at"),
      fetchAll<EquipoRow>(sb, "fcp_inscripciones", "id_equipo, updated_at"),
    ]);

    // La temporada más alta es la «en curso»: se recrawlea a diario; las
    // anteriores son archivo y cambian poco.
    const temporadas = grupos.map((g) => g.temporada).filter((t): t is string => !!t);
    const actual = temporadas.length ? temporadas.sort().at(-1) : null;

    const groupEntries: MetadataRoute.Sitemap = grupos.map((g) => {
      const live = actual != null && g.temporada === actual;
      return {
        url: `${SITE_URL}${fcpGroupPath(g.id_grupo)}`,
        lastModified: g.updated_at ? new Date(g.updated_at) : now,
        changeFrequency: live ? "daily" : "yearly",
        priority: live ? 0.8 : 0.4,
      };
    });

    // Un equipo aparece en varias temporadas: una URL, la fecha más reciente.
    const teams = new Map<number, string | null>();
    for (const r of [...clasificacion, ...inscripciones]) {
      if (!r.id_equipo) continue;
      teams.set(r.id_equipo, newest(teams.get(r.id_equipo), r.updated_at));
    }
    const teamEntries: MetadataRoute.Sitemap = [...teams.entries()].map(([id, upd]) => ({
      url: `${SITE_URL}${fcpTeamPath(id)}`,
      lastModified: upd ? new Date(upd) : now,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

    return [...fixed, ...groupEntries, ...teamEntries];
  } catch {
    // Sin base de datos el sitemap sigue saliendo, con lo fijo.
    return fixed;
  }
}
