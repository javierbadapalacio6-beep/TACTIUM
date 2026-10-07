"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { type Position } from "@/lib/team-data";
import {
  captainUnclaimPlayer,
  createPlayer,
  deletePlayer,
  fetchPlayers,
  fetchSeasons,
  fetchTeamFcpGroup,
  setSelfAvailability,
  updatePlayer,
  fetchSubscription,
  fetchTeamInscripcion,
  type DbPlayer,
} from "@/lib/queries";
import { fetchLeagueStatsBundle, type LeagueStatsBundle } from "@/lib/player-stats";
import { FcpGroupRivals } from "@/components/federation/FcpGroupRivals";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  importFcpRosterIntoTeam,
  searchFcpClubs,
  type FcpClubGroup,
  type FcpTeamOption,
} from "@/lib/fcp-import";
import {
  Avatar,
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  IconTile,
  Input,
  InputWrap,
  Modal,
  Note,
  PageHeader,
  Progress,
  Segmented,
  Stat,
  StatRow,
  Toggle,
} from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import {
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconFlag,
  IconPlus,
  IconSearch,
  IconSettings,
  IconShare,
  IconUpload,
  IconUserPlus,
  IconUsers,
  IconX,
} from "@/components/Icon";
import { EditTeamModal } from "@/components/team/EditTeamModal";
import { ScanModal } from "@/components/team/ScanModal";
import { bulkUpsertPlayers } from "@/lib/parse-image";
import { PairStats } from "@/components/team/PairStats";
import { ACCOUNT_DOT, PlayerCard } from "@/components/team/PlayerCard";
import { Crest } from "@/components/Crest";
import { InvitePanel } from "@/components/invite/InvitePanel";
import { EASE } from "@/components/entry/motion-bits";
import { proHref } from "@/lib/nav";

type SortKey = "name" | "pts" | "pos";
type Tab = "plantilla" | "parejas";
type Filter = "todos" | "disponibles" | "bajas";

const POSITIONS: Position[] = ["Drive", "Revés", "Ambos"];
/** Liga Cántabra: 5 parejas por encuentro = 10 jugadores. */
const MATCHDAY_PLAYERS = 10;

