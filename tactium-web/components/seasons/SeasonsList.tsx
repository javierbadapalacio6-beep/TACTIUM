"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { type SeasonFormat } from "@/lib/team-data";
import {
  createSeason,
  fetchActiveSeason,
  fetchAvailabilityDetail,
  fetchMatchdays,
  fetchPlayers,
  fetchSeasons,
  type DbMatchday,
  type DbSeason,
} from "@/lib/queries";
import { fetchLeagueStatsBundle, computePlayerLeagueStats } from "@/lib/player-stats";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  Btn,
  BtnLink,
  Card,
  Chip,
  Field,
  IconTile,
  Input,
  ListRow,
  Modal,
  Note,
  PageHeader,
  SectionHead,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { CountUp, EASE } from "@/components/entry/motion-bits";
import {
  IconCalendar,
  IconCamera,
  IconChevronRight,
  IconFlag,
  IconInfo,
  IconPlus,
} from "@/components/Icon";
import {
  fetchTeamStanding,
  isAlreadyInHistoryError,
  previousSeasonImportNotice,
  shortGroupName,
} from "@/components/federation/fed-data";
import {
  PHASE_EYEBROW,
  fetchSeasonsBalance,
  fmtDay,
  importFcpSeason,
  outcomeVar,
  pickNext,
  playedChrono,
  scoreText,
  type SeasonBalance,
} from "./season-data";

const FORMATS: { key: SeasonFormat; note: string }[] = [
  { key: "Liga regular", note: "Jornadas en orden" },
  { key: "Liga + Playoff", note: "Formato completo" },
  { key: "Eliminatorias", note: "Playoff" },
];

const FORMAT_TO_PHASE: Record<SeasonFormat, DbSeason["phase"]> = {
  "Liga regular": "liga",
  "Liga + Playoff": "mixto",
  Eliminatorias: "playoff",
};

/** Nombre legible de la fase que guarda la base de datos. */
const PHASE_LABEL: Record<DbSeason["phase"], string> = {
  liga: "Liga regular",
  playoff: "Eliminatorias",
  mixto: "Liga + Playoff",
};

/**
 * Competir › Liga. Igual que en la app: la temporada activa como un marcador
 * (puesto y zona de la Federación, próxima jornada con la disponibilidad y la
 * racha con resultado). Sin temporada, el capitán tiene los tres caminos; el
 * jugador, el aviso y el salto a Federación.
 */
