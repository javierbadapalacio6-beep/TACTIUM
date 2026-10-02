import type { Metadata } from "next";
import { cache } from "react";

import {
  fetchFcpGroupHeader,
  fetchFcpMatches,
  fetchFcpStandings,
  fetchFcpTeamProfile,
  type FcpGroupHeader,
  type FcpMatch,
  type FcpStanding,
  type FcpTeamProfile,
} from "@/lib/fcp-public";
import { SITE_URL } from "@/lib/site";
import { supabaseAnon } from "@/lib/supabase/anon";

/**
 * Fichas federativas en servidor: datos, metadatos y JSON-LD.
 *
 * Google indexa lo que hay en el HTML. Hasta ahora las fichas de grupo y de
 * equipo llegaban como un esqueleto que se rellenaba en el navegador, con el
 * título genérico del sitio: para el buscador eran 600 páginas iguales y
 * vacías. Aquí se cargan con el cliente anónimo (sin cookies, cacheable), se
 * pasan a la vista como estado inicial y se convierten en título, descripción
 * y datos estructurados propios de cada URL.
 *
 * Los cargadores devuelven `null` si falta configuración o falla la consulta:
 * la vista sigue funcionando como antes (carga en el navegador) y la página
 * sale con metadatos genéricos. Nunca tiran la página.
 */

/** Todas las fichas son de la Federación Cántabra: es la única con datos. */
export const FCP_SLUG = "cantabra";
export const FCP_LEAGUE_NAME = "Liga Cántabra de Pádel";
export const FCP_FED_NAME = "Federación Cántabra de Pádel";

export interface FcpGroupBundle {
  header: FcpGroupHeader | null;
  standings: FcpStanding[];
  matches: FcpMatch[];
}

export interface FcpTeamBundle {
  profile: FcpTeamProfile;
  /** Temporada del grupo principal, para el título. */
  temporada: string | null;
}

export const loadFcpGroup = cache(async (idGrupo: string): Promise<FcpGroupBundle | null> => {
  const sb = supabaseAnon();
  if (!sb) return null;
  try {
    const [header, standings, matches] = await Promise.all([
      fetchFcpGroupHeader(sb, idGrupo),
      fetchFcpStandings(sb, idGrupo),
      fetchFcpMatches(sb, idGrupo),
    ]);
    return { header, standings, matches };
  } catch {
    return null;
  }
});

export const loadFcpTeam = cache(async (idEquipo: number): Promise<FcpTeamBundle | null> => {
  const sb = supabaseAnon();
  if (!sb || !Number.isFinite(idEquipo)) return null;
  try {
    const profile = await fetchFcpTeamProfile(sb, idEquipo);
    if (!profile) return null;
    let temporada = profile.preseason?.temporada ?? null;
    if (!temporada && profile.idGrupo) {
      const h = await fetchFcpGroupHeader(sb, profile.idGrupo).catch(() => null);
      temporada = h?.temporada ?? null;
    }
    return { profile, temporada };
  } catch {
    return null;
  }
});

/* ── Texto ─────────────────────────────────────────────────────── */

/**
 * «5ª CATEGORIA MASCULINA - GRUPO A» → «5ª Categoría Masculina - Grupo A».
 * La Federación publica todo en mayúsculas; en un título de Google eso lee
 * como un grito y se recorta peor.
 */
export function prettyFcpName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/categoria/g, "categoría")
    .replace(/\bmasc\.(?=\s|$)/g, "masc.")
    .replace(/(^|[\s\-·(/])([a-záéíóúñ])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase())
    .replace(/\bDe\b/g, "de")
    .replace(/\bAl\b/g, "al")
    .replace(/\bY\b/g, "y")
    .replace(/\s+/g, " ")
    .trim();
}

function ordinal(n: number): string {
  return `${n}º`;
}

const enc = encodeURIComponent;

export function fcpGroupPath(idGrupo: string): string {
  return `/federacion/${FCP_SLUG}/grupo/${enc(idGrupo)}`;
}
export function fcpTeamPath(idEquipo: number | string): string {
  return `/federacion/${FCP_SLUG}/equipo/${enc(String(idEquipo))}`;
}

function groupProgress(matches: FcpMatch[]): { actual: number; total: number } {
  const jugadas = matches.filter((m) => m.resultado).map((m) => m.jornada ?? 0);
  const total = matches.reduce((mx, m) => Math.max(mx, m.jornada ?? 0), 0);
  const actual = jugadas.length ? Math.max(...jugadas) : 0;
  return { actual, total };
}

/* ── Metadatos ─────────────────────────────────────────────────── */

