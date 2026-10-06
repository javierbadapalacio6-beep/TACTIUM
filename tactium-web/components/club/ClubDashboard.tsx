"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  coverTeam,
  fetchClub,
  fetchClubHomeSchedule,
  fetchClubTeams,
  fetchClubTournaments,
  fetchSubscription,
  fetchVenueHomeSchedule,
  type DbClubHomeMatch,
  type DbClubTeam,
  type DbClubTournament,
} from "@/lib/queries";
import {
  fetchClubInscripciones,
  fetchClubWeek,
  fetchInscripcionGrupo,
  fetchTournamentStats,
  fetchUnconfirmedVenues,
  tournamentPhase,
  type FcpInscripcion,
  type FcpInscripcionesResumen,
  type TeamWeek,
} from "@/lib/club-ops";
import { CLUB_PLANS } from "@/lib/plans";
import { FCP_FEDERATION_CODE } from "@/lib/federations";
import { FcpGroupRivals } from "@/components/federation/FcpGroupRivals";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  IconTile,
  ListRow,
  Modal,
  Note,
  PageHeader,
  Progress,
  Select,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import {
  IconBuilding,
  IconCheckCircle,
  IconFlag,
  IconPlus,
  IconReceipt,
  IconSettings,
  IconShield,
  IconTrophy,
  IconUserPlus,
} from "@/components/Icon";
import { InvitePanel } from "@/components/invite/InvitePanel";
import { TrialCard } from "@/components/subscription/TrialCard";
import { EditClubModal } from "@/components/club/EditClubModal";
import { Crest } from "@/components/Crest";

interface ClubData {
  club: {
    id: string;
    name: string;
    federation: string | null;
    logo_url: string | null;
    tournaments_only: boolean | null;
  } | null;
  teams: DbClubTeam[];
}

/** Lo que el panel necesita para «Por hacer», «Esta semana» y «Gestión». */
interface OpsData {
  home: (DbClubHomeMatch & { is_guest: boolean; unconfirmed: boolean })[];
  tournaments: (DbClubTournament & { billing_status?: string | null })[];
  unpaid: { count: number; id: string | null; name: string | null };
  week: Record<string, TeamWeek>;
  planName: string | null;
  quota: number;
  inscripciones: FcpInscripcionesResumen | null;
}

const WEEKDAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const dayLabel = (iso: string | null) => {
  if (!iso) return "Sin fecha";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : `${WEEKDAY[d.getDay()]} ${d.getDate()}`;
};

/** Ventana de la jornada en juego: 7 días desde el primer partido de hoy en adelante. */
function currentRound<T extends { match_date: string | null }>(ms: T[]): T[] {
  const dated = ms.filter((m) => m.match_date).sort((a, b) => a.match_date!.localeCompare(b.match_date!));
  if (!dated.length) return ms;
  const today = localIso(new Date());
  const d0 = (dated.find((m) => m.match_date! >= today) ?? dated[dated.length - 1]).match_date!;
  const end = new Date(`${d0}T00:00:00`);
  end.setDate(end.getDate() + 6);
  const e = localIso(end);
  return ms.filter((m) => !m.match_date || (m.match_date >= d0 && m.match_date <= e));
}

