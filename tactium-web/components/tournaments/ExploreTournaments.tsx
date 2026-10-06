"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { exploreTournaments } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { TOURNAMENT_FREE_PAIRS } from "@/lib/tournament-billing";
import { useAsync } from "@/lib/use-async";
import { BtnLink, Card, CardHead, IconTile, InputWrap, ListRow, PageHeader, SectionHead } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconSearch, IconTicket, IconTrophy } from "@/components/Icon";
import { LiveDot } from "@/components/tournaments/SpectatorParts";
import {
  CodeBox,
  TournamentRow,
  groupTournaments,
  bucketOf,
  type RowTournament,
} from "@/components/tournaments/TournamentRow";

/**
 * Explorar torneos — datos REALES (RPC `explore_tournaments`, concedida a
 * `anon`: funciona sin sesión, igual que en la app).
 *
 * Primero lo que está pasando: «En juego ahora» · «Inscripción abierta» ·
 * «Próximamente» · «Terminados» (plegados), con la tarjeta compacta. Filtros
 * por estado y género en chips, y un solo «Tengo un código».
 */

type StatusFilter = "all" | "open" | "live";

export function ExploreTournaments({ embedded = false }: { embedded?: boolean } = {}) {
  const { user } = useSession();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [genders, setGenders] = useState<Set<string>>(new Set());
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const { data, loading, error } = useAsync(() => exploreTournaments(debounced), [debounced], true);
  const all = (data ?? []) as unknown as RowTournament[];

  const rows = all.filter((t) => {
    if (status === "open" && t.status !== "open") return false;
    if (status === "live" && bucketOf(t.status, t.starts_on, t.ends_on) !== "live") return false;
    if (genders.size && !(t.genders ?? []).some((g) => genders.has(g))) return false;
    return true;
  });
  const g = groupTournaments(rows);
  const filtering = !!debounced.trim() || status !== "all" || genders.size > 0;

  const toggleGender = (x: string) =>
    setGenders((prev) => {
      const n = new Set(prev);
      if (n.has(x)) n.delete(x);
      else n.add(x);
      return n;
    });

  const group = (title: string, list: RowTournament[], live?: boolean) =>
    list.length > 0 && (
      <Card flush>
        <CardHead
          title={
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {live && <LiveDot />}
              {title}
            </span>
          }
          count={list.length}
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 340px), 1fr))" }}>
          {list.map((t) => (
            <TournamentRow key={t.id} t={t} />
          ))}
        </div>
      </Card>
    );

  return (
    <div className="tw-page">
      {/* Dentro de Competir el título es «Competir», la pestaña ya dice
          «Torneos» y encima va «Mis torneos»: aquí, un título de bloque y sin
          las pestañas Explorar / Mis torneos. */}
      {embedded ? (
        <SectionHead
          title="Explorar torneos"
          count={loading ? undefined : all.length}
          sub="Busca por nombre, club o lugar, o entra directo con el código que te han pasado."
          style={{ marginTop: 0 }}
        />
      ) : (
        <>
          <PageHeader
            title="Torneos"
            lede="Busca por nombre, club o lugar, o entra directo con el código que te han pasado."
            meta={[loading ? "Cargando…" : `${all.length} ${all.length === 1 ? "torneo" : "torneos"}`]}
          />

          {/* Explorar / Mis torneos (antes nada llevaba a /torneos/mios). */}
          <div className="tw-toolbar" role="tablist" aria-label="Torneos" style={{ marginBottom: 12 }}>
            <span className="tw-fcp-chip is-on" role="tab" aria-selected="true" style={{ display: "inline-flex", alignItems: "center" }}>
              Explorar
            </span>
            <Link href="/torneos/mios" className="tw-fcp-chip" role="tab" aria-selected="false" style={{ display: "inline-flex", alignItems: "center" }}>
              Mis torneos
            </Link>
          </div>
        </>
      )}

      <div className="tw-tourney-grid">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          <div className="tw-toolbar">
            <InputWrap icon={<IconSearch size={15} />}>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nombre, club o lugar"
                aria-label="Buscar torneo"
              />
            </InputWrap>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(
              [
                ["Todos", status === "all" && genders.size === 0, () => { setStatus("all"); setGenders(new Set()); }],
                ["Abiertos", status === "open", () => setStatus(status === "open" ? "all" : "open")],
                ["En juego", status === "live", () => setStatus(status === "live" ? "all" : "live")],
                ["Masc.", genders.has("masculino"), () => toggleGender("masculino")],
                ["Fem.", genders.has("femenino"), () => toggleGender("femenino")],
                ["Mixto", genders.has("mixto"), () => toggleGender("mixto")],
              ] as [string, boolean, () => void][]
            ).map(([label, on, fn]) => (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={fn}
                className={"tw-fcp-chip" + (on ? " is-on" : "")}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : error ? (
            <Card>
              <EmptyState icon={<IconTrophy size={22} />} title="No se pudieron cargar los torneos" body={error} />
            </Card>
          ) : rows.length === 0 ? (
            <Card>
              {filtering ? (
                <EmptyState
                  icon={<IconTrophy size={22} />}
                  title="Nada con este filtro"
                  body="Prueba con otra búsqueda o quita algún filtro."
                />
              ) : (
                // Sin torneos vivos: la página se dirige a quien organiza.
                <EmptyState
                  icon={<IconTrophy size={22} />}
                  title="Ahora mismo no hay torneos abiertos"
                  body={`Si organizas uno, móntalo aquí: inscripción por categorías, cuadros, horario por pistas y resultados en directo. Hasta ${TOURNAMENT_FREE_PAIRS} parejas es gratis.`}
                  action={
                    <BtnLink href="/torneos/organizar" variant="accent">
                      Organizar un torneo
                    </BtnLink>
                  }
                />
              )}
            </Card>
          ) : (
            <>
              {group("En juego ahora", g.live, true)}
              {group("Inscripción abierta", g.open)}
              {group("Próximamente", g.soon)}
              {g.done.length > 0 &&
                (showDone ? (
                  group("Terminados", g.done)
                ) : (
                  <Card flush>
                    <ListRow
                      onClick={() => setShowDone(true)}
                      title="Terminados"
                      right={<span style={{ fontSize: 12.5, color: "var(--accent)", fontWeight: 600 }}>Ver {g.done.length}</span>}
                    />
                  </Card>
                ))}
            </>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card flush>
            <CardHead title="Tengo un código" />
            <div className="card-body">
              <CodeBox loggedIn={!!user} />
            </div>
          </Card>

          <Card flush>
            <ListRow
              href="/torneos/organizar"
              icon={
                <IconTile>
                  <IconTicket size={16} />
                </IconTile>
              }
              title="Organizo torneos"
              sub="Monta el cuadro y el horario, con tu club o sin él"
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
