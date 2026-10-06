"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BtnLink } from "@/components/ui";
import { EmptyState, Skeleton } from "@/components/states";
import { IconFlag, IconSearch, IconTrophy } from "@/components/Icon";
import { exploreTournaments } from "@/lib/queries";
import { useAsync } from "@/lib/use-async";
import { Reveal } from "./Reveal";
import {
  TournamentRow,
  groupTournaments,
  type RowTournament,
} from "@/components/tournaments/TournamentRow";
import type { FeaturedGroup } from "./explore-data";

/**
 * La parte que se puede usar SIN cuenta, con datos de verdad. Los datos de
 * partida llegan ya del servidor (cacheados, ver `explore-data.ts`); el
 * navegador solo consulta cuando el visitante busca.
 */

const PREVIEW = 4;
const FED_SLUG = "cantabra";

/** "5ª CATEGORIA MASCULINA - GRUPO A" → "5ª categoría masculina · Grupo A". */
function prettyGroup(nombre: string): string {
  return nombre
    .toLowerCase()
    .replace(/categoria/g, "categoría")
    .replace(/\s*-\s*/g, " · ")
    .replace(/(^|\s·\s)(\w)/g, (m) => m.toUpperCase())
    .replace(/grupo (\w+)/gi, (_, g: string) => `Grupo ${g.toUpperCase()}`);
}

export function ExploreBandClient({
  initialTournaments,
  featured,
}: {
  initialTournaments: RowTournament[];
  featured: FeaturedGroup | null;
}) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const searching = debounced.trim().length > 0;
  const search = useAsync(() => exploreTournaments(debounced), [debounced], searching);

  const rows = searching
    ? ((search.data ?? []) as unknown as RowTournament[])
    : initialTournaments;
  // Primero lo que está en juego, luego lo abierto (la misma tarjeta que /torneos).
  const grouped = groupTournaments(rows);
  const shown = [...grouped.live, ...grouped.open, ...grouped.soon].slice(0, PREVIEW);
  const loading = searching && search.loading;

  return (
    <section id="explorar" className="mk-sec mk-explore" aria-labelledby="mk-explore-title">
      <div className="mk-wrap">
        <Reveal className="mk-head">
          <p className="mk-kicker">Sin cuenta</p>
          <h2 id="mk-explore-title" className="mk-h2">
            Torneos y federación, sin cuenta
          </h2>
          <p className="mk-lede">
            Cuadros, horarios y resultados de los torneos que montan clubes y
            organizadores, y la competición federada al completo. Entra solo
            cuando quieras inscribirte o llevar tu equipo.
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

            {loading ? (
              <div className="mk-tourneys">
                {Array.from({ length: PREVIEW }).map((_, i) => (
                  <Skeleton key={i} h={118} r={14} />
                ))}
              </div>
            ) : searching && search.error ? (
              <EmptyState
                compact
                icon={<IconTrophy size={22} />}
                title="No se han podido cargar los torneos"
                body={search.error}
              />
            ) : shown.length === 0 ? (
              searching ? (
                <EmptyState
                  compact
                  icon={<IconTrophy size={22} />}
                  title="Ningún torneo con esa búsqueda"
                  body="Prueba con el nombre del club o de la localidad."
                />
              ) : (
                // Sin torneos vivos, el hueco se dirige a quien organiza.
                <EmptyState
                  compact
                  icon={<IconTrophy size={22} />}
                  title="¿Organizas un torneo?"
                  body="Ahora mismo no hay torneos abiertos. Monta el tuyo: inscripción online, cuadros y horario por pistas, y aparecerá aquí."
                  action={
                    <BtnLink href="/torneos/organizar" variant="ghost">
                      Organizar un torneo
                    </BtnLink>
                  }
                />
              )
            ) : (
              <div className="card card-flush" style={{ padding: 0 }}>
                {shown.map((t) => (
                  <TournamentRow key={t.id} t={t} />
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
            {featured ? (
              <FeaturedStandings data={featured} />
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
