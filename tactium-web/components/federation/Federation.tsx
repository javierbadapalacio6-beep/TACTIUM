"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  fetchFcpBracket,
  fetchFcpBracketTieActa,
  fetchFcpGroupActas,
  fetchFcpGroups,
  fetchFcpLeagues,
  fetchFcpMatches,
  fetchFcpPlayerHistory,
  fetchFcpPlayerProfile,
  fetchFcpPlayerTeamRank,
  fetchFcpPlayerYearMatches,
  fetchFcpPlayerYears,
  fetchFcpRanking,
  fetchFcpStandings,
  fetchFcpTeamProfile,
  searchFcpPlayers,
  searchFcpTeams,
  type FcpBracketTie,
  type FcpGroup,
  type FcpPlayerMatch,
  type FcpPlayerYearTeam,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { EmptyState, Skeleton, SkeletonCard } from "@/components/states";
import { IconChevronRight, IconFlag, IconSearch } from "@/components/Icon";

/**
 * Federación — datos reales de las tablas `fcp_*`, con lectura pública
 * (migración 20260811c). Son datos que la federación publica en abierto.
 *
 * La estructura es la MISMA que la pantalla Explorar Federación de la app:
 * pestañas Todo · Equipos · Jugadores · Rankings y filtros en línea de año,
 * género, categoría y grupo. Si las dos superficies enseñan lo mismo con la
 * misma forma, quien salta de una a otra no tiene que reaprender nada.
 */

const FEDERATIONS = [
  { slug: "cantabra", name: "Federación Cántabra de Pádel", short: "FCP", active: true },
  { slug: "asturiana", name: "Federación Asturiana de Pádel", short: "FAP", active: false },
  { slug: "vasca", name: "Federación Vasca de Pádel", short: "FVP", active: false },
  { slug: "madrilena", name: "Federación Madrileña de Pádel", short: "FMP", active: false },
];

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

type Tab = "todo" | "equipos" | "jugadores" | "rankings";
const TABS: [Tab, string][] = [
  ["todo", "Todo"],
  ["equipos", "Equipos"],
  ["jugadores", "Jugadores"],
  ["rankings", "Rankings"],
];