export function ClubDashboard() {
  const { clubId, teams: myTeams, setActiveTeam } = useSession();
  const reduce = useReducedMotion();
  const [editOpen, setEditOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTeamId, setInviteTeamId] = useState<string | null>(null);
  const [roster, setRoster] = useState<number | null>(null);

  const { data, loading, error } = useAsync<ClubData>(
    async () => {
      const [club, teams] = await Promise.all([fetchClub(clubId!), fetchClubTeams(clubId!)]);
      return { club, teams };
    },
    [clubId, reloadKey],
    !!clubId,
  );

  // Datos operativos, aparte: si una fuente falla, el panel se pinta igual.
  const ops = useAsync<OpsData>(
    async () => {
      const teams = data?.teams ?? [];
      const [own, guests, tours, sub, week, insc] = await Promise.all([
        fetchClubHomeSchedule(clubId!).catch(() => [] as DbClubHomeMatch[]),
        fetchVenueHomeSchedule(clubId!).catch(() => [] as DbClubHomeMatch[]),
        fetchClubTournaments(clubId!).catch(() => [] as DbClubTournament[]),
        fetchSubscription().catch(() => null),
        fetchClubWeek(teams.map((t) => t.id)).catch(() => ({}) as Record<string, TeamWeek>),
        data?.club?.federation === FCP_FEDERATION_CODE
          ? fetchClubInscripciones(teams).catch(() => null)
          : Promise.resolve(null),
      ]);
      const all = [
        ...own.map((m) => ({ ...m, is_guest: false })),
        ...guests.map((m) => ({ ...m, is_guest: true })),
      ];
      const pending = await fetchUnconfirmedVenues(all.map((m) => m.matchday_id)).catch(
        () => new Set<string>(),
      );
      const open = tours.filter((t) => t.status === "open" || t.status === "draft");
      const stats = await fetchTournamentStats(open);
      let count = 0;
      let top: DbClubTournament | null = null;
      let topN = 0;
      for (const t of open) {
        const n = stats[t.id]?.pendingClub ?? 0;
        count += n;
        if (n > topN) {
          topN = n;
          top = t;
        }
      }
      const plan =
        sub?.subjectType === "club" ? (CLUB_PLANS.find((p) => p.tier === sub.planTier) ?? null) : null;
      return {
        home: all.map((m) => ({ ...m, unconfirmed: pending.has(m.matchday_id) })),
        tournaments: tours,
        unpaid: { count, id: top?.id ?? null, name: top?.name ?? null },
        week,
        planName: plan?.displayName ?? null,
        quota: plan?.teamQuota ?? 0,
        inscripciones: insc,
      };
    },
    [clubId, data],
    !!clubId && !!data,
  );

  // Espacio de organizador («solo torneos»): su casa es la pantalla de torneos.
  const router = useRouter();
  const tournamentsOnly = data?.club?.tournaments_only === true;
  useEffect(() => {
    if (tournamentsOnly) router.replace("/club/torneos");
  }, [tournamentsOnly, router]);

  if (!clubId) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconBuilding size={24} />}
            title="Sin club activo"
            body="Crea un club o pide que te añadan como administrador."
            action={
              <BtnLink href="/empezar/club" variant="accent">
                Crear club
              </BtnLink>
            }
          />
        </Card>
      </div>
    );
  }
  if (loading) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconBuilding size={24} />} title="No se pudo cargar el club" body={error} />
        </Card>
      </div>
    );
  }

  const club = data?.club;
  const teams = data?.teams ?? [];
  const covered = teams.filter((t) => t.covered).length;
  const unconfigured = teams.filter((t) => !t.category).length;
  const o = ops.data;
  const quota = o?.quota ?? 0;
  const hasPlan = quota > 0;
  const pct = teams.length ? Math.round((covered / teams.length) * 100) : 0;
  const isFcp = club?.federation === FCP_FEDERATION_CODE;

  async function doCoverTeam(teamId: string) {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("cubrir el equipo", () => coverTeam(teamId));
    setBusy(false);
    if (res.ok) {
      setReloadKey((k) => k + 1);
      setToast("Equipo cubierto con la suscripción del club");
    } else setToast(res.reason);
  }

  // ── Por hacer ──────────────────────────────────────────────────────────
  const todo: { key: string; count: number; title: string; sub: string; href: string }[] = [];
  if (o) {
    const round = currentRound(o.home);
    const noTime = round.filter((m) => !m.match_time);
    if (noTime.length) {
      const j = noTime.find((m) => m.jornada_number)?.jornada_number;
      todo.push({
        key: "noTime",
        count: noTime.length,
        title: noTime.length === 1 ? "Partido de local sin hora" : "Partidos de local sin hora",
        sub: [
          j ? `J${j}` : null,
          noTime
            .slice(0, 3)
            .map((m) => m.team_name + (m.is_guest ? " (invitado)" : ""))
            .join(", "),
        ]
          .filter(Boolean)
          .join(" · "),
        href: "/club/horarios",
      });
    }
    const venues = o.home.filter((m) => m.unconfirmed);
    if (venues.length) {
      todo.push({
        key: "venues",
        count: venues.length,
        title: venues.length === 1 ? "Sede de playoff por confirmar" : "Sedes de playoff por confirmar",
        sub: [venues[0].team_name, venues[0].match_date ? dayLabel(venues[0].match_date) : null]
          .filter(Boolean)
          .join(" · "),
        href: "/club/horarios",
      });
    }
    if (o.unpaid.count > 0) {
      todo.push({
        key: "unpaid",
        count: o.unpaid.count,
        title: o.unpaid.count === 1 ? "Pareja sin pagar en el club" : "Parejas sin pagar en el club",
        sub: o.unpaid.name ?? "Tus torneos",
        href: o.unpaid.id ? `/torneos/${o.unpaid.id}` : "/club/torneos",
      });
    }
    const uncovered = hasPlan ? teams.filter((t) => !t.covered) : [];
    if (uncovered.length) {
      todo.push({
        key: "cover",
        count: uncovered.length,
        title: uncovered.length === 1 ? "Equipo sin cubrir por el plan" : "Equipos sin cubrir por el plan",
        sub: uncovered
          .slice(0, 2)
          .map((t) => [t.name, t.category].filter(Boolean).join(" · "))
          .join(", "),
        href: "/club/facturacion/cubrir",
      });
    }
  }

  // ── Esta semana ────────────────────────────────────────────────────────
  const today = localIso(new Date());
  const in7 = localIso(new Date(Date.now() + 6 * 86400000));
  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? "";
  const upcoming = Object.values(o?.week ?? {})
    .map((w) => w.next)
    .filter((n): n is NonNullable<typeof n> => !!n)
    .sort((a, b) => (a.match_date ?? "z").localeCompare(b.match_date ?? "z"));
  const thisWeek = upcoming.filter((m) => m.match_date && m.match_date >= today && m.match_date <= in7);
  const weekList = thisWeek.length ? thisWeek : upcoming.slice(0, 4);
  const results = Object.values(o?.week ?? {})
    .map((w) => w.last)
    .filter((n): n is NonNullable<typeof n> => !!n);
  const tally = { v: 0, e: 0, d: 0 };
  for (const r of results) {
    if (r.outcome === "win") tally.v++;
    else if (r.outcome === "loss") tally.d++;
    else tally.e++;
  }
  const latest = results.slice().sort((a, b) => (b.match_date ?? "").localeCompare(a.match_date ?? ""))[0];

  const tours = o?.tournaments ?? [];
  const live = tours.filter((t) => tournamentPhase(t) === 3).length;
  const openSignup = tours.filter((t) => tournamentPhase(t) === 0).length;
  const toursSub =
    tours.length === 0
      ? "Crea el primero: gratis hasta 16 parejas"
      : [live ? `${live} en juego` : null, openSignup ? `${openSignup} con inscripción abierta` : null]
          .filter(Boolean)
          .join(" · ") || `${tours.length} torneos`;

  const shortcuts = [
    { href: "/club/torneos", title: "Torneos", body: toursSub, Icon: IconTrophy },
    {
      href: "/club/facturacion",
      title: "Cobros y facturación",
      body: o?.planName ? `${o.planName} · cobro de inscripciones` : "Plan del club y cobro de inscripciones",
      Icon: IconReceipt,
    },
    ...(isFcp
      ? [{ href: "/club/importar", title: "Importar de la Federación", body: "Equipos, plantillas y puntos", Icon: IconFlag }]
      : []),
  ];

  const insc = o?.inscripciones ?? null;
  const rosterRow = roster != null && insc ? insc.rows[roster] : null;

  return (
    <div className="tw-page">
      <PageHeader
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <Crest src={club?.logo_url} kind="club" size={40} />
            {club?.name ?? "Club"}
          </span>
        }
        meta={[
          club?.federation ? club.federation.toUpperCase() : "Sin federación",
          `${teams.length} ${teams.length === 1 ? "equipo" : "equipos"}`,
        ]}
        actions={
          <>
            {club && (
              <Btn onClick={() => setEditOpen(true)} icon={<IconSettings size={15} />}>
                Editar club
              </Btn>
            )}
            <BtnLink href="/club/equipos/nuevo" variant="accent" icon={<IconPlus size={15} />}>
              Nuevo equipo
            </BtnLink>
          </>
        }
      />

      <TrialCard subjectType="club" subjectId={clubId} />

      {/* ── Por hacer: solo lo que pide una acción ─────────────────── */}
      {teams.length > 0 && o && (
        <AnimatePresence initial={false} mode="wait">
          {todo.length > 0 ? (
            <motion.div key="todo" exit={reduce ? undefined : { opacity: 0, height: 0 }}>
              <Card flush style={{ marginBottom: 16, borderColor: "var(--warning)" }}>
                <CardHead title="Por hacer" count={todo.reduce((n, t) => n + t.count, 0)} />
                <AnimatePresence initial={false}>
                  {todo.map((t) => (
                    <motion.div
                      key={t.key}
                      layout={!reduce}
                      exit={reduce ? undefined : { opacity: 0, height: 0, transition: { duration: 0.3 } }}
                    >
                      <ListRow
                        href={t.href}
                        icon={
                          <span
                            className="mono"
                            style={{ minWidth: 28, textAlign: "center", fontSize: 20, fontWeight: 700, color: "var(--warning)" }}
                          >
                            {t.count}
                          </span>
                        }
                        title={t.title}
                        sub={t.sub}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </Card>
            </motion.div>
          ) : (
            <motion.div key="ok" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
              <Note tone="accent" icon={<IconCheckCircle size={15} />} style={{ marginBottom: 16 }}>
                Todo al día: horarios puestos, equipos cubiertos y torneos sin pagos pendientes.
              </Note>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <StatRow style={{ marginBottom: 16 }}>
        <Stat label="Equipos" value={teams.length} icon={<IconShield size={14} />} />
        <Stat
          label={o?.planName ? `Cubiertos por ${o.planName}` : "Cubiertos por el plan"}
          value={covered}
          unit={`/ ${hasPlan ? quota : teams.length}`}
          tone={teams.length > 0 && covered === teams.length ? "accent" : undefined}
          sub={
            teams.length === 0
              ? "Aún sin equipos"
              : covered === teams.length
                ? "Todos los equipos cubiertos"
                : `${teams.length - covered} sin cubrir`
          }
        >
          <Progress value={hasPlan ? Math.round((covered / quota) * 100) : pct} style={{ marginTop: 10 }} />
        </Stat>
        <Stat
          label="Sin configurar"
          value={unconfigured}
          tone={unconfigured > 0 ? "warning" : undefined}
          sub={unconfigured > 0 ? "Falta categoría o género" : "Todo configurado"}
        />
      </StatRow>

      <div className="tw-club-grid" style={{ "--cols": "minmax(0, 1.6fr) minmax(0, 1fr)" } as CSSProperties}>
        {/* ── Equipos ─────────────────────────────────────────────── */}
        <Card flush>
          <CardHead title="Equipos" count={teams.length}>
            {teams.length > 0 && (
              <Btn
                size="sm"
                variant="quiet"
                icon={<IconUserPlus size={14} />}
                onClick={() => {
                  setInviteTeamId((cur) => cur ?? teams[0]?.id ?? null);
                  setInviteOpen(true);
                }}
              >
                Invitar
              </Btn>
            )}
            <Link href="/club/equipos" className="link-action">
              Ver todos
            </Link>
          </CardHead>
          {teams.length === 0 ? (
            <SetupList isFcp={isFcp} clubName={club?.name ?? ""} />
          ) : (
            teams.map((t) => (
              <ListRow
                key={t.id}
                href={`/club/equipos/${t.id}`}
                icon={
                  <IconTile small>
                    <IconShield size={14} />
                  </IconTile>
                }
                title={t.name}
                sub={
                  hasPlan && !t.covered
                    ? "Sin cubrir"
                    : [t.category, t.gender].filter(Boolean).join(" · ") || "Sin categoría"
                }
                right={
                  t.covered ? (
                    <Chip>Cubierto</Chip>
                  ) : covered >= quota && hasPlan ? (
                    <Link href="/club/facturacion/cubrir" className="chip chip-warning" onClick={(e) => e.stopPropagation()}>
                      Cubrir
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="chip chip-warning"
                      disabled={busy}
                      onClick={(e) => {
                        // La fila entera es un enlace: sin esto, cubrir te sacaría de la pantalla.
                        e.preventDefault();
                        e.stopPropagation();
                        void doCoverTeam(t.id);
                      }}
                      title="Cubrir con la suscripción del club"
                    >
                      Cubrir
                    </button>
                  )
                }
              />
            ))
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          {/* ── Pretemporada / Esta semana ─────────────────────────── */}
          {insc ? (
            <Card flush>
              <CardHead
                title={`Inscripciones ${insc.temporada}`}
                sub={`${insc.confirmados} de ${insc.total} equipos confirmados por la Federación`}
              />
              <div style={{ padding: "0 18px 8px" }}>
                <Progress value={insc.total ? Math.round((insc.confirmados / insc.total) * 100) : 0} />
              </div>
              {insc.rows.map((r, i) => (
                <ListRow
                  key={`${r.equipo}-${r.genero}`}
                  onClick={() => setRoster(i)}
                  title={r.equipo}
                  // El estado sale del cruce por jugadores (`diffClubSeason`),
                  // no del nombre exacto: dice si sigue, sube, baja, si la FCP
                  // le ha cambiado el nombre o si es nuevo.
                  sub={[
                    r.genero === "F" ? "Femenino" : "Masculino",
                    r.categoria,
                    r.subgrupo ? `Grupo ${r.subgrupo}` : null,
                    r.estadoLabel,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  right={r.confirmado ? <Chip>Confirmado</Chip> : <Chip tone="warning">Pendiente</Chip>}
                />
              ))}
              {/* Equipos importados de la Federación que no salen en la lista
                  nueva: o no se han apuntado o se han ido a otro club. Es lo
                  que el gestor tiene que perseguir antes del cierre. */}
              {insc.desaparecen.length > 0 && (
                <div style={{ borderTop: "1px solid var(--line)" }}>
                  <CardHead
                    title="No aparecen inscritos"
                    count={insc.desaparecen.length}
                    sub="Equipos del club que la Federación no lista esta temporada"
                  />
                  {insc.desaparecen.map((t) => (
                    <ListRow
                      key={t.teamId}
                      title={t.name}
                      sub={t.categoria ? `Ahora en ${t.categoria}` : undefined}
                      right={<Chip tone="mute">Sin inscribir</Chip>}
                    />
                  ))}
                </div>
              )}
            </Card>
          ) : (
            teams.length > 0 && (
              <Card flush>
                <CardHead title={thisWeek.length ? "Esta semana" : "Próximas jornadas"}>
                  <Link href="/temporadas" className="link-action">
                    Ver liga
                  </Link>
                </CardHead>
                {ops.loading ? (
                  <div style={{ padding: 18, fontSize: 13, color: "var(--text-faint)" }}>Cargando…</div>
                ) : weekList.length === 0 ? (
                  <EmptyState compact title="Sin jornadas próximas" body="Cuando haya calendario, saldrán aquí." />
                ) : (
                  weekList.map((m) => {
                    const time = m.match_time?.slice(0, 5);
                    const noTime = m.is_home && !time;
                    return (
                      <ListRow
                        key={m.id}
                        // A la jornada concreta. Si el admin también está en
                        // ese equipo, se activa: las pantallas de alineación y
                        // resultados trabajan con el equipo activo.
                        onClick={() => {
                          if (myTeams.some((t) => t.id === m.team_id)) setActiveTeam(m.team_id);
                          router.push(`/jornada/${m.id}`);
                        }}
                        icon={
                          <span className="mono" style={{ minWidth: 44, fontSize: 12.5, color: "var(--text-muted)" }}>
                            {dayLabel(m.match_date)}
                          </span>
                        }
                        title={`${nameOf(m.team_id)} ${m.is_home ? "vs" : "@"} ${m.opponent ?? "—"}`}
                        sub={[time ?? "Sin hora", m.location].filter(Boolean).join(" · ")}
                        right={
                          noTime ? (
                            <Chip tone="warning">Sin hora</Chip>
                          ) : m.is_home ? (
                            <Chip>Casa</Chip>
                          ) : (
                            <Chip tone="mute">Fuera</Chip>
                          )
                        }
                      />
                    );
                  })
                )}
                {latest && (
                  <div className="card-foot" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    Última jornada · <span className="mono">{tally.v}V · {tally.e}E · {tally.d}D</span> ·{" "}
                    {nameOf(latest.team_id)}{" "}
                    <span className="mono">
                      {latest.score_for ?? "—"}-{latest.score_against ?? "—"}
                    </span>{" "}
                    {latest.opponent}
                  </div>
                )}
              </Card>
            )
          )}

          {/* ── Gestión ─────────────────────────────────────────────── */}
          <Card flush>
            <CardHead title="Gestión del club" />
            {shortcuts.map((s) => (
              <ListRow
                key={s.href}
                href={s.href}
                icon={
                  <IconTile>
                    <s.Icon size={16} />
                  </IconTile>
                }
                title={s.title}
                sub={s.body}
              />
            ))}
            <ListRow
              onClick={() => setEditOpen(true)}
              icon={
                <IconTile>
                  <IconSettings size={16} />
                </IconTile>
              }
              title="Ajustes del club"
              sub="Nombre, escudo y borrar club"
            />
          </Card>
        </div>
      </div>

      {inviteOpen && (
        <Modal
          open
          onClose={() => setInviteOpen(false)}
          labelledBy="club-invitar"
          width={460}
          title="Invitar a tu gente"
          lede="Comparte el enlace del equipo: capitán y jugadores se unen gratis desde la app o la web."
          footer={<Btn onClick={() => setInviteOpen(false)}>Listo</Btn>}
        >
          {teams.length > 1 && (
            <Field label="Equipo" htmlFor="club-invitar-equipo" style={{ marginBottom: 16 }}>
              <Select id="club-invitar-equipo" value={inviteTeamId ?? ""} onChange={(e) => setInviteTeamId(e.target.value)}>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {inviteTeamId && (
            <InvitePanel
              key={inviteTeamId}
              teamId={inviteTeamId}
              teamName={teams.find((t) => t.id === inviteTeamId)?.name ?? "tu equipo"}
              onToast={setToast}
            />
          )}
        </Modal>
      )}

      {rosterRow && (
        <InscripcionModal
          row={rosterRow}
          // El nombre de verdad del equipo en TACTIUM, no `antes` (que va en
          // mayúsculas y sin patrocinador): es el que el gestor reconoce.
          nombreTactium={
            rosterRow.estado === "renombrado" && rosterRow.teamId
              ? (teams.find((t) => t.id === rosterRow.teamId)?.name ?? rosterRow.antes)
              : null
          }
          onClose={() => setRoster(null)}
        />
      )}

      {club && (
        <EditClubModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          clubId={club.id}
          initialName={club.name}
          initialFederation={club.federation}
          initialLogo={club.logo_url}
        />
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/**
 * Detalle de un equipo inscrito: dónde juega, contra quién y con qué
 * plantilla. Va en componente aparte porque pide los rivales al abrirse (una
 * consulta por equipo mirado, no una por fila del panel) y un hook no puede
 * vivir detrás de los `return` tempranos del panel.
 */
function InscripcionModal({
  row,
  nombreTactium,
  onClose,
}: {
  row: FcpInscripcion;
  nombreTactium: string | null;
  onClose: () => void;
}) {
  const rivales = useAsync(
    () => fetchInscripcionGrupo(row).catch(() => []),
    [row.idLiga, row.idGrupo, row.subgrupo, row.idEquipo],
    !!row.subgrupo,
  );
  const sede = row.sedeCorta ?? row.sede;
  const lede = [row.subgrupo ? `Grupo ${row.subgrupo}` : null, sede ? `juega en ${sede}` : null]
    .filter(Boolean)
    .join(" · ");
  const fila: CSSProperties = {
    display: "grid",
    gridTemplateColumns: "22px minmax(0, 1fr) auto",
    alignItems: "center",
    gap: 10,
    padding: "6px 0",
    fontSize: 13.5,
  };
  return (
    <Modal
      open
      onClose={onClose}
      labelledBy="plantilla-inscrita"
      width={460}
      title={row.equipo}
      lede={lede ? lede.charAt(0).toUpperCase() + lede.slice(1) : "Plantilla inscrita"}
      footer={<Btn onClick={onClose}>Cerrar</Btn>}
    >
      {nombreTactium && (
        <Note style={{ marginBottom: 14 }}>
          En TACTIUM se llama <strong>{nombreTactium}</strong>. La Federación lo ha inscrito con
          otro nombre, pero son los mismos jugadores.
        </Note>
      )}
      <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>Plantilla inscrita</div>
      {row.jugadores.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
          La Federación todavía no publica jugadores en este equipo.
        </p>
      ) : (
        row.jugadores.map((j, i) => (
          <div key={j.idJugador} style={fila}>
            <span className="mono" style={{ color: "var(--text-faint)" }}>
              {i + 1}
            </span>
            <span className="truncate">{j.nombre}</span>
            <span className="mono" style={{ color: "var(--text-muted)" }}>
              {j.puntos.toLocaleString("es-ES")}
            </span>
          </div>
        ))
      )}
      {(rivales.data?.length ?? 0) > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>
            Tu grupo
            <span style={{ marginLeft: 6, fontWeight: 500, color: "var(--text-muted)" }}>
              Grupo {row.subgrupo} · {rivales.data!.length} rivales
            </span>
          </div>
          <FcpGroupRivals rivales={rivales.data!} />
        </div>
      )}
    </Modal>
  );
}

/** Club sin equipos: lista de arranque en vez de «Aún no hay equipos». */
function SetupList({ isFcp, clubName }: { isFcp: boolean; clubName: string }) {
  const steps = [
    { title: "Crear el club", sub: isFcp ? `${clubName} · Federación Cántabra` : clubName, done: true, href: undefined },
    isFcp
      ? { title: "Importar tus equipos de la Federación", sub: "Plantillas y puntos oficiales, en un paso", done: false, href: "/club/importar" }
      : { title: "Crear el primer equipo", sub: "Nombre, categoría y género", done: false, href: "/club/equipos/nuevo" },
    { title: "Invitar a los capitanes", sub: "Un código por equipo, por WhatsApp", done: false, href: "/club/equipos" },
    { title: "Poner las franjas de tus pistas", sub: "Sábado 10:00 y 12:00, por ejemplo", done: false, href: "/club/horarios" },
  ];
  const next = steps.find((s) => !s.done);
  return (
    <div>
      <div style={{ padding: "4px 18px 12px", fontSize: 13.5, color: "var(--text-muted)" }}>
        Pon en marcha el club: 4 pasos, en cualquier orden.
        <Progress value={25} style={{ marginTop: 10 }} />
      </div>
      {steps.map((s) => (
        <ListRow
          key={s.title}
          href={s.href}
          icon={
            <IconTile small mute={!s.done}>
              {s.done ? <IconCheckCircle size={14} /> : <span className="mono">·</span>}
            </IconTile>
          }
          title={s.title}
          sub={s.sub}
        />
      ))}
      <ListRow
        href="/club/torneos"
        icon={
          <IconTile small mute>
            <IconTrophy size={14} />
          </IconTile>
        }
        title="¿También organizas torneos?"
        sub="Gratis hasta 16 parejas. Para cobrar la inscripción online, conecta Stripe."
      />
      {next?.href && (
        <div className="card-foot">
          <BtnLink href={next.href} variant="accent">
            {next.title}
          </BtnLink>
        </div>
      )}
    </div>
  );
}
