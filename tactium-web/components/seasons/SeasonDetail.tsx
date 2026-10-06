"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import {
  createMatchday,
  fetchMatchdays,
  fetchSubscription,
  renumberSeasonMatchdays,
  fetchSeasons,
  type DbMatchday,
  type DbSeason,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { useDismiss } from "@/lib/use-dismiss";
import { guardedWrite } from "@/lib/writes";
import {
  Btn,
  Card,
  CardHead,
  Chip,
  Field,
  Input,
  Modal,
  Note,
  PageHeader,
  Segmented,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonCard, SkeletonPage, Toast } from "@/components/states";
import { EASE } from "@/components/entry/motion-bits";
import { ScanModal } from "@/components/team/ScanModal";
import type { ScannedMatchday } from "@/lib/parse-image";
import { IconCalendar, IconChevronRight, IconInfo, IconLock, IconPlus } from "@/components/Icon";
import { FcpBracketPanel, FcpStandingsTable } from "@/components/federation/Federation";
import {
  fetchTeamPlayoffGroup,
  fetchTeamStanding,
  shortGroupName,
} from "@/components/federation/fed-data";
import {
  closeSeason,
  fetchSeasonEndDate,
  fmtDay,
  importFcpSeason,
  isUpcoming,
  outcomeVar,
  pickNext,
  playedChrono,
  scoreText,
} from "./season-data";

/** Etiqueta de formato a partir de la fase que guarda la base de datos. */
const PHASE_FORMAT: Record<DbSeason["phase"], string> = {
  liga: "Liga regular",
  playoff: "Eliminatorias",
  mixto: "Liga + Playoff",
};

type Tab = "jornadas" | "clasif" | "cuadro";

/**
 * Detalle de temporada, a la par con la app: abre en Jornadas (agrupadas en
 * Próxima · Jugadas · Pendientes, con el marcador en color), Clasificación con
 * la tabla de la Federación y Cuadro con el cuadro real del playoff. Las
 * acciones son solo del capitán: «Añadir» y «···» (renumerar, cerrar).
 */
