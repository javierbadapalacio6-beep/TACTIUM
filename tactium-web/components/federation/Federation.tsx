"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  fetchFcpBracket,
  fetchFcpBracketTieActa,
  fetchFcpGroupActas,
  fetchFcpGroups,
  fetchFcpLeagues,
  fetchFcpGroupHeader,
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
import {
  Avatar,
  Btn,
  Card,
  CardHead,
  Chip,
  IconTile,
  InputWrap,
  ListRow,
  Modal,
  PageHeader,
  SectionHead,
  Segmented,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, Skeleton, SkeletonCard, SkeletonPage } from "@/components/states";
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconFlag,
  IconSearch,
  IconUser,
  IconUsers,
} from "@/components/Icon";

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
    <div className="tw-page">
      <PageHeader
        title="Elige federación"
        lede="Clasificaciones, jornadas y jugadores federados."
      />

      <div className="tw-club-teams">
        {FEDERATIONS.map((f) => {
          const inner = (
            <Card
              hover={f.active}
              style={{
                height: "100%",
                opacity: f.active ? 1 : 0.6,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <IconTile mute={!f.active}>
                <IconFlag size={16} />
              </IconTile>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>
                  {f.name}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                  }}
                >
                  {f.short}
                </span>
              </span>
              {f.active ? (
                <span className="list-row-chev">
                  <IconChevronRight size={16} />
                </span>
              ) : (
                <Chip tone="mute" plain>
                  Próximamente
                </Chip>
              )}
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

  // Por defecto, la temporada que SE JUEGA, no la más reciente: la que está en
  // inscripción ordena por delante ("2026/2027" > "2026") y aterrizar ahí sería
  // aterrizar en una temporada sin clasificación ni resultados.
  useEffect(() => {
    if (year != null || !leagues.data?.length) return;
    const jugando = leagues.data.find((l) => !l.upcoming);
    setYear((jugando ?? leagues.data[0]).idLiga);
  }, [leagues.data, year]);

  const selectedLeague = useMemo(
    () => leagues.data?.find((l) => l.idLiga === year) ?? null,
    [leagues.data, year]
  );
  /** Liga en inscripción: los equipos salen de las inscripciones. */
  const upcomingLiga = selectedLeague?.upcoming ? selectedLeague.idLiga : null;

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
        idLigaSinGrupos: upcomingLiga,
      }),
    [term, scopedGroupIds.join(","), upcomingLiga],
    // Sin sorteo no hay grupos que acotar, así que la condición de "hay algo
    // que enseñar" no puede depender de ellos: si no, la pestaña sale vacía.
    tab === "equipos" &&
      (term.length >= 2 || scopedGroupIds.length > 0 || upcomingLiga != null)
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
    // Se marca la que aún no ha empezado: si no, alguien mira la clasificación
    // vacía y piensa que los datos están rotos.
    label: `${l.temporada ?? l.idLiga}${l.upcoming ? " · en inscripción" : ""}`,
  }));

  // El contador habla de lo que hay debajo, no siempre de grupos.
  const countLabel =
    tab === "rankings"
      ? `${(ranking.data ?? []).length} jugadores en el ranking`
      : tab === "jugadores"
        ? `${(players.data ?? []).length} jugadores`
        : tab === "equipos"
          ? `${(teams.data ?? []).length} equipos`
          : groups.loading
            ? "Cargando…"
            : `${shownGroups.length} de ${allGroups.length} grupos`;

  return (
    <div className="tw-page">
      <PageHeader
        back={{ href: "/federacion", label: "Federaciones" }}
        title="Federación Cántabra de Pádel"
        lede="Clasificaciones, jornadas y jugadores federados."
        meta={[countLabel]}
      />

      <Card style={{ marginBottom: 16 }}>
        <div className="tw-toolbar" style={{ marginBottom: 0 }}>
          <InputWrap icon={<IconSearch size={15} />}>
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
            />
          </InputWrap>
          <Segmented
            label="Sección"
            value={tab}
            onChange={setTab}
            options={TABS.map(([v, l]) => ({ value: v, label: l }))}
          />
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
              icon={<IconFlag size={22} />}
              title="No se pudieron cargar los grupos"
              body={groups.error}
            />
          </Card>
        ) : shownGroups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={22} />}
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
                <Card hover style={{ height: "100%" }}>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{g.nombre}</div>
                  <div style={{ marginTop: 4, fontSize: 12.5, color: "var(--text-muted)" }}>
                    {[
                      g.genero === "F" ? "Femenino" : "Masculino",
                      g.categoria,
                      g.esPlayoff ? "Fase final" : null,
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
              icon={<IconFlag size={22} />}
              title="Error en la búsqueda"
              body={teams.error}
            />
          </Card>
        ) : (teams.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconSearch size={22} />}
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
                <Card
                  hover
                  style={{ height: "100%", display: "flex", alignItems: "center", gap: 12 }}
                >
                  <IconTile small mute>
                    <IconUsers size={14} />
                  </IconTile>
                  <span className="truncate" style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>
                    {t.equipo}
                  </span>
                  <span className="list-row-chev">
                    <IconChevronRight size={16} />
                  </span>
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
              icon={<IconSearch size={22} />}
              title="Escribe el nombre de un jugador"
              body="Mínimo 3 letras. Hay más de 27.000 jugadores federados."
            />
          </Card>
        ) : players.loading ? (
          <SkeletonCard />
        ) : players.error ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={22} />}
              title="Error en la búsqueda"
              body={players.error}
            />
          </Card>
        ) : (players.data ?? []).length === 0 ? (
          <Card>
            <EmptyState icon={<IconSearch size={22} />} title="Sin coincidencias" />
          </Card>
        ) : (
          <Card flush>
            {(players.data ?? []).map((p, i) => (
              <Link
                key={p.idJugador}
                href={`/federacion/${slug}/jugador/${encodeURIComponent(p.idJugador)}`}
                className="tw-fcp-row"
                style={{ color: "inherit" }}
              >
                <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  {i + 1}
                </span>
                <span className="truncate" style={{ fontSize: 14, fontWeight: 700 }}>
                  {p.nombre}
                </span>
                <span className="truncate" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  {p.nombreEquipo ?? "—"}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: "var(--accent)",
                    textAlign: "right",
                  }}
                >
                  {p.puntos}
                </span>
                <span className="list-row-chev">
                  <IconChevronRight size={16} />
                </span>
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
              icon={<IconFlag size={22} />}
              title="No se pudo cargar el ranking"
              body={ranking.error}
            />
          </Card>
        ) : (ranking.data ?? []).length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={22} />}
              title="No hay ranking para esa combinación"
              body="Cambia el género o la categoría."
            />
          </Card>
        ) : (
          <Card flush>
            <div className="tw-fcp-rank-row tw-fcp-rank-head">
              <span>Pos</span>
              <span>Jugador</span>
              <span style={{ textAlign: "right" }}>Puntos</span>
            </div>
            {(ranking.data ?? []).map((r) => (
              <div key={`${r.posicion}-${r.name}`} className="tw-fcp-rank-row">
                <span
                  className="mono"
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: r.posicion <= 3 ? "var(--accent)" : "var(--text-faint)",
                  }}
                >
                  {r.posicion}
                </span>
                <span className="truncate" style={{ fontSize: 14, fontWeight: 600 }}>
                  {r.name}
                </span>
                <span
                  className="mono"
                  style={{ fontSize: 13.5, fontWeight: 700, textAlign: "right" }}
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

/* ═══ Primitivas compartidas ══════════════════════════════════════ */

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
            borderRadius: "var(--r-xs)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
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

/* ═══ 03 · GRUPO ══════════════════════════════════════════════════ */

// Columnas de la tabla de clasificación (comparte plantilla cabecera + filas).
const STAND_COLS =
  "38px minmax(150px, 1.7fr) 34px 34px 46px 46px 46px 52px minmax(104px, auto)";

type GroupTab = "clasificacion" | "jornadas" | "cuadro";

export function FcpGroupView({ slug, id }: { slug: string; id: string }) {
  const { user, activeTeam } = useSession();
  const esPlayoff = /^fase/i.test(decodeURIComponent(id));
  const [tab, setTab] = useState<GroupTab>(esPlayoff ? "cuadro" : "clasificacion");

  const standings = useAsync(() => fetchFcpStandings(id), [id, user?.id]);
  // Los partidos se cargan siempre: alimentan tanto las jornadas como la meta.
  const matches = useAsync(() => fetchFcpMatches(id), [id, user?.id]);
  // El nombre legible del grupo: la URL sólo trae su identificador.
  const header = useAsync(() => fetchFcpGroupHeader(id), [id]);
  if (standings.loading) return <SkeletonPage />;

  const rows = standings.data ?? [];
  const mData = matches.data ?? [];

  // Meta del grupo, derivada del calendario.
  const jugadas = mData.filter((m) => m.resultado).map((m) => m.jornada ?? 0);
  const jornadaTotal = mData.reduce((mx, m) => Math.max(mx, m.jornada ?? 0), 0);
  const jornadaActual = jugadas.length ? Math.max(...jugadas) : 0;
  const finalizada = jornadaTotal > 0 && jornadaActual >= jornadaTotal;

  // El equipo propio (si hay sesión con equipo) se resalta en la tabla.
  const myName = activeTeam?.name?.trim().toLowerCase() ?? null;

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
    <div className="tw-page">
      <PageHeader
        back={{ href: `/federacion/${slug}`, label: "Federación" }}
        title={header.data?.nombre ?? decodeURIComponent(id)}
        meta={
          tab !== "cuadro"
            ? [
                header.data?.temporada ?? null,
                rows.length > 0 ? `${rows.length} equipos` : null,
                jornadaTotal > 0 ? `Jornada ${jornadaActual} de ${jornadaTotal}` : null,
              ]
            : undefined
        }
        actions={
          tab !== "cuadro" ? (
            <Chip tone={finalizada ? "accent" : "mute"}>
              {finalizada ? "Finalizada" : "En curso"}
            </Chip>
          ) : undefined
        }
      />

      <div style={{ marginBottom: 16 }}>
        <Segmented
          label="Vista del grupo"
          value={tab}
          onChange={setTab}
          options={tabs.map(([v, l]) => ({ value: v, label: l }))}
        />
      </div>

      {tab === "cuadro" ? (
        <FcpBracketPanel idGrupo={id} />
      ) : tab === "clasificacion" ? (
        standings.error ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={22} />}
              title="Sin clasificación disponible"
              body={standings.error}
            />
          </Card>
        ) : rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconFlag size={22} />}
              title="Sin clasificación disponible"
              body="Aún no hay datos federativos sincronizados para este grupo."
            />
          </Card>
        ) : (
          <Card flush>
            <div className="tw-roster-scroll">
              <div
                className="tw-fcp-head"
                style={{ gridTemplateColumns: STAND_COLS, minWidth: 700 }}
              >
                {["Pos", "Equipo", "PJ", "PG", "Dif", "Sets +", "Sets −", "Pts", "Racha"].map(
                  (h) => (
                    <span key={h}>{h}</span>
                  )
                )}
              </div>
              {rows.map((t) => {
                const dif = t.setsFavor - t.setsContra;
                const mine = myName != null && t.equipo.trim().toLowerCase() === myName;
                return (
                  <Link
                    key={t.idEquipo}
                    href={`/federacion/${slug}/equipo/${t.idEquipo}`}
                    className="tw-fcp-table-row"
                    style={{
                      color: "inherit",
                      gridTemplateColumns: STAND_COLS,
                      minWidth: 700,
                      background: mine ? "var(--accent-10)" : undefined,
                    }}
                  >
                    <span className="mono" style={{ color: "var(--text-muted)" }}>
                      {t.posicion}
                    </span>
                    <span
                      className="truncate"
                      style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <span className="truncate">{t.equipo}</span>
                      {mine ? (
                        <Chip plain style={{ flex: "none" }}>
                          Tu equipo
                        </Chip>
                      ) : null}
                    </span>
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
          <EmptyState icon={<IconFlag size={22} />} title="Sin jornadas registradas" />
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
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {groups.map((g) => {
        const date = g.items.find((m) => m.fecha)?.fecha ?? null;
        return (
          <Card flush key={g.label}>
            <CardHead title={g.label} count={g.items.length}>
              {date ? (
                <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  {date}
                </span>
              ) : null}
            </CardHead>
            {g.items.map((p, i) => {
              const score = splitScore(p.resultado);
              const localWon = p.ganador === "local";
              const visitWon = p.ganador === "visitante";
              const acta = (actaMap[p.idPartido] ?? []).slice(0, 3);
              return (
                <div
                  key={p.idPartido}
                  style={{
                    borderBottom: i === g.items.length - 1 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 18px",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 6 }}>
                      {[
                        [p.local, localWon] as const,
                        [p.visitante, visitWon] as const,
                      ].map(([name, won], k) => (
                        <div
                          key={k}
                          style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              flex: "none",
                              background: won ? "var(--accent)" : "var(--line-strong)",
                            }}
                          />
                          <span
                            className="truncate"
                            style={{
                              fontSize: 13.5,
                              fontWeight: won ? 700 : 500,
                              color: won ? "var(--text)" : "var(--text-muted)",
                            }}
                          >
                            {name}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "grid", gap: 6, textAlign: "center" }}>
                      <span
                        className="mono"
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: localWon ? "var(--text)" : "var(--text-muted)",
                        }}
                      >
                        {score ? score[0] : "·"}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 15,
                          fontWeight: 700,
                          color: visitWon ? "var(--text)" : "var(--text-muted)",
                        }}
                      >
                        {score ? score[1] : "·"}
                      </span>
                    </div>
                    {!p.resultado ? <Chip tone="mute">Por jugar</Chip> : null}
                  </div>
                  {acta.length > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 14,
                        padding: "8px 18px 10px",
                        background: "var(--bg-card-2)",
                      }}
                    >
                      {acta.map((a) => (
                        <span
                          key={a.partidoNum}
                          className="mono"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            fontSize: 12,
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "var(--text-muted)" }}>
                            P{a.partidoNum}
                          </span>
                          <span style={{ color: "var(--text-faint)" }}>
                            {a.parciales || `${a.setsLocal ?? 0}-${a.setsVisit ?? 0}`}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </Card>
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
          icon={<IconFlag size={22} />}
          title="El cuadro aún no está disponible"
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
          <Segmented
            label="Cuadro"
            value={String(selCuadro)}
            onChange={(v) => setSelCuadro(Number(v))}
            options={data.cuadros.map((q, i) => ({ value: String(i), label: q.label }))}
          />
        </div>
      ) : null}

      <Card flush>
        <div className="tw-bracket-scroll">
          <div className="tw-bracket">
            {cuadro.rounds.map((r) => (
              <div key={r.avance} className="tw-bracket-col">
                <div className="grid-head" style={{ marginBottom: 10 }}>
                  {r.label}
                </div>
                <div className="tw-bracket-ties">
                  {r.ties.map((t) => (
                    <TieCard key={t.idPartido} tie={t} onOpen={() => setOpenTie(t)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <TieActaModal tie={openTie} onClose={() => setOpenTie(null)} />
    </div>
  );
}

function TieCard({ tie, onOpen }: { tie: FcpBracketTie; onOpen: () => void }) {
  const hasActa = tie.estado === "jugado" || tie.estado === "jugado_ida";
  const line = (name: string | null, won: boolean, muted?: boolean) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ width: 14, flex: "none", color: "var(--accent)", display: "flex" }}>
        {won ? <IconCheck size={12} /> : null}
      </span>
      <span
        className="truncate"
        style={{
          fontSize: 13,
          fontWeight: won ? 700 : 500,
          color: won ? "var(--text)" : muted ? "var(--text-faint)" : "var(--text-muted)",
          fontStyle: muted ? "italic" : "normal",
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
      className="tw-tie"
      style={{
        textAlign: "left",
        width: "100%",
        padding: "10px 12px",
        cursor: hasActa ? "pointer" : "default",
        display: "grid",
        gap: 6,
      }}
    >
      {line(tie.local, tie.ganador === "local")}
      <div className="divider" style={{ margin: 0 }} />
      {line(tie.visit || "Por determinar", tie.ganador === "visitante", !tie.visit)}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 2,
        }}
      >
        <span className="mono" style={{ fontSize: 13.5, fontWeight: 700 }}>
          {tie.marcador ? tie.marcador.replace("-", "–") : hasActa ? "—" : "pend."}
        </span>
        {hasActa ? (
          <span className="link-action" style={{ fontSize: 12 }}>
            Ver acta
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
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {partidos.map((g) => (
            <div
              key={g.partidoNum}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 12px",
                border: "1px solid var(--line)",
                borderRadius: "var(--r-md)",
                background: "var(--bg-card-2)",
              }}
            >
              <span
                className="mono"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--text-faint)",
                  width: 16,
                  textAlign: "center",
                }}
              >
                {g.partidoNum}
              </span>
              <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 2 }}>
                <span
                  className="truncate"
                  style={{
                    fontSize: 13,
                    fontWeight: g.ganador === "local" ? 700 : 500,
                    color: g.ganador === "local" ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  {[g.localJ1, g.localJ2].filter(Boolean).join(" / ") || "—"}
                </span>
                <span
                  className="truncate"
                  style={{
                    fontSize: 13,
                    fontWeight: g.ganador === "visitante" ? 700 : 500,
                    color: g.ganador === "visitante" ? "var(--text)" : "var(--text-muted)",
                  }}
                >
                  {[g.visitJ1, g.visitJ2].filter(Boolean).join(" / ") || "—"}
                </span>
              </div>
              <span className="mono" style={{ fontSize: 12.5, fontWeight: 700 }}>
                {g.parciales || `${g.setsLocal ?? 0}-${g.setsVisit ?? 0}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <Modal
      open={!!tie}
      onClose={onClose}
      labelledBy="tie-acta-title"
      width={520}
      title={
        <>
          {tie.local || "—"}{" "}
          <span style={{ color: "var(--text-faint)", fontWeight: 500 }}>vs</span>{" "}
          {tie.visit || "Por determinar"}
        </>
      }
    >
      {acta.loading ? (
        <Skeleton h={80} />
      ) : empty ? (
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
          Acta no disponible todavía.
        </p>
      ) : (
        <div style={{ display: "grid", gap: 16 }}>
          {leg("Ida", data!.ida)}
          {leg("Vuelta", data!.vuelta)}
        </div>
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

  if (loading) return <SkeletonPage />;

  if (error || !data) {
    return (
      <div className="tw-page">
        <PageHeader
          back={{ href: `/federacion/${slug}`, label: "Federación" }}
          title={`Equipo ${id}`}
        />
        <Card>
          <EmptyState
            icon={<IconFlag size={22} />}
            title="No se pudo cargar el equipo"
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

  return (
    <div className="tw-page">
      <PageHeader
        back={{ href: `/federacion/${slug}`, label: "Federación" }}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={initials(data.equipo)} size={40} />
            {data.equipo}
          </span>
        }
        meta={[data.grupo ?? null]}
        actions={
          data.posicion != null ? <Chip>{data.posicion}º del grupo</Chip> : undefined
        }
      />

      {/* Cifras de la temporada */}
      <StatRow style={{ marginBottom: 16 }}>
        <Stat label="Puntos" value={data.puntos} tone="accent" />
        <Stat label="Jugados" value={data.pj} />
        <Stat label="Ganados" value={data.pg} />
        <Stat label="Perdidos" value={data.pp} />
        <Stat label="Sets" value={`${data.setsFavor}–${data.setsContra}`} />
        <Stat
          label="Diferencia"
          value={dif >= 0 ? `+${dif}` : String(dif)}
          tone={dif > 0 ? "accent" : dif < 0 ? "error" : undefined}
        />
        <Stat
          label="Victorias"
          value={winRate != null ? winRate : "—"}
          unit={winRate != null ? "%" : undefined}
        />
      </StatRow>

      {/* Racha de la temporada */}
      {data.form.length > 0 ? (
        <Card
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
            Racha de la temporada
          </span>
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              justifyContent: "flex-end",
              overflowX: "auto",
            }}
          >
            <FormPips form={data.form} box={18} />
          </div>
        </Card>
      ) : null}

      {/* Plantilla */}
      <Card flush>
        <CardHead title="Plantilla" count={data.roster.length}>
          <Btn
            size="sm"
            variant="quiet"
            onClick={() => setSort((s) => (s === "puntos" ? "nombre" : "puntos"))}
          >
            {sort === "puntos" ? "Por puntos" : "Por nombre"}
            <IconChevronDown size={14} />
          </Btn>
        </CardHead>
        {roster.length === 0 ? (
          <EmptyState
            compact
            icon={<IconUsers size={22} />}
            title="Sin plantilla sincronizada"
            body="Aún no hay jugadores federados para este equipo."
          />
        ) : (
          roster.map((p, i) => (
            <ListRow
              key={p.idJugador}
              href={`/federacion/${slug}/jugador/${encodeURIComponent(p.idJugador)}`}
              icon={
                <>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
                      color: "var(--text-faint)",
                      width: 18,
                      textAlign: "center",
                      flex: "none",
                    }}
                  >
                    {i + 1}
                  </span>
                  <Avatar initials={initials(p.name)} size={32} />
                </>
              }
              title={p.name}
              sub={p.categoria ?? undefined}
              right={
                <span
                  className="mono"
                  style={{ fontSize: 14, fontWeight: 700, color: "var(--accent)", flex: "none" }}
                >
                  {fmtInt(p.puntos)}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color: "var(--text-faint)",
                      marginLeft: 4,
                    }}
                  >
                    pts
                  </span>
                </span>
              }
            />
          ))
        )}
      </Card>
    </div>
  );
}

/* ═══ 05 · JUGADOR FEDERADO ═══════════════════════════════════════ */
type MatchFilter = "todos" | "victorias" | "derrotas";
const MATCH_FILTER_LABEL: Record<MatchFilter, string> = {
  todos: "Todos",
  victorias: "Victorias",
  derrotas: "Derrotas",
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

  if (profile.loading) return <SkeletonPage />;

  const p = profile.data;
  if (profile.error || !p) {
    return (
      <div className="tw-page">
        <PageHeader back={{ href: "/federacion", label: "Federación" }} title="Jugador" />
        <Card>
          <EmptyState
            icon={<IconUser size={22} />}
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

  const equipoLabel = selYear?.equipo || p.equipo || "Sin equipo";
  const categoriaLabel = selYear?.categoria || p.categoria || null;

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
          label: isPlayoff ? "Playoff" : `Jornada ${m.jornada}`,
          order: isPlayoff ? 9999 : m.jornada ?? 0,
          games: [],
        });
      }
      map.get(key)!.games.push(m);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  })();

  return (
    <div className="tw-page">
      <PageHeader
        back={{ href: "/federacion", label: "Federación" }}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={initials(p.name)} size={40} />
            {p.name}
          </span>
        }
        meta={[equipoLabel, categoriaLabel]}
      />

      {/* Ranking FCP */}
      <StatRow style={{ marginBottom: 16 }}>
        <Stat
          label="Ranking FCP"
          value={fmtInt(rankingPts)}
          unit="pts"
          tone="accent"
          sub={
            variacion != null && variacion !== 0 ? (
              <span style={{ color: variacion >= 0 ? "var(--accent)" : "var(--error)" }}>
                {variacion >= 0 ? "▲ +" : "▼ "}
                {fmtInt(variacion)} esta temporada
              </span>
            ) : undefined
          }
        />
        {rank && rank.rank > 0 ? (
          <Stat label="En el equipo" value={`Nº ${rank.rank}`} sub={equipoLabel} />
        ) : null}
      </StatRow>

      {/* Selector de temporada */}
      {(years.data ?? []).length > 0 ? (
        <div style={{ marginBottom: 16, overflowX: "auto" }}>
          <Segmented
            label="Temporada"
            value={String(selLiga ?? "")}
            onChange={(v) => setSelLiga(Number(v))}
            options={(years.data ?? []).map((y) => ({
              value: String(y.idLiga),
              label: y.anio,
            }))}
          />
        </div>
      ) : null}

      {/* Stats del año */}
      <StatRow style={{ marginBottom: 16 }}>
        <Stat label="Jugados" value={yd?.pj ?? 0} />
        <Stat label="Ganados" value={yd?.pg ?? 0} tone="accent" />
        <Stat label="Perdidos" value={yd?.pp ?? 0} tone="error" />
        <Stat
          label="Victorias"
          value={wr != null ? wr : "—"}
          unit={wr != null ? "%" : undefined}
        />
        <Stat label="Sets" value={sd >= 0 ? `+${sd}` : String(sd)} />
      </StatRow>

      {/* Partidos */}
      <SectionHead title="Partidos" count={yd?.matches.length ?? 0}>
        <Btn
          size="sm"
          variant="quiet"
          onClick={() =>
            setFilter((f) => (f === "todos" ? "victorias" : f === "victorias" ? "derrotas" : "todos"))
          }
        >
          {MATCH_FILTER_LABEL[filter]}
          <IconChevronDown size={14} />
        </Btn>
      </SectionHead>

      {yearMatches.loading ? (
        <SkeletonCard />
      ) : !yd || (yd.matches.length === 0 && !yd.hasData) ? (
        <Card>
          <EmptyState
            icon={<IconFlag size={22} />}
            title="Actas en sincronización"
            body={`Las actas de ${selYear?.anio ?? "esta temporada"} aún se están sincronizando con la Federación.`}
          />
        </Card>
      ) : yd.matches.length === 0 ? (
        <Card>
          <EmptyState icon={<IconFlag size={22} />} title="Sin partidos disputados esta temporada" />
        </Card>
      ) : dayGroups.length === 0 ? (
        <Card>
          <EmptyState icon={<IconFlag size={22} />} title="Sin partidos con ese filtro" />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {dayGroups.map((d) => (
            <Card flush key={d.label}>
              <CardHead title={d.label} count={d.games.length} />
              {d.games.map((m, i) => (
                <div key={i} className="list-row">
                  <span
                    className="mono"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "var(--r-sm)",
                      flex: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12.5,
                      fontWeight: 700,
                      background: m.won ? "var(--accent-10)" : "var(--error-soft)",
                      color: m.won ? "var(--accent)" : "var(--error)",
                    }}
                  >
                    {m.won ? "V" : "D"}
                  </span>
                  <span className="list-row-main">
                    <span className="list-row-title truncate">vs {m.rivalPair}</span>
                    {m.partner ? <span className="list-row-sub">con {m.partner}</span> : null}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}
                  >
                    {m.parciales || m.sets}
                  </span>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