function initials(n: string) {
  return n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/* La Federación publica todo en MAYÚSCULAS ("C.D. PADEL Y TENIS MEDIO
   CUDEYO"); se pasa a frase normal respetando siglas con punto y partículas. */
const SMALL_WORDS = new Set(["y", "de", "del", "la", "el", "los", "las", "e"]);
function niceName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((w, i) => {
      if (w.includes(".")) return w.toUpperCase();
      if (i > 0 && SMALL_WORDS.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(" ");
}

/** Menú desplegable con su propio cierre (clic fuera y Escape). */
function Dropdown({
  open,
  onClose,
  children,
  align = "right",
  width = 300,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: "left" | "right";
  width?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const id = setTimeout(() => document.addEventListener("mousedown", onDown), 0);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(id);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          initial={reduce ? false : { opacity: 0, y: -6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
          transition={{ duration: 0.18, ease: EASE }}
          className="card"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            [align]: 0,
            zIndex: 30,
            width: `min(${width}px, calc(100vw - 32px))`,
            padding: 6,
            boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function MenuItem({
  icon,
  title,
  sub,
  pro,
  onClick,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  pro?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const inner = (
    <>
      <IconTile small>{icon}</IconTile>
      <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
        <span style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--text)" }}>{title}</span>
        <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{sub}</span>
      </span>
      {pro && (
        <Chip tone="accent" plain>
          Pro
        </Chip>
      )}
    </>
  );
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "9px 10px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    cursor: "pointer",
    textDecoration: "none",
    fontFamily: "var(--font-ui)",
  };
  return href ? (
    <a role="menuitem" href={href} style={style} className="tw-menu-item">
      {inner}
    </a>
  ) : (
    <button role="menuitem" type="button" onClick={onClick} style={style} className="tw-menu-item">
      {inner}
    </button>
  );
}

/**
 * /equipo (capitán y jugador). Rediseño 2026-10, a la par que la app:
 *  · «Invitar» y «Plantilla ▾» con nombre; el resto de acciones va dentro.
 *  · Cifras iguales que en la app: jugadores, en TACTIUM y media.
 *  · La fila abre la FICHA del jugador, no el formulario.
 *  · El JUGADOR ve la pestaña en solo lectura, con su fila «Tú» arriba y el
 *    interruptor de baja (antes veía los botones del capitán).
 *  · «Parejas» es una pestaña aquí dentro (/stats se queda).
 *  · La inscripción pasa a la sección «Federación».
 */
export function Roster() {
  const { activeTeam, role, user, teams: myTeams } = useSession();
  const reduce = useReducedMotion();
  const teamId = activeTeam?.id ?? null;
  // El jugador (o el capitán que entra en modo jugador) no gestiona. Decisión
  // 1: sin «Invitar» para el jugador, la RLS de `team_invitations` solo deja
  // leer el código al admin del equipo.
  const canManage =
    (activeTeam?.role === "captain" || activeTeam?.role === "admin") && role !== "jugador";

  // Inscripción a la temporada que viene (null fuera del periodo). Con los
  // demás equipos del mismo club que ve el usuario: el cruce por jugadores
  // necesita a los hermanos delante para no quedarse con la fila de otro.
  const hermanos = useMemo(
    () =>
      activeTeam?.clubId
        ? myTeams
            .filter((t) => t.clubId === activeTeam.clubId)
            .map((t) => ({ id: t.id, name: t.name, gender: t.gender, category: t.category }))
        : [],
    [myTeams, activeTeam?.clubId]
  );
  const hermanosKey = hermanos.map((t) => `${t.id}|${t.name}|${t.gender}|${t.category}`).join(",");
  const inscripcion = useAsync(
    () =>
      fetchTeamInscripcion(
        {
          id: activeTeam!.id,
          name: activeTeam!.name,
          gender: activeTeam!.gender,
          category: activeTeam!.category,
        },
        hermanos
      ),
    [activeTeam?.id, activeTeam?.name, activeTeam?.gender, activeTeam?.category, hermanosKey],
    !!activeTeam?.name
  );
  const fcpGroup = useAsync(
    () => fetchTeamFcpGroup(teamId!).catch(() => null),
    [teamId],
    !!teamId
  );
  const grupoHref = fcpGroup.data
    ? `/federacion/${fcpGroup.data.fed}/grupo/${encodeURIComponent(fcpGroup.data.idGrupo)}`
    : null;

  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsync(
    () => fetchPlayers(teamId!),
    [teamId, reloadKey],
    !!teamId
  );
  const PLAYERS: DbPlayer[] = data ?? [];

  // Capitanes del equipo (para «CAP» y «capitán: …»). Lectura bajo RLS.
  const captains = useAsync(
    async () => {
      const { data: rows } = await supabaseBrowser()
        .from("team_members")
        .select("user_id, role")
        .eq("team_id", teamId!)
        .in("role", ["captain", "admin"]);
      return new Set(((rows ?? []) as { user_id: string }[]).map((r) => r.user_id));
    },
    [teamId],
    !!teamId
  );
  const captainIds = captains.data ?? new Set<string>();

  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("pts");
  const [asc, setAsc] = useState(false);
  const [tab, setTab] = useState<Tab>("plantilla");
  const [filter, setFilter] = useState<Filter>("todos");
  const [editing, setEditing] = useState<DbPlayer | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [editTeamOpen, setEditTeamOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [noticeHidden, setNoticeHidden] = useState(false);

  // Ficha: el bundle de liga de todas las temporadas, una vez por equipo.
  const [bundle, setBundle] = useState<LeagueStatsBundle | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const bundleFor = useRef<string | null>(null);
  useEffect(() => {
    setBundle(null);
    bundleFor.current = null;
  }, [teamId]);
  function openCard(p: DbPlayer) {
    setCardId(p.id);
    if (!teamId || bundleFor.current === teamId) return;
    bundleFor.current = teamId;
    setBundleLoading(true);
    fetchSeasons(teamId)
      .then((ss) => fetchLeagueStatsBundle(ss.map((s) => s.id)))
      .then(setBundle)
      .catch(() => {
        bundleFor.current = null;
      })
      .finally(() => setBundleLoading(false));
  }

  // Importar de la Federación al equipo QUE YA EXISTE.
  const [fcpOpen, setFcpOpen] = useState(false);
  const [fcpQuery, setFcpQuery] = useState("");
  const [fcpResults, setFcpResults] = useState<FcpClubGroup[]>([]);
  const [fcpLoading, setFcpLoading] = useState(false);
  const [fcpBusy, setFcpBusy] = useState(false);
  const [fcpErr, setFcpErr] = useState<string | null>(null);

  // El volcado masivo es premium en las cinco superficies.
  const sub = useAsync(
    () => fetchSubscription(),
    [fcpOpen, menuOpen, scanOpen],
    fcpOpen || menuOpen || scanOpen,
  );

  useEffect(() => {
    if (!fcpOpen || fcpQuery.trim().length < 2) {
      setFcpResults([]);
      return;
    }
    let alive = true;
    setFcpLoading(true);
    const id = setTimeout(() => {
      searchFcpClubs(fcpQuery)
        .then((r) => alive && setFcpResults(r))
        .catch(() => alive && setFcpResults([]))
        .finally(() => alive && setFcpLoading(false));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [fcpOpen, fcpQuery]);

  async function importarPlantilla(t: FcpTeamOption) {
    if (!teamId || fcpBusy) return;
    setFcpBusy(true);
    setFcpErr(null);
    const res = await guardedWrite("importar de la Federación", () =>
      importFcpRosterIntoTeam(teamId, t),
    );
    setFcpBusy(false);
    if (!res.ok) {
      setFcpErr(res.reason);
      return;
    }
    setFcpOpen(false);
    setFcpQuery("");
    setReloadKey((k) => k + 1);
    setToast(
      res.data > 0
        ? `${res.data} ${res.data === 1 ? "jugador añadido" : "jugadores añadidos"} desde la Federación`
        : "Ya tenías a toda la plantilla de la Federación",
    );
  }
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Alta o edición de un jugador (el modal usa id="new" para el alta).
  async function savePlayer() {
    if (!editing || !teamId || busy) return;
    if (!editing.name.trim()) {
      setToast("Ponle un nombre al jugador.");
      return;
    }
    setBusy(true);
    const isNew = editing.id === "new";
    const res = await guardedWrite(
      isNew ? "añadir el jugador" : "guardar el jugador",
      () =>
        isNew
          ? createPlayer(teamId, {
              name: editing.name.trim(),
              pts: editing.pts,
              position: editing.position,
            })
          : updatePlayer(editing.id, {
              name: editing.name.trim(),
              pts: editing.pts,
              position: editing.position,
              active: editing.active,
              alias: editing.alias,
            }),
    );
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      setReloadKey((k) => k + 1);
      setToast(isNew ? "Jugador añadido" : "Jugador guardado");
    } else {
      setToast(res.reason);
    }
  }

  /** Suelta la ficha de la cuenta a la que está vinculada. */
  async function unlinkAccount() {
    if (busy || !editing || editing.id === "new" || !editing.userId) return;
    setBusy(true);
    const res = await guardedWrite("desvincular al jugador", () =>
      captainUnclaimPlayer(editing.id),
    );
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      setReloadKey((k) => k + 1);
      setToast("Jugador desvinculado de su cuenta");
    } else setToast(res.reason);
  }

  async function removePlayer(target: DbPlayer | null = editing) {
    if (!target || target.id === "new" || busy) return;
    if (!window.confirm(`Vas a quitar a «${target.name}» de la plantilla. No se puede deshacer.`)) return;
    setBusy(true);
    const res = await guardedWrite("eliminar el jugador", () => deletePlayer(target.id));
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      setCardId(null);
      setReloadKey((k) => k + 1);
      setToast("Jugador eliminado");
    } else {
      setToast(res.reason);
    }
  }

  /** «Disponible / De baja»: el capitán con updatePlayer; el jugador, la suya
   *  con la RPC `set_player_self_availability` (la misma que usa la app). */
  async function setAvailable(p: DbPlayer, v: boolean, self: boolean) {
    const res = await guardedWrite("guardar la disponibilidad", async () => {
      if (self) await setSelfAvailability(p.id, v);
      else {
        const { error: e } = await supabaseBrowser()
          .from("players")
          .update({ available: v })
          .eq("id", p.id);
        if (e) throw e;
      }
    });
    if (res.ok) setReloadKey((k) => k + 1);
    else setToast(res.reason);
  }

  const me = user ? PLAYERS.find((p) => p.userId === user.id) ?? null : null;
  const myPlayerId = me?.id ?? null;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = PLAYERS.filter((p) => {
      if (!canManage && me && p.id === me.id) return false;
      if (filter === "disponibles" && (p.available === false || !p.active)) return false;
      if (filter === "bajas" && p.available !== false && p.active) return false;
      return !q || (p.name + " " + (p.alias ?? "")).toLowerCase().includes(q);
    });
    const dir = asc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort === "pts") return (a.pts - b.pts) * dir;
      if (sort === "name") return a.name.localeCompare(b.name) * dir;
      return a.position.localeCompare(b.position) * dir;
    });
  }, [PLAYERS, query, sort, asc, filter, canManage, me]);

  const avg = PLAYERS.length
    ? Math.round(PLAYERS.reduce((s, p) => s + p.pts, 0) / PLAYERS.length)
    : 0;
  const linked = PLAYERS.filter((p) => !!p.userId).length;
  const availableCount = PLAYERS.filter((p) => p.available !== false && p.active).length;
  const bajasCount = PLAYERS.length - availableCount;

  function toggleSort(k: SortKey) {
    if (sort === k) setAsc((v) => !v);
    else {
      setSort(k);
      setAsc(k === "name");
    }
  }

  const newPlayer = () =>
    setEditing({
      id: "new",
      name: "",
      alias: null,
      pts: 0,
      position: "Ambos",
      active: true,
      available: null,
      userId: null,
      photoUrl: null,
    });

  const isPro = !!sub.data;
  const card = cardId ? PLAYERS.find((p) => p.id === cardId) ?? null : null;
  const insc = inscripcion.data;
  const showNotice = !!insc && !insc.confirmado && !noticeHidden;
  const captainName = (() => {
    const cap = PLAYERS.find((p) => p.userId && captainIds.has(p.userId));
    return cap ? cap.alias?.trim() || cap.name : null;
  })();

  return (
    <div className="tw-page">
      <PageHeader
        // Un solo selector de equipo: el de la barra superior, que está en
        // todas las pantallas. Aquí el título ya no despliega otra lista.
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <Crest src={activeTeam?.logoUrl} size={40} />
            {activeTeam?.name ?? "Equipo"}
          </span>
        }
        meta={[
          [activeTeam?.category, activeTeam?.gender].filter(Boolean).join(" · ") || null,
          !canManage && captainName ? `capitán: ${captainName}` : null,
        ]}
        actions={
          teamId && canManage ? (
            <>
              <Btn variant="accent" onClick={() => setInviteOpen(true)} icon={<IconUserPlus size={15} />}>
                Invitar
              </Btn>
              <span style={{ position: "relative" }}>
                <Btn
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  icon={<IconChevronDown size={15} />}
                >
                  Plantilla
                </Btn>
                <Dropdown open={menuOpen} onClose={() => setMenuOpen(false)}>
                  <div style={{ padding: "6px 10px", fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>
                    Plantilla
                  </div>
                  <MenuItem
                    icon={<IconFlag size={14} />}
                    title="Traer de la Federación"
                    sub="Jugadores y puntos oficiales"
                    pro={!isPro}
                    onClick={() => {
                      setMenuOpen(false);
                      setFcpOpen(true);
                    }}
                  />
                  <MenuItem
                    icon={<IconUpload size={14} />}
                    title="Escanear el ranking"
                    sub="Una foto de la lista de puntos"
                    pro={!isPro}
                    onClick={() => {
                      setMenuOpen(false);
                      setScanOpen(true);
                    }}
                  />
                  <MenuItem
                    icon={<IconPlus size={14} />}
                    title="Añadir a mano"
                    sub="Nombre, posición y puntos"
                    onClick={() => {
                      setMenuOpen(false);
                      newPlayer();
                    }}
                  />
                  <div style={{ padding: "8px 10px 6px", fontSize: 12, fontWeight: 600, color: "var(--text-faint)" }}>
                    Equipo
                  </div>
                  <MenuItem
                    icon={<IconSettings size={14} />}
                    title="Editar el equipo"
                    sub="Escudo, categoría y grupo"
                    onClick={() => {
                      setMenuOpen(false);
                      setEditTeamOpen(true);
                    }}
                  />
                  <MenuItem
                    icon={<IconCalendar size={14} />}
                    title="Mi grupo en la Federación"
                    sub="Jornadas y clasificación"
                    href={grupoHref ?? "/federacion"}
                  />
                </Dropdown>
              </span>
            </>
          ) : undefined
        }
      />

      {/* Cifras: las mismas que en la app */}
      <StatRow compact style={{ marginBottom: 16 }}>
        <Stat label="Jugadores" value={PLAYERS.length} icon={<IconUsers size={14} />} />
        <Stat label="En TACTIUM" value={linked} unit={`/ ${PLAYERS.length}`} tone="accent" />
        <Stat label="Media de puntos" value={avg} />
      </StatRow>

      {showNotice && (
        <Note tone="accent" style={{ marginBottom: 16, alignItems: "center" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>Inscripción {insc!.temporada}</strong>
              <span style={{ color: "var(--text-muted)" }}>: la Federación aún no la ha confirmado.</span>
            </span>
            <a href="#federacion" className="link-action" style={{ fontSize: 13 }}>
              Revisar
            </a>
            <button
              type="button"
              onClick={() => setNoticeHidden(true)}
              aria-label="Cerrar aviso"
              className="btn btn-icon"
              style={{ width: 28, minHeight: 28 }}
            >
              <IconX size={13} />
            </button>
          </span>
        </Note>
      )}

      {/* ── Federación: inscripción y grupo en un sitio ─────────── */}
      {(insc || grupoHref) && (
        <section id="federacion" style={{ marginBottom: 16 }}>
          <Card flush>
            <CardHead title="Federación" sub={`${activeTeam?.name ?? "Tu equipo"} en la Liga Cántabra`}>
              {insc && (
                <Chip tone={insc.confirmado ? "accent" : "warning"}>
                  {insc.confirmado ? "Inscripción confirmada" : "Sin confirmar"}
                </Chip>
              )}
            </CardHead>
            {grupoHref && (
              <a href={grupoHref} className="list-row">
                <IconTile small>
                  <IconCalendar size={14} />
                </IconTile>
                <span className="list-row-main">
                  <span className="list-row-title">Clasificación y jornadas</span>
                  <span className="list-row-sub">Tu grupo en la Federación</span>
                </span>
                <span className="list-row-chev">
                  <IconChevronRight size={16} />
                </span>
              </a>
            )}
            {insc && (
              <div style={{ padding: "12px 16px 14px" }}>
                {/* Lo que de verdad quiere saber el equipo, en una frase:
                    dónde juega y contra quién. El grupo y la sede corta salen
                    del PDF de distribución de la Federación. */}
                {insc.categoria && (
                  <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 700 }}>
                    Jugarás en {insc.categoria}
                    {insc.subgrupo ? `, grupo ${insc.subgrupo}` : ""}.
                    {(insc.sedeCorta || insc.sede) &&
                      ` Sede: ${insc.sedeCorta ?? niceName(insc.sede!)}.`}
                  </p>
                )}
                <p style={{ margin: "0 0 12px", fontSize: 13, color: "var(--text-muted)" }}>
                  Inscripción {insc.temporada}.{" "}
                  {insc.confirmado
                    ? "La Federación te tiene inscrito y confirmado."
                    : "Estás apuntado, pero la Federación todavía no lo ha confirmado."}{" "}
                  Cuando publique el calendario podrás volcar la temporada con sus jornadas.
                </p>
                {/* La FCP reasigna letras entre temporadas: si te inscribe con
                    otro nombre, que no parezca que esto es de otro equipo. */}
                {insc.estado === "renombrado" && (
                  <Note style={{ marginBottom: 12 }}>
                    En la Federación se llama <strong>{insc.equipo}</strong>.
                  </Note>
                )}
                <dl className="tw-insc-facts">
                  <div className="tw-insc-fact">
                    <dt>Categoría</dt>
                    <dd>
                      {insc.categoria ?? "—"}
                      {insc.subgrupo ? ` · Grupo ${insc.subgrupo}` : ""}
                      <small>{insc.estadoLabel}</small>
                    </dd>
                  </div>
                  <div className="tw-insc-fact">
                    <dt>Sede de local</dt>
                    <dd>
                      {insc.sedeCorta ?? (insc.sede ? niceName(insc.sede) : "Sin asignar")}
                      {insc.sedeCorta && insc.sede && <small>{niceName(insc.sede)}</small>}
                    </dd>
                  </div>
                  <div className="tw-insc-fact">
                    <dt>Plantilla inscrita</dt>
                    <dd>
                      {insc.roster.length}
                      <small>Según la Federación</small>
                    </dd>
                  </div>
                </dl>
                {insc.roster.length > 0 ? (
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-muted)" }}>
                      Ver la plantilla inscrita
                    </summary>
                    <div className="tw-insc-roster">
                      {insc.roster.map((j, i) => (
                        <div key={j.idJugador} className="tw-insc-roster-row">
                          <span className="pos">{i + 1}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <Avatar initials={initials(j.name)} src={j.avatarUrl} size={24} />
                            <span className="truncate">{niceName(j.name)}</span>
                          </span>
                          <span className="pts">{j.puntos}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : (
                  <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-faint)" }}>
                    La Federación todavía no publica jugadores en tu equipo.
                  </p>
                )}
                {insc.rivales.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                      Tu grupo
                      <span style={{ marginLeft: 6, fontWeight: 500, color: "var(--text-muted)" }}>
                        Grupo {insc.subgrupo} · {insc.rivales.length} rivales
                      </span>
                    </div>
                    <FcpGroupRivals rivales={insc.rivales} />
                  </div>
                )}
              </div>
            )}
          </Card>
        </section>
      )}

      {/* Tú (jugador): tu baja larga a un toque */}
      {!canManage && me && (
        <motion.div
          animate={{ opacity: me.available === false ? 0.6 : 1 }}
          transition={{ duration: reduce ? 0 : 0.22 }}
          style={{ marginBottom: 16 }}
        >
          <Card style={{ borderColor: "var(--accent-40)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>Tú</span>
              <button
                type="button"
                onClick={() => openCard(me)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                  minWidth: 180,
                  border: "none",
                  background: "transparent",
                  color: "inherit",
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font-ui)",
                }}
              >
                <Avatar initials={initials(me.name)} src={me.photoUrl} size={36} />
                <span style={{ minWidth: 0 }}>
                  <span className="truncate" style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                    {me.alias?.trim() || me.name}
                  </span>
                  <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>
                    {me.position} · {me.pts} pts
                  </span>
                </span>
              </button>
              <span style={{ fontSize: 13, fontWeight: 700, color: me.available === false ? "var(--warning)" : "var(--accent)" }}>
                {me.available === false ? "De baja" : "Disponible"}
              </span>
              <Toggle
                on={me.available !== false}
                onChange={() => void setAvailable(me, me.available === false, true)}
                label="Estoy disponible"
              />
            </div>
            <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-faint)" }}>
              Es la baja larga (lesión, una temporada fuera). Para cada jornada sigue el Voy / Duda / No.
            </p>
          </Card>
        </motion.div>
      )}

      {PLAYERS.length > 0 && (
        <div className="tw-toolbar">
          <Segmented<Tab>
            label="Vista"
            value={tab}
            onChange={setTab}
            options={[
              { value: "plantilla", label: `Plantilla · ${PLAYERS.length}` },
              { value: "parejas", label: "Parejas" },
            ]}
          />
          {tab === "plantilla" && (
            <>
              <InputWrap icon={<IconSearch size={15} />}>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar jugador"
                  aria-label="Buscar jugador"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    aria-label="Limpiar búsqueda"
                    className="btn btn-icon"
                    style={{ width: 24, minHeight: 24, fontSize: 15, lineHeight: 1 }}
                  >
                    ×
                  </button>
                )}
              </InputWrap>
              <span className="tw-toolbar-spacer" />
              <Segmented<Filter>
                label="Filtro"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "todos", label: "Todos" },
                  { value: "disponibles", label: `Disponibles · ${availableCount}` },
                  { value: "bajas", label: `Bajas · ${bajasCount}` },
                ]}
              />
            </>
          )}
        </div>
      )}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.18, ease: EASE }}
        >
          {tab === "parejas" ? (
            <PairStats embedded myPlayerId={myPlayerId} />
          ) : !teamId ? (
            <Card>
              <EmptyState
                icon={<IconUsers size={24} />}
                title="Sin equipo activo"
                body="Entra con una cuenta que pertenezca a un equipo."
              />
            </Card>
          ) : loading ? (
            <SkeletonCard />
          ) : error ? (
            <Card>
              <EmptyState icon={<IconUsers size={24} />} title="No se pudo cargar la plantilla" body={error} />
            </Card>
          ) : PLAYERS.length === 0 ? (
            <Card>
              <div style={{ maxWidth: 520 }}>
                <div className="eyebrow eyebrow-accent">Plantilla vacía</div>
                <h2 style={{ fontSize: 19, margin: "6px 0 0" }}>
                  {canManage
                    ? `Para jugar una jornada hacen falta ${MATCHDAY_PLAYERS}`
                    : "Tu capitán todavía no ha añadido jugadores"}
                </h2>
                {canManage && (
                  <>
                    <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
                      Una jornada de la Liga Cántabra son 5 parejas. Trae la plantilla de la
                      Federación o manda el enlace al grupo.
                    </p>
                    <Progress value={0} style={{ marginTop: 16 }} />
                    <div className="mono" style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 6 }}>
                      0 de {MATCHDAY_PLAYERS}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
                      <Btn variant="accent" icon={<IconFlag size={15} />} onClick={() => setFcpOpen(true)}>
                        Traer de la Federación
                      </Btn>
                      <Btn icon={<IconShare size={15} />} onClick={() => setInviteOpen(true)}>
                        Enviar el enlace
                      </Btn>
                      <Btn variant="quiet" onClick={newPlayer}>
                        o añádelos a mano
                      </Btn>
                    </div>
                  </>
                )}
              </div>
            </Card>
          ) : (
            <>
              {canManage && PLAYERS.length < MATCHDAY_PLAYERS && (
                <Card style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>
                        Faltan {MATCHDAY_PLAYERS - PLAYERS.length} para una jornada
                      </div>
                      <Progress value={(PLAYERS.length / MATCHDAY_PLAYERS) * 100} style={{ marginTop: 8 }} />
                    </div>
                    <Btn size="sm" icon={<IconShare size={14} />} onClick={() => setInviteOpen(true)}>
                      Enviar el enlace
                    </Btn>
                  </div>
                </Card>
              )}
              {rows.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={<IconUsers size={24} />}
                    title="Sin coincidencias"
                    body="Prueba con otro nombre, alias o filtro."
                  />
                </Card>
              ) : (
                <Card flush>
                  <CardHead title="Plantilla" count={rows.length} />
                  <div className="tw-roster-scroll">
                    <div className="tw-roster-head">
                      {(
                        [
                          ["name", "Nombre"],
                          ["pos", "Posición"],
                          ["pts", "Puntos de la federación"],
                        ] as const
                      ).map(([k, label]) => (
                        <button
                          key={k}
                          type="button"
                          onClick={() => toggleSort(k)}
                          aria-sort={sort === k ? (asc ? "ascending" : "descending") : "none"}
                          className="tw-sort-btn"
                          style={{ color: sort === k ? "var(--accent)" : undefined }}
                        >
                          {label}
                          {sort === k && <span>{asc ? " ↑" : " ↓"}</span>}
                        </button>
                      ))}
                      <span>Disponibilidad</span>
                      <span />
                    </div>

                    {rows.map((p, i) => {
                      const isCap = !!p.userId && captainIds.has(p.userId);
                      return (
                        <motion.div
                          key={p.id}
                          className="tw-roster-row"
                          role="button"
                          tabIndex={0}
                          onClick={() => openCard(p)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openCard(p);
                            }
                          }}
                          initial={reduce ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, ease: EASE, delay: Math.min(i, 12) * 0.03 }}
                          style={{ cursor: "pointer" }}
                          aria-label={`Ficha de ${p.name}`}
                        >
                          <span style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
                            <span style={{ position: "relative", display: "inline-flex" }}>
                              <Avatar initials={initials(p.name)} src={p.photoUrl} size={30} />
                              {p.userId && <span aria-hidden="true" style={ACCOUNT_DOT} />}
                            </span>
                            <span style={{ minWidth: 0 }}>
                              <span
                                className="truncate"
                                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 700 }}
                              >
                                {p.name}
                                {isCap && (
                                  <Chip tone="accent" plain>
                                    Capitán
                                  </Chip>
                                )}
                              </span>
                              {(p.alias || (!p.userId && canManage)) && (
                                <span
                                  className="truncate"
                                  style={{ display: "block", marginTop: 2, fontSize: 12, color: "var(--text-faint)" }}
                                >
                                  {[p.alias, !p.userId && canManage ? "sin cuenta" : null].filter(Boolean).join(" · ")}
                                </span>
                              )}
                            </span>
                          </span>

                          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{p.position}</span>

                          <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                            {p.pts}
                          </span>

                          <span>
                            {!p.active || p.available === false ? (
                              <Chip tone="warning">De baja</Chip>
                            ) : (
                              <Chip>Disponible</Chip>
                            )}
                          </span>

                          <span style={{ display: "flex", justifyContent: "flex-end" }}>
                            {canManage && !p.userId ? (
                              <Btn
                                size="sm"
                                variant="tint"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInviteOpen(true);
                                }}
                                aria-label={`Invitar a ${p.name}`}
                              >
                                Invitar
                              </Btn>
                            ) : (
                              <IconChevronRight size={15} style={{ color: "var(--text-faint)" }} />
                            )}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </Card>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>

      {card && (
        <PlayerCard
          player={card}
          teamName={activeTeam?.name ?? "Equipo"}
          canManage={canManage}
          isCaptainRow={!!card.userId && captainIds.has(card.userId)}
          myPlayerId={myPlayerId}
          bundle={bundle}
          loading={bundleLoading}
          onClose={() => setCardId(null)}
          onEdit={() => {
            setCardId(null);
            setEditing(card);
          }}
          // Sin gestión solo sale el interruptor de la propia ficha: va por
          // la RPC del jugador.
          onToggleAvailable={(v) => void setAvailable(card, v, !canManage)}
          onRemove={() => void removePlayer(card)}
          profileHref={card.userId ? `/u/${card.userId}` : null}
        />
      )}

      {/* ── Editar jugador ───────────────────────────────────────── */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        labelledBy="edit-jugador"
        width={520}
        title={editing?.id === "new" ? "Añadir jugador" : "Editar jugador"}
        footer={
          editing ? (
            <>
              {editing.id !== "new" && (
                <Btn
                  variant="danger-ghost"
                  disabled={busy}
                  onClick={() => void removePlayer()}
                  style={{ marginRight: "auto" }}
                >
                  Eliminar
                </Btn>
              )}
              {editing.id !== "new" && editing.userId && (
                <Btn variant="quiet" disabled={busy} onClick={() => void unlinkAccount()}>
                  Desvincular cuenta
                </Btn>
              )}
              <Btn onClick={() => setEditing(null)}>Cancelar</Btn>
              <Btn variant="accent" disabled={busy} onClick={savePlayer}>
                {busy ? "Guardando…" : "Guardar"}
              </Btn>
            </>
          ) : null
        }
      >
        {editing && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="Nombre" htmlFor="jugador-nombre">
              <Input
                id="jugador-nombre"
                type="text"
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="Nombre y apellidos"
              />
            </Field>
            <Field label="Alias" hint="Opcional: cómo le llaman en el equipo" htmlFor="jugador-alias">
              <Input
                id="jugador-alias"
                type="text"
                value={editing.alias ?? ""}
                onChange={(e) => setEditing({ ...editing, alias: e.target.value })}
                placeholder="Cómo le llaman en el equipo"
              />
            </Field>

            <Field label="Posición">
              <Segmented
                label="Posición"
                value={editing.position}
                onChange={(o) => setEditing({ ...editing, position: o })}
                options={POSITIONS.map((o) => ({ value: o, label: o }))}
                style={{ alignSelf: "flex-start" }}
              />
            </Field>

            <Field label="Puntos de la federación" htmlFor="jugador-pts">
              <Input
                id="jugador-pts"
                type="text"
                inputMode="numeric"
                className="mono"
                value={editing.pts || ""}
                onChange={(e) =>
                  setEditing({
                    ...editing,
                    pts: parseInt(e.target.value.replace(/\D/g, ""), 10) || 0,
                  })
                }
              />
            </Field>

            {editing.id !== "new" && !editing.userId && (
              <Note tone="accent">
                Todavía no está en TACTIUM. Mándale el enlace y su ficha queda unida a su
                cuenta.{" "}
                <button
                  type="button"
                  className="link-action"
                  onClick={() => {
                    setEditing(null);
                    setInviteOpen(true);
                  }}
                  style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
                >
                  Invitar
                </button>
              </Note>
            )}

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: 14,
                borderRadius: 10,
                background: "var(--bg-card-2)",
                border: "1px solid var(--line)",
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                  Marcar como baja
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 3,
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                  }}
                >
                  No aparecerá en el banquillo de la alineación
                </span>
              </span>
              <Toggle
                on={!editing.active}
                onChange={() => setEditing({ ...editing, active: !editing.active })}
                label="Marcar como baja"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ── Invitación ───────────────────────────────────────────── */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        labelledBy="invitar"
        width={460}
        title={`Invitar a ${activeTeam?.name ?? "tu equipo"}`}
        lede="Comparte el enlace: se unen desde la app o desde la web, gratis."
        footer={<Btn onClick={() => setInviteOpen(false)}>Listo</Btn>}
      >
        {teamId && (
          <InvitePanel
            teamId={teamId}
            teamName={activeTeam?.name ?? "tu equipo"}
            players={data ?? null}
            onToast={setToast}
          />
        )}
      </Modal>

      {/* ── Importar de la Federación ────────────────────────────── */}
      {fcpOpen && (
        <Modal
          open
          onClose={() => setFcpOpen(false)}
          labelledBy="tw-fcp-roster"
          width={560}
          title="Importar de la Federación"
          lede="Busca tu club, elige tu equipo y traemos su plantilla con los puntos oficiales."
        >
          {sub.loading ? (
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Comprobando tu plan…</p>
          ) : !sub.data ? (
            /* Mismo criterio que el importador del club y que la app: el
               volcado masivo es la acción de más valor y va tras el plan. */
            <>
              <Note tone="accent">
                Traer la plantilla entera con sus puntos oficiales es una función
                premium. Con suscripción es un clic; sin ella puedes añadir
                jugadores a mano.
              </Note>
              <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
                <BtnLink href={proHref("roster_import")} variant="accent">
                  Ver planes
                </BtnLink>
              </div>
            </>
          ) : (
            <>
              <Input
                type="text"
                placeholder="Busca tu club"
                value={fcpQuery}
                onChange={(e) => setFcpQuery(e.target.value)}
                autoFocus
              />
              {fcpErr && (
                <Note tone="error" style={{ marginTop: 10 }}>
                  {fcpErr}
                </Note>
              )}
              <p style={{ margin: "10px 0 0", fontSize: 12.5, color: "var(--text-faint)" }}>
                Se añaden los que falten: si repites la importación no se duplica
                nadie.
              </p>
              <div style={{ marginTop: 12, maxHeight: 380, overflowY: "auto" }}>
                {fcpLoading && (
                  <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Buscando…</p>
                )}
                {!fcpLoading && fcpQuery.trim().length >= 2 && fcpResults.length === 0 && (
                  <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
                    Sin resultados para «{fcpQuery.trim()}».
                  </p>
                )}
                {fcpResults.map((club) => (
                  <div key={club.club} style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{club.club}</div>
                    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                      {club.teams.map((t) => (
                        <button
                          key={t.id_equipo}
                          type="button"
                          disabled={fcpBusy}
                          onClick={() => void importarPlantilla(t)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "10px 12px",
                            borderRadius: "var(--r-md)",
                            border: "1px solid var(--line)",
                            background: "var(--bg-card-2)",
                            color: "var(--text)",
                            cursor: fcpBusy ? "default" : "pointer",
                            opacity: fcpBusy ? 0.6 : 1,
                            textAlign: "left",
                            fontFamily: "var(--font-ui)",
                          }}
                        >
                          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>
                            {t.equipo}
                          </span>
                          <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                            {[t.category, t.gender].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Escanear ranking (parse-image, como la app) */}
      <ScanModal
        mode="ranking"
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        checking={sub.loading && !sub.data}
        locked={!sub.data}
        lockedIntent="roster_import"
        onConfirm={async (items) => {
          if (!teamId) return "No hay equipo activo.";
          const res = await guardedWrite("importar los jugadores escaneados", () =>
            bulkUpsertPlayers(teamId, items, PLAYERS),
          );
          if (!res.ok) return res.reason;
          setReloadKey((k) => k + 1);
          const { added, updated } = res.data;
          setToast(
            added && updated
              ? `Plantilla actualizada: ${added} ${added === 1 ? "nuevo" : "nuevos"} y ${updated} con los puntos al día`
              : updated
                ? `Puntos actualizados de ${updated} ${updated === 1 ? "jugador" : "jugadores"}`
                : `${added} ${added === 1 ? "jugador añadido" : "jugadores añadidos"}`,
          );
          return null;
        }}
      />

      {teamId && (
        <EditTeamModal
          open={editTeamOpen}
          onClose={() => setEditTeamOpen(false)}
          teamId={teamId}
          teamName={activeTeam?.name ?? "Equipo"}
          initialCategory={activeTeam?.category ?? null}
          isClubTeam={!!activeTeam?.clubId}
          onDeleted={() => {
            // Recarga completa: la sesión cachea equipos y el que acabamos de
            // borrar seguiría apareciendo en el selector.
            window.location.href = "/";
          }}
        />
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
