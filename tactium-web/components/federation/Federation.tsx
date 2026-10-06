"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";

import {
  fetchFcpActa,
  fetchFcpBracket,
  fetchFcpBracketTieActa,
  fetchFcpGroupActas,
  fetchFcpGroupMetas,
  fetchFcpGroupPlayerIndex,
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
  fetchTeamFcpId,
  fetchFcpTeamNameById,
  fcpSameTeam,
  catShort,
  searchFcpPlayers,
  searchFcpTeams,
  fcpNameKey,
  type FcpActaPartido,
  type FcpActaPlayerInfo,
  type FcpBracketTie,
  type FcpGroup,
  type FcpPlayerMatch,
  type FcpPlayerYearTeam,
  type FcpTeamProfile,
  type FcpTeamResult,
} from "@/lib/queries";
import type { FcpGroupBundle } from "@/lib/seo/fcp";
import { fcpCategoriaCorta, type FcpStanding } from "@/lib/fcp-public";
import { FCP_ZONES_NOTE, legendFor, type FcpZone } from "@/lib/fcp-zones";
import { useSession } from "@/lib/session";
import { FCP_FEDERATION_CODE, FEDERATIONS as FED_LIST } from "@/lib/federations";
import { fetchMyFederation, fetchPlayerHistMatches, fmtFcpDate } from "./fed-data";
import { motion, useReducedMotion } from "motion/react";
import { FederationMine } from "./FederationMine";
import { useAsync } from "@/lib/use-async";
import { useDismiss } from "@/lib/use-dismiss";
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
  IconCalendar,
  IconChart,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconFlag,
  IconMars,
  IconSearch,
  IconShield,
  IconSliders,
  IconTrophy,
  IconUser,
  IconUsers,
  IconVenus,
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
  {
    slug: "cantabra",
    name: "Federación Cántabra de Pádel",
    short: "FCP",
    active: true,
    logo: "/federations/fcantp-mark.png",
  },
];

/**
 * Escudo de la federación.
 *
 * El logo oficial es un lockup horizontal —emblema + «Federación Cántabra
 * de Pádel»—, y dentro de un disco queda ilegible; lo que se usa aquí es
 * el emblema recortado (`fcantp-mark.png`). Va en rojo sobre blanco, así
 * que necesita su propio disco claro o se recorta contra el panel oscuro.
 * Las federaciones que aún no tienen logo caen en la bandera genérica.
 */
function FedCrest({
  logo,
  size = 52,
  alt = "",
}: {
  logo?: string;
  size?: number;
  alt?: string;
}) {
  if (!logo) {
    return (
      <span className="tw-fcp-crest" style={{ width: size, height: size }} aria-hidden="true">
        <IconFlag size={Math.round(size * 0.46)} />
      </span>
    );
  }
  return (
    <span className="tw-fcp-crest is-logo" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logo} alt={alt} width={size} height={size} />
    </span>
  );
}

const FED_NAMES: Record<string, string> = Object.fromEntries(
  FED_LIST.map((f) => [f.code, f.name]),
);

/* Estas pantallas ya NO piden sesión: las tablas `fcp_*` tienen lectura
   pública (migración 20260811c). Son datos que la federación publica en
   abierto, y además es lo que mejor posiciona en buscadores. */

/* ═══ 01 · SELECTOR ═══════════════════════════════════════════════ */
/**
 * Selector honesto: solo la Cántabra tiene datos. Ya no se listan una a una
 * las federaciones sin datos con «Próximamente». Si tu federación es otra, lo
 * dice y lleva a la que sí está.
 */
export function FederationPicker({
  mine,
  embedded = false,
}: { mine?: string | null; embedded?: boolean } = {}) {
  const f = FEDERATIONS[0];
  const title = mine ? "Tu federación aún no está" : "Federaciones";
  const lede = mine
    ? `${mine}: de momento leemos los datos de la Cántabra. El resto de federaciones irán entrando.`
    : "De momento leemos los datos de la Federación Cántabra. El resto de federaciones irán entrando.";
  return (
    <div className="tw-page">
      {/* Dentro de Competir el título de página es «Competir»: aquí, un
          título de bloque. */}
      {embedded ? (
        <SectionHead title={title} sub={lede} style={{ marginTop: 0 }} />
      ) : (
        <PageHeader title={title} lede={lede} />
      )}
      <SectionHead title="Disponible" style={{ margin: "0 0 10px" }} />
      <Link href={`/federacion/${f.slug}`} style={{ color: "inherit", display: "block", maxWidth: 520 }}>
        <Card hover style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <FedCrest logo={f.logo} size={40} alt="" />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{f.name}</span>
            <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>
              Clasificaciones, equipos y jugadores
            </span>
          </span>
          <span className="list-row-chev">
            <IconChevronRight size={16} />
          </span>
        </Card>
      </Link>
    </div>
  );
}

/**
 * Competir › Federación: como en la app, va directa a la Cántabra; el
 * selector solo sale si tu equipo (o tu club) es de otra federación.
 */
export function FederationForMe({ embedded = false }: { embedded?: boolean } = {}) {
  const { role, activeTeam, clubId, ready } = useSession();
  const fed = useAsync(
    () =>
      fetchMyFederation(
        role === "club" ? { clubId } : { teamId: activeTeam?.id ?? null },
      ),
    [role, clubId, activeTeam?.id],
    ready,
  );
  if (!ready || fed.loading) return <SkeletonPage />;
  const code = fed.data ?? null;
  if (code && code !== FCP_FEDERATION_CODE) {
    return <FederationPicker mine={FED_NAMES[code] ?? "Tu federación"} embedded={embedded} />;
  }
  return <FederationExplore slug="cantabra" embedded={embedded} />;
}

/* ── Vista partida (≥1100 px): lista a la izquierda, detalle a la derecha ──
   Como `SplitView` de la app en tablet. Los enlaces a grupo, equipo y
   jugador, dentro del explorador o del propio detalle, abren el detalle en
   el panel en vez de navegar; con Ctrl/Cmd/Mayús (o en móvil) navegan como
   siempre, y la URL de cada ficha sigue existiendo. */
type PaneKind = "grupo" | "equipo" | "jugador";
type PaneSel = { kind: PaneKind; id: string };
const FcpPaneCtx = createContext<((sel: PaneSel) => void) | null>(null);

/** `onClick` para un enlace de la federación: abre en el panel si lo hay. */
function useFcpPane() {
  const open = useContext(FcpPaneCtx);
  return (kind: PaneKind, id: string | number) =>
    open
      ? (e: ReactMouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          open({ kind, id: String(id) });
        }
      : undefined;
}