export function groupMetadata(idGrupo: string, data: FcpGroupBundle | null): Metadata {
  const path = fcpGroupPath(idGrupo);
  const nombre = prettyFcpName(data?.header?.nombre) || `Grupo ${idGrupo}`;
  const temporada = data?.header?.temporada;
  const title = [nombre, `${FCP_LEAGUE_NAME}${temporada ? ` ${temporada}` : ""}`].join(" · ");

  const rows = data?.standings ?? [];
  const parts: string[] = [];
  if (rows.length > 0) {
    const { actual, total } = groupProgress(data?.matches ?? []);
    parts.push(
      `Clasificación y resultados de ${nombre} (${FCP_LEAGUE_NAME}${temporada ? ` ${temporada}` : ""}): ${rows.length} equipos${total > 0 ? `, jornada ${actual} de ${total}` : ""}.`
    );
    const top = rows.slice(0, 3).map((r) => r.equipo).join(", ");
    parts.push(`Encabezan ${top}.`);
    parts.push("Calendario, actas y plantillas de cada equipo.");
  } else {
    parts.push(
      `Clasificación, calendario y resultados de ${nombre} de la ${FCP_LEAGUE_NAME}, actualizados cada jornada.`
    );
  }
  const description = parts.join(" ");

  return {
    title,
    description,
    alternates: { canonical: path },
    // Un grupo sin clasificación es una página vacía: mejor fuera del índice
    // hasta que la Federación publique el sorteo.
    robots: rows.length === 0 ? { index: false, follow: true } : undefined,
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

export function teamMetadata(idEquipo: number, data: FcpTeamBundle | null): Metadata {
  const path = fcpTeamPath(idEquipo);
  if (!data) {
    return {
      title: `Equipo ${idEquipo} · ${FCP_LEAGUE_NAME}`,
      alternates: { canonical: path },
      robots: { index: false, follow: true },
    };
  }
  const { profile: p, temporada } = data;
  const grupo = prettyFcpName(p.grupo);
  const title = [p.equipo, grupo || null, `${FCP_LEAGUE_NAME}${temporada ? ` ${temporada}` : ""}`]
    .filter(Boolean)
    .join(" · ");

  const parts: string[] = [];
  if (p.preseason) {
    parts.push(
      `${p.equipo}, equipo de pádel federado en la ${FCP_FED_NAME}, inscrito en ${grupo || "la liga"} para la temporada ${p.preseason.temporada ?? "siguiente"}.`
    );
    if (p.preseason.sede) parts.push(`Juega de local en ${p.preseason.sede}.`);
  } else {
    parts.push(
      `${p.equipo}, equipo de pádel federado en la ${FCP_FED_NAME}${grupo ? ` (${grupo})` : ""}.`
    );
    const stats: string[] = [];
    if (p.posicion != null) stats.push(`${ordinal(p.posicion)} en la clasificación`);
    stats.push(`${p.puntos} puntos`);
    if (p.pj > 0) stats.push(`${p.pg} victorias en ${p.pj} partidos`);
    parts.push(`${stats.join(", ")}.`);
  }
  if (p.roster.length > 0) {
    const names = p.roster.slice(0, 4).map((r) => r.name).join(", ");
    parts.push(`Plantilla de ${p.roster.length} jugadores: ${names}${p.roster.length > 4 ? "…" : "."}`);
  }
  const description = parts.join(" ");

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "profile",
      locale: "es_ES",
      url: `${SITE_URL}${path}`,
      siteName: "TACTIUM",
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/* ── JSON-LD ───────────────────────────────────────────────────── */

function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

const FED_ORG = {
  "@type": "SportsOrganization",
  name: FCP_FED_NAME,
  sport: "Pádel",
};

export function groupJsonLd(idGrupo: string, data: FcpGroupBundle): object[] {
  const nombre = prettyFcpName(data.header?.nombre) || `Grupo ${idGrupo}`;
  const temporada = data.header?.temporada;
  const path = fcpGroupPath(idGrupo);
  const out: object[] = [
    breadcrumbs([
      { name: "Federación", path: "/federacion" },
      { name: FCP_FED_NAME, path: `/federacion/${FCP_SLUG}` },
      { name: nombre, path },
    ]),
  ];
  if (data.standings.length > 0) {
    out.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `${nombre} · ${FCP_LEAGUE_NAME}${temporada ? ` ${temporada}` : ""}`,
      description: `Clasificación de ${nombre}`,
      url: `${SITE_URL}${path}`,
      numberOfItems: data.standings.length,
      itemListOrder: "https://schema.org/ItemListOrderAscending",
      itemListElement: data.standings.map((r) => ({
        "@type": "ListItem",
        position: r.posicion,
        item: {
          "@type": "SportsTeam",
          name: r.equipo,
          sport: "Pádel",
          url: `${SITE_URL}${fcpTeamPath(r.idEquipo)}`,
          memberOf: FED_ORG,
        },
      })),
    });
  }
  return out;
}

export function teamJsonLd(idEquipo: number, data: FcpTeamBundle): object[] {
  const { profile: p } = data;
  const path = fcpTeamPath(idEquipo);
  const grupo = prettyFcpName(p.grupo);
  const crumbs: { name: string; path: string }[] = [
    { name: "Federación", path: "/federacion" },
    { name: FCP_FED_NAME, path: `/federacion/${FCP_SLUG}` },
  ];
  if (p.idGrupo && grupo) crumbs.push({ name: grupo, path: fcpGroupPath(p.idGrupo) });
  crumbs.push({ name: p.equipo, path });

  return [
    breadcrumbs(crumbs),
    {
      "@context": "https://schema.org",
      "@type": "SportsTeam",
      name: p.equipo,
      sport: "Pádel",
      url: `${SITE_URL}${path}`,
      memberOf: FED_ORG,
      ...(p.preseason?.sede ? { location: { "@type": "Place", name: p.preseason.sede } } : {}),
      athlete: p.roster.map((r) => ({
        "@type": "Person",
        name: r.name,
        url: `${SITE_URL}/federacion/${FCP_SLUG}/jugador/${enc(r.idJugador)}`,
      })),
    },
  ];
}
