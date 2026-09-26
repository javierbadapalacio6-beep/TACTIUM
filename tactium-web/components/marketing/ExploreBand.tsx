"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BtnLink, Chip } from "@/components/ui";
import { EmptyState, Skeleton } from "@/components/states";
import { IconFlag, IconSearch, IconTrophy } from "@/components/Icon";
import {
  exploreTournaments,
  fetchFcpGroupMetas,
  fetchFcpGroups,
  fetchFcpLeagues,
  fetchFcpStandings,
  type FcpGroup,
  type FcpStanding,
} from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { Reveal } from "./Reveal";

/**
 * La parte que se puede usar SIN cuenta, con datos de verdad: los torneos que
 * los clubes tienen en marcha y una clasificación real de la Federación
 * Cántabra. Todo sale de fuentes ya públicas (`explore_tournaments` y las
 * tablas `fcp_*` de lectura abierta).
 */

const PREVIEW = 4;
const STANDINGS_ROWS = 5;
const FED_SLUG = "cantabra";

const STATUS_TONE: Record<string, "accent" | "warning" | "mute"> = {
  open: "accent",
  in_progress: "warning",
  finished: "mute",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Inscripción abierta",
  in_progress: "En juego",
  finished: "Finalizado",
};
const FORMAT_LABEL: Record<string, string> = {
  ko: "Eliminación directa",
  ko_consolation: "Con consolación",
  league: "Liga",
  round_robin: "Liga",
  groups_ko: "Grupos y eliminatorias",
};

/** Los clubes de demostración no salen en la portada. */
const isDemo = (t: { club_name: string | null; name: string }) =>
  /\bdemo\b|\btest\b/i.test(`${t.club_name ?? ""} ${t.name}`);

/** "5ª CATEGORIA MASCULINA - GRUPO A" → "5ª categoría masculina · Grupo A". */
function prettyGroup(nombre: string): string {
  return nombre
    .toLowerCase()
    .replace(/categoria/g, "categoría")
    .replace(/\s*-\s*/g, " · ")
    .replace(/(^|\s·\s)(\w)/g, (m) => m.toUpperCase())
    .replace(/grupo (\w+)/gi, (_, g: string) => `Grupo ${g.toUpperCase()}`);
}

interface FeaturedGroup {
  group: FcpGroup;
  rows: FcpStanding[];
  live: boolean;
}

/** Un grupo de liga regular de la temporada en curso, a poder ser en juego. */
async function pickFeaturedGroup(): Promise<FeaturedGroup | null> {
  const leagues = await fetchFcpLeagues();
  const league = leagues.find((l) => !l.upcoming);
  if (!league) return null;
  const groups = (await fetchFcpGroups(league.idLiga)).filter((g) => !g.esPlayoff);
  if (groups.length === 0) return null;
  const metas = await fetchFcpGroupMetas(groups.slice(0, 60).map((g) => g.idGrupo));
  const scored = groups
    .map((g) => ({ g, m: metas[g.idGrupo] }))
    .filter((x) => x.m && x.m.equiposCount >= 4)
    .sort((a, b) => {
      const la = a.m.live ? 1 : 0;
      const lb = b.m.live ? 1 : 0;
      if (la !== lb) return lb - la;
      const ea = a.m.estado === "en_curso" ? 1 : 0;
      const eb = b.m.estado === "en_curso" ? 1 : 0;
      if (ea !== eb) return eb - ea;
      return b.m.equiposCount - a.m.equiposCount;
    });
  const best = scored[0] ?? { g: groups[0], m: undefined };
  const rows = await fetchFcpStandings(best.g.idGrupo);
  if (rows.length === 0) return null;
  return { group: best.g, rows: rows.slice(0, STANDINGS_ROWS), live: Boolean(best.m?.live) };
}