/** Una fila de filtro: etiqueta + chips en una línea que hace scroll. */
function FilterRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  if (options.length <= 1) return null;
  return (
    <div className="tw-fcp-filter">
      <span className="tw-fcp-filter-label">{label}</span>
      <div className="tw-fcp-filter-chips">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={on}
              className={"tw-fcp-chip" + (on ? " is-on" : "")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function FederationExplore({ slug }: { slug: string }) {
  const [tab, setTab] = useState<Tab>("todo");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [gender, setGender] = useState<"all" | "M" | "F">("all");
  const [cat, setCat] = useState("all");
  const [grupo, setGrupo] = useState("all");

  // Una consulta por tecla es una consulta de más.
  useEffect(() => {
    const id = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const leagues = useAsync(() => fetchFcpLeagues(), []);

  // Por defecto, la temporada más reciente.
  useEffect(() => {
    if (year == null && leagues.data?.length) setYear(leagues.data[0].idLiga);
  }, [leagues.data, year]);

  const groups = useAsync(() => fetchFcpGroups(year), [year], year != null);
  const allGroups = useMemo(() => groups.data ?? [], [groups.data]);

  // ── Opciones de los filtros, derivadas de los propios datos ─────────────
  const catOptions = useMemo(() => {
    const set = new Set<string>();
    for (const g of allGroups) {
      if (gender !== "all" && g.genero !== gender) continue;
      if (g.categoria) set.add(g.categoria);
    }
    const sorted = [...set].sort(
      (a, b) => parseInt(a, 10) - parseInt(b, 10)
    );
    return [
      { value: "all", label: "Todas" },
      ...sorted.map((c) => ({ value: c, label: c })),
    ];
  }, [allGroups, gender]);

  const grupoOptions = useMemo(
    () =>
      allGroups.filter(
        (g) =>
          !g.esPlayoff &&
          (gender === "all" || g.genero === gender) &&
          (cat === "all" || g.categoria === cat)
      ),
    [allGroups, gender, cat]
  );

  // Si el grupo elegido deja de casar con los demás filtros, se suelta.
  useEffect(() => {
    if (grupo !== "all" && !grupoOptions.some((g) => g.idGrupo === grupo)) {
      setGrupo("all");
    }
  }, [grupoOptions, grupo]);

  // ── Grupos que se listan ────────────────────────────────────────────────
  const shownGroups = useMemo(() => {
    const t = term.toLowerCase();
    return allGroups.filter((g) => {
      if (gender !== "all" && g.genero !== gender) return false;
      if (cat !== "all" && g.categoria !== cat) return false;
      if (grupo !== "all" && g.idGrupo !== grupo) return false;
      return !t || g.nombre.toLowerCase().includes(t);
    });
  }, [allGroups, gender, cat, grupo, term]);

  const scopedGroupIds = useMemo(
    () =>
      grupo !== "all" ? [grupo] : grupoOptions.map((g) => g.idGrupo),
    [grupo, grupoOptions]
  );

  // ── Datos por pestaña ───────────────────────────────────────────────────
  const teams = useAsync(
    () =>
      searchFcpTeams({
        query: term,
        grupoIds: term.length < 2 ? scopedGroupIds : undefined,
        limit: 60,
      }),
    [term, scopedGroupIds.join(",")],
    tab === "equipos" && (term.length >= 2 || scopedGroupIds.length > 0)
  );

  const players = useAsync(
    () => searchFcpPlayers(term, 40),
    [term],
    tab === "jugadores" && term.length >= 3
  );

  const ranking = useAsync(
    () =>
      fetchFcpRanking({ genero: gender, categoria: cat, query: term, limit: 150 }),
    [gender, cat, term],
    tab === "rankings"
  );

  const filtersOn = gender !== "all" || cat !== "all" || grupo !== "all";
  const reset = () => {
    setGender("all");
    setCat("all");
    setGrupo("all");
  };

  const yearOptions = (leagues.data ?? []).map((l) => ({
    value: String(l.idLiga),
    label: l.temporada ?? String(l.idLiga),
  }));

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>FEDERACIÓN CÁNTABRA</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>
          Federación Cántabra de Pádel
        </h1>
        <p
          className="mono"
          style={{
            margin: "8px 0 0",
            fontSize: 10.5,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
          }}
        >
          {/* El contador habla de lo que hay debajo, no siempre de grupos. */}
          {tab === "rankings"
            ? `${(ranking.data ?? []).length} JUGADORES EN EL RANKING`
            : tab === "jugadores"
              ? `${(players.data ?? []).length} JUGADORES`
              : tab === "equipos"
                ? `${(teams.data ?? []).length} EQUIPOS`
                : groups.loading
                  ? "CARGANDO…"
                  : `${shownGroups.length} DE ${allGroups.length} GRUPOS`}
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
              tab === "jugadores"
                ? "Busca un jugador (3 letras)…"
                : tab === "equipos"
                  ? "Busca un equipo…"
                  : tab === "rankings"
                    ? "Busca en el ranking…"
                    : "Busca un grupo…"
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

        {/* Pestañas */}
        <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {TABS.map(([k, label]) => {
            const on = tab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                aria-pressed={on}
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
        </div>

        {/* Filtros en línea. En Rankings el grupo no pinta nada: la lista es
            por género y categoría, no por grupo. */}
        <div className="tw-fcp-filters">
          <FilterRow
            label="Temporada"
            value={String(year ?? "")}
            options={yearOptions}
            onChange={(v) => setYear(Number(v))}
          />
          <FilterRow
            label="Género"
            value={gender}
            options={[
              { value: "all", label: "Ambos" },
              { value: "M", label: "Masculino" },
              { value: "F", label: "Femenino" },
            ]}
            onChange={(v) => setGender(v as "all" | "M" | "F")}
          />
          <FilterRow
            label="Categoría"
            value={cat}
            options={catOptions}
            onChange={setCat}
          />
          {tab !== "rankings" && (
            <FilterRow
              label="Grupo"
              value={grupo}
              options={[
                { value: "all", label: "Todos" },
                ...grupoOptions.map((g) => ({
                  value: g.idGrupo,
                  label: g.nombre,
                })),
              ]}
              onChange={setGrupo}
            />
          )}

          {filtersOn && (
            <button type="button" onClick={reset} className="tw-fcp-reset">
              Restablecer filtros
            </button>
          )}
        </div>
      </Card>

      {/* ── TODO · grupos ─────────────────────────────────────────── */}
      {tab === "todo" &&
        (groups.loading ? (
          <SkeletonCard />
        ) : groups.error ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={34} />}
              title="No se pudieron cargar los grupos"
              body={groups.error}
            />
          </Card>
        ) : shownGroups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={34} />}
              title="No hay grupos con esos filtros"
              body="Prueba a quitar la categoría o el género."
            />
          </Card>
        ) : (
          <div className="tw-club-teams">
            {shownGroups.map((g: FcpGroup) => (
              <Link
                key={g.idGrupo}
                href={`/federacion/${slug}/grupo/${encodeURIComponent(g.idGrupo)}`}
                style={{ color: "inherit" }}
              >
                <Card style={{ padding: 20, height: "100%" }}>
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
                    {[
                      g.genero === "F" ? "FEMENINO" : "MASCULINO",
                      g.categoria,
                      g.esPlayoff ? "FASE FINAL" : null,
                      g.temporada,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ))}

      {/* ── EQUIPOS ───────────────────────────────────────────────── */}
      {tab === "equipos" &&
        (teams.loading ? (
          <SkeletonCard />
        ) : teams.error ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={34} />}
              title="Error en la búsqueda"
              body={teams.error}
            />
          </Card>
        ) : (teams.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconSearch size={34} />}
              title="Sin equipos"
              body="Escribe un nombre o acota por categoría y grupo."
            />
          </Card>
        ) : (
          <div className="tw-club-teams">
            {(teams.data ?? []).map((t) => (
              <Link
                key={t.idEquipo}
                href={`/federacion/${slug}/equipo/${t.idEquipo}`}
                style={{ color: "inherit" }}
              >
                <Card style={{ padding: 18, height: "100%" }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{t.equipo}</div>
                </Card>
              </Link>
            ))}
          </div>
        ))}

      {/* ── JUGADORES ─────────────────────────────────────────────── */}
      {tab === "jugadores" &&
        (term.length < 3 ? (
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
              <Link
                key={p.idJugador}
                href={`/federacion/${slug}/jugador/${encodeURIComponent(p.idJugador)}`}
                style={{ color: "inherit" }}
              >
                <div
                  className="tw-fcp-row"
                  style={{
                    borderBottom:
                      i === arr.length - 1 ? "none" : "1px solid var(--hair)",
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
                  <IconChevronRight size={15} />
                </div>
              </Link>
            ))}
          </Card>
        ))}

      {/* ── RANKINGS ──────────────────────────────────────────────── */}
      {tab === "rankings" &&
        (ranking.loading ? (
          <SkeletonCard />
        ) : ranking.error ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={34} />}
              title="No se pudo cargar el ranking"
              body={ranking.error}
            />
          </Card>
        ) : (ranking.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={34} />}
              title="No hay ranking para esa combinación"
              body="Cambia el género o la categoría."
            />
          </Card>
        ) : (
          <Card style={{ padding: 0, overflow: "hidden" }}>
            <div className="tw-fcp-rank-row tw-fcp-rank-head">
              <span>#</span>
              <span>Jugador</span>
              <span style={{ textAlign: "right" }}>Puntos</span>
            </div>
            {(ranking.data ?? []).map((r, i, arr) => (
              <div
                key={`${r.posicion}-${r.name}`}
                className="tw-fcp-rank-row"
                style={{
                  borderBottom:
                    i === arr.length - 1 ? "none" : "1px solid var(--hair)",
                }}
              >
                <span
                  className="mono"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: r.posicion <= 3 ? "var(--accent)" : "var(--text-faint)",
                  }}
                >
                  {r.posicion}
                </span>
                <span style={{ fontSize: 13.5, fontWeight: 600 }}>{r.name}</span>
                <span
                  className="mono"
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {r.puntos ?? "—"}
                </span>
              </div>
            ))}
          </Card>
        ))}
    </div>
  );
}