export function SeasonDetail({ id }: { id: string }) {
  const { user, activeTeam, role } = useSession();
  const teamId = activeTeam?.id ?? null;
  // Solo el capitán (o el club) gestiona; el jugador consulta.
  const canManage = role === "capitan" || role === "club";
  const [tab, setTab] = useState<Tab>("jornadas");
  const [newOpen, setNewOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [showPending, setShowPending] = useState(false);
  // Formulario de nueva jornada.
  const [jorRival, setJorRival] = useState("");
  const [jorDate, setJorDate] = useState("");
  const [jorTime, setJorTime] = useState("");
  const [jorLoc, setJorLoc] = useState("");
  const [jorHome, setJorHome] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [scanOpen, setScanOpen] = useState(false);
  // Escanear el calendario es premium, como en la app (`calendar_scan`).
  const sub = useAsync(() => fetchSubscription(), [scanOpen], scanOpen);

  // «＋ Crear → Nueva jornada» llega con `?nueva=1` y el atajo «Escanear
  // calendario» con `?escanear=1`: el modal se abre solo y el parámetro se
  // limpia para que recargar no lo vuelva a abrir.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const nueva = url.searchParams.get("nueva") === "1";
      const escanear = url.searchParams.get("escanear") === "1";
      if (!nueva && !escanear) return;
      if (nueva) setNewOpen(true);
      if (escanear) setScanOpen(true);
      url.searchParams.delete("nueva");
      url.searchParams.delete("escanear");
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    } catch {
      /* sin URL: se abre a mano */
    }
  }, []);

  const { data, loading, error } = useAsync(
    async () => {
      const [seasons, matchdays, endDate] = await Promise.all([
        teamId ? fetchSeasons(teamId) : Promise.resolve<DbSeason[]>([]),
        fetchMatchdays(id),
        fetchSeasonEndDate(id).catch(() => null),
      ]);
      return { season: seasons.find((s) => s.id === id) ?? null, matchdays, endDate };
    },
    [id, teamId, user?.id, reloadKey],
    !!user,
  );
  // Con la temporada anterior si la nueva aún no tiene grupos (como la app).
  const standing = useAsync(
    () => fetchTeamStanding(teamId!, { withPrevious: true }),
    [teamId],
    !!teamId,
  );
  const playoff = useAsync(
    () => fetchTeamPlayoffGroup(standing.data!),
    [standing.data?.idGrupo, standing.data?.me?.equipo],
    !!standing.data?.me,
  );

  const matchdays = useMemo(() => data?.matchdays ?? [], [data?.matchdays]);
  const next = useMemo(() => pickNext(matchdays), [matchdays]);
  const playedList = useMemo(
    () =>
      matchdays
        .filter((m) => !isUpcoming(m))
        .sort((a, b) =>
          a.date && b.date && a.date !== b.date ? b.date.localeCompare(a.date) : b.round - a.round,
        ),
    [matchdays],
  );
  const pendingList = useMemo(
    () => matchdays.filter((m) => isUpcoming(m) && m.id !== next?.id).sort((a, b) => a.round - b.round),
    [matchdays, next],
  );

  /**
   * Renumera las jornadas 1..N por fecha. Tras borrar una en medio, la
   * numeración queda con huecos y no hay forma de arreglarla a mano.
   */
  async function renumber() {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("renumerar las jornadas", () => renumberSeasonMatchdays(id));
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast("Jornadas renumeradas");
    } else setToast(res.reason);
  }

  async function doClose() {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("cerrar la temporada", () => closeSeason(id));
    setBusy(false);
    setCloseOpen(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast("Temporada cerrada");
    } else setToast(res.reason);
  }

  /**
   * Vuelca las jornadas escaneadas. Igual que `handleBulkMatchdays` de la
   * app: numera a partir de la última y, salvo en ligas de la Federación
   * (donde manda el número oficial), renumera por fecha al terminar.
   */
  async function saveScanned(items: ScannedMatchday[], fcp: boolean): Promise<string | null> {
    const base = matchdays.reduce((m, j) => Math.max(m, j.round), 0) + 1;
    const res = await guardedWrite("crear las jornadas escaneadas", async () => {
      try {
        for (let i = 0; i < items.length; i++) {
          const m = items[i];
          await createMatchday(id, {
            jornada_number: base + i,
            opponent: m.opponent,
            match_date: m.match_date ?? null,
            match_time: m.match_time ?? null,
            is_home: m.is_home,
          });
        }
        if (!fcp) await renumberSeasonMatchdays(id);
      } finally {
        // Siempre: si un insert falla a medias, que se vea lo que sí entró.
        setReloadKey((k) => k + 1);
      }
    });
    if (!res.ok) return res.reason;
    setToast(`${items.length} ${items.length === 1 ? "jornada creada" : "jornadas creadas"}`);
    return null;
  }

  async function importFromFederation() {
    const fcpId = standing.data?.fcpId ?? null;
    if (busy || !teamId || fcpId == null) return;
    setBusy(true);
    const res = await guardedWrite("traer el calendario de la Federación", () =>
      importFcpSeason(teamId, fcpId),
    );
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast(`${res.data.created} jornadas creadas · ${res.data.updated} actualizadas`);
    } else setToast(res.reason);
  }

  if (loading) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="No se pudo cargar la temporada"
            body={error}
          />
        </Card>
      </div>
    );
  }

  const dbSeason = data?.season ?? null;
  if (!dbSeason) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="Temporada no encontrada"
            body="Puede que no exista o que no tengas acceso a ella."
          />
        </Card>
      </div>
    );
  }

  const format = PHASE_FORMAT[dbSeason.phase] ?? "Liga regular";
  const archived = !dbSeason.active;
  const canEdit = canManage && !archived;

  async function saveJornada() {
    if (busy) return;
    if (!jorRival.trim()) {
      setToast("Pon el rival de la jornada.");
      return;
    }
    const nextNum = matchdays.reduce((m, j) => Math.max(m, j.round), 0) + 1;
    setBusy(true);
    const res = await guardedWrite("crear la jornada", () =>
      createMatchday(id, {
        jornada_number: nextNum,
        opponent: jorRival.trim(),
        match_date: jorDate || null,
        match_time: jorTime || null,
        is_home: jorHome,
        location: jorLoc.trim() || null,
      }),
    );
    setBusy(false);
    if (res.ok) {
      setNewOpen(false);
      setJorRival("");
      setJorDate("");
      setJorTime("");
      setJorLoc("");
      setJorHome(true);
      setReloadKey((k) => k + 1);
      setToast("Jornada creada");
    } else {
      setToast(res.reason);
    }
  }

  // Balance y tasa de victorias con las jornadas que tienen resultado.
  const seasonWon = matchdays.filter((m) => m.outcome === "win").length;
  const seasonDrawn = matchdays.filter((m) => m.outcome === "draw").length;
  const seasonLost = matchdays.filter((m) => m.outcome === "loss").length;
  const played = seasonWon + seasonDrawn + seasonLost;
  const totalRounds = dbSeason.totalMatchdays ?? matchdays.length;
  const winRatePct = played ? Math.round((seasonWon / played) * 100) : 0;

  const tabs: { value: Tab; label: string }[] = [
    { value: "jornadas", label: "Jornadas" },
    ...(standing.data?.idGrupo ? [{ value: "clasif" as Tab, label: "Clasificación" }] : []),
    ...(playoff.data ? [{ value: "cuadro" as Tab, label: "Cuadro" }] : []),
  ];

  const isFcp = standing.data?.fcpId != null;

  return (
    <div className="tw-page">
      <PageHeader
        back={{ href: "/competir", label: "Liga" }}
        title={dbSeason.name}
        meta={[format, activeTeam?.name ?? null, activeTeam?.category ?? null]}
        actions={
          <>
            <Chip tone={dbSeason.active ? "accent" : "mute"}>
              {dbSeason.active ? "Activa" : "Archivada"}
            </Chip>
            {canEdit && (
              <Menu
                label="Añadir"
                accent
                items={[
                  { label: "Nueva jornada", sub: "Rival, casa o fuera, fecha y hora", onClick: () => setNewOpen(true) },
                  {
                    label: "Escanear el calendario",
                    sub: "Foto o PDF del calendario del grupo",
                    onClick: () => setScanOpen(true),
                  },
                  ...(isFcp
                    ? [
                        {
                          label: "Traer de la Federación",
                          sub: "Calendario y resultados del grupo",
                          onClick: () => void importFromFederation(),
                        },
                      ]
                    : []),
                ]}
              />
            )}
            {canEdit && (
              <Menu
                label="···"
                ariaLabel="Más opciones de la temporada"
                items={[
                  { label: "Renumerar jornadas", sub: "Vuelve a numerarlas por fecha", onClick: () => void renumber() },
                  {
                    label: "Cerrar temporada",
                    sub: "Pasa al histórico; avisa si quedan jornadas",
                    danger: true,
                    onClick: () => setCloseOpen(true),
                  },
                ]}
              />
            )}
          </>
        }
      />

      {archived ? (
        <ArchivedSummary matchdays={matchdays} endDate={data?.endDate ?? null} />
      ) : (
        <StatRow style={{ marginBottom: 16 }}>
          <Stat label="Jornadas" value={played} unit={`/ ${totalRounds}`} icon={<IconCalendar size={14} />} />
          <Stat
            label="Balance"
            value={`${seasonWon}-${seasonDrawn}-${seasonLost}`}
            sub="Ganadas · empatadas · perdidas"
          />
          <Stat
            label="Victorias"
            value={winRatePct}
            unit="%"
            tone={played > 0 && winRatePct >= 50 ? "accent" : undefined}
            sub={played > 0 ? `${seasonWon} de ${played} jugadas` : "Aún sin actas"}
          />
        </StatRow>
      )}

      {tabs.length > 1 && (
        <div className="tw-toolbar">
          <Segmented label="Vista de la temporada" value={tab} onChange={setTab} options={tabs} />
        </div>
      )}

      {/* ── Jornadas ─────────────────────────────────────────────── */}
      {tab === "jornadas" &&
        (matchdays.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconCalendar size={24} />}
              title="Aún no hay jornadas"
              body={
                canEdit
                  ? "Añádelas a mano, escanea el calendario o tráelas de la Federación."
                  : "El capitán aún no ha añadido jornadas."
              }
              action={
                canEdit ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    <Btn variant="accent" onClick={() => setNewOpen(true)} icon={<IconPlus size={14} />}>
                      Añadir jornada
                    </Btn>
                    <Btn onClick={() => setScanOpen(true)}>Escanear el calendario</Btn>
                  </div>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {next && (
              <Card flush>
                <CardHead title="Próxima" />
                <MatchdayRow j={next} isNext />
              </Card>
            )}
            {playedList.length > 0 && (
              <Card flush>
                <CardHead title="Jugadas" count={playedList.length} />
                {playedList.map((j) => (
                  <MatchdayRow key={j.id} j={j} />
                ))}
              </Card>
            )}
            {pendingList.length > 0 && (
              <Card flush>
                <CardHead title="Pendientes" count={pendingList.length}>
                  <Btn size="sm" variant="quiet" onClick={() => setShowPending((v) => !v)}>
                    {showPending ? "Ocultar" : "Ver"}
                  </Btn>
                </CardHead>
                {showPending && pendingList.map((j) => <MatchdayRow key={j.id} j={j} />)}
              </Card>
            )}
          </div>
        ))}

      {/* ── Clasificación (la de la Federación) ──────────────────── */}
      {tab === "clasif" && standing.data?.idGrupo && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
              {shortGroupName(standing.data.grupo)}
            </span>
          </div>
          {standing.data.previous && (
            <Note icon={<IconInfo size={15} />} style={{ marginBottom: 12 }}>
              <b>
                Clasificación final
                {standing.data.temporada ? ` de la ${standing.data.temporada}` : " de la temporada pasada"}
              </b>
              . La Federación aún no ha publicado los grupos de la temporada nueva. Cuando lo
              haga, aquí verás tu grupo nuevo.
            </Note>
          )}
          {matchdays.length === 0 ? (
            <Card>
              <EmptyState
                icon={<IconCalendar size={22} />}
                title="Aún no hay clasificación"
                body="Esta temporada está vacía. La clasificación aparecerá al traer la liga de la Federación o al añadir jornadas."
              />
            </Card>
          ) : (
            <FcpStandingsTable
              slug="cantabra"
              rows={standing.data.rows}
              zones={standing.data.zones}
              myFcpId={standing.data.me ? Number(standing.data.me.idEquipo) : standing.data.fcpId}
            />
          )}
        </>
      )}

      {/* ── Cuadro (el real del playoff) ─────────────────────────── */}
      {tab === "cuadro" &&
        (playoff.loading ? (
          <SkeletonCard />
        ) : playoff.data ? (
          <FcpBracketPanel idGrupo={playoff.data.idGrupo} />
        ) : null)}

      {/* ── Crear jornada ────────────────────────────────────────── */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        labelledBy="nueva-jor"
        width={520}
        title="Nueva jornada"
        lede="Se numera automáticamente a continuación de la última."
        footer={
          <>
            <Btn onClick={() => setNewOpen(false)}>Cancelar</Btn>
            <Btn variant="accent" disabled={busy} onClick={saveJornada}>
              {busy ? "Creando…" : "Crear jornada"}
            </Btn>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Field label="Rival" htmlFor="jor-rival">
            <Input
              id="jor-rival"
              type="text"
              placeholder="Club Visitante"
              value={jorRival}
              onChange={(e) => setJorRival(e.target.value)}
            />
          </Field>
          <div className="tw-form-grid">
            <Field label="Fecha del partido" htmlFor="jor-fecha">
              <Input id="jor-fecha" type="date" value={jorDate} onChange={(e) => setJorDate(e.target.value)} />
            </Field>
            <Field label="Hora del partido" htmlFor="jor-hora">
              <Input id="jor-hora" type="time" value={jorTime} onChange={(e) => setJorTime(e.target.value)} />
            </Field>
          </div>
          <Field label="Lugar" hint="Opcional" htmlFor="jor-lugar">
            <Input
              id="jor-lugar"
              type="text"
              placeholder="Ej. Club Pádel Indoor, Pista 3"
              value={jorLoc}
              onChange={(e) => setJorLoc(e.target.value)}
            />
          </Field>

          <Field label="Localización">
            <Segmented
              label="Localización"
              value={jorHome ? "home" : "away"}
              onChange={(v) => setJorHome(v === "home")}
              options={[
                { value: "home", label: "En nuestras pistas" },
                { value: "away", label: "Fuera de casa" },
              ]}
              style={{ alignSelf: "flex-start" }}
            />
          </Field>
        </div>
      </Modal>

      {/* ── Cerrar temporada ─────────────────────────────────────── */}
      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        labelledBy="cerrar-temp"
        width={480}
        title="Cerrar temporada"
        lede={`«${dbSeason.name}» pasará al histórico. No podrás añadir jornadas nuevas, pero los resultados pendientes se podrán registrar.`}
        footer={
          <>
            <Btn onClick={() => setCloseOpen(false)}>Cancelar</Btn>
            <Btn variant="danger" disabled={busy} onClick={() => void doClose()}>
              {busy ? "Cerrando…" : "Cerrar temporada"}
            </Btn>
          </>
        }
      >
        {pendingList.length + (next ? 1 : 0) > 0 ? (
          <Note tone="warning">
            Quedan {pendingList.length + (next ? 1 : 0)} jornadas por jugar.
          </Note>
        ) : (
          <Note>Todas las jornadas están disputadas.</Note>
        )}
      </Modal>

      {canEdit && (
        <ScanModal
          mode="calendar"
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          teamName={activeTeam?.name}
          checking={sub.loading && !sub.data}
          locked={!sub.data}
          lockedIntent="calendar_scan"
          lockedText="Escanear el calendario y crear todas las jornadas de golpe es una función premium. Sin plan puedes añadirlas a mano."
          onConfirm={(items) => saveScanned(items, isFcp)}
        />
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ── Fila de jornada ─────────────────────────────────────────────── */

function MatchdayRow({ j, isNext }: { j: DbMatchday; isNext?: boolean }) {
  const score = scoreText(j);
  const pendingActa = !score && !isUpcoming(j);
  const meta = [fmtDay(j.date, !!isNext), isNext ? j.time?.slice(0, 5) : null, j.location]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      href={`/jornada/${j.id}`}
      className="tw-md-row"
      style={{ boxShadow: isNext ? "inset 2px 0 0 var(--accent)" : "none" }}
    >
      <span
        className="mono"
        style={{ fontSize: 12, fontWeight: 600, color: isNext ? "var(--accent)" : "var(--text-faint)" }}
      >
        J{j.round}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700 }}>vs {j.opponent}</span>
      <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
        {[j.isHome ? "Casa" : "Fuera", meta || "Fecha por confirmar"].join(" · ")}
      </span>
      <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {score ? (
          <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: outcomeVar(j.outcome) }}>
            {score}
          </span>
        ) : pendingActa ? (
          <Chip tone="warning" plain>
            Acta
          </Chip>
        ) : isNext ? (
          <Chip>Próxima</Chip>
        ) : null}
      </span>
      <span style={{ color: "var(--text-faint)", display: "flex" }}>
        <IconChevronRight size={16} />
      </span>
    </Link>
  );
}