function useMinWidth(px: number): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${px}px)`);
    const on = () => setOk(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [px]);
  return ok;
}

type Tab = "todo" | "equipos" | "jugadores" | "rankings";
const TABS: [Tab, string, (p: { size?: number }) => React.ReactElement][] = [
  ["todo", "Todo", IconSliders],
  ["equipos", "Equipos", IconUsers],
  ["jugadores", "Jugadores", IconUser],
  ["rankings", "Rankings", IconChart],
];

/**
 * Un filtro: tesela redonda + etiqueta + desplegable.
 *
 * Antes era una fila de chips con scroll horizontal. Con 138 grupos esa
 * fila no había quien la usara —y además es el patrón que se rompe en
 * Safari de iOS—, así que va en un `select` nativo, que en el móvil abre
 * la rueda del sistema.
 */
function FilterField({
  label,
  icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const actual = options.find((o) => o.value === value) ?? options[0];

  // El desplegable es NUESTRO, no el nativo: Chrome pinta el popup del
  // `select` con el fondo del propio control, que aquí es transparente, y
  // el texto claro del panel se perdía sobre blanco. No hay CSS que
  // arregle eso, así que se dibuja con el mismo popover del resto.
  function mover(paso: number) {
    const i = options.findIndex((o) => o.value === value);
    const siguiente = options[Math.min(Math.max(i + paso, 0), options.length - 1)];
    if (siguiente) onChange(siguiente.value);
  }

  if (options.length <= 1) return null;
  return (
    <div className={"tw-fcp-field" + (open ? " is-open" : "")} ref={ref}>
      <span className="tw-fcp-field-tile" aria-hidden="true">
        {icon}
      </span>
      <button
        type="button"
        className="tw-fcp-field-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${actual?.label ?? ""}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            mover(e.key === "ArrowDown" ? 1 : -1);
          }
        }}
      >
        <span className="tw-fcp-field-label">{label}</span>
        <span className="tw-fcp-field-value truncate">{actual?.label ?? "—"}</span>
      </button>
      <IconChevronDown
        size={15}
        className="tw-fcp-field-chev"
        style={{ transform: open ? "rotate(180deg)" : "none" }}
      />

      {open && (
        <div className="tw-popover tw-fcp-menu" role="listbox" aria-label={label}>
          {options.map((o) => {
            const on = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={on}
                className={"tw-popitem" + (on ? " is-on" : "")}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="truncate" style={{ flex: 1, textAlign: "left" }}>
                  {o.label}
                </span>
                {on && <IconCheck size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function FederationExplore({
  slug,
  embedded = false,
}: {
  slug: string;
  /** Dentro de Competir: sin «‹ Federaciones» y el nombre como h2 (el h1 es «Competir»). */
  embedded?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("todo");
  const wide = useMinWidth(1100);
  const [sel, setSel] = useState<PaneSel | null>(null);
  // Este componente PONE el contexto, así que no lo puede leer: el
  // `onClick` se construye con su propio estado.
  const pane = (kind: PaneKind, id: string | number) =>
    wide
      ? (e: ReactMouseEvent) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          setSel({ kind, id: String(id) });
        }
      : undefined;
  const isSel = (kind: PaneKind, id: string | number) =>
    wide && sel?.kind === kind && sel.id === String(id) ? "true" : undefined;
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [gender, setGender] = useState<"all" | "M" | "F">("all");
  const [cat, setCat] = useState("all");
  const [grupo, setGrupo] = useState("all");

  // Los filtros (temporada, género, categoría, grupo) se recuerdan en este
  // navegador. Se leen tras montar —no en el `useState`— para no romper la
  // hidratación del HTML de servidor; y no se guarda nada hasta haber leído,
  // o lo primero que se escribiría serían los valores por defecto.
  const filtersKey = `tw_fcp_explore_filters:${slug}`;
  const [filtersRestored, setFiltersRestored] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(filtersKey);
      if (raw) {
        const f = JSON.parse(raw) as Partial<{
          year: number | null;
          gender: string;
          cat: string;
          grupo: string;
        }>;
        if (typeof f.year === "number") setYear(f.year);
        if (f.gender === "all" || f.gender === "M" || f.gender === "F") setGender(f.gender);
        if (typeof f.cat === "string" && f.cat) setCat(f.cat);
        if (typeof f.grupo === "string" && f.grupo) setGrupo(f.grupo);
      }
    } catch {
      /* sin storage o dato corrupto: filtros por defecto */
    }
    setFiltersRestored(true);
  }, [filtersKey]);
  useEffect(() => {
    if (!filtersRestored) return;
    try {
      localStorage.setItem(filtersKey, JSON.stringify({ year, gender, cat, grupo }));
    } catch {
      /* sin storage */
    }
  }, [filtersRestored, filtersKey, year, gender, cat, grupo]);

  // Una consulta por tecla es una consulta de más.
  useEffect(() => {
    const id = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(id);
  }, [query]);

  const leagues = useAsync(() => fetchFcpLeagues(), []);

  // Por defecto, la temporada que SE JUEGA, no la más reciente: la que está en
  // inscripción ordena por delante ("2026/2027" > "2026") y aterrizar ahí sería
  // aterrizar en una temporada sin clasificación ni resultados.
  // Una temporada recordada que ya no existe también cae en la de por defecto.
  useEffect(() => {
    if (!filtersRestored || !leagues.data?.length) return;
    if (year != null && leagues.data.some((l) => l.idLiga === year)) return;
    const jugando = leagues.data.find((l) => !l.upcoming);
    setYear((jugando ?? leagues.data[0]).idLiga);
  }, [leagues.data, year, filtersRestored]);

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

  // Si el grupo elegido deja de casar con los demás filtros, se suelta. Con
  // los grupos aún cargando no se decide nada: soltaría el grupo recordado.
  useEffect(() => {
    if (groups.loading || !groups.data) return;
    if (grupo !== "all" && !grupoOptions.some((g) => g.idGrupo === grupo)) {
      setGrupo("all");
    }
  }, [groups.loading, groups.data, grupoOptions, grupo]);

  // Igual con una categoría recordada que no existe en esta temporada.
  // (En una liga en inscripción las categorías salen de los inscritos: se
  // decide más abajo, con ellos ya cargados.)
  useEffect(() => {
    if (upcomingLiga != null) return;
    if (groups.loading || !groups.data) return;
    if (cat !== "all" && !catOptions.some((c) => c.value === cat)) setCat("all");
  }, [groups.loading, groups.data, catOptions, cat, upcomingLiga]);

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

  // Equipos y estado de cada grupo: es lo que va en el pie de la tarjeta.
  // Se pide sólo de los grupos que se están viendo.
  const metaIds = useMemo(
    () => shownGroups.slice(0, 200).map((g) => g.idGrupo),
    [shownGroups]
  );
  const groupMetas = useAsync(
    () => fetchFcpGroupMetas(metaIds),
    [metaIds.join(",")],
    tab === "todo" && metaIds.length > 0
  );

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
        // Una liga EN JUEGO se mira por grupos, y un grupo son ~10 equipos: 60
        // sobra. Una liga en INSCRIPCIÓN no tiene sorteo, así que «todas las
        // categorías» es la temporada entera —323 equipos este año— y con 60
        // el club no encontraba los suyos.
        limit: upcomingLiga ? 500 : 60,
        idLigaSinGrupos: upcomingLiga,
      }),
    [term, scopedGroupIds.join(","), upcomingLiga],
    // Sin sorteo no hay grupos que acotar, así que la condición de "hay algo
    // que enseñar" no puede depender de ellos: si no, la pestaña sale vacía.
    tab === "equipos" &&
      (term.length >= 2 || scopedGroupIds.length > 0 || upcomingLiga != null)
  );

  // Liga en inscripción: los equipos por categoría y, dentro, por el grupo que
  // reparte la Federación (`subgrupo`). Aquí no hay `fcp_grupos` que filtrar,
  // así que género y categoría se aplican sobre la propia lista.
  const inscritosPorCategoria = useMemo(() => {
    if (!upcomingLiga) return [];
    const porCat = new Map<
      string,
      {
        idGrupo: string;
        titulo: string;
        genero: string;
        num: number;
        total: number;
        grupos: Map<string | null, FcpTeamResult[]>;
      }
    >();
    for (const t of teams.data ?? []) {
      const i = t.insc;
      if (!i) continue;
      if (gender !== "all" && i.genero !== gender) continue;
      if (cat !== "all" && catShort(i.grupoNombre) !== cat) continue;
      let sec = porCat.get(t.idGrupo);
      if (!sec) {
        sec = {
          idGrupo: t.idGrupo,
          titulo: fcpCategoriaCorta(i.grupoNombre, i.genero) ?? i.grupoNombre ?? "Categoría",
          genero: i.genero ?? "M",
          num: parseInt(catShort(i.grupoNombre) ?? "99", 10),
          total: 0,
          grupos: new Map(),
        };
        porCat.set(t.idGrupo, sec);
      }
      sec.total += 1;
      const lista = sec.grupos.get(i.subgrupo) ?? [];
      lista.push(t);
      sec.grupos.set(i.subgrupo, lista);
    }
    return [...porCat.values()]
      .sort((a, b) => a.genero.localeCompare(b.genero) || a.num - b.num)
      .map((s) => ({
        ...s,
        // Sin grupo al final: solo puede darse en una categoría sin reparto.
        grupos: [...s.grupos.entries()]
          .sort(([a], [b]) => (a ?? "~").localeCompare(b ?? "~"))
          .map(([subgrupo, equipos]) => ({ subgrupo, equipos })),
      }));
  }, [upcomingLiga, teams.data, gender, cat]);

  // Categorías del filtro en una liga en inscripción: salen de los inscritos,
  // porque no hay grupos de los que sacarlas.
  const upcomingCatOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of teams.data ?? []) {
      if (!t.insc) continue;
      if (gender !== "all" && t.insc.genero !== gender) continue;
      const c = catShort(t.insc.grupoNombre);
      if (c) set.add(c);
    }
    return [
      { value: "all", label: "Todas" },
      ...[...set]
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
        .map((c) => ({ value: c, label: c })),
    ];
  }, [teams.data, gender]);

  // La categoría recordada que no existe en la liga en inscripción se suelta,
  // pero solo con la lista entera delante: con un término de búsqueda la
  // lista es un trozo y faltarían categorías que sí existen.
  useEffect(() => {
    if (upcomingLiga == null || !teams.data || term.length >= 2) return;
    if (cat !== "all" && !upcomingCatOptions.some((c) => c.value === cat)) setCat("all");
  }, [upcomingLiga, teams.data, term, upcomingCatOptions, cat]);

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
          ? `${upcomingLiga ? inscritosPorCategoria.reduce((n, s) => n + s.total, 0) : (teams.data ?? []).length} equipos`
          : groups.loading
            ? "Cargando…"
            : `${shownGroups.length} de ${allGroups.length} grupos`;

  return (
    <FcpPaneCtx.Provider value={wide ? setSel : null}>
    <ExploreBody
      wide={wide}
      sel={sel}
      onClose={() => setSel(null)}
      slug={slug}
    >
    <div className="tw-page">
      {/* ══ Cabecera ══════════════════════════════════════════════
          Sobre una pista de noche dibujada con gradientes: la
          federación es la cara pública de la aplicación. */}
      <header className="tw-fcp-hero">
        {!embedded && (
          <Link href="/federacion" className="tw-back" style={{ marginBottom: 12 }}>
            <IconChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
            Federaciones
          </Link>
        )}
        <div className="tw-fcp-hero-top">
          <FedCrest logo="/federations/fcantp-mark.png" alt="" />
          <div className="tw-fcp-hero-txt">
            {embedded ? (
              <h2 className="tw-fcp-hero-title">Federación Cántabra de Pádel</h2>
            ) : (
              <h1 className="tw-fcp-hero-title">Federación Cántabra de Pádel</h1>
            )}
            <p className="tw-fcp-hero-sub">
              Clasificaciones, jornadas y jugadores federados.
            </p>
          </div>
        </div>
        <span className="tw-fcp-hero-meta">
          <IconCalendar size={14} />
          {countLabel}
        </span>
      </header>

      {/* Primero lo tuyo (solo con sesión; sin ella la página queda igual). */}
      <FederationMine
        slug={slug}
        onFindMe={() => setTab("jugadores")}
        onOpenGroup={wide ? (idGrupo) => setSel({ kind: "grupo", id: idGrupo }) : undefined}
      />

      <div className={wide ? "tw-fcp-master" : undefined}>
      <div className="tw-fcp-master-list">
      <div className="tw-fcp-bar">
        <div className="tw-fcp-bar-top">
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
            as="tabs"
            label="Sección"
            value={tab}
            onChange={setTab}
            options={TABS.map(([v, l, Ico]) => ({
              value: v,
              label: (
                <>
                  <Ico size={15} />
                  {l}
                </>
              ),
            }))}
          />
        </div>

        {/* Filtros en línea. En Rankings el grupo no pinta nada: la lista es
            por género y categoría, no por grupo. */}
        <div className="tw-fcp-fields">
          <FilterField
            label="Temporada"
            icon={<IconCalendar size={15} />}
            value={String(year ?? "")}
            options={yearOptions}
            onChange={(v) => setYear(Number(v))}
          />
          <FilterField
            label="Género"
            icon={<IconUser size={15} />}
            value={gender}
            options={[
              { value: "all", label: "Ambos" },
              { value: "M", label: "Masculino" },
              { value: "F", label: "Femenino" },
            ]}
            onChange={(v) => setGender(v as "all" | "M" | "F")}
          />
          <FilterField
            label="Categoría"
            icon={<IconTrophy size={15} />}
            value={cat}
            options={upcomingLiga ? upcomingCatOptions : catOptions}
            onChange={setCat}
          />
          {tab !== "rankings" && (
            <FilterField
              label="Grupo"
              icon={<IconUsers size={15} />}
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
        </div>

        {filtersOn && (
          <button
            type="button"
            onClick={reset}
            className="tw-fcp-reset"
            style={{ marginTop: 10 }}
          >
            Restablecer filtros
          </button>
        )}
      </div>

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
          <div className="tw-fcp-groups">
            {shownGroups.map((g: FcpGroup) => {
              const meta = groupMetas.data?.[g.idGrupo];
              const GenIcon =
                g.genero === "F" ? IconVenus : g.genero === "M" ? IconMars : IconUsers;
              // El estado sale del dato, no de un rótulo fijo: una liga sin
              // sorteo no está «en juego», está esperando.
              const estado = meta?.estado;
              const chip =
                estado === "finalizada"
                  ? { label: "Finalizada", tone: "mute" as const }
                  : estado === "en_curso"
                    ? {
                        label: `Jornada ${meta!.jornadaActual} de ${meta!.jornadaTotal}`,
                        tone: "accent" as const,
                      }
                    : selectedLeague?.upcoming
                      ? { label: "En inscripción", tone: "accent" as const }
                      : meta
                        ? // Hay equipos pero la federación aún no ha
                          // publicado el calendario del grupo.
                          { label: "Sin jornadas", tone: "mute" as const }
                        : null;
              return (
                <Link
                  key={g.idGrupo}
                  href={`/federacion/${slug}/grupo/${encodeURIComponent(g.idGrupo)}`}
                  onClick={pane("grupo", g.idGrupo)}
                  className="tw-fcp-group"
                  aria-current={isSel("grupo", g.idGrupo)}
                >
                  <span className="tw-fcp-group-top">
                    <span className="tw-fcp-field-tile" aria-hidden="true">
                      <GenIcon size={15} />
                    </span>
                    <span style={{ minWidth: 0 }}>
                      <span className="tw-fcp-group-name">{g.nombre}</span>
                      <span className="tw-fcp-group-meta">
                        {[
                          g.genero === "F"
                            ? "Femenino"
                            : g.genero === "M"
                              ? "Masculino"
                              : "Mixto",
                          g.categoria,
                          g.esPlayoff ? "Fase final" : null,
                          g.temporada,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </span>

                  <span className="tw-fcp-group-foot">
                    <span className="tw-fcp-group-count">
                      {meta && meta.equiposCount > 0 && (
                        <>
                          <IconUsers size={13} />
                          {meta.equiposCount} equipos
                        </>
                      )}
                    </span>
                    {chip && (
                      <Chip tone={chip.tone} plain>
                        {chip.label}
                      </Chip>
                    )}
                    <span className="tw-fcp-group-go" aria-hidden="true">
                      <IconChevronRight size={15} />
                    </span>
                  </span>
                </Link>
              );
            })}
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
        ) : (upcomingLiga ? inscritosPorCategoria.length : (teams.data ?? []).length) === 0 ? (
          <Card>
            <EmptyState
              icon={<IconSearch size={22} />}
              title="Sin equipos"
              body="Escribe un nombre o acota por categoría y grupo."
            />
          </Card>
        ) : upcomingLiga ? (
          // Liga en inscripción: una tarjeta por categoría y, dentro, los
          // grupos tal y como los reparte la Federación. Cada equipo solo
          // juega contra los de su grupo, así que una lista plana de 323
          // nombres no contestaba a nada. Sin reparto, la categoría va de
          // corrido, como antes.
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {inscritosPorCategoria.map((sec) => (
              <Card flush key={sec.idGrupo}>
                <CardHead title={sec.titulo} count={sec.total} />
                {sec.grupos.map((g) => (
                  <div key={g.subgrupo ?? "-"}>
                    {g.subgrupo && (
                      <div
                        className="grid-head"
                        style={{
                          padding: "8px 18px",
                          background: "var(--bg-card-2)",
                          borderBottom: "1px solid var(--line)",
                        }}
                      >
                        Grupo {g.subgrupo} · {g.equipos.length} {g.equipos.length === 1 ? "equipo" : "equipos"}
                      </div>
                    )}
                    {g.equipos.map((t, i) => (
                      <Link
                        key={t.idEquipo}
                        href={`/federacion/${slug}/equipo/${t.idEquipo}`}
                        onClick={pane("equipo", t.idEquipo)}
                        aria-current={isSel("equipo", t.idEquipo)}
                        className="tw-fcp-row"
                        style={{
                          color: "inherit",
                          gridTemplateColumns: "24px minmax(0, 1fr) auto auto 16px",
                        }}
                      >
                        <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                          {i + 1}
                        </span>
                        <span className="truncate" style={{ fontSize: 14, fontWeight: 700 }}>
                          {t.equipo}
                        </span>
                        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                          {t.insc?.sedeCorta ?? ""}
                        </span>
                        <span>
                          {t.insc && !t.insc.confirmado && (
                            <Chip tone="warning" plain>
                              Pendiente
                            </Chip>
                          )}
                        </span>
                        <span className="list-row-chev">
                          <IconChevronRight size={16} />
                        </span>
                      </Link>
                    ))}
                  </div>
                ))}
              </Card>
            ))}
          </div>
        ) : (
          <div className="tw-club-teams">
            {(teams.data ?? []).map((t) => (
              <Link
                key={t.idEquipo}
                href={`/federacion/${slug}/equipo/${t.idEquipo}`}
                onClick={pane("equipo", t.idEquipo)}
                aria-current={isSel("equipo", t.idEquipo)}
                className="tw-fcp-pick"
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
                onClick={pane("jugador", p.idJugador)}
                aria-current={isSel("jugador", p.idJugador)}
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
              <span style={{ textAlign: "right" }}>Año</span>
              <span style={{ textAlign: "right" }}>Puntos</span>
            </div>
            {(ranking.data ?? []).map((r) => {
              const cuerpo = (
                <>
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
                  <span className="tw-fcp-rank-who">
                    <Avatar initials={initials(r.name)} src={r.avatarUrl} size={30} />
                    <span className="truncate" style={{ fontSize: 14, fontWeight: 600 }}>
                      {r.name}
                    </span>
                  </span>
                  {/* Lo ganado en el año. Sólo lo tenemos de 138 jugadores;
                      del resto no se pinta nada, que es más honesto que un
                      «+0» que parecería que no ha ganado. */}
                  <span className="tw-fcp-rank-var mono">
                    {r.puntosAnio == null ? (
                      <span style={{ color: "var(--text-faint)" }}>·</span>
                    ) : (
                      <span
                        style={{
                          color:
                            r.puntosAnio > 0
                              ? "var(--accent)"
                              : r.puntosAnio < 0
                                ? "var(--error)"
                                : "var(--text-faint)",
                        }}
                      >
                        {r.puntosAnio > 0 ? `+${fmtInt(r.puntosAnio)}` : fmtInt(r.puntosAnio)}
                      </span>
                    )}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 13.5, fontWeight: 700, textAlign: "right" }}
                  >
                    {r.puntos ?? "—"}
                  </span>
                </>
              );
              // El nombre del ranking no siempre cruza con el censo (96%);
              // el que no cruza se queda sin enlace en vez de llevar a la
              // ficha equivocada.
              return r.idJugador ? (
                <Link
                  key={`${r.posicion}-${r.name}`}
                  href={`/federacion/${slug}/jugador/${encodeURIComponent(r.idJugador)}`}
                  onClick={pane("jugador", r.idJugador)}
                  className="tw-fcp-rank-row is-link"
                >
                  {cuerpo}
                </Link>
              ) : (
                <div key={`${r.posicion}-${r.name}`} className="tw-fcp-rank-row">
                  {cuerpo}
                </div>
              );
            })}
          </Card>
        ))}
      </div>
      {wide && (
        <aside className="tw-fcp-pane" aria-label="Detalle">
          {sel ? (
            <>
              <div className="tw-fcp-pane-bar">
                <Link
                  href={
                    `/federacion/${slug}/${sel.kind}/` +
                    (sel.kind === "equipo" ? sel.id : encodeURIComponent(sel.id))
                  }
                  className="tw-fcp-reset"
                >
                  Abrir en su página
                </Link>
                <button type="button" className="tw-fcp-reset" onClick={() => setSel(null)}>
                  Cerrar
                </button>
              </div>
              {sel.kind === "grupo" ? (
                <FcpGroupView key={sel.id} slug={slug} id={sel.id} embedded />
              ) : sel.kind === "equipo" ? (
                <FcpTeamView key={sel.id} slug={slug} id={sel.id} embedded />
              ) : (
                <FcpPlayerView key={sel.id} id={sel.id} embedded />
              )}
            </>
          ) : (
            <Card>
              <EmptyState
                icon={<IconFlag size={22} />}
                title="Elige un grupo, un equipo o un jugador"
                body="Su clasificación, sus partidos o su ficha se abren aquí, sin perder la lista."
              />
            </Card>
          )}
        </aside>
      )}
      </div>
    </div>
    </ExploreBody>
    </FcpPaneCtx.Provider>
  );
}

/** Envoltorio del explorador: hoy solo pasa los hijos (el panel va dentro
 *  de `.tw-fcp-master`); queda como punto único para el atajo de Escape. */
function ExploreBody({
  wide,
  sel,
  onClose,
  children,
}: {
  wide: boolean;
  sel: PaneSel | null;
  onClose: () => void;
  slug: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!wide || !sel) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".tw-scrim")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wide, sel, onClose]);
  return <>{children}</>;
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
    <span className="tw-pips" style={{ display: "inline-flex", gap: 4, flexWrap: "wrap" }}>
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

// Columnas de la tabla de clasificación: en `.tw-fcp-stand` (globals.css).
// En móvil quedan Pos · Equipo · Pts · Racha, y PJ, PG, Dif y sets bajan a
// una segunda línea bajo el nombre: así Pts no se pierde por la derecha.

/* Clasificación y jornadas ya no son dos pestañas: se miran a la vez, que
   es como se mira una liga —«voy tercero, ¿contra quién juego?»—. En un
   grupo normal no queda nada que elegir, así que no hay pestañas; sólo el
   playoff conserva el cuadro como vista aparte. */
type GroupTab = "tabla" | "cuadro";

export function FcpGroupView({
  slug,
  id,
  initial,
  embedded,
}: {
  slug: string;
  id: string;
  /** Datos ya cargados en servidor (SEO): la vista arranca pintada. */
  initial?: FcpGroupBundle;
  /** Dentro del panel de detalle del explorador: sin «volver» ni márgenes de página. */
  embedded?: boolean;
}) {
  const { user, activeTeam } = useSession();
  const esPlayoff = /^fase/i.test(decodeURIComponent(id));
  const [tab, setTab] = useState<GroupTab>(esPlayoff ? "cuadro" : "tabla");

  const standings = useAsync(
    () => fetchFcpStandings(id),
    [id, user?.id],
    true,
    initial?.standings
  );
  // Los partidos se cargan siempre: alimentan tanto las jornadas como la meta.
  const matches = useAsync(
    () => fetchFcpMatches(id),
    [id, user?.id],
    true,
    initial?.matches
  );
  // El nombre legible del grupo: la URL sólo trae su identificador.
  const header = useAsync(() => fetchFcpGroupHeader(id), [id], true, initial?.header);
  // «Tu equipo» se reconoce por el VÍNCULO federativo (fcp_team_links), no
  // por el nombre: dos equipos pueden llamarse igual.
  const teamId = activeTeam?.id ?? null;
  const myFcp = useAsync(() => fetchTeamFcpId(teamId!), [teamId], !!teamId);
  if (standings.loading) return <SkeletonPage />;

  const rows = standings.data ?? [];
  const mData = matches.data ?? [];

  // Meta del grupo, derivada del calendario.
  const jugadas = mData.filter((m) => m.resultado).map((m) => m.jornada ?? 0);
  const jornadaTotal = mData.reduce((mx, m) => Math.max(mx, m.jornada ?? 0), 0);
  const jornadaActual = jugadas.length ? Math.max(...jugadas) : 0;
  const finalizada = jornadaTotal > 0 && jornadaActual >= jornadaTotal;

  // El equipo propio (si hay sesión con equipo vinculado) se resalta.
  const myFcpId = myFcp.data ?? null;
  const isMine = (idEquipo: number) => myFcpId != null && Number(idEquipo) === myFcpId;
  const myRow = rows.find((t) => isMine(t.idEquipo)) ?? null;

  // Zonas de la normativa (oro, plata, bronce, descenso): sólo en la fase
  // de grupos; los grupos de play off no tienen.
  const groupName = header.data?.nombre ?? "";
  const grupoPlayoff = esPlayoff || /ORO|PLATA|PLAY\s*OFF/i.test(groupName);
  const zones = grupoPlayoff
    ? null
    : legendFor(slug, header.data?.genero ?? null, catShort(groupName));
  const zoneOf = (pos: number): FcpZone | null =>
    zones?.find((zn) => pos >= zn.from && pos <= zn.to) ?? null;
  const myZone = myRow ? zoneOf(myRow.posicion) : null;

  const tabs: [GroupTab, string][] = [
    ["cuadro", "Cuadro"],
    ["tabla", "Clasificación y jornadas"],
  ];

  const groupMeta = [
    header.data?.temporada ?? null,
    rows.length > 0 ? `${rows.length} equipos` : null,
    jornadaTotal > 0 ? `Jornada ${jornadaActual} de ${jornadaTotal}` : null,
  ].filter(Boolean);

  return (
    <div className={embedded ? "tw-fcp-pane-body" : "tw-page"}>
      <header className="tw-fcp-hero">
        {!embedded && (
          <Link href={`/federacion/${slug}`} className="tw-back" style={{ marginBottom: 12 }}>
            <IconChevronRight size={13} style={{ transform: "rotate(180deg)" }} />
            Federación
          </Link>
        )}
        <div className="tw-fcp-hero-top">
          <FedCrest logo="/federations/fcantp-mark.png" alt="" />
          <div className="tw-fcp-hero-txt">
            <h1 className="tw-fcp-hero-title">
              {header.data?.nombre ?? decodeURIComponent(id)}
            </h1>
            {tab !== "cuadro" && groupMeta.length > 0 && (
              <p className="tw-fcp-hero-sub">{groupMeta.join(" · ")}</p>
            )}
          </div>
          {tab !== "cuadro" && (
            <Chip tone={finalizada ? "accent" : "mute"}>
              {finalizada ? "Finalizada" : "En curso"}
            </Chip>
          )}
        </div>
      </header>

      {/* El selector sólo aparece en el playoff, que es el único grupo con
          algo que elegir: el cuadro. */}
      {esPlayoff && (
        <div style={{ marginBottom: 16 }}>
          <Segmented
            label="Vista del grupo"
            value={tab}
            onChange={setTab}
            options={tabs.map(([v, l]) => ({ value: v, label: l }))}
          />
        </div>
      )}

      {tab === "cuadro" ? (
        <FcpBracketPanel idGrupo={id} />
      ) : (
        <div className="tw-fcp-split">
          <section style={{ minWidth: 0 }}>
            <SectionHead title="Clasificación" style={{ margin: "0 0 10px" }} />
            {myRow && (
              <Card style={{ marginBottom: 12, padding: "12px 16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <span style={{ fontSize: 14, fontWeight: 600 }}>
                    Tu equipo: {myRow.posicion}º · {myRow.puntos} pts
                  </span>
                  {myZone && <ZoneTag zone={myZone} />}
                </div>
              </Card>
            )}
            {standings.error ? (
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
              <FcpStandingsTable slug={slug} rows={rows} zones={zones} myFcpId={myFcpId} />
            )}
            {zones && rows.length > 0 && <ZoneLegend zones={zones} />}
          </section>

          <section style={{ minWidth: 0 }}>
            <SectionHead title="Jornadas" style={{ margin: "0 0 10px" }} />
            {matches.loading ? (
              <SkeletonCard />
            ) : mData.length === 0 ? (
              <Card>
                <EmptyState icon={<IconFlag size={22} />} title="Sin jornadas registradas" />
              </Card>
            ) : (
              <FcpGroupSchedule idGrupo={id} matches={mData} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * Tabla de clasificación de un grupo (zonas, tu fila en verde, racha). La usan
 * el grupo federativo y la pestaña Clasificación de una temporada.
 */
export function FcpStandingsTable({
  slug,
  rows,
  zones,
  myFcpId,
}: {
  slug: string;
  rows: FcpStanding[];
  zones: FcpZone[] | null;
  myFcpId: number | null;
}) {
  const pane = useFcpPane();
  const isMine = (idEquipo: number) => myFcpId != null && Number(idEquipo) === myFcpId;
  const zoneOf = (pos: number): FcpZone | null =>
    zones?.find((zn) => pos >= zn.from && pos <= zn.to) ?? null;
  return (
              <Card flush>
            <div className="tw-roster-scroll">
              <div className="tw-fcp-head tw-fcp-stand">
                {["Pos", "Equipo", "PJ", "PG", "Dif", "Sets +", "Sets −", "Pts", "Racha"].map(
                  (h, i) => (
                    <span key={h} className={i >= 2 && i <= 6 ? "tw-st-x" : undefined}>
                      {h}
                    </span>
                  )
                )}
              </div>
              {rows.map((t, i) => {
                const dif = t.setsFavor - t.setsContra;
                const mine = isMine(t.idEquipo);
                const zone = zoneOf(t.posicion);
                // Línea discontinua donde cambia de zona.
                const next = rows[i + 1];
                const cambia =
                  zones != null && next != null && zoneOf(next.posicion)?.id !== zone?.id;
                return (
                  <Link
                    key={t.idEquipo}
                    href={`/federacion/${slug}/equipo/${t.idEquipo}`}
                    onClick={pane("equipo", t.idEquipo)}
                    className="tw-fcp-table-row tw-fcp-stand"
                    style={{
                      color: "inherit",
                      background: mine ? "var(--accent-10)" : undefined,
                      // Franja de la zona a la izquierda.
                      boxShadow: zone ? `inset 3px 0 0 ${zone.color}` : undefined,
                      borderBottom: cambia ? "1px dashed var(--line-strong)" : undefined,
                    }}
                    title={zone ? zone.label : undefined}
                  >
                    <span className="mono" style={{ color: "var(--text-muted)" }}>
                      {t.posicion}
                    </span>
                    <span style={{ minWidth: 0 }}>
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
                      <span className="tw-st-sub">
                        PJ <span className="mono">{t.pj}</span> · PG{" "}
                        <span className="mono">{t.pg}</span> · Dif{" "}
                        <span className="mono">{dif >= 0 ? `+${dif}` : dif}</span> · Sets{" "}
                        <span className="mono">
                          {t.setsFavor}-{t.setsContra}
                        </span>
                      </span>
                    </span>
                    <span className="mono tw-st-x">{t.pj}</span>
                    <span className="mono tw-st-x">{t.pg}</span>
                    <span className="mono tw-st-x" style={{ color: "var(--text-muted)" }}>
                      {dif >= 0 ? `+${dif}` : dif}
                    </span>
                    <span className="mono tw-st-x">{t.setsFavor}</span>
                    <span className="mono tw-st-x">{t.setsContra}</span>
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
  );
}

/* ── Zonas de la clasificación (normativa de la liga) ── */
function ZoneSwatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      style={{ width: 10, height: 10, borderRadius: 3, background: color, flex: "none" }}
    />
  );
}

function ZoneTag({ zone }: { zone: FcpZone }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12.5,
        color: "var(--text-muted)",
      }}
    >
      <ZoneSwatch color={zone.color} />
      {zone.label}
    </span>
  );
}

function ZoneLegend({ zones }: { zones: FcpZone[] }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px" }}>
        {zones.map((zn) => (
          <span
            key={zn.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12.5,
              color: "var(--text-muted)",
            }}
          >
            <ZoneSwatch color={zn.color} />
            {zn.label}
            <span className="mono" style={{ color: "var(--text-faint)" }}>
              {zn.from === zn.to ? `${zn.from}º` : `${zn.from}º–${zn.to}º`}
            </span>
          </span>
        ))}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-faint)" }}>
        {FCP_ZONES_NOTE}
      </p>
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
  // Caras y puntos de quien juega cada punto. Una consulta por grupo, no
  // por partido: son los mismos sesenta jugadores toda la temporada.
  const players = useAsync(() => fetchFcpGroupPlayerIndex(idGrupo), [idGrupo, user?.id]);
  const [abierto, setAbierto] = useState<(typeof matches)[number] | null>(null);

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

  // Una jornada cada vez. Catorce jornadas apiladas son metro y medio de
  // scroll para mirar una sola, así que se pasan con los botones.
  const [idx, setIdx] = useState<number | null>(null);
  // Se aterriza en la última jugada, no en la primera: quien entra viene a
  // ver lo de ayer, no la jornada 1 de una liga acabada.
  const initial = useMemo(() => {
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i].items.some((m) => m.resultado)) return i;
    }
    return 0;
  }, [groups]);
  const cur = Math.min(idx ?? initial, Math.max(groups.length - 1, 0));

  if (groups.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconCalendar size={22} />}
          title="Sin jornadas"
          body="La federación aún no ha publicado el calendario de este grupo."
        />
      </Card>
    );
  }

  const g = groups[cur];
  const date = fmtFcpDate(g.items.find((m) => m.fecha)?.fecha ?? null) || null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="tw-pager">
        <button
          type="button"
          className="tw-pager-btn"
          onClick={() => setIdx(cur - 1)}
          disabled={cur === 0}
          aria-label="Jornada anterior"
        >
          <IconChevronRight size={17} style={{ transform: "rotate(180deg)" }} />
        </button>

        <span className="tw-pager-mid">
          <span className="tw-pager-title">{g.label}</span>
          <span className="tw-pager-sub">
            {[date, `${g.items.length} partidos`].filter(Boolean).join(" · ")}
          </span>
        </span>

        <span className="tw-pager-count mono">
          {cur + 1} / {groups.length}
        </span>

        <button
          type="button"
          className="tw-pager-btn"
          onClick={() => setIdx(cur + 1)}
          disabled={cur === groups.length - 1}
          aria-label="Jornada siguiente"
        >
          <IconChevronRight size={17} />
        </button>
      </div>

      <Card flush key={g.label}>
        {g.items.map((p, i) => {
              const score = splitScore(p.resultado);
              const localWon = p.ganador === "local";
              const visitWon = p.ganador === "visitante";
              const actaCompleta = actaMap[p.idPartido] ?? [];
              const acta = actaCompleta.slice(0, 3);
              // Sin acta publicada no hay nada que abrir: la fila se queda
              // como estaba en vez de prometer un panel vacío.
              const abrible = actaCompleta.length > 0;
              return (
                <div
                  key={p.idPartido}
                  style={{
                    borderBottom: i === g.items.length - 1 ? "none" : "1px solid var(--line)",
                  }}
                >
                  <div
                    role={abrible ? "button" : undefined}
                    tabIndex={abrible ? 0 : undefined}
                    onClick={abrible ? () => setAbierto(p) : undefined}
                    onKeyDown={
                      abrible
                        ? (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setAbierto(p);
                            }
                          }
                        : undefined
                    }
                    className={abrible ? "acta-row" : undefined}
                    aria-label={abrible ? `Ver el acta de ${p.local} contra ${p.visitante}` : undefined}
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
                    {!p.resultado ? (
                      <Chip tone="mute">Por jugar</Chip>
                    ) : abrible ? (
                      <span className="acta-row-go" aria-hidden="true">
                        <IconChevronRight size={15} />
                      </span>
                    ) : null}
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

      <FcpActaModal
        partido={abierto}
        acta={abierto ? (actaMap[abierto.idPartido] ?? []) : []}
        index={players.data ?? {}}
        onClose={() => setAbierto(null)}
      />
    </div>
  );
}

/* ── Acta de un partido ──────────────────────────────────────────────
   Una eliminatoria de liga son cinco puntos, y cada punto lo juegan dos
   parejas. Esto abre el acta entera: quién jugó cada punto, con su cara y
   sus puntos de ranking, y cómo acabó.

   La cara sale de `profiles.avatar_url` de quien ha reclamado su ficha
   federativa. La RLS sólo deja ver la propia y la de compañeros de equipo
   o club, así que el resto se queda en iniciales. ─────────────────────── */

function paresDe(j1: string | null, j2: string | null): string[] {
  return [j1, j2].map((x) => (x ?? "").trim()).filter(Boolean);
}

function ActaPair({
  jugadores,
  index,
  won,
  sets,
}: {
  jugadores: string[];
  index: Record<string, FcpActaPlayerInfo>;
  won: boolean;
  sets: number | null;
}) {
  const info = jugadores.map((n) => index[fcpNameKey(n)] ?? null);
  const puntos = info.filter(Boolean).map((i) => i!.puntos);
  return (
    <div className={"acta-pair" + (won ? " is-won" : "")}>
      <span className="acta-faces">
        {jugadores.map((n, i) => (
          <Avatar key={n + i} initials={initials(n)} src={info[i]?.avatarUrl} size={30} />
        ))}
      </span>
      <span className="acta-who">
        <span className="acta-names truncate">{jugadores.join(" / ") || "—"}</span>
        {puntos.length > 0 && (
          <span className="acta-pts mono">{puntos.map(fmtInt).join(" · ")} pts</span>
        )}
      </span>
      <span className="acta-sets mono">{sets ?? "—"}</span>
    </div>
  );
}

function FcpActaModal({
  partido,
  acta,
  index,
  onClose,
}: {
  partido: { local: string | null; visitante: string | null; resultado: string | null } | null;
  acta: FcpActaPartido[];
  index: Record<string, FcpActaPlayerInfo>;
  onClose: () => void;
}) {
  if (!partido) return null;
  const marcador = splitScore(partido.resultado);
  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="acta-title"
      width={560}
      title={
        <span className="acta-head" id="acta-title">
          <span className="truncate">{partido.local ?? "—"}</span>
          <span className="acta-score mono">
            {marcador ? `${marcador[0]} — ${marcador[1]}` : "vs"}
          </span>
          <span className="truncate" style={{ textAlign: "right" }}>
            {partido.visitante ?? "—"}
          </span>
        </span>
      }
    >
      {acta.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
          La federación todavía no ha publicado el acta de este partido.
        </p>
      ) : (
        <div className="acta-list">
          {acta.map((g) => (
            <div key={g.partidoNum} className="acta-punto">
              <div className="acta-punto-head">
                <span className="acta-punto-num">Pareja {g.partidoNum}</span>
                {g.parciales && <span className="acta-parciales mono">{g.parciales}</span>}
              </div>
              <ActaPair
                jugadores={paresDe(g.localJ1, g.localJ2)}
                index={index}
                won={g.ganador === "local"}
                sets={g.setsLocal}
              />
              <ActaPair
                jugadores={paresDe(g.visitJ1, g.visitJ2)}
                index={index}
                won={g.ganador === "visitante"}
                sets={g.setsVisit}
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

/* ── Cuadro de playoff (bracket): columnas por ronda + modal de acta ── */
export function FcpBracketPanel({ idGrupo }: { idGrupo: string }) {
  const { user, activeTeam } = useSession();
  const bracket = useAsync(() => fetchFcpBracket(idGrupo), [idGrupo, user?.id]);
  const [selCuadro, setSelCuadro] = useState(0);
  const [openTie, setOpenTie] = useState<FcpBracketTie | null>(null);

  // «Tu equipo» en el cuadro: por el VÍNCULO federativo (id → nombre FCP),
  // porque el cuadro solo guarda nombres. Sin vínculo, por el nombre del
  // equipo activo, normalizado.
  const teamId = activeTeam?.id ?? null;
  const myFcpName = useAsync(
    async () => {
      const fcpId = await fetchTeamFcpId(teamId!);
      return fcpId != null ? await fetchFcpTeamNameById(fcpId, idGrupo) : null;
    },
    [teamId, idGrupo],
    !!teamId
  );
  const myName = myFcpName.data ?? (myFcpName.loading ? null : activeTeam?.name ?? null);
  const isMine = (name: string | null) => !!myName && fcpSameTeam(name, myName);

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

      {myName && (
        <BracketPath
          teamName={myName}
          rounds={cuadro.rounds}
          isMine={isMine}
          onOpen={setOpenTie}
        />
      )}

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
                    <TieCard
                      key={t.idPartido}
                      tie={t}
                      onOpen={() => setOpenTie(t)}
                      mine={isMine(t.local) ? "local" : isMine(t.visit) ? "visit" : null}
                    />
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

/** Próxima manga sin jugar de un cruce: «IDA · SÁB 17/05 17:00 · sede».
 *  Null si ya está jugado o la FCP no ha publicado ni fecha ni sede. */
function nextLegText(tie: FcpBracketTie): string | null {
  if (tie.estado === "jugado") return null;
  const leg = (label: string, f: string | null | undefined, l: string | null | undefined) => {
    const parts = [fmtLegDate(f), l].filter(Boolean);
    return parts.length ? [label, ...parts].join(" · ") : null;
  };
  const vuelta = leg("VUELTA", tie.fechaVuelta, tie.lugarVuelta);
  if (tie.estado === "jugado_ida") return vuelta;
  return leg("IDA", tie.fechaIda, tie.lugarIda) ?? vuelta;
}

/** Recorrido del equipo del usuario en el cuadro: sus cruces ronda a ronda
 *  (como en la app). Lo que se quiere saber de un cuadro es «de dónde vengo y
 *  contra quién voy», y en el lienzo hay que buscarlo columna a columna. */
function BracketPath({
  teamName,
  rounds,
  isMine,
  onOpen,
}: {
  teamName: string;
  rounds: { avance: number; label: string; ties: FcpBracketTie[] }[];
  isMine: (name: string | null) => boolean;
  onOpen: (tie: FcpBracketTie) => void;
}) {
  // Rondas ya vienen de la primera a la final.
  const path = rounds
    .map((r) => ({ round: r, tie: r.ties.find((t) => isMine(t.local) || isMine(t.visit)) }))
    .filter((x): x is { round: (typeof rounds)[number]; tie: FcpBracketTie } => !!x.tie);
  if (path.length === 0) return null;

  return (
    <Card style={{ marginBottom: 16 }}>
      <div className="grid-head truncate" style={{ marginBottom: 10 }} title={`Recorrido de ${teamName}`}>
        RECORRIDO DE {teamName.toUpperCase()}
      </div>
      <div style={{ display: "grid", gap: 2 }}>
        {path.map(({ round, tie }) => {
          const iAmLocal = isMine(tie.local);
          const rival = iAmLocal ? tie.visit : tie.local;
          const won = (iAmLocal && tie.ganador === "local") || (!iAmLocal && tie.ganador === "visitante");
          const lost = !!tie.ganador && tie.ganador !== "empate" && !won;
          const hasActa = tie.estado === "jugado" || tie.estado === "jugado_ida";
          // Marcadores vistos desde mi equipo: lo mío primero.
          const mineFirst = (s: { l: number; v: number } | null | undefined) =>
            s ? (iAmLocal ? `${s.l}–${s.v}` : `${s.v}–${s.l}`) : null;
          const [ml, mv] = (tie.marcador ?? "").split("-");
          const total = tie.marcador ? (iAmLocal ? `${ml}–${mv}` : `${mv}–${ml}`) : null;
          const legs = [
            mineFirst(tie.idaScore) ? `Ida ${mineFirst(tie.idaScore)}` : null,
            mineFirst(tie.vueltaScore) ? `Vuelta ${mineFirst(tie.vueltaScore)}` : null,
          ].filter(Boolean);
          const next = nextLegText(tie);
          const result = total
            ? `${won ? "Ganó" : lost ? "Perdió" : ""} ${total}`.trim()
            : next ?? "Pendiente";
          return (
            <button
              key={tie.idPartido}
              type="button"
              disabled={!hasActa}
              onClick={() => onOpen(tie)}
              aria-label={hasActa ? `${round.label}: ver acta contra ${rival || "por determinar"}` : undefined}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 7.5rem) minmax(0, 1fr) auto",
                alignItems: "baseline",
                columnGap: 12,
                rowGap: 2,
                width: "100%",
                textAlign: "left",
                padding: "8px 0",
                background: "none",
                border: 0,
                borderTop: "1px solid var(--line)",
                color: "inherit",
                font: "inherit",
                cursor: hasActa ? "pointer" : "default",
              }}
            >
              <span className="truncate" style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>
                {round.label}
              </span>
              <span
                className="truncate"
                style={{
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: rival ? "var(--text)" : "var(--text-faint)",
                  fontStyle: rival ? "normal" : "italic",
                }}
              >
                {rival || "Por determinar"}
              </span>
              <span
                className={total ? "mono" : undefined}
                style={{
                  fontSize: total ? 13 : 12,
                  fontWeight: total ? 700 : 500,
                  textAlign: "right",
                  color: won ? "var(--accent)" : lost ? "var(--text-faint)" : "var(--text-muted)",
                }}
              >
                {result}
              </span>
              {(legs.length > 0 || (total && next)) && (
                <span
                  className="truncate"
                  style={{ gridColumn: "2 / -1", fontSize: 12, color: "var(--text-muted)" }}
                >
                  {[legs.join(" · "), total ? next : null].filter(Boolean).join(" · ")}
                  {hasActa ? <span className="link-action" style={{ marginLeft: 8 }}>Ver acta</span> : null}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-faint)" }}>
        El marcador es de partidos ganados en la eliminatoria, sumando ida y vuelta.
      </div>
    </Card>
  );
}

/** Fecha de una manga del playoff, como en la app: «SÁB 17/05 17:00». La
 *  FCP la da como texto; se entiende ISO («2026-05-17 17:00») y «17/05/2026
 *  17:00». Si no encaja, se deja tal cual. */
function fmtLegDate(v: string | null | undefined): string | null {
  if (!v) return null;
  let y: number, mo: number, d: number;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const es = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (iso) [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (es) [d, mo, y] = [Number(es[1]), Number(es[2]), Number(es[3].length === 2 ? "20" + es[3] : es[3])];
  else return v.toUpperCase();
  const date = new Date(y, mo - 1, d);
  if (Number.isNaN(date.getTime())) return v.toUpperCase();
  const wd = date.toLocaleDateString("es-ES", { weekday: "short" }).replace(".", "").toUpperCase();
  const hm = v.match(/(\d{1,2}):(\d{2})/);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${wd} ${pad(d)}/${pad(mo)}${hm ? ` ${pad(Number(hm[1]))}:${hm[2]}` : ""}`;
}

