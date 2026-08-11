"use client";

import Link from "next/link";
import { useState } from "react";

import {
  fetchFcpGroups,
  fetchFcpMatches,
  fetchFcpStandings,
  fetchFcpTeamPlayers,
  searchFcpPlayers,
  type FcpGroup,
  type FcpStanding,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconChevronRight, IconFlag, IconSearch } from "@/components/Icon";

/**
 * Federación — datos reales de las tablas `fcp_*`.
 *
 * ⚠️ Estas tablas exigen `authenticated`: sin sesión no devuelven nada. Es lo
 * que impide, hoy por hoy, usar la Federación como reclamo de buscadores.
 */

const FEDERATIONS = [
  { slug: "cantabra", name: "Federación Cántabra de Pádel", short: "FCP", active: true },
  { slug: "asturiana", name: "Federación Asturiana de Pádel", short: "FAP", active: false },
  { slug: "vasca", name: "Federación Vasca de Pádel", short: "FVP", active: false },
  { slug: "madrilena", name: "Federación Madrileña de Pádel", short: "FMP", active: false },
];

/** Puntos por partido, con coma decimal. */
function ptsPerMatch(t: FcpStanding): string {
  if (!t.pj) return "0,00";
  return (t.puntos / t.pj).toFixed(2).replace(".", ",");
}

/* Estas pantallas ya NO piden sesión: las tablas `fcp_*` tienen lectura
   pública (migración 20260811c). Son datos que la federación publica en
   abierto, y además es lo que mejor posiciona en buscadores. */