export function SeasonsList({ embedded = false }: { embedded?: boolean } = {}) {
  const { activeTeam, role, user } = useSession();
  const teamId = activeTeam?.id ?? null;
  // Solo capitán/club crean temporadas; el jugador las consulta (Competir › Liga).
  const canManage = role === "capitan" || role === "club";
  const [reloadKey, setReloadKey] = useState(0);
  const { data, loading, error } = useAsync(
    async () => {
      const seasons = await fetchSeasons(teamId!);
      const active = seasons.find((s) => s.active) ?? null;
      const [matchdays, balances, players] = await Promise.all([
        active ? fetchMatchdays(active.id) : Promise.resolve([] as DbMatchday[]),
        fetchSeasonsBalance(seasons.filter((s) => !s.active).map((s) => s.id)).catch(
          () => ({}) as Record<string, SeasonBalance>,
        ),
        fetchPlayers(teamId!).catch(() => []),
      ]);
      return { seasons, active, matchdays, balances, players };
    },
    [teamId, reloadKey],
    !!teamId,
  );
  const SEASONS = data?.seasons ?? [];
  // Con la temporada anterior si la nueva aún no tiene grupos (como la app).
  const standing = useAsync(
    () => fetchTeamStanding(teamId!, { withPrevious: true }),
    [teamId],
    !!teamId,
  );

  const [open, setOpen] = useState(false);
  // «Escanear el calendario» sin temporada: primero se crea la temporada y,
  // al crearla, se salta a ella con el escáner abierto.
  const [scanAfter, setScanAfter] = useState(false);
  const [format, setFormat] = useState<SeasonFormat>("Liga + Playoff");
  const [name, setName] = useState("");
  const [matchdaysStr, setMatchdaysStr] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // Aviso informativo (no error): p. ej. «aún no hay temporada nueva».
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);

  const active = data?.active ?? null;
  const past = SEASONS.filter((s) => !s.active);
  const myPlayerId =
    (data?.players ?? []).find((p) => user && p.userId === user.id)?.id ?? null;

  async function saveSeason() {
    if (busy || !teamId) return;
    if (!name.trim()) {
      setToast("Ponle un nombre a la temporada.");
      return;
    }
    const n = matchdaysStr.trim() ? Number(matchdaysStr) : null;
    if (n != null && (!Number.isFinite(n) || n < 1 || n > 99)) {
      setToast("El número de jornadas va de 1 a 99.");
      return;
    }
    setBusy(true);
    const res = await guardedWrite("crear la temporada", () =>
      createSeason(teamId, {
        name: name.trim(),
        phase: FORMAT_TO_PHASE[format],
        category: activeTeam?.category ?? null,
        totalMatchdays: n,
      }),
    );
    if (res.ok && scanAfter) {
      const created = await fetchActiveSeason(teamId).catch(() => null);
      if (created) {
        window.location.href = `/temporadas/${created.id}?escanear=1`;
        return;
      }
    }
    setBusy(false);
    if (res.ok) {
      setOpen(false);
      setScanAfter(false);
      setName("");
      setMatchdaysStr("");
      setReloadKey((k) => k + 1);
      setToast("Temporada creada");
    } else {
      setToast(res.reason);
    }
  }

  async function importFromFederation() {
    if (busy || !teamId) return;
    const fcpId = standing.data?.fcpId ?? null;
    if (fcpId == null) {
      setToast("Tu equipo no está vinculado a la Federación.");
      return;
    }
    setBusy(true);
    // Entre temporadas lo único publicado es la ANTERIOR: volcarla duplicaría
    // la del histórico. Se avisa y no se llama al RPC (como la app).
    if (standing.data?.previous) {
      const n = await previousSeasonImportNotice(teamId, standing.data);
      setBusy(false);
      setNotice(n);
      return;
    }
    const res = await guardedWrite("traer la temporada de la Federación", () =>
      importFcpSeason(teamId, fcpId),
    );
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast(
        `${res.data.newSeason ? "Temporada nueva creada" : "Temporada volcada"} · ${res.data.created} jornadas`,
      );
    } else if (isAlreadyInHistoryError(res.reason)) {
      setNotice({ title: "Aún no hay temporada nueva", body: res.reason });
    } else setToast(res.reason);
  }

  if (teamId && loading) return <SkeletonPage />;

  return (
    <div className="tw-page">
      {/* Dentro de Competir el título es «Competir» y la pestaña ya dice
          «Liga»: aquí basta con el equipo y la acción. */}
      {embedded ? (
        <SectionHead
          title={activeTeam?.name ?? "Liga"}
          sub={activeTeam?.category ?? undefined}
          style={{ marginTop: 0 }}
        >
          {canManage && active ? (
            <Btn variant="ghost" onClick={() => setOpen(true)} icon={<IconPlus size={15} />}>
              Nueva temporada
            </Btn>
          ) : null}
        </SectionHead>
      ) : (
        <PageHeader
          title="Liga"
          meta={[activeTeam?.name ?? null, activeTeam?.category ?? null]}
          actions={
            canManage && active ? (
              <Btn variant="ghost" onClick={() => setOpen(true)} icon={<IconPlus size={15} />}>
                Nueva temporada
              </Btn>
            ) : undefined
          }
        />
      )}

      {!teamId ? (
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="Sin equipo activo"
            body="Entra con una cuenta que pertenezca a un equipo."
          />
        </Card>
      ) : error ? (
        <Card>
          <EmptyState
            icon={<IconCalendar size={24} />}
            title="No se pudieron cargar las temporadas"
            body={error}
          />
        </Card>
      ) : (
        <>
          {active ? (
            <>
              <Scoreboard
                season={active}
                teamName={activeTeam?.name ?? null}
                matchdays={data?.matchdays ?? []}
                standing={standing.data ?? null}
                canManage={canManage}
                teamId={teamId}
                myPlayerId={myPlayerId}
              />
              {!canManage && myPlayerId ? (
                <MySeason seasonId={active.id} playerId={myPlayerId} />
              ) : null}
            </>
          ) : canManage ? (
            <Card>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Empieza la temporada</h2>
              <p style={{ margin: "6px 0 8px", fontSize: 13.5, color: "var(--text-muted)" }}>
                {standing.data?.fcpId != null
                  ? "Tu equipo está en la Federación Cántabra: podemos traer el calendario con las jornadas, las fechas y los rivales."
                  : "Elige cómo cargar el calendario de tu liga."}
              </p>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {standing.data?.fcpId != null ? (
                  <ListRow
                    onClick={() => void importFromFederation()}
                    icon={
                      <IconTile>
                        <IconFlag size={16} />
                      </IconTile>
                    }
                    title="Traer de la Federación"
                    sub="Calendario, rivales y clasificación"
                  />
                ) : null}
                <ListRow
                  onClick={() => {
                    setScanAfter(true);
                    setOpen(true);
                  }}
                  icon={
                    <IconTile mute>
                      <IconCamera size={16} />
                    </IconTile>
                  }
                  title="Escanear el calendario"
                  sub="Creas la temporada y subes la foto o el PDF"
                />
                <ListRow
                  onClick={() => {
                    setScanAfter(false);
                    setOpen(true);
                  }}
                  icon={
                    <IconTile mute>
                      <IconPlus size={16} />
                    </IconTile>
                  }
                  title="Crear a mano"
                  sub="Nombre, formato y nº de jornadas"
                />
              </div>
            </Card>
          ) : (
            <Card>
              <EmptyState
                icon={<IconCalendar size={24} />}
                title="Tu capitán aún no ha empezado la temporada"
                body="Cuando la cree, aquí verás tu próxima jornada, el puesto y la racha. Mientras, mira la Federación."
                action={
                  <BtnLink href="/federacion/cantabra" size="sm">
                    Ver la Federación
                  </BtnLink>
                }
              />
            </Card>
          )}

          {past.length > 0 && (
            <>
              <SectionHead title="Histórico" count={past.length} />
              <Card flush>
                {past.map((s) => {
                  const b = data?.balances?.[s.id];
                  return (
                    <ListRow
                      key={s.id}
                      href={`/temporadas/${s.id}`}
                      icon={
                        <IconTile mute>
                          <IconCalendar size={16} />
                        </IconTile>
                      }
                      title={s.name}
                      sub={
                        b && b.total > 0
                          ? `${PHASE_LABEL[s.phase]} · ${b.w}-${b.d}-${b.l}`
                          : `${PHASE_LABEL[s.phase]} · sin jornadas`
                      }
                      right={<Chip tone="mute">Archivada</Chip>}
                    />
                  );
                })}
              </Card>
            </>
          )}
        </>
      )}

      {/* ── Crear temporada ──────────────────────────────────────── */}
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          setScanAfter(false);
        }}
        labelledBy="nueva-temp"
        width={520}
        title="Crear temporada"
        lede={scanAfter ? "Primero la temporada; después subes el calendario y creamos las jornadas." : undefined}
        footer={
          <>
            <Btn onClick={() => setOpen(false)}>Cancelar</Btn>
            <Btn variant="accent" disabled={busy} onClick={saveSeason}>
              {busy
                ? "Creando…"
                : active
                  ? "Cerrar y crear nueva"
                  : scanAfter
                    ? "Crear y escanear"
                    : "Crear temporada"}
            </Btn>
          </>
        }
      >
        {active && (
          <Note tone="warning" style={{ marginBottom: 18 }}>
            Ya tienes una temporada activa. Al crear una nueva, la actual se
            cierra y pasa al histórico.
          </Note>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Field label="Nombre" htmlFor="temporada-nombre">
            <Input
              id="temporada-nombre"
              type="text"
              placeholder="Temporada 26/27"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>

          <Field label="Formato">
            <div
              style={{ display: "flex", flexDirection: "column", gap: 8 }}
              role="radiogroup"
              aria-label="Formato"
            >
              {FORMATS.map((f) => {
                const on = format === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setFormat(f.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      minHeight: 44,
                      padding: "0 14px",
                      borderRadius: 10,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "var(--font-ui)",
                      background: on ? "var(--accent-10)" : "var(--bg-card-2)",
                      color: on ? "var(--accent)" : "var(--text)",
                      border: `1px solid ${on ? "var(--accent-40)" : "var(--line)"}`,
                      transition:
                        "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: on ? 700 : 500 }}>
                      {f.key}
                    </span>
                    <span
                      style={{
                        fontSize: 12.5,
                        color: on ? "var(--accent)" : "var(--text-faint)",
                      }}
                    >
                      {f.note}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field
            label={format === "Eliminatorias" ? "Número de eliminatorias" : "Número de jornadas"}
            hint="Opcional"
            htmlFor="temporada-jornadas"
          >
            <Input
              id="temporada-jornadas"
              type="text"
              inputMode="numeric"
              className="mono"
              value={matchdaysStr}
              onChange={(e) => setMatchdaysStr(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
            />
          </Field>
        </div>
      </Modal>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
      {notice && (
        <Toast tone="info" title={notice.title} body={notice.body} onClose={() => setNotice(null)} />
      )}
    </div>
  );
}

/* ── Marcador de la temporada activa ─────────────────────────────── */

function Scoreboard({
  season,
  teamName,
  matchdays,
  standing,
  canManage,
  teamId,
  myPlayerId,
}: {
  season: DbSeason;
  teamName: string | null;
  matchdays: DbMatchday[];
  standing: Awaited<ReturnType<typeof fetchTeamStanding>> | null;
  canManage: boolean;
  teamId: string;
  myPlayerId: string | null;
}) {
  const reduce = useReducedMotion();
  const wins = matchdays.filter((m) => m.outcome === "win").length;
  const draws = matchdays.filter((m) => m.outcome === "draw").length;
  const losses = matchdays.filter((m) => m.outcome === "loss").length;
  const played = wins + draws + losses;
  const total = season.totalMatchdays ?? matchdays.length;
  const last5 = playedChrono(matchdays).slice(-5);
  const next = pickNext(matchdays);

  // Disponibilidad de la próxima: cuántos van (capitán) o tu respuesta.
  const avail = useAsync(
    async () => {
      const [detail, players] = await Promise.all([
        fetchAvailabilityDetail(next!.id),
        fetchPlayers(teamId),
      ]);
      const ids = players.filter((p) => p.active).map((p) => p.id);
      return {
        yes: ids.filter((id) => detail[id]?.status === "yes").length,
        total: ids.length,
        mine: myPlayerId ? detail[myPlayerId]?.status ?? null : null,
      };
    },
    [next?.id, teamId, myPlayerId],
    !!next,
  );

  const me = standing?.me ?? null;
  const zone = standing?.zone ?? null;
  const group = shortGroupName(standing?.grupo);
  const mine = avail.data?.mine;

  return (
    <Card style={{ borderColor: "var(--accent-40)", background: "linear-gradient(135deg, var(--accent-10), var(--bg-card) 70%)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Chip>Activa · {PHASE_EYEBROW[season.phase]}</Chip>
          <h2 style={{ margin: "10px 0 2px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.01em" }}>
            {season.name}
          </h2>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-muted)" }}>
            {[teamName, group].filter(Boolean).join(" · ")}
          </p>
        </div>
        <BtnLink href={`/temporadas/${season.id}`} size="sm" variant="accent">
          Abrir temporada
        </BtnLink>
      </div>

      <StatRow style={{ marginTop: 16 }}>
        {me ? (
          <Stat
            label={zone ? zone.label : "Puesto"}
            value={
              <>
                <CountUp to={me.posicion} duration={0.4} />º
              </>
            }
            unit={`de ${standing?.rows.length ?? 0}`}
            tone="accent"
          />
        ) : null}
        <Stat label="Jornadas" value={`${played}/${total || "—"}`} />
        <Stat label="Balance" value={`${wins}-${draws}-${losses}`} sub="Ganadas · empatadas · perdidas" />
      </StatRow>

      {standing?.previous && me && (
        <Note icon={<IconInfo size={15} />} style={{ marginTop: 12 }}>
              <b>
                Clasificación final
                {standing.temporada ? ` de la ${standing.temporada}` : " de la temporada pasada"}
              </b>
              . La Federación aún no ha publicado los grupos de la temporada nueva. Cuando lo
              haga, aquí verás tu grupo nuevo.
            </Note>
      )}

      {next ? (
        <div
          className="divider-top"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--line)",
            flexWrap: "wrap",
          }}
        >
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}>
            J{String(next.round).padStart(2, "0")}
          </span>
          <Link href={`/jornada/${next.id}`} style={{ flex: 1, minWidth: 0, color: "inherit" }}>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }} className="truncate">
              vs {next.opponent}
            </span>
            <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>
              {[fmtDay(next.date), next.time?.slice(0, 5), next.isHome ? "En casa" : "Fuera"]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </Link>
          {avail.data ? (
            canManage ? (
              avail.data.total > 0 ? (
                <Link href={`/jornada/${next.id}/disponibilidad`} className="chip chip-accent">
                  {avail.data.yes}/{avail.data.total} van
                </Link>
              ) : null
            ) : myPlayerId ? (
              <Link
                href={`/jornada/${next.id}/disponibilidad`}
                className={mine ? "chip chip-accent" : "btn btn-accent btn-sm"}
              >
                {mine === "yes"
                  ? "Tú: Voy"
                  : mine === "maybe"
                    ? "Tú: Duda"
                    : mine === "no"
                      ? "Tú: No"
                      : "¿Puedes jugar?"}
              </Link>
            ) : null
          ) : null}
        </div>
      ) : null}

      {last5.length > 0 || standing?.idGrupo ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {last5.map((m, i) => (
              <motion.span
                key={m.id}
                className="mono"
                initial={reduce ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.12 + i * 0.07, duration: 0.26, ease: EASE }}
                title={`J${m.round} · ${m.opponent}`}
                style={{
                  minWidth: 40,
                  padding: "4px 8px",
                  borderRadius: "var(--r-sm)",
                  textAlign: "center",
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: outcomeVar(m.outcome),
                  background: `color-mix(in srgb, ${outcomeVar(m.outcome)} 14%, transparent)`,
                }}
              >
                {scoreText(m)}
              </motion.span>
            ))}
          </div>
          {standing?.idGrupo ? (
            <Link
              href={`/federacion/cantabra/grupo/${encodeURIComponent(standing.idGrupo)}`}
              className="link-action"
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              Clasificación <IconChevronRight size={14} />
            </Link>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/* ── «Tu temporada» (jugador) ───────────────────────────────────── */

function MySeason({ seasonId, playerId }: { seasonId: string; playerId: string }) {
  const stats = useAsync(
    async () => computePlayerLeagueStats(playerId, await fetchLeagueStatsBundle([seasonId])),
    [seasonId, playerId],
  );
  const s = stats.data;
  if (!s) return null;
  // La pareja MÁS REPETIDA (no la de mejor porcentaje).
  const partner = [...s.partners].sort((a, b) => b.played - a.played)[0];
  return (
    <>
      <SectionHead title="Tu temporada" />
      <StatRow>
        <Stat label="Jugados" value={s.played} />
        <Stat label="Ganados" value={s.won} tone="accent" />
        <Stat label="Tu pareja" value={partner ? partner.name.split(/\s+/).slice(-1)[0] : "—"} sub={partner ? `${partner.played} partidos juntos` : undefined} />
      </StatRow>
    </>
  );
}