/* ── Resumen de una temporada archivada ──────────────────────────── */

function ArchivedSummary({ matchdays, endDate }: { matchdays: DbMatchday[]; endDate: string | null }) {
  const reduce = useReducedMotion();
  const seq = playedChrono(matchdays);
  const w = seq.filter((m) => m.outcome === "win").length;
  const d = seq.filter((m) => m.outcome === "draw").length;
  const l = seq.filter((m) => m.outcome === "loss").length;
  return (
    <Card style={{ marginBottom: 16 }}>
      <CardHead title="Resumen final" sub={`Solo lectura${endDate ? ` · cerrada el ${fmtDay(endDate, false)}` : ""}`}>
        <IconLock size={15} />
      </CardHead>
      <StatRow>
        <Stat label="Jornadas" value={seq.length} />
        <Stat label="Balance" value={`${w}-${d}-${l}`} sub="Ganadas · empatadas · perdidas" />
      </StatRow>
      {seq.length > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 14 }}>
          {seq.map((m, i) => (
            <motion.span
              key={m.id}
              className="mono"
              title={`J${m.round} · ${m.opponent}`}
              initial={reduce ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, duration: 0.2, ease: EASE }}
              style={{
                width: 22,
                height: 22,
                borderRadius: "var(--r-xs)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: outcomeVar(m.outcome),
                background: `color-mix(in srgb, ${outcomeVar(m.outcome)} 14%, transparent)`,
              }}
            >
              {m.outcome === "win" ? "V" : m.outcome === "loss" ? "D" : "E"}
            </motion.span>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ── Menú desplegable de acciones («Añadir», «···») ──────────────── */

function Menu({
  label,
  ariaLabel,
  accent,
  items,
}: {
  label: ReactNode;
  ariaLabel?: string;
  accent?: boolean;
  items: { label: string; sub?: string; danger?: boolean; onClick: () => void }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <Btn
        variant={accent ? "accent" : "ghost"}
        icon={accent ? <IconPlus size={15} /> : undefined}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
      </Btn>
      {open && (
        <div
          className="tw-popover"
          role="menu"
          style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", minWidth: 260, zIndex: 30 }}
        >
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className="tw-popitem"
              onClick={() => {
                setOpen(false);
                it.onClick();
              }}
              style={{ flexDirection: "column", alignItems: "flex-start", gap: 2 }}
            >
              <span style={{ fontWeight: 600, color: it.danger ? "var(--error)" : undefined }}>
                {it.label}
              </span>
              {it.sub && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{it.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