/* ═══ 01 · SELECTOR ═══════════════════════════════════════════════ */
export function FederationPicker() {
  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Eyebrow>FEDERACIONES</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>Elige federación</h1>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
          Clasificaciones, jornadas y jugadores federados.
        </p>
      </div>

      <div className="tw-club-teams">
        {FEDERATIONS.map((f) => {
          const inner = (
            <Card style={{ padding: 22, height: "100%", opacity: f.active ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 11,
                    background: f.active ? "var(--accent-10)" : "var(--bg-card-2)",
                    color: f.active ? "var(--accent)" : "var(--text-faint)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <IconFlag size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>
                    {f.name}
                  </span>
                  <span
                    className="mono"
                    style={{
                      display: "block",
                      marginTop: 4,
                      fontSize: 10,
                      letterSpacing: "0.16em",
                      color: "var(--text-faint)",
                    }}
                  >
                    {f.short}
                  </span>
                </span>
              </div>
              <div style={{ marginTop: 18 }}>
                {f.active ? (
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    Explorar <IconChevronRight size={14} />
                  </span>
                ) : (
                  <span className="chip chip-mute">Próximamente</span>
                )}
              </div>
            </Card>
          );
          return f.active ? (
            <Link key={f.slug} href={`/federacion/${f.slug}`} style={{ color: "inherit" }}>
              {inner}
            </Link>
          ) : (
            <div key={f.slug}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══ 02 · EXPLORAR ═══════════════════════════════════════════════ */
export function FederationExplore({ slug }: { slug: string }) {
  const { user } = useSession();
  const [tab, setTab] = useState<"grupos" | "jugadores">("grupos");
  const [query, setQuery] = useState("");
  const [gender, setGender] = useState("Ambos");

  const groups = useAsync(() => fetchFcpGroups(200), [user?.id]);
  const players = useAsync(
    () => searchFcpPlayers(query),
    [query, user?.id],
    tab === "jugadores" && query.trim().length >= 3
  );

  const q = query.trim().toLowerCase();
  const allGroups = groups.data ?? [];
  const rows = allGroups.filter((g) => {
    if (gender !== "Ambos" && (g.genero ?? "").toLowerCase() !== gender.toLowerCase())
      return false;
    return !q || g.nombre.toLowerCase().includes(q);
  });

  const genders = Array.from(
    new Set(allGroups.map((g) => g.genero).filter(Boolean) as string[])
  );

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>FEDERACIÓN CÁNTABRA</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>Federación Cántabra de Pádel</h1>
        <p
          className="mono"
          style={{
            margin: "8px 0 0",
            fontSize: 10.5,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
          }}
        >
          {groups.loading ? "CARGANDO…" : `${allGroups.length} GRUPOS · DATOS REALES`}
        </p>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 18px",
            borderRadius: 12,
            border: "1px solid var(--hair-strong)",
            background: "var(--bg-card-2)",
          }}
        >
          <IconSearch size={18} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              tab === "grupos" ? "Busca un grupo…" : "Busca un jugador (3 letras)…"
            }
            aria-label="Buscar en la federación"
            style={{
              flex: 1,
              minWidth: 0,
              border: "none",
              background: "transparent",
              color: "var(--text)",
              fontSize: 15,
              outline: "none",
              fontFamily: "'Satoshi', sans-serif",
            }}
          />
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(
            [
              ["grupos", "Grupos"],
              ["jugadores", "Jugadores"],
            ] as const
          ).map(([k, label]) => {
            const on = tab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className="btn"
                style={{
                  padding: "9px 16px",
                  fontSize: 12.5,
                  fontWeight: on ? 700 : 500,
                  background: on ? "var(--accent-10)" : "transparent",
                  color: on ? "var(--accent)" : "var(--text-muted)",
                  border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                }}
              >
                {label}
              </button>
            );
          })}

          <div style={{ flex: 1 }} />

          {tab === "grupos" && genders.length > 0 && (
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              aria-label="Género"
              className="tw-select"
            >
              {["Ambos", ...genders].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          )}
        </div>
      </Card>

      {tab === "grupos" ? (
        groups.loading ? (
          <SkeletonCard />
        ) : groups.error ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={34} />}
              title="No se pudieron cargar los grupos"
              body={groups.error}
            />
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={34} />}
              title="No hay grupos con esos filtros."
              body="Prueba a quitar el filtro de género o busca otro nombre."
            />
          </Card>
        ) : (
          <div className="tw-club-teams">
            {rows.map((g: FcpGroup) => (
              <Link
                key={g.idGrupo}
                href={`/federacion/${slug}/grupo/${encodeURIComponent(g.idGrupo)}`}
                style={{ color: "inherit" }}
              >
                <Card style={{ padding: 20 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>{g.nombre}</div>
                  <div
                    className="mono"
                    style={{
                      marginTop: 8,
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      color: "var(--text-faint)",
                    }}
                  >
                    {[g.genero, g.temporada].filter(Boolean).join(" · ").toUpperCase()}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )
      ) : query.trim().length < 3 ? (
        <Card>
          <EmptyState
            icon={<IconSearch size={34} />}
            title="Escribe el nombre de un jugador"
            body="Mínimo 3 letras. Hay más de 27.000 jugadores federados."
          />
        </Card>
      ) : players.loading ? (
        <SkeletonCard />
      ) : players.error ? (
        <Card>
          <EmptyState
            icon={<IconFlag size={34} />}
            title="Error en la búsqueda"
            body={players.error}
          />
        </Card>
      ) : (players.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={<IconSearch size={34} />} title="Sin coincidencias" />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {(players.data ?? []).map((p, i, arr) => (
            <div
              key={p.idJugador}
              className="tw-fcp-row"
              style={{
                borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--hair)",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--text-faint)" }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{p.nombre}</span>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {p.nombreEquipo ?? "—"}
              </span>
              <span
                className="mono"
                style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}
              >
                {p.puntos}
              </span>
              <span />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ═══ 03 · GRUPO ══════════════════════════════════════════════════ */
export function FcpGroupView({ slug, id }: { slug: string; id: string }) {
  const { user } = useSession();
  const [tab, setTab] = useState<"clasificacion" | "jornadas">("clasificacion");

  const standings = useAsync(() => fetchFcpStandings(id), [id, user?.id]);
  const matches = useAsync(
    () => fetchFcpMatches(id),
    [id, user?.id],
    tab === "jornadas"
  );
  if (standings.loading) return <SkeletonCard />;

  const rows = standings.data ?? [];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>FEDERACIÓN CÁNTABRA · GRUPO</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>{decodeURIComponent(id)}</h1>
        <p
          className="mono"
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
          }}
        >
          {rows.length} EQUIPOS
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {(
          [
            ["clasificacion", "Clasificación"],
            ["jornadas", "Jornadas"],
          ] as const
        ).map(([k, label]) => {
          const on = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className="btn"
              style={{
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: on ? 700 : 500,
                background: on ? "var(--accent-10)" : "transparent",
                color: on ? "var(--accent)" : "var(--text-muted)",
                border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {tab === "clasificacion" ? (
        standings.error ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={34} />}
              title="Sin clasificación disponible."
              body={standings.error}
            />
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={34} />}
              title="Sin clasificación disponible."
              body="Aún no hay datos federativos sincronizados para este grupo."
            />
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div className="tw-roster-scroll">
              <div className="tw-fcp-head">
                {["POS", "EQUIPO", "PJ", "PG", "ENF", "SETS +", "SETS −", "PUNTOS", "PTS/PART."].map(
                  (h) => (
                    <span key={h}>{h}</span>
                  )
                )}
              </div>
              {rows.map((t) => (
                <Link
                  key={t.idEquipo}
                  href={`/federacion/${slug}/equipo/${t.idEquipo}`}
                  className="tw-fcp-table-row"
                  style={{ color: "inherit" }}
                >
                  <span className="mono">{t.posicion}</span>
                  <span style={{ fontWeight: 700 }}>{t.equipo}</span>
                  <span className="mono">{t.pj}</span>
                  <span className="mono">{t.pg}</span>
                  <span className="mono">{t.enf}</span>
                  <span className="mono">{t.setsFavor}</span>
                  <span className="mono">{t.setsContra}</span>
                  <span className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>
                    {t.puntos}
                  </span>
                  <span className="mono" style={{ color: "var(--text-muted)" }}>
                    {ptsPerMatch(t)}
                  </span>
                </Link>
              ))}
            </div>
          </Card>
        )
      ) : matches.loading ? (
        <SkeletonCard />
      ) : (matches.data ?? []).length === 0 ? (
        <Card>
          <EmptyState icon={<IconFlag size={34} />} title="Sin jornadas registradas." />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {(matches.data ?? []).map((p, i, arr) => (
            <div
              key={p.idPartido}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 20px",
                borderBottom: i === arr.length - 1 ? "none" : "1px solid var(--hair)",
                flexWrap: "wrap",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--text-faint)", width: 46 }}
              >
                {p.ronda ? p.ronda.slice(0, 6) : `J·${p.jornada ?? "—"}`}
              </span>
              <span style={{ flex: 1, minWidth: 200, fontSize: 13.5 }}>
                <strong style={{ fontWeight: 700 }}>{p.local}</strong>
                <span style={{ color: "var(--text-faint)" }}> vs </span>
                {p.visitante}
              </span>
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--text-muted)" }}
              >
                {p.fecha ?? "—"}
                {p.hora ? ` · ${p.hora}` : ""}
              </span>
              {p.resultado ? (
                <span className="mono" style={{ fontSize: 15, fontWeight: 700 }}>
                  {p.resultado}
                </span>
              ) : (
                <span className="chip chip-mute">Por jugar</span>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ═══ 04 · EQUIPO FEDERADO ════════════════════════════════════════ */
export function FcpTeamView({ slug, id }: { slug: string; id: string }) {
  const { user } = useSession();
  const idEquipo = Number(id);
  const { data, loading, error } = useAsync(
    () => fetchFcpTeamPlayers(idEquipo),
    [idEquipo, user?.id],
    Number.isFinite(idEquipo)
  );

  if (loading) return <SkeletonCard />;

  const players = data ?? [];
  const teamName = players[0]?.nombreEquipo ?? `Equipo ${id}`;

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>FEDERACIÓN CÁNTABRA · EQUIPO</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>{teamName}</h1>
        <p
          className="mono"
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
          }}
        >
          {players.length} JUGADORES FEDERADOS
        </p>
      </div>

      {error || players.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconFlag size={34} />}
            title="No se pudo cargar el equipo."
            body={error ?? "No hay jugadores sincronizados para este equipo."}
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {players.map((p, i) => (
            <div
              key={p.idJugador}
              className="tw-fcp-row"
              style={{
                borderBottom: i === players.length - 1 ? "none" : "1px solid var(--hair)",
              }}
            >
              <span className="mono" style={{ fontSize: 11, color: "var(--text-faint)" }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700 }}>{p.nombre}</span>
              <span
                className="mono"
                style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--text-faint)" }}
              >
                {p.categoria ?? "—"}
              </span>
              <span
                className="mono"
                style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}
              >
                {p.puntos}
              </span>
              <span />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ═══ 05 · JUGADOR FEDERADO ═══════════════════════════════════════ */
export function FcpPlayerView({ id }: { id: string }) {
  const { user } = useSession();
  const { data, loading } = useAsync(() => searchFcpPlayers(id, 1), [id, user?.id]);

  if (loading) return <SkeletonCard />;

  const p = (data ?? [])[0];
  if (!p) {
    return (
      <Card>
        <EmptyState
          icon={<IconFlag size={34} />}
          title="Jugador no encontrado"
          body="Busca por nombre desde Explorar Federación."
        />
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>FEDERACIÓN CÁNTABRA · JUGADOR</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>{p.nombre}</h1>
        <p
          className="mono"
          style={{
            margin: "8px 0 0",
            fontSize: 11,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
          }}
        >
          {(p.nombreEquipo ?? "SIN EQUIPO").toUpperCase()}
        </p>
      </div>

      <div className="tw-solo-stats">
        {[
          { l: "PUNTOS FEP", v: String(p.puntos), accent: true },
          { l: "CATEGORÍA", v: p.categoria ?? "—" },
        ].map((k) => (
          <Card key={k.l} style={{ padding: 20 }}>
            <div className="mono tw-stat-label">{k.l}</div>
            <div
              className="mono tw-stat-value"
              style={{ fontSize: 26, ...(k.accent ? { color: "var(--accent)" } : null) }}
            >
              {k.v}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