function TieCard({
  tie,
  onOpen,
  mine,
}: {
  tie: FcpBracketTie;
  onOpen: () => void;
  /** Lado en el que juega el equipo del usuario, si juega este cruce. */
  mine?: "local" | "visit" | null;
}) {
  const hasActa = tie.estado === "jugado" || tie.estado === "jugado_ida";
  const line = (name: string | null, won: boolean, muted?: boolean, me?: boolean) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
      <span style={{ width: 14, flex: "none", color: "var(--accent)", display: "flex" }}>
        {won ? <IconCheck size={12} /> : null}
      </span>
      <span
        className="truncate"
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 13,
          fontWeight: won || me ? 700 : 500,
          color: won || me ? "var(--text)" : muted ? "var(--text-faint)" : "var(--text-muted)",
          fontStyle: muted ? "italic" : "normal",
        }}
      >
        {name || "—"}
      </span>
      {me && (
        <Chip tone="accent" plain style={{ flex: "none" }}>
          Tu equipo
        </Chip>
      )}
    </div>
  );
  // Fecha y sede de cada manga, solo si la FCP las ha publicado.
  const legs = (
    [
      ["IDA", fmtLegDate(tie.fechaIda), tie.lugarIda],
      ["VUELTA", fmtLegDate(tie.fechaVuelta), tie.lugarVuelta],
    ] as [string, string | null, string | null | undefined][]
  ).filter(([, f, l]) => f || l);
  return (
    <button
      type="button"
      disabled={!hasActa}
      onClick={onOpen}
      className="tw-tie"
      aria-label={mine ? "Cruce de tu equipo" : undefined}
      style={{
        textAlign: "left",
        width: "100%",
        padding: "10px 12px",
        cursor: hasActa ? "pointer" : "default",
        display: "grid",
        gap: 6,
        ...(mine
          ? { borderColor: "var(--accent-40)", background: "var(--accent-10)" }
          : null),
      }}
    >
      {line(tie.local, tie.ganador === "local", false, mine === "local")}
      <div className="divider" style={{ margin: 0 }} />
      {line(tie.visit || "Por determinar", tie.ganador === "visitante", !tie.visit, mine === "visit")}
      {legs.length > 0 && (
        <div style={{ display: "grid", gap: 2 }}>
          {legs.map(([k, f, l]) => (
            <span
              key={k}
              className="truncate"
              style={{ fontSize: 12, color: "var(--text-muted)" }}
              title={[k, f, l].filter(Boolean).join(" · ")}
            >
              {k}
              {f ? <span className="mono"> · {f}</span> : null}
              {l ? ` · ${l}` : null}
            </span>
          ))}
        </div>
      )}
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
export function FcpTeamView({
  slug,
  id,
  initial,
  embedded,
}: {
  slug: string;
  id: string;
  /** Perfil ya cargado en servidor (SEO): la vista arranca pintada. */
  initial?: FcpTeamProfile | null;
  /** Dentro del panel de detalle del explorador: sin «volver» ni márgenes de página. */
  embedded?: boolean;
}) {
  const { user } = useSession();
  const pane = useFcpPane();
  const root = embedded ? "tw-fcp-pane-body" : "tw-page";
  const back = embedded ? undefined : { href: `/federacion/${slug}`, label: "Federación" };
  const idEquipo = Number(id);
  const [sort, setSort] = useState<"puntos" | "nombre">("puntos");
  // Resumen · Partidos · Plantilla (como la ficha de equipo de la app).
  const [teamTab, setTeamTab] = useState<"resumen" | "partidos" | "plantilla">("resumen");
  const { data, loading, error } = useAsync(
    () => fetchFcpTeamProfile(idEquipo),
    [idEquipo, user?.id],
    Number.isFinite(idEquipo),
    initial
  );
  // Próximo y últimos: las jornadas del grupo filtradas por este equipo.
  const groupMatches = useAsync(
    () => fetchFcpMatches(data!.idGrupo!),
    [data?.idGrupo],
    !!data?.idGrupo && !data?.preseason
  );

  if (loading) return <SkeletonPage />;

  if (error || !data) {
    return (
      <div className={root}>
        <PageHeader
          back={back}
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
  const teamMatches = (groupMatches.data ?? [])
    .filter((m) => fcpSameTeam(m.local, data.equipo) || fcpSameTeam(m.visitante, data.equipo))
    .map((m) => {
      const home = fcpSameTeam(m.local, data.equipo);
      const sc = splitScore(m.resultado);
      const l = sc ? Number(sc[0]) : null;
      const v = sc ? Number(sc[1]) : null;
      const played = l != null && v != null && Number.isFinite(l) && Number.isFinite(v);
      return {
        id: m.idPartido,
        jornada: m.jornada,
        fecha: m.fecha,
        hora: m.hora,
        rival: home ? m.visitante : m.local,
        home,
        us: played ? (home ? l : v) : null,
        them: played ? (home ? v : l) : null,
        played,
      };
    });
  const playedTM = teamMatches
    .filter((m) => m.played)
    .sort((a, b) => (b.jornada ?? 0) - (a.jornada ?? 0));
  const nextTM = teamMatches
    .filter((m) => !m.played)
    .sort((a, b) => (a.jornada ?? 999) - (b.jornada ?? 999))[0];

  return (
    <div className={root}>
      <PageHeader
        back={back}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={initials(data.equipo)} size={40} />
            {data.equipo}
          </span>
        }
        meta={[
          // En inscripción, «2ª Masculina · Grupo B» en vez del «2ª CATEGORIA
          // MASCULINA» de la FCP: el grupo es lo que más importa y no cabía.
          data.preseason
            ? [
                fcpCategoriaCorta(data.preseason.categoria, data.preseason.genero) ??
                  data.grupo,
                data.preseason.subgrupo ? `Grupo ${data.preseason.subgrupo}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || null
            : (data.grupo ?? null),
        ]}
        actions={
          data.preseason ? (
            <Chip tone={data.preseason.confirmado ? "accent" : "warning"}>
              {data.preseason.confirmado ? "Confirmado" : "Sin confirmar"}
            </Chip>
          ) : data.posicion != null ? (
            <Chip>{data.posicion}º del grupo</Chip>
          ) : undefined
        }
      />

      {/* Temporada en inscripción: sin sorteo no hay clasificación ni
          partidos. Pintar la fila de cifras a cero sería mentir —parecería un
          equipo que ha jugado y ha perdido todo—, así que se sustituye por lo
          que sí sabemos. */}
      {data.preseason ? (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <IconFlag size={16} />
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              Temporada {data.preseason.temporada ?? "siguiente"} · en inscripción
            </span>
          </div>
          <p style={{ margin: "0 0 14px", fontSize: 13.5, color: "var(--text-muted)" }}>
            {data.preseason.subgrupo
              ? "La Federación ya ha repartido la categoría en grupos, pero todavía no hay calendario ni clasificación. Lo que sí hay es contra quién jugará, dónde y con qué plantilla."
              : "La Federación todavía no ha hecho el sorteo, así que este equipo aún no tiene grupo, calendario ni clasificación. Lo que sí hay es dónde le han encuadrado y su plantilla: ahí es donde se ven los fichajes."}
          </p>
          {/* Ni categoría ni género: los dos van ya en la cabecera, y el
              nombre de la categoría («5ª CATEGORIA MASCULINA») lleva el género
              dentro. Repetirlos aquí solo hacía la fila más alta. Sin `unit`
              en la plantilla: su margen de 2px es para «%» y con una palabra
              entera el número queda pegado. La sede, en corto («SMASH») si la
              Federación la da así: el nombre largo no cabe en una cifra. */}
          <StatRow>
            <Stat
              label="Sede de local"
              value={data.preseason.sedeCorta ?? data.preseason.sede ?? "Sin asignar"}
              sub={data.preseason.sedeCorta ? (data.preseason.sede ?? undefined) : undefined}
            />
            <Stat label="Plantilla" value={data.roster.length} />
          </StatRow>
        </Card>
      ) : (
      <>
      <div className="tw-toolbar">
        <Segmented
          label="Ficha del equipo"
          value={teamTab}
          onChange={setTeamTab}
          options={[
            { value: "resumen", label: "Resumen" },
            { value: "partidos", label: "Partidos" },
            { value: "plantilla", label: `Plantilla · ${data.roster.length}` },
          ]}
        />
      </div>
      {teamTab === "partidos" ? (
        playedTM.length === 0 ? (
          <Card>
            <EmptyState icon={<IconFlag size={22} />} title="Aún no ha jugado ninguna jornada" />
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
            {playedTM.map((m, i) => (
              <TeamActaCard key={m.id} m={m} initiallyOpen={i === 0} />
            ))}
          </div>
        )
      ) : teamTab === "resumen" ? (
      <>
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

      {nextTM ? (
        <Card style={{ marginBottom: 16, borderColor: "var(--accent-40)" }}>
          <CardHead title="Próximo" />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
              J{String(nextTM.jornada ?? 0).padStart(2, "0")}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="truncate" style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>
                vs {nextTM.rival}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>
                {[
                  nextTM.fecha
                    ? new Date(nextTM.fecha + "T00:00:00").toLocaleDateString("es-ES", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })
                    : null,
                  nextTM.hora?.slice(0, 5),
                  nextTM.home ? "En casa" : "Fuera",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </div>
        </Card>
      ) : null}

      {playedTM.length > 0 ? (
        <Card flush style={{ marginBottom: 16 }}>
          <CardHead title="Últimos">
            <Btn size="sm" variant="quiet" onClick={() => setTeamTab("partidos")}>
              Todos
            </Btn>
          </CardHead>
          {playedTM.slice(0, 3).map((m) => (
            <div key={m.id} className="list-row">
              <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)", width: 30 }}>
                J{String(m.jornada ?? 0).padStart(2, "0")}
              </span>
              <span className="list-row-main">
                <span className="list-row-title truncate">{m.rival}</span>
                <span className="list-row-sub">{m.home ? "Casa" : "Fuera"}</span>
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color:
                    (m.us ?? 0) > (m.them ?? 0)
                      ? "var(--accent)"
                      : (m.us ?? 0) < (m.them ?? 0)
                        ? "var(--error)"
                        : "var(--text-muted)",
                }}
              >
                {m.us}–{m.them}
              </span>
            </div>
          ))}
        </Card>
      ) : null}
      {data.roster.length > 0 ? (
        <Card flush style={{ marginBottom: 16 }}>
          <CardHead title="Más puntos">
            <Btn size="sm" variant="quiet" onClick={() => setTeamTab("plantilla")}>
              Plantilla
            </Btn>
          </CardHead>
          {/* Podio: los 3 con más puntos de la federación, 1º en acento. */}
          {[...data.roster]
            .sort((a, b) => b.puntos - a.puntos)
            .slice(0, 3)
            .map((p, i) => (
              <ListRow
                key={p.idJugador}
                href={`/federacion/${slug}/jugador/${encodeURIComponent(p.idJugador)}`}
                onClick={pane("jugador", p.idJugador)}
                icon={
                  <>
                    <span
                      className="mono"
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: i === 0 ? "var(--accent)" : "var(--text-faint)",
                        width: 24,
                        textAlign: "center",
                        flex: "none",
                      }}
                    >
                      {i + 1}º
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
                      style={{ fontSize: 12, fontWeight: 500, color: "var(--text-faint)", marginLeft: 4 }}
                    >
                      pts
                    </span>
                  </span>
                }
              />
            ))}
        </Card>
      ) : null}
      </>
      ) : null}
      </>
      )}

      {/* Su grupo en la liga que viene: contra quién juega y dónde. Sale del
          PDF de distribución de la FCP; sin él no hay nada que enseñar (la
          categoría entera no es «su grupo»). */}
      {data.preseason && data.preseason.rivales.length > 0 && (
        <Card flush style={{ marginBottom: 16 }}>
          <CardHead
            title="Su grupo"
            count={data.preseason.rivales.length}
            sub={`Grupo ${data.preseason.subgrupo} · rivales de la temporada ${data.preseason.temporada ?? "siguiente"}`}
          />
          {data.preseason.rivales.map((r) => (
            <ListRow
              key={r.idEquipo}
              href={`/federacion/${slug}/equipo/${r.idEquipo}`}
              onClick={pane("equipo", r.idEquipo)}
              title={r.equipo}
              sub={r.sedeCorta ? `Juega en ${r.sedeCorta}` : "Sede sin asignar"}
              right={r.confirmado ? undefined : <Chip tone="warning">Sin confirmar</Chip>}
            />
          ))}
        </Card>
      )}

      {/* Plantilla */}
      {(data.preseason || teamTab === "plantilla") && (
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
              onClick={pane("jugador", p.idJugador)}
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
      )}
    </div>
  );
}

/** Jornada de un equipo, desplegable con las 5 parejas del acta. */
function TeamActaCard({
  m,
  initiallyOpen,
}: {
  m: {
    id: string;
    jornada: number | null;
    fecha: string | null;
    rival: string;
    home: boolean;
    us: number | null;
    them: number | null;
  };
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!initiallyOpen);
  const acta = useAsync(() => fetchFcpActa(m.id), [m.id], open);
  const col =
    (m.us ?? 0) > (m.them ?? 0)
      ? "var(--accent)"
      : (m.us ?? 0) < (m.them ?? 0)
        ? "var(--error)"
        : "var(--text-muted)";
  const sur = (n: string | null) => (n ?? "").trim().split(/\s+/).slice(-1)[0] || "—";
  return (
    <Card flush>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="list-row"
        style={{
          width: "100%",
          background: "none",
          border: 0,
          cursor: "pointer",
          textAlign: "left",
          color: "inherit",
        }}
      >
        <span className="list-row-main">
          <span className="list-row-sub">
            Jornada {m.jornada ?? "—"}
            {m.fecha
              ? ` · ${new Date(m.fecha + "T00:00:00").toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                })}`
              : ""}
          </span>
          <span className="list-row-title truncate">
            {m.home ? "vs" : "en"} {m.rival}
          </span>
        </span>
        <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: col }}>
          {m.us}–{m.them}
        </span>
        <IconChevronDown size={15} style={{ transform: open ? "rotate(180deg)" : "none" }} />
      </button>
      {open &&
        (acta.loading ? (
          <div style={{ padding: 16 }}>
            <SkeletonCard />
          </div>
        ) : (acta.data ?? []).length === 0 ? (
          <p style={{ margin: 0, padding: "0 18px 16px", fontSize: 13, color: "var(--text-muted)" }}>
            Acta pendiente
          </p>
        ) : (
          (acta.data ?? []).map((p) => {
            const ours = m.home ? [p.localJ1, p.localJ2] : [p.visitJ1, p.visitJ2];
            const theirs = m.home ? [p.visitJ1, p.visitJ2] : [p.localJ1, p.localJ2];
            const su = (m.home ? p.setsLocal : p.setsVisit) ?? 0;
            const sh = (m.home ? p.setsVisit : p.setsLocal) ?? 0;
            const won = su > sh;
            return (
              <div key={p.partidoNum} className="list-row">
                <span
                  className="mono"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "var(--r-sm)",
                    flex: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    background: won ? "var(--accent-10)" : "var(--error-soft)",
                    color: won ? "var(--accent)" : "var(--error)",
                  }}
                >
                  {won ? "V" : "D"}
                </span>
                <span className="list-row-main">
                  <span className="list-row-title truncate">{ours.map(sur).join(" / ")}</span>
                  <span className="list-row-sub truncate">vs {theirs.map(sur).join(" / ")}</span>
                </span>
                <span style={{ textAlign: "right" }}>
                  <span className="mono" style={{ display: "block", fontSize: 13, fontWeight: 700 }}>
                    {su}-{sh}
                  </span>
                  {p.parciales ? (
                    <span
                      className="mono"
                      style={{ display: "block", fontSize: 12, color: "var(--text-faint)" }}
                    >
                      {p.parciales}
                    </span>
                  ) : null}
                </span>
              </div>
            );
          })
        ))}
    </Card>
  );
}

/* ═══ 05 · JUGADOR FEDERADO ═══════════════════════════════════════ */
type MatchFilter = "todos" | "victorias" | "derrotas";
const MATCH_FILTER_LABEL: Record<MatchFilter, string> = {
  todos: "Todos",
  victorias: "Victorias",
  derrotas: "Derrotas",
};

export function FcpPlayerView({ id, embedded }: { id: string; embedded?: boolean }) {
  const { user } = useSession();
  const root = embedded ? "tw-fcp-pane-body" : "tw-page";
  const back = embedded ? undefined : { href: "/federacion", label: "Federación" };
  const idJugador = decodeURIComponent(id);

  const profile = useAsync(() => fetchFcpPlayerProfile(idJugador), [idJugador, user?.id]);
  const years = useAsync(() => fetchFcpPlayerYears(idJugador), [idJugador, user?.id]);
  const history = useAsync(() => fetchFcpPlayerHistory(idJugador), [idJugador, user?.id]);
  // Histórico partido a partido (puntos que sumó o restó cada uno).
  const histMatches = useAsync(() => fetchPlayerHistMatches(idJugador), [idJugador, user?.id]);

  const [selLiga, setSelLiga] = useState<number | null>(null);
  const [filter, setFilter] = useState<MatchFilter>("todos");
  const [allPartners, setAllPartners] = useState(false);

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
      <div className={root}>
        <PageHeader back={back} title="Jugador" />
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

  // Histórico de la temporada elegida (cronológico).
  const yearHist = (histMatches.data ?? []).filter(
    (h) => selYear != null && String(h.anio) === selYear.anio,
  );
  // Curva: puntos tras cada partido, reconstruidos hacia atrás desde los
  // actuales. Con menos de 3 partidos no se dibuja.
  const withVar = yearHist.filter((h) => h.puntosVar != null);
  const curve = (() => {
    if (withVar.length < 3) return null;
    const vals: number[] = new Array(withVar.length);
    let acc = rankingPts;
    for (let i = withVar.length - 1; i >= 0; i--) {
      vals[i] = acc;
      acc -= withVar[i].puntosVar ?? 0;
    }
    // El histórico trae «17/01/2026 16:00»; algunas filas, ISO.
    const toDate = (f: string | null) => {
      if (!f) return null;
      const dmy = f.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      const d = dmy
        ? new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
        : new Date(f.slice(0, 10) + "T00:00:00");
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const mon = (f: string | null) => toDate(f)?.toLocaleDateString("es-ES", { month: "short" }) ?? "";
    const day = (f: string | null) =>
      toDate(f)?.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) ?? "";
    const points: CurvePoint[] = withVar.map((h) => {
      const head = h.esPlayoff ? "Playoff" : h.jornada ? `J${h.jornada}` : "Partido";
      return {
        delta: h.puntosVar ?? 0,
        won: h.gana,
        label: h.equipoRival ? `${head} · ${h.equipoRival}` : head,
        date: day(h.fecha),
      };
    });
    return {
      values: [acc, ...vals],
      points,
      start: mon(withVar[0].fecha),
      end: mon(withVar[withVar.length - 1].fecha),
    };
  })();
  // Puntos y rival por jornada; si en una jornada hay más de un partido, no se pinta.
  const histFor = (jornada: number | null, won?: boolean) => {
    if (jornada == null) return null;
    const arr = yearHist.filter((h) => h.jornada === jornada && !h.esPlayoff);
    if (arr.length !== 1) return null;
    if (won != null && arr[0].gana !== won) return null;
    return arr[0];
  };
  // Parejas de la temporada: TODOS los compañeros, con partidos, balance,
  // sets y los puntos de la federación que sumaron juntos (del histórico).
  const partners = (() => {
    const norm = (x: string) =>
      x.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").replace(/\s+/g, " ").trim();
    const ptsBy = new Map<string, number>();
    for (const h of yearHist) {
      if (!h.pareja || h.puntosVar == null) continue;
      const k = norm(h.pareja);
      ptsBy.set(k, (ptsBy.get(k) ?? 0) + h.puntosVar);
    }
    const map = new Map<
      string,
      { name: string; n: number; w: number; sf: number; sa: number; pts: number | null }
    >();
    for (const m of yd?.matches ?? []) {
      if (!m.partner) continue;
      const e = map.get(m.partner) ?? { name: m.partner, n: 0, w: 0, sf: 0, sa: 0, pts: null };
      e.n += 1;
      if (m.won) e.w += 1;
      const [a, b] = (m.sets ?? "").split("-").map((x) => Number(x));
      if (Number.isFinite(a) && Number.isFinite(b)) {
        e.sf += a;
        e.sa += b;
      }
      map.set(m.partner, e);
    }
    // Las actas dan el nombre corto («ADRIAN RUIZ») y el histórico el completo
    // («ADRIAN RUIZ CAÑARTE»): casan si uno empieza por el otro.
    const same = (x: string, y: string) => x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
    for (const e of map.values()) {
      const k = norm(e.name);
      let total: number | null = null;
      for (const [hk, v] of ptsBy) if (same(hk, k)) total = (total ?? 0) + v;
      e.pts = total;
    }
    return [...map.values()].sort((a, b) => b.n - a.n || b.w - a.w);
  })();
  const noActas = !!yd && yd.matches.length === 0 && !yd.hasData;
  const prevYear = (years.data ?? []).find((y) => selLiga != null && y.idLiga < selLiga) ?? null;

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
          label: isPlayoff
            ? "Playoff"
            : `Jornada ${m.jornada}${histFor(m.jornada)?.equipoRival ? ` · vs ${histFor(m.jornada)!.equipoRival}` : ""}`,
          order: isPlayoff ? 9999 : m.jornada ?? 0,
          games: [],
        });
      }
      map.get(key)!.games.push(m);
    }
    return [...map.values()].sort((a, b) => a.order - b.order);
  })();

  return (
    <div className={root}>
      <PageHeader
        back={back}
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={initials(p.name)} src={p.avatarUrl} size={40} />
            {p.name}
          </span>
        }
        meta={[equipoLabel, categoriaLabel]}
      />

      {/* Ranking FCP */}
      <StatRow style={{ marginBottom: 16 }}>
        <Stat
          label="Puntos de la federación"
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

      {curve && !noActas ? (
        <Card style={{ marginBottom: 16 }}>
          <PointsCurve values={curve.values} points={curve.points} start={curve.start} end={curve.end} />
        </Card>
      ) : null}

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

      {/* Stats del año (sin actas no hay cifras a cero) */}
      {noActas ? null : (
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
      )}

      {partners.length > 0 ? (
        <Card flush style={{ marginBottom: 16 }}>
          <CardHead title="Parejas" count={partners.length}>
            {partners.length > 3 ? (
              <Btn size="sm" variant="quiet" onClick={() => setAllPartners((v) => !v)}>
                {allPartners ? "Menos" : "Todas"}
              </Btn>
            ) : null}
          </CardHead>
          {(allPartners ? partners : partners.slice(0, 3)).map((pp) => {
            const pct = Math.round((pp.w / pp.n) * 100);
            return (
              <div key={pp.name} className="list-row">
                <Avatar initials={initials(pp.name)} size={32} />
                <span className="list-row-main" style={{ gap: 4 }}>
                  <span className="list-row-title truncate">{pp.name}</span>
                  <span className="list-row-sub">
                    {pp.n} {pp.n === 1 ? "partido" : "partidos"} · sets {pp.sf}-{pp.sa}
                    {pp.pts != null
                      ? ` · ${pp.pts > 0 ? "+" : pp.pts < 0 ? "−" : ""}${fmtInt(Math.abs(pp.pts))} pts`
                      : ""}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{
                      display: "block",
                      height: 4,
                      borderRadius: 2,
                      background: "var(--line)",
                      overflow: "hidden",
                      maxWidth: 220,
                    }}
                  >
                    <span style={{ display: "block", height: 4, width: `${pct}%`, background: "var(--accent)" }} />
                  </span>
                </span>
                <span style={{ display: "grid", justifyItems: "end", gap: 2 }}>
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                    {pp.w}-{pp.n - pp.w}
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 12, color: pct >= 50 ? "var(--accent)" : "var(--text-faint)" }}
                  >
                    {pct}%
                  </span>
                </span>
              </div>
            );
          })}
        </Card>
      ) : null}

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
      ) : !yd || noActas ? (
        <Card>
          <EmptyState
            icon={<IconFlag size={22} />}
            title={`Aún no hay actas de ${selYear?.anio ?? "esta temporada"}`}
            body={`La federación las publica después de cada jornada.${prevYear ? " Mientras, mira la temporada pasada." : ""}`}
            action={
              prevYear ? (
                <Btn size="sm" onClick={() => setSelLiga(prevYear.idLiga)}>
                  Ver {prevYear.anio}
                </Btn>
              ) : undefined
            }
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
              {/* Sin contador: un jugador disputa UN partido por jornada, así
                  que el número era un «1» repetido pantalla abajo. */}
              <CardHead title={d.label} />
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
                  {(() => {
                    const pv = d.games.length === 1 ? histFor(m.jornada, m.won)?.puntosVar : null;
                    if (pv == null) return null;
                    return (
                      <span
                        className="mono"
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          minWidth: 40,
                          textAlign: "right",
                          color: pv >= 0 ? "var(--accent)" : "var(--error)",
                        }}
                      >
                        {pv >= 0 ? "+" : "−"}
                        {Math.abs(pv)}
                      </span>
                    );
                  })()}
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

type CurvePoint = { delta: number; won: boolean; label: string; date: string };

/** Curva de puntos de la federación. Cada partido es un punto (verde si ganó,
 *  rojo si perdió); al pasar o tocar se ve ese partido. Debajo, inicio, máximo
 *  y el mejor y el peor partido. Se dibuja en 1,1 s; con «reducir
 *  movimiento», aparece sin más. */
function PointsCurve({
  values,
  points,
  start,
  end,
}: {
  values: number[];
  points: CurvePoint[];
  start: string;
  end: string;
}) {
  const reduce = useReducedMotion();
  const [sel, setSel] = useState<number | null>(null);
  const W = 600;
  const H = 110;
  const padX = 6;
  const padY = 12;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    padX + (i / (values.length - 1)) * (W - padX * 2),
    padY + (1 - (v - min) / span) * (H - padY * 2),
  ]);
  const d = pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt[0].toFixed(1)} ${pt[1].toFixed(1)}`).join(" ");
  const area = `${d} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H} Z`;
  const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmtInt(Math.abs(n))}`;
  const deltas = points.map((p) => p.delta);
  const best = deltas.length ? Math.max(...deltas) : null;
  const worst = deltas.length ? Math.min(...deltas) : null;
  const selected = sel != null ? points[sel - 1] : null;
  const pct = (x: number, total: number) => `${(x / total) * 100}%`;
  const faint = { fontSize: 12, color: "var(--text-faint)" } as const;

  const summary = [
    { k: "Inicio", v: fmtInt(values[0]), color: "var(--text)" },
    { k: "Máximo", v: fmtInt(max), color: "var(--text)" },
    best != null
      ? { k: "Mejor partido", v: signed(best), color: best >= 0 ? "var(--accent)" : "var(--error)" }
      : null,
    worst != null
      ? { k: "Peor partido", v: signed(worst), color: worst < 0 ? "var(--error)" : "var(--text-muted)" }
      : null,
  ].filter((x): x is { k: string; v: string; color: string } => x != null);

  return (
    <div>
      {/* Partido seleccionado */}
      <div style={{ minHeight: 36, marginBottom: 6, display: "flex", alignItems: "center", gap: 10 }}>
        {selected ? (
          <>
            <span
              className="mono"
              style={{ fontSize: 15, fontWeight: 800, color: selected.won ? "var(--accent)" : "var(--error)" }}
            >
              {signed(selected.delta)}
            </span>
            <span style={{ display: "grid", minWidth: 0 }}>
              <span className="truncate" style={{ fontSize: 13.5, fontWeight: 600 }}>
                {selected.won ? "Victoria" : "Derrota"} · {selected.label}
              </span>
              <span className="mono" style={faint}>
                {selected.date} · quedó en {fmtInt(values[sel!])} pts
              </span>
            </span>
          </>
        ) : (
          <span className="mono" style={faint}>
            Pasa o toca un partido para ver el detalle
          </span>
        )}
      </div>

      <div style={{ position: "relative", height: H }} onMouseLeave={() => setSel(null)}>
        {/* La línea se descubre de izquierda a derecha (con el trazo sin
            escalar, pathLength no mide bien en un SVG estirado). */}
        <motion.div
          key={d}
          initial={reduce ? false : { clipPath: "inset(0 100% 0 0)" }}
          animate={{ clipPath: "inset(0 0% 0 0)" }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        >
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ display: "block" }}
        >
          {/* Línea de referencia: los puntos con los que empezó */}
          <line
            x1={padX}
            x2={W - padX}
            y1={pts[0][1]}
            y2={pts[0][1]}
            stroke="var(--text-faint)"
            strokeOpacity={0.4}
            strokeDasharray="3 4"
            vectorEffect="non-scaling-stroke"
          />
          <path d={area} fill="var(--accent)" fillOpacity={0.07} />
          <path
            d={d}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        </motion.div>
        {/* Un punto por partido, en HTML para que no se deforme con el ancho */}
        {pts.slice(1).map(([x, y], i) => {
          const p = points[i];
          if (!p) return null;
          const on = sel === i + 1;
          return (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setSel(i + 1)}
              onFocus={() => setSel(i + 1)}
              onClick={() => setSel((s) => (s === i + 1 ? null : i + 1))}
              aria-label={`${p.won ? "Victoria" : "Derrota"} ${p.label}, ${signed(p.delta)} puntos`}
              style={{
                position: "absolute",
                left: pct(x, W),
                top: pct(y, H),
                width: on ? 12 : 8,
                height: on ? 12 : 8,
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                padding: 0,
                cursor: "pointer",
                background: p.won ? "var(--accent)" : "var(--error)",
                border: on ? "2px solid var(--text)" : "none",
              }}
            />
          );
        })}
        {max !== min ? (
          <>
            <span className="mono" style={{ ...faint, position: "absolute", right: 0, top: -4 }}>
              {fmtInt(max)}
            </span>
            <span className="mono" style={{ ...faint, position: "absolute", right: 0, bottom: -4 }}>
              {fmtInt(min)}
            </span>
          </>
        ) : null}
      </div>
      <div className="mono" style={{ ...faint, display: "flex", justifyContent: "space-between", marginTop: 6 }}>
        <span>{start}</span>
        <span>{end}</span>
      </div>

      {/* Resumen de la temporada */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8, marginTop: 14 }}>
        {summary.map((x) => (
          <div key={x.k}>
            <div className="mono" style={{ fontSize: 15, fontWeight: 800, color: x.color }}>
              {x.v}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{x.k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