export function ExploreBand() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const tournaments = useAsync(() => exploreTournaments(debounced), [debounced]);
  const featured = useAsync(pickFeaturedGroup, []);

  const rows = (tournaments.data ?? []).filter((t) => !isDemo(t));
  const shown = rows.slice(0, PREVIEW);
  const searching = debounced.trim().length > 0;

  return (
    <section id="explorar" className="mk-sec mk-explore" aria-labelledby="mk-explore-title">
      <div className="mk-wrap">
        <Reveal className="mk-head">
          <p className="mk-kicker">Sin cuenta</p>
          <h2 id="mk-explore-title" className="mk-h2">
            Torneos y federación, sin cuenta
          </h2>
          <p className="mk-lede">
            Cuadros, horarios y resultados de los torneos que organizan los
            clubes, y la competición federada al completo. Entra solo cuando
            quieras inscribirte o llevar tu equipo.
          </p>
        </Reveal>

        <div className="mk-explore-grid">
          <Reveal className="mk-explore-col">
            <h3>
              <span>{searching ? "Resultados" : "Torneos ahora mismo"}</span>
              {rows.length > PREVIEW && (
                <Link href="/torneos" className="link-action">
                  Ver los {rows.length}
                </Link>
              )}
            </h3>
            <label className="mk-search">
              <IconSearch size={16} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busca un torneo por nombre, club o lugar"
                aria-label="Buscar torneo"
              />
            </label>

            {tournaments.loading ? (
              <div className="mk-tourneys">
                {Array.from({ length: PREVIEW }).map((_, i) => (
                  <Skeleton key={i} h={118} r={14} />
                ))}
              </div>
            ) : tournaments.error ? (
              <EmptyState
                compact
                icon={<IconTrophy size={22} />}
                title="No se han podido cargar los torneos"
                body={tournaments.error}
              />
            ) : shown.length === 0 ? (
              <EmptyState
                compact
                icon={<IconTrophy size={22} />}
                title={searching ? "Ningún torneo con esa búsqueda" : "Todavía no hay torneos"}
                body={
                  searching
                    ? "Prueba con el nombre del club o de la localidad."
                    : "En cuanto un club publique el suyo, aparecerá aquí."
                }
              />
            ) : (
              <div className="mk-tourneys">
                {shown.map((t) => (
                  <Link key={t.id} href={`/torneos/${t.id}`} className="mk-tourney">
                    <div>
                      <Chip tone={STATUS_TONE[t.status] ?? "mute"}>
                        {STATUS_LABEL[t.status] ?? t.status}
                      </Chip>
                    </div>
                    <div className="mk-tourney-name">{t.name}</div>
                    <div className="mk-tourney-meta">
                      {t.club_name ?? "Sin club"}
                      {t.location ? ` · ${t.location}` : ""}
                    </div>
                    <div className="mk-tourney-foot">
                      <span>{FORMAT_LABEL[t.format] ?? t.format.replace(/_/g, " ")}</span>
                      {t.players != null && (
                        <span>
                          <span className="mono">{t.players}</span> jugadores
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Reveal>

          <Reveal className="mk-explore-col" delay={0.1}>
            <h3>
              <span>Competición federada</span>
              <Link href={`/federacion/${FED_SLUG}`} className="link-action">
                Toda la federación
              </Link>
            </h3>
            {featured.loading ? (
              <Skeleton h={320} r={20} />
            ) : featured.data ? (
              <FeaturedStandings data={featured.data} />
            ) : (
              <EmptyState
                compact
                icon={<IconFlag size={22} />}
                title="Federación Cántabra de Pádel"
                body="Clasificaciones, jornadas, actas y rankings, abiertos y sin cuenta."
                action={
                  <BtnLink href={`/federacion/${FED_SLUG}`} variant="ghost">
                    Explorar la federación
                  </BtnLink>
                }
              />
            )}
          </Reveal>
        </div>

        <Reveal className="mk-explore-links" delay={0.15}>
          <BtnLink href="/torneos" variant="ghost">
            Todos los torneos
          </BtnLink>
          <BtnLink href="/federacion" variant="ghost">
            Federaciones
          </BtnLink>
          <BtnLink href="/comunidad" variant="ghost">
            Buscar jugadores y clubs
          </BtnLink>
        </Reveal>
      </div>
    </section>
  );
}

function FeaturedStandings({ data }: { data: FeaturedGroup }) {
  const { group, rows, live } = data;
  const href = `/federacion/${FED_SLUG}/grupo/${encodeURIComponent(group.idGrupo)}`;
  return (
    <div className="mk-standings">
      <div className="mk-standings-head">
        <span className="truncate">{prettyGroup(group.nombre)}</span>
        {live ? <span className="live">En juego</span> : <span className="muted">{group.temporada}</span>}
      </div>
      <div className="mk-standings-cols" aria-hidden="true">
        <span />
        <span>Equipo</span>
        <span>Sets</span>
        <span>Pts</span>
      </div>
      {rows.map((r, i) => (
        <div key={r.idEquipo} className={"mk-standings-row" + (i === 0 ? " is-leader" : "")}>
          <span className="pos">{r.posicion || i + 1}</span>
          <span className="team">{r.equipo}</span>
          <span className="num">
            {r.setsFavor}–{r.setsContra}
          </span>
          <span className="num pts">{r.puntos}</span>
        </div>
      ))}
      <div className="mk-standings-foot">
        <span>Datos de la Federación Cántabra · al día cada jornada</span>
        <Link href={href} className="link-action">
          Ver grupo
        </Link>
      </div>
    </div>
  );
}