/* ═══ Primitivas compartidas del rediseño "scoreboard" ════════════ */

const fmtInt = (n: number) => n.toLocaleString("es-ES");

/** Iniciales de un nombre: "Central Padel A" → "CP", "Nuria H." → "NH". */
function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
}

/** Racha V/D en cajitas mono (verde = victoria, rojo = derrota). */
function FormPips({ form, box = 18 }: { form: ("V" | "D")[]; box?: number }) {
  if (form.length === 0) return null;
  return (
    <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
      {form.map((r, i) => (
        <span
          key={i}
          className="mono"
          style={{
            width: box,
            height: box,
            borderRadius: 5,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9.5,
            fontWeight: 700,
            background: r === "V" ? "var(--accent-10)" : "var(--error-soft)",
            color: r === "V" ? "var(--accent)" : "var(--error)",
          }}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

/** Celda de estadística: valor mono grande + label mono con tracking. */
function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span
        className="mono"
        style={{ fontSize: 19, fontWeight: 800, color: color ?? "var(--text)", lineHeight: 1 }}
      >
        {value}
      </span>
      <span
        className="mono"
        style={{ fontSize: 9.5, letterSpacing: "0.14em", color: "var(--text-faint)" }}
      >
        {label}
      </span>
    </div>
  );
}

/** Cabecera de lista: eyebrow mono a la izquierda + acción opcional a la derecha. */
function ListHeader({
  title,
  action,
  onAction,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        paddingBottom: 10,
        borderBottom: "1px solid var(--hair)",
        marginBottom: 12,
      }}
    >
      <span
        className="mono"
        style={{ fontSize: 11, letterSpacing: "0.2em", color: "var(--text-muted)", fontWeight: 600 }}
      >
        {title}
      </span>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          style={{
            border: "none",
            background: "transparent",
            cursor: onAction ? "pointer" : "default",
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
            letterSpacing: "0.08em",
            fontWeight: 600,
            color: "var(--accent)",
          }}
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

/** Botones de pestaña con el mismo estilo en todas las vistas de federación. */
function TabBar<T extends string>({
  items,
  value,
  onChange,
}: {
  items: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {items.map(([k, label]) => {
        const on = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
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
  );
}

/* ═══ 03 · GRUPO ══════════════════════════════════════════════════ */

// Columnas de la tabla de clasificación (comparte plantilla cabecera + filas).
const STAND_COLS =
  "38px minmax(150px, 1.7fr) 34px 34px 46px 46px 46px 52px minmax(104px, auto)";

type GroupTab = "clasificacion" | "jornadas" | "cuadro";

export function FcpGroupView({ slug, id }: { slug: string; id: string }) {
  const { user } = useSession();
  const esPlayoff = /^fase/i.test(decodeURIComponent(id));
  const [tab, setTab] = useState<GroupTab>(esPlayoff ? "cuadro" : "clasificacion");

  const standings = useAsync(() => fetchFcpStandings(id), [id, user?.id]);
  // Los partidos se cargan siempre: alimentan tanto las jornadas como la meta.
  const matches = useAsync(() => fetchFcpMatches(id), [id, user?.id]);
  if (standings.loading) return <SkeletonCard />;

  const rows = standings.data ?? [];
  const mData = matches.data ?? [];

  // Meta del grupo, derivada del calendario.
  const jugadas = mData.filter((m) => m.resultado).map((m) => m.jornada ?? 0);
  const jornadaTotal = mData.reduce((mx, m) => Math.max(mx, m.jornada ?? 0), 0);
  const jornadaActual = jugadas.length ? Math.max(...jugadas) : 0;
  const finalizada = jornadaTotal > 0 && jornadaActual >= jornadaTotal;

  const tabs: [GroupTab, string][] = esPlayoff
    ? [
        ["cuadro", "Cuadro"],
        ["clasificacion", "Clasificación"],
        ["jornadas", "Jornadas"],
      ]
    : [
        ["clasificacion", "Clasificación"],
        ["jornadas", "Jornadas"],
      ];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <Eyebrow>FEDERACIÓN CÁNTABRA · GRUPO</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>{decodeURIComponent(id)}</h1>
        {tab !== "cuadro" ? (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {rows.length > 0 ? (
              <span className="chip chip-mute">{rows.length} equipos</span>
            ) : null}
            {jornadaTotal > 0 ? (
              <span className="chip chip-mute">
                J·{jornadaActual}/{jornadaTotal}
              </span>
            ) : null}
            <span className={finalizada ? "chip" : "chip chip-mute"}>
              {finalizada ? "Finalizada" : "En curso"}
            </span>
          </div>
        ) : null}
      </div>

      <div style={{ marginBottom: 18 }}>
        <TabBar items={tabs} value={tab} onChange={setTab} />
      </div>

      {tab === "cuadro" ? (
        <FcpBracketPanel idGrupo={id} />
      ) : tab === "clasificacion" ? (
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
              <div
                className="tw-fcp-head"
                style={{ gridTemplateColumns: STAND_COLS, minWidth: 700 }}
              >
                {["POS", "EQUIPO", "PJ", "PG", "DIF", "SETS +", "SETS −", "PTS", "RACHA"].map(
                  (h) => (
                    <span key={h}>{h}</span>
                  )
                )}
              </div>
              {rows.map((t) => {
                const dif = t.setsFavor - t.setsContra;
                return (
                  <Link
                    key={t.idEquipo}
                    href={`/federacion/${slug}/equipo/${t.idEquipo}`}
                    className="tw-fcp-table-row"
                    style={{ color: "inherit", gridTemplateColumns: STAND_COLS, minWidth: 700 }}
                  >
                    <span className="mono">{t.posicion}</span>
                    <span style={{ fontWeight: 700 }}>{t.equipo}</span>
                    <span className="mono">{t.pj}</span>
                    <span className="mono">{t.pg}</span>
                    <span className="mono" style={{ color: "var(--text-muted)" }}>
                      {dif >= 0 ? `+${dif}` : dif}
                    </span>
                    <span className="mono">{t.setsFavor}</span>
                    <span className="mono">{t.setsContra}</span>
                    <span className="mono" style={{ fontWeight: 700, color: "var(--accent)" }}>
                      {t.puntos}
                    </span>
                    <span>
                      {t.form.length > 0 ? (
                        <FormPips form={t.form} box={16} />
                      ) : (
                        <span className="mono" style={{ color: "var(--text-faint)" }}>
                          —
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          </Card>
        )
      ) : matches.loading ? (
        <SkeletonCard />
      ) : mData.length === 0 ? (
        <Card>
          <EmptyState icon={<IconFlag size={34} />} title="Sin jornadas registradas." />
        </Card>
      ) : (
        <FcpGroupSchedule idGrupo={id} matches={mData} />
      )}
    </div>
  );
}

/* ── Jornadas del grupo: agrupadas por jornada, con parciales inline ── */
function splitScore(resultado: string | null): [string, string] | null {
  if (!resultado) return null;
  const m = resultado.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  return m ? [m[1], m[2]] : null;
}

function FcpGroupSchedule({
  idGrupo,
  matches,
}: {
  idGrupo: string;
  matches: Awaited<ReturnType<typeof fetchFcpMatches>>;
}) {
  const { user } = useSession();
  const actas = useAsync(() => fetchFcpGroupActas(idGrupo), [idGrupo, user?.id]);
  const actaMap = actas.data ?? {};

  // Agrupar por jornada (ronda de playoff = 9999 al final).
  const groups = useMemo(() => {
    const map = new Map<number, { label: string; order: number; items: typeof matches }>();
    for (const m of matches) {
      const isPlayoff = m.jornada == null;
      const order = isPlayoff ? 9999 : m.jornada ?? 0;
      const key = order;
      if (!map.has(key)) {
        map.set(key, {
          label: isPlayoff ? m.ronda ?? "Playoff" : `Jornada ${m.jornada}`,
          order,
          items: [] as typeof matches,
        });
      }
      map.get(key)!.items.push(m);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  }, [matches]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {groups.map((g) => {
        const date = g.items.find((m) => m.fecha)?.fecha ?? null;
        return (
          <div key={g.label}>
            <div
              style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}
            >
              <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em" }}>
                {g.label}
              </span>
              <span style={{ flex: 1, height: 1, background: "var(--hair)" }} />
              {date ? (
                <span
                  className="mono"
                  style={{ fontSize: 10.5, letterSpacing: "0.1em", color: "var(--text-faint)" }}
                >
                  {date}
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {g.items.map((p) => {
                const score = splitScore(p.resultado);
                const localWon = p.ganador === "local";
                const visitWon = p.ganador === "visitante";
                const acta = (actaMap[p.idPartido] ?? []).slice(0, 3);
                return (
                  <Card key={p.idPartido} style={{ padding: 0, overflow: "hidden" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "14px 18px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 8 }}>
                        {[
                          [p.local, localWon] as const,
                          [p.visitante, visitWon] as const,
                        ].map(([name, won], i) => (
                          <div
                            key={i}
                            style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
                          >
                            <span
                              style={{
                                width: 5,
                                height: 5,
                                borderRadius: 999,
                                flex: "none",
                                background: won ? "var(--accent)" : "var(--hair-strong)",
                              }}
                            />
                            <span
                              style={{
                                fontSize: 13.5,
                                fontWeight: won ? 700 : 500,
                                color: won ? "var(--text)" : "var(--text-muted)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {name}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: "grid", gap: 8, textAlign: "center" }}>
                        <span
                          className="mono"
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: localWon ? "var(--text)" : "var(--text-muted)",
                          }}
                        >
                          {score ? score[0] : "·"}
                        </span>
                        <span
                          className="mono"
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: visitWon ? "var(--text)" : "var(--text-muted)",
                          }}
                        >
                          {score ? score[1] : "·"}
                        </span>
                      </div>
                      {!p.resultado ? (
                        <span className="chip chip-mute">Por jugar</span>
                      ) : null}
                    </div>
                    {acta.length > 0 ? (
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          padding: "9px 18px",
                          borderTop: "1px solid var(--hair)",
                          background: "var(--bg-card-2)",
                        }}
                      >
                        {acta.map((a) => (
                          <span
                            key={a.partidoNum}
                            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                          >
                            <span
                              className="mono"
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                padding: "2px 5px",
                                borderRadius: 5,
                                background: "var(--bg-raised)",
                                color: "var(--text-muted)",
                              }}
                            >
                              P{a.partidoNum}
                            </span>
                            <span
                              className="mono"
                              style={{ fontSize: 10.5, color: "var(--text-faint)" }}
                            >
                              {a.parciales || `${a.setsLocal ?? 0}-${a.setsVisit ?? 0}`}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Cuadro de playoff (bracket): columnas por ronda + modal de acta ── */
function FcpBracketPanel({ idGrupo }: { idGrupo: string }) {
  const { user } = useSession();
  const bracket = useAsync(() => fetchFcpBracket(idGrupo), [idGrupo, user?.id]);
  const [selCuadro, setSelCuadro] = useState(0);
  const [openTie, setOpenTie] = useState<FcpBracketTie | null>(null);

  if (bracket.loading) return <SkeletonCard />;
  const data = bracket.data;
  if (bracket.error || !data || data.cuadros.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconFlag size={34} />}
          title="El cuadro aún no está disponible."
          body={bracket.error ?? undefined}
        />
      </Card>
    );
  }

  const cuadro = data.cuadros[selCuadro] ?? data.cuadros[0];

  return (
    <div>
      {data.cuadros.length > 1 ? (
        <div style={{ marginBottom: 16 }}>
          <TabBar
            items={data.cuadros.map((q, i) => [String(i), q.label] as [string, string])}
            value={String(selCuadro)}
            onChange={(v) => setSelCuadro(Number(v))}
          />
        </div>
      ) : null}

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 16, paddingBottom: 6, minWidth: "min-content" }}>
          {cuadro.rounds.map((r) => (
            <div key={r.avance} style={{ width: 200, flex: "none" }}>
              <div
                className="mono"
                style={{
                  fontSize: 10.5,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--accent)",
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                {r.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {r.ties.map((t) => (
                  <TieCard key={t.idPartido} tie={t} onOpen={() => setOpenTie(t)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TieActaModal tie={openTie} onClose={() => setOpenTie(null)} />
    </div>
  );
}

function TieCard({ tie, onOpen }: { tie: FcpBracketTie; onOpen: () => void }) {
  const hasActa = tie.estado === "jugado" || tie.estado === "jugado_ida";
  const line = (name: string | null, won: boolean, muted?: boolean) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ width: 12, flex: "none", color: "var(--accent)" }}>{won ? "✓" : ""}</span>
      <span
        style={{
          fontSize: 12.5,
          fontWeight: won ? 800 : 600,
          color: won ? "var(--text)" : muted ? "var(--text-faint)" : "var(--text-muted)",
          fontStyle: muted ? "italic" : "normal",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {name || "—"}
      </span>
    </div>
  );
  return (
    <button
      type="button"
      disabled={!hasActa}
      onClick={onOpen}
      style={{
        textAlign: "left",
        width: "100%",
        background: "var(--bg-card)",
        border: "1px solid var(--hair-strong)",
        borderRadius: 12,
        padding: "8px 10px",
        cursor: hasActa ? "pointer" : "default",
        display: "grid",
        gap: 6,
      }}
    >
      {line(tie.local, tie.ganador === "local")}
      <div style={{ height: 1, background: "var(--hair)" }} />
      {line(tie.visit || "Por determinar", tie.ganador === "visitante", !tie.visit)}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 3,
        }}
      >
        <span className="mono" style={{ fontSize: 13, fontWeight: 800 }}>
          {tie.marcador ? tie.marcador.replace("-", "–") : hasActa ? "—" : "pend."}
        </span>
        {hasActa ? (
          <span className="mono" style={{ fontSize: 9.5, color: "var(--text-faint)" }}>
            ver acta
          </span>
        ) : null}
      </div>
    </button>
  );
}

function TieActaModal({ tie, onClose }: { tie: FcpBracketTie | null; onClose: () => void }) {
  const acta = useAsync(
    () => fetchFcpBracketTieActa(tie!.idPartido),
    [tie?.idPartido],
    !!tie
  );
  if (!tie) return null;
  const data = acta.data;
  const empty = !data || (data.ida.length === 0 && data.vuelta.length === 0);

  const leg = (title: string, partidos: FcpActaLeg) =>
    partidos.length === 0 ? null : (
      <div style={{ marginTop: 16 }}>
        <div
          className="mono"
          style={{ fontSize: 11, letterSpacing: "0.16em", color: "var(--accent)", fontWeight: 700 }}
        >
          {title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
          {partidos.map((g) => (
            <div
              key={g.partidoNum}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                border: "1px solid var(--hair-strong)",
                borderRadius: 10,
                background: "var(--bg-card)",
              }}
            >
              <span className="mono" style={{ fontSize: 11, fontWeight: 800, color: "var(--text-faint)", width: 16, textAlign: "center" }}>
                {g.partidoNum}
              </span>
              <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 1 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: g.ganador === "local" ? 800 : 600,
                    color: g.ganador === "local" ? "var(--text)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {[g.localJ1, g.localJ2].filter(Boolean).join(" / ") || "—"}
                </span>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: g.ganador === "visitante" ? 800 : 600,
                    color: g.ganador === "visitante" ? "var(--text)" : "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {[g.visitJ1, g.visitJ2].filter(Boolean).join(" / ") || "—"}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 12, fontWeight: 700 }}>
                {g.parciales || `${g.setsLocal ?? 0}-${g.setsVisit ?? 0}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <Modal open={!!tie} onClose={onClose} labelledBy="tie-acta-title" width={520}>
      <div id="tie-acta-title" style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{tie.local || "—"}</span>
        <span className="mono" style={{ margin: "0 8px", fontSize: 11, color: "var(--text-faint)" }}>
          vs
        </span>
        <span style={{ fontSize: 16, fontWeight: 800 }}>{tie.visit || "Por determinar"}</span>
      </div>
      {acta.loading ? (
        <Skeleton h={80} style={{ marginTop: 16 }} />
      ) : empty ? (
        <p style={{ marginTop: 16, fontSize: 13.5, color: "var(--text-muted)" }}>
          Acta no disponible todavía.
        </p>
      ) : (
        <>
          {leg("IDA", data!.ida)}
          {leg("VUELTA", data!.vuelta)}
        </>
      )}
    </Modal>
  );
}
type FcpActaLeg = Awaited<ReturnType<typeof fetchFcpBracketTieActa>>["ida"];

/* ═══ 04 · EQUIPO FEDERADO ════════════════════════════════════════ */
export function FcpTeamView({ slug, id }: { slug: string; id: string }) {
  const { user } = useSession();
  const idEquipo = Number(id);
  const [sort, setSort] = useState<"puntos" | "nombre">("puntos");
  const { data, loading, error } = useAsync(
    () => fetchFcpTeamProfile(idEquipo),
    [idEquipo, user?.id],
    Number.isFinite(idEquipo)
  );

  if (loading) return <SkeletonCard />;

  if (error || !data) {
    return (
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <Eyebrow>FEDERACIÓN CÁNTABRA · EQUIPO</Eyebrow>
          <h1 style={{ marginTop: 10, fontSize: 30 }}>Equipo {id}</h1>
        </div>
        <Card>
          <EmptyState
            icon={<IconFlag size={34} />}
            title="No se pudo cargar el equipo."
            body={error ?? "No hay datos sincronizados para este equipo."}
          />
        </Card>
      </div>
    );
  }

  const dif = data.setsFavor - data.setsContra;
  const winRate = data.pj > 0 ? Math.round((data.pg / data.pj) * 100) : null;
  const roster = [...data.roster].sort((a, b) =>
    sort === "nombre" ? a.name.localeCompare(b.name) : b.puntos - a.puntos
  );

  const stats: { k: string; v: string; color?: string }[] = [
    { k: "PJ", v: String(data.pj) },
    { k: "PG", v: String(data.pg), color: "var(--accent)" },
    { k: "PP", v: String(data.pp), color: "var(--error)" },
    { k: "SETS", v: `${data.setsFavor}·${data.setsContra}` },
    {
      k: "DIF",
      v: dif >= 0 ? `+${dif}` : String(dif),
      color: dif > 0 ? "var(--accent)" : dif < 0 ? "var(--error)" : undefined,
    },
    { k: "% VIC", v: winRate != null ? String(winRate) : "—" },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <Eyebrow>FEDERACIÓN CÁNTABRA · EQUIPO</Eyebrow>
      </div>

      {/* Hero */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <span
          className="mono"
          style={{
            width: 58,
            height: 58,
            borderRadius: 16,
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-card-2)",
            border: "1px solid var(--hair-strong)",
            color: "var(--accent)",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {initials(data.equipo)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 26, lineHeight: 1.1 }}>{data.equipo}</h1>
          {data.grupo ? (
            <p
              className="mono"
              style={{
                margin: "6px 0 0",
                fontSize: 10.5,
                letterSpacing: "0.14em",
                color: "var(--text-faint)",
              }}
            >
              {data.grupo.toUpperCase()}
            </p>
          ) : null}
        </div>
        {data.posicion != null ? (
          <div
            style={{
              flex: "none",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "var(--accent-10)",
              border: "1px solid var(--accent-40)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span className="mono" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
              {data.posicion}º
            </span>
            <span className="mono" style={{ fontSize: 8, letterSpacing: "0.12em", color: "var(--accent)" }}>
              GRUPO
            </span>
          </div>
        ) : null}
      </div>

      {/* Bloque de estadística */}
      <Card style={{ padding: 20, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "stretch", gap: 18, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 4,
              paddingRight: 18,
              borderRight: "1px solid var(--hair)",
            }}
          >
            <span className="mono" style={{ fontSize: 38, fontWeight: 800, color: "var(--accent)", lineHeight: 1 }}>
              {data.puntos}
            </span>
            <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.18em", color: "var(--text-faint)" }}>
              PUNTOS
            </span>
          </div>
          <div
            style={{
              flex: 1,
              minWidth: 220,
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 14,
              alignContent: "center",
            }}
          >
            {stats.map((s) => (
              <StatTile key={s.k} label={s.k} value={s.v} color={s.color} />
            ))}
          </div>
        </div>
      </Card>

      {/* Racha de la temporada */}
      {data.form.length > 0 ? (
        <Card style={{ padding: "14px 18px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.16em", color: "var(--text-faint)" }}>
              TEMPORADA
            </span>
            <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "flex-end", overflowX: "auto" }}>
              <FormPips form={data.form} box={18} />
            </div>
          </div>
        </Card>
      ) : null}

      {/* Plantilla */}
      <ListHeader
        title={`PLANTILLA · ${data.roster.length}`}
        action={sort === "puntos" ? "POR PUNTOS ▾" : "POR NOMBRE ▾"}
        onAction={() => setSort((s) => (s === "puntos" ? "nombre" : "puntos"))}
      />
      {roster.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconFlag size={34} />}
            title="Sin plantilla sincronizada."
            body="Aún no hay jugadores federados para este equipo."
          />
        </Card>
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          {roster.map((p, i) => (
            <Link
              key={p.idJugador}
              href={`/federacion/${slug}/jugador/${encodeURIComponent(p.idJugador)}`}
              style={{
                color: "inherit",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 18px",
                borderBottom: i === roster.length - 1 ? "none" : "1px solid var(--hair)",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 12, fontWeight: 700, color: "var(--text-faint)", width: 18, textAlign: "center" }}
              >
                {i + 1}
              </span>
              <span
                className="mono"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--bg-card-2)",
                  border: "1px solid var(--hair-strong)",
                  color: "var(--text-muted)",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {initials(p.name)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </div>
                {p.categoria ? (
                  <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.1em", color: "var(--text-faint)", marginTop: 2 }}>
                    {p.categoria.toUpperCase()}
                  </div>
                ) : null}
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)" }}>
                  {fmtInt(p.puntos)}
                </div>
                <div className="mono" style={{ fontSize: 8.5, letterSpacing: "0.1em", color: "var(--text-faint)" }}>
                  PTS FCP
                </div>
              </div>
              <IconChevronRight size={15} />
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

/* ═══ 05 · JUGADOR FEDERADO ═══════════════════════════════════════ */
type MatchFilter = "todos" | "victorias" | "derrotas";
const MATCH_FILTER_LABEL: Record<MatchFilter, string> = {
  todos: "TODOS ▾",
  victorias: "VICTORIAS ▾",
  derrotas: "DERROTAS ▾",
};

export function FcpPlayerView({ id }: { id: string }) {
  const { user } = useSession();
  const idJugador = decodeURIComponent(id);

  const profile = useAsync(() => fetchFcpPlayerProfile(idJugador), [idJugador, user?.id]);
  const years = useAsync(() => fetchFcpPlayerYears(idJugador), [idJugador, user?.id]);
  const history = useAsync(() => fetchFcpPlayerHistory(idJugador), [idJugador, user?.id]);

  const [selLiga, setSelLiga] = useState<number | null>(null);
  const [filter, setFilter] = useState<MatchFilter>("todos");

  // Por defecto, la temporada más reciente.
  useEffect(() => {
    if (selLiga == null && years.data?.length) setSelLiga(years.data[0].idLiga);
  }, [years.data, selLiga]);

  const selYear: FcpPlayerYearTeam | null =
    years.data?.find((y) => y.idLiga === selLiga) ?? null;

  const yearMatches = useAsync(
    () => fetchFcpPlayerYearMatches(idJugador, selLiga!),
    [idJugador, selLiga, user?.id],
    selLiga != null
  );
  const teamRank = useAsync(
    () => fetchFcpPlayerTeamRank(selYear!.idEquipo!, idJugador),
    [selYear?.idEquipo, idJugador, user?.id],
    !!selYear?.idEquipo
  );

  if (profile.loading) return <SkeletonCard />;

  const p = profile.data;
  if (profile.error || !p) {
    return (
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 22 }}>
          <Eyebrow>FEDERACIÓN CÁNTABRA · JUGADOR</Eyebrow>
        </div>
        <Card>
          <EmptyState
            icon={<IconFlag size={34} />}
            title="Jugador no encontrado"
            body={profile.error ?? "Busca por nombre desde Explorar Federación."}
          />
        </Card>
      </div>
    );
  }

  const yd = yearMatches.data;
  const wr = yd && yd.pj > 0 ? Math.round((yd.pg / yd.pj) * 100) : null;
  const sd = yd ? yd.setsFor - yd.setsAgainst : 0;
  const rankingPts = selYear?.puntos ?? p.puntos;
  const rank = teamRank.data;
  const variacion =
    selYear && history.data
      ? history.data.find((h) => String(h.anio) === selYear.anio)?.variacion ?? null
      : null;

  const stats: { k: string; v: string; color?: string }[] = [
    { k: "PJ", v: String(yd?.pj ?? 0) },
    { k: "PG", v: String(yd?.pg ?? 0), color: "var(--accent)" },
    { k: "PP", v: String(yd?.pp ?? 0), color: "var(--error)" },
    { k: "% VIC", v: wr != null ? String(wr) : "—" },
    { k: "SETS", v: sd >= 0 ? `+${sd}` : String(sd) },
  ];

  // Partidos filtrados y agrupados por jornada.
  const dayGroups = (() => {
    if (!yd) return [] as { label: string; order: number; games: FcpPlayerMatch[] }[];
    const filtered = yd.matches.filter((m) =>
      filter === "todos" ? true : filter === "victorias" ? m.won : !m.won
    );
    const map = new Map<string, { label: string; order: number; games: FcpPlayerMatch[] }>();
    for (const m of filtered) {
      const isPlayoff = m.jornada == null;
      const key = isPlayoff ? "PLAYOFF" : `J${m.jornada}`;
      if (!map.has(key)) {
        map.set(key, {
          label: isPlayoff ? "PLAYOFF" : `JORNADA ${m.jornada}`,
          order: isPlayoff ? 9999 : m.jornada ?? 0,
          games: [],
        });
      }
      map.get(key)!.games.push(m);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  })();

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 18 }}>
        <Eyebrow>FEDERACIÓN CÁNTABRA · JUGADOR</Eyebrow>
      </div>

      {/* Hero */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <span
          style={{
            width: 60,
            height: 60,
            borderRadius: 999,
            flex: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--bg-card-2)",
            border: "1px solid var(--accent-40)",
            color: "var(--accent)",
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          {initials(p.name)}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 25, lineHeight: 1.1 }}>{p.name}</h1>
          <p
            className="mono"
            style={{ margin: "6px 0 0", fontSize: 10.5, letterSpacing: "0.14em", color: "var(--text-faint)" }}
          >
            {[selYear?.equipo || p.equipo, selYear?.categoria || p.categoria]
              .filter(Boolean)
              .join(" · ")
              .toUpperCase() || "SIN EQUIPO"}
          </p>
        </div>
      </div>

      {/* Ranking FCP */}
      <Card style={{ padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.18em", color: "var(--text-faint)" }}>
              RANKING FCP
            </span>
            <span className="mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}>
              {fmtInt(rankingPts)}
            </span>
          </div>
          <div style={{ display: "grid", gap: 4, textAlign: "right" }}>
            {rank && rank.rank > 0 ? (
              <span className="mono" style={{ fontSize: 9.5, letterSpacing: "0.12em", color: "var(--text-faint)" }}>
                Nº {rank.rank} EN EL EQUIPO
              </span>
            ) : null}
            {variacion != null && variacion !== 0 ? (
              <span
                className="mono"
                style={{ fontSize: 12, fontWeight: 600, color: variacion >= 0 ? "var(--accent)" : "var(--error)" }}
              >
                {variacion >= 0 ? "▲ +" : "▼ "}
                {fmtInt(variacion)} esta temporada
              </span>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Selector de temporada */}
      {(years.data ?? []).length > 0 ? (
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
          {(years.data ?? []).map((y) => {
            const on = y.idLiga === selLiga;
            return (
              <button
                key={y.idLiga}
                type="button"
                onClick={() => setSelLiga(y.idLiga)}
                className="btn"
                style={{
                  flex: "none",
                  padding: "8px 16px",
                  fontSize: 12.5,
                  fontWeight: on ? 700 : 500,
                  background: on ? "var(--accent)" : "transparent",
                  color: on ? "var(--text-inverse)" : "var(--text-muted)",
                  border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                }}
              >
                {y.anio}
              </button>
            );
          })}
        </div>
      ) : null}

      {/* Stats del año */}
      <Card style={{ padding: "16px 18px", marginBottom: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 12,
          }}
        >
          {stats.map((s) => (
            <StatTile key={s.k} label={s.k} value={s.v} color={s.color} />
          ))}
        </div>
      </Card>

      {/* Partidos */}
      <ListHeader
        title={`PARTIDOS · ${yd?.matches.length ?? 0}`}
        action={MATCH_FILTER_LABEL[filter]}
        onAction={() =>
          setFilter((f) => (f === "todos" ? "victorias" : f === "victorias" ? "derrotas" : "todos"))
        }
      />

      {yearMatches.loading ? (
        <SkeletonCard />
      ) : !yd || (yd.matches.length === 0 && !yd.hasData) ? (
        <Card>
          <EmptyState
            icon={<IconFlag size={34} />}
            title="Actas en sincronización"
            body={`Las actas de ${selYear?.anio ?? "esta temporada"} aún se están sincronizando con la Federación.`}
          />
        </Card>
      ) : yd.matches.length === 0 ? (
        <Card>
          <EmptyState icon={<IconFlag size={34} />} title="Sin partidos disputados esta temporada." />
        </Card>
      ) : dayGroups.length === 0 ? (
        <Card>
          <EmptyState icon={<IconFlag size={34} />} title="Sin partidos con ese filtro." />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {dayGroups.map((d) => (
            <div key={d.label}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                <span className="mono" style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "var(--text-muted)", fontWeight: 600 }}>
                  {d.label}
                </span>
                <span style={{ flex: 1, height: 1, background: "var(--hair)" }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {d.games.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 14px",
                      border: "1px solid var(--hair)",
                      borderRadius: 12,
                      background: "var(--bg-card)",
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 9,
                        flex: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        background: m.won ? "var(--accent-10)" : "var(--error-soft)",
                        color: m.won ? "var(--accent)" : "var(--error)",
                      }}
                    >
                      {m.won ? "V" : "D"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        vs {m.rivalPair}
                      </div>
                      {m.partner ? (
                        <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.06em", color: "var(--text-faint)", marginTop: 2 }}>
                          CON {m.partner.toUpperCase()}
                        </div>
                      ) : null}
                    </div>
                    <span className="mono" style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                      {m.parciales || m.sets}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
