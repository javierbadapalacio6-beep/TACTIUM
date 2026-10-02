"use client";

import Link from "next/link";
import { useState } from "react";

import {
  fetchCasualMatches,
  fetchFeed,
  fetchPublicProfile,
  followTarget,
  searchCommunity,
  toggleActivityKudos,
  unfollowTarget,
  type CommunityHit,
  type DbCasual,
  type FeedRow,
} from "@/lib/queries";
import {
  combineRecord,
  fetchMyLeagueStats,
  type RecordGame,
  type RecordSummary,
} from "@/lib/player-stats";
import { fetchPeopleYouKnow, profileHref, type PersonSuggestion } from "@/lib/people";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  Avatar,
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Field,
  InputWrap,
  ListRow,
  PageHeader,
  Segmented,
  Stat,
  StatRow,
} from "@/components/ui";
import { EmptyState, SkeletonCard, SkeletonPage, Toast } from "@/components/states";
import { BarList, Ring, WonLostBar } from "@/components/charts";
import { IconCheck, IconGlobe, IconPlus, IconSearch, IconUsers } from "@/components/Icon";

function initialsOf(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "··"
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

const TYPE_LABEL: Record<string, string> = {
  amistoso: "Amistoso",
  entreno: "Entreno",
  torneo: "Torneo",
};

/* ═══ FEED ════════════════════════════════════════════════════════ */
/**
 * Con `embedded`, la misma lista se pinta como bloque «Tu gente» dentro de
 * Inicio: sin cabecera de pantalla, las últimas `limit` y «Ver todo» a
 * `/novedades`. Kudos y estados vacíos son los mismos.
 */
export function Feed({ embedded = false, limit = 5 }: { embedded?: boolean; limit?: number } = {}) {
  const { user } = useSession();
  const { data, loading, error } = useAsync(() => fetchFeed(30), [user?.id], !!user);
  const all = data ?? [];
  const rows = embedded ? all.slice(0, limit) : all;

  // Kudos por resultado (clave kind·ref: un amistoso con dos jugadores a los
  // que sigues sale dos veces y comparte recuento). Optimista con rollback.
  const [kudos, setKudos] = useState<Record<string, { given: boolean; count: number }>>({});
  const [kudosBusy, setKudosBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const kudosKey = (n: FeedRow) => `${n.kind}-${n.ref_id}`;
  const kudosOf = (n: FeedRow) =>
    kudos[kudosKey(n)] ?? { given: n.i_gave_kudos, count: n.kudos_count };

  async function toggleKudos(n: FeedRow) {
    const k = kudosKey(n);
    if (kudosBusy) return;
    const prev = kudosOf(n);
    setKudosBusy(k);
    setKudos((m) => ({
      ...m,
      [k]: { given: !prev.given, count: Math.max(0, prev.count + (prev.given ? -1 : 1)) },
    }));
    const res = await toggleActivityKudos(n.kind, n.ref_id, n.kind === "casual" ? n.actor_id : null);
    setKudosBusy(null);
    if (res.ok) {
      setKudos((m) => ({ ...m, [k]: res.data }));
    } else {
      setKudos((m) => ({ ...m, [k]: prev })); // revertir
      setToast(res.blocked ? res.reason : "No se pudo dar kudos");
    }
  }

  if (loading) return embedded ? <SkeletonCard /> : <SkeletonPage />;

  // Con el feed vacío o casi (menos de 3 entradas), «Gente que conoces»: a
  // quién seguir para que el feed se llene. Igual que en la app.
  const suggest = !error && all.length < 3;

  const body = (
    <>
      {error ? (
        <Card>
          <EmptyState
            icon={<IconGlobe size={22} />}
            title="No se pudieron cargar las novedades"
            body={error}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconGlobe size={22} />}
            title="Aún no hay novedades"
            body="Aquí verás lo que hacen los jugadores y clubes a los que sigues. Empieza siguiendo a alguien."
            action={
              <BtnLink href="/comunidad" variant="accent" size="sm">
                Buscar en la comunidad
              </BtnLink>
            }
          />
        </Card>
      ) : (
        <Card flush>
          {embedded ? (
            <CardHead title="Actividad reciente">
              <Link href="/novedades" className="link-action">
                Ver todo
              </Link>
            </CardHead>
          ) : (
            <CardHead title="Actividad reciente" count={rows.length} />
          )}
          {rows.map((n) => (
            <ListRow
              key={`${n.kind}-${n.ref_id}-${n.actor_id ?? ""}`}
              icon={
                <Avatar
                  initials={initialsOf(n.actor_name ?? "?")}
                  src={n.avatar_url}
                  size={36}
                />
              }
              title={n.title}
              sub={
                <>
                  <span>
                    {n.kind === "casual" ? "Amistoso" : "Jornada"}
                    {n.occurred_on ? ` · ${formatDate(n.occurred_on)}` : ""}
                  </span>
                  {n.subtitle && (
                    <span
                      style={{
                        display: "block",
                        marginTop: 6,
                        padding: "10px 12px",
                        borderRadius: "var(--r-sm)",
                        background: "var(--bg-card-2)",
                        color: "var(--text-muted)",
                        fontSize: 12.5,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {n.subtitle}
                    </span>
                  )}
                  <KudosButton
                    state={kudosOf(n)}
                    // Sin kudos a uno mismo: en tu propio amistoso solo se ve el recuento.
                    own={n.kind === "casual" && !!user && n.actor_id === user.id}
                    busy={kudosBusy === kudosKey(n)}
                    onToggle={() => void toggleKudos(n)}
                  />
                </>
              }
              right={
                n.positive !== null ? (
                  <Chip tone={n.positive ? "accent" : "mute"}>
                    {n.positive ? "Victoria" : "Jugado"}
                  </Chip>
                ) : undefined
              }
              style={{ alignItems: "flex-start", paddingTop: 14, paddingBottom: 14 }}
            />
          ))}
        </Card>
      )}

      {suggest && <PeopleYouKnow showSearch={all.length > 0} />}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </>
  );

  if (embedded) return body;

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title="Novedades"
        lede="Lo que hacen los jugadores y los clubes a los que sigues."
        actions={
          <BtnLink href="/comunidad" icon={<IconSearch size={15} />}>
            Buscar en la comunidad
          </BtnLink>
        }
      />
      {body}
    </div>
  );
}

/* ═══ GENTE QUE CONOCES ══════════════════════════════════════════ */
/**
 * Compañeros de tus equipos y miembros de tus clubes con cuenta, a los que aún
 * no sigues (máx. 8), en una fila deslizable con «Seguir». Sin nadie que
 * sugerir no se pinta: es un extra del feed, nunca un estado de error.
 */
export function PeopleYouKnow({ showSearch = false }: { showSearch?: boolean }) {
  const { user, teams, clubs } = useSession();
  const teamIds = teams.map((t) => t.id);
  const clubIds = clubs.map((c) => c.id);
  const { data } = useAsync<PersonSuggestion[]>(
    () => fetchPeopleYouKnow(user!.id, teamIds, clubIds, 8).catch(() => []),
    [user?.id, teamIds.join(","), clubIds.join(",")],
    !!user
  );
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const people = data ?? [];
  if (people.length === 0) return null;

  async function follow(p: PersonSuggestion) {
    if (busy) return;
    const now = following[p.id] ?? p.following;
    setBusy(p.id);
    setFollowing((f) => ({ ...f, [p.id]: !now })); // optimista
    const res = await guardedWrite(now ? "dejar de seguir" : "seguir", async () => {
      try {
        if (now) await unfollowTarget("user", p.id);
        else await followTarget("user", p.id);
      } catch (e) {
        // Ya le seguías (clave duplicada): cuenta como hecho.
        const code = (e as { code?: string } | null)?.code;
        if (!now && code === "23505") return;
        throw e;
      }
    });
    setBusy(null);
    if (!res.ok) {
      setFollowing((f) => ({ ...f, [p.id]: now })); // revertir
      setToast(res.reason);
    }
  }

  return (
    <Card flush style={{ marginTop: 16 }}>
      <CardHead title="Gente que conoces" sub="De tus equipos y tus clubes">
        {showSearch && (
          <Link href="/comunidad" className="link-action">
            Buscar gente
          </Link>
        )}
      </CardHead>
      <div
        className="card-body"
        style={{
          display: "grid",
          gridAutoFlow: "column",
          gridAutoColumns: "156px",
          gap: 12,
          overflowX: "auto",
          overscrollBehaviorX: "contain",
          scrollSnapType: "x proximity",
          paddingBottom: 16,
        }}
      >
        {people.map((p) => {
          const on = following[p.id] ?? p.following;
          return (
            <div
              key={p.id}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
                padding: "16px 12px 12px",
                borderRadius: "var(--r-md)",
                background: "var(--bg-card-2)",
                border: "1px solid var(--line)",
                textAlign: "center",
                minWidth: 0,
                scrollSnapAlign: "start",
              }}
            >
              <Link
                href={profileHref(p.id)}
                style={{
                  color: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  minWidth: 0,
                }}
              >
                <Avatar initials={initialsOf(p.name)} src={p.avatarUrl} size={48} />
                <span
                  className="truncate"
                  title={p.name}
                  style={{ display: "block", maxWidth: "100%", fontSize: 13.5, fontWeight: 700 }}
                >
                  {p.name}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -4 }}>
                  {p.source === "team" ? "Tu equipo" : "Tu club"}
                </span>
              </Link>
              <Btn
                size="sm"
                block
                variant={on ? "ghost" : "tint"}
                disabled={busy === p.id}
                aria-pressed={on}
                aria-label={on ? `Dejar de seguir a ${p.name}` : `Seguir a ${p.name}`}
                icon={on ? <IconCheck size={14} /> : undefined}
                onClick={() => void follow(p)}
              >
                {on ? "Siguiendo" : "Seguir"}
              </Btn>
            </div>
          );
        })}
      </div>
      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </Card>
  );
}

/** «👏 Kudos · N» (ya diste el tuyo) / «👏 Dar kudos · N». */
function KudosButton({
  state,
  own,
  busy,
  onToggle,
}: {
  state: { given: boolean; count: number };
  own: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  if (own) {
    // En tu propio resultado solo se ve el recuento, y solo si hay alguno.
    if (state.count <= 0) return null;
    return (
      <span
        style={{ display: "block", marginTop: 8, fontSize: 12.5, color: "var(--text-muted)" }}
        aria-label={`${state.count} kudos`}
      >
        👏 Kudos · <span className="mono">{state.count}</span>
      </span>
    );
  }
  return (
    <span style={{ display: "block", marginTop: 8 }}>
      <Btn
        size="sm"
        variant={state.given ? "tint" : "quiet"}
        aria-pressed={state.given}
        disabled={busy}
        onClick={onToggle}
      >
        {state.given ? "👏 Kudos · " : "👏 Dar kudos · "}
        <span className="mono">{state.count}</span>
      </Btn>
    </span>
  );
}

/* ═══ BUSCAR EN LA COMUNIDAD ══════════════════════════════════════ */
type CommunityFilter = "todos" | "user" | "club";

export function Community() {
  const { user } = useSession();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CommunityFilter>("todos");
  const { data, loading, error } = useAsync(
    () => searchCommunity(query),
    [query],
    query.trim().length >= 2
  );
  const hits = data ?? [];
  const people = hits.filter((h) => h.type === "user");
  const clubs = hits.filter((h) => h.type === "club");

  // Estado local de seguimiento (sobre lo que devuelve la búsqueda) para pintar
  // optimista sin recargar. `busy` bloquea el botón mientras escribe.
  const [follow, setFollow] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function toggleFollow(h: CommunityHit) {
    if (busy) return;
    // Un anónimo no puede seguir: en vez de un no-op confuso, se le invita a
    // entrar (vuelve a la comunidad tras el login).
    if (!user) {
      window.location.href = "/entrar?next=/comunidad";
      return;
    }
    const now = follow[h.id] ?? h.is_following;
    setBusy(h.id);
    setFollow((f) => ({ ...f, [h.id]: !now })); // optimista
    const res = await guardedWrite(now ? "dejar de seguir" : "seguir", () =>
      now ? unfollowTarget(h.type, h.id) : followTarget(h.type, h.id),
    );
    setBusy(null);
    if (!res.ok) {
      setFollow((f) => ({ ...f, [h.id]: now })); // revertir
      setToast(res.reason);
    }
  }

  const sections = [
    { key: "user" as const, title: "Jugadores", rows: people },
    { key: "club" as const, title: "Clubes", rows: clubs },
  ].filter((s) => s.rows.length > 0 && (filter === "todos" || filter === s.key));

  return (
    <div className="tw-page">
      <PageHeader
        title="Comunidad"
        lede="Busca jugadores y clubes, y sigue a los que quieras tener a la vista."
      />

      <div className="tw-toolbar">
        <Field hint="Escribe al menos dos letras">
          <InputWrap icon={<IconSearch size={15} />}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca jugadores o clubes"
              aria-label="Buscar en la comunidad"
            />
          </InputWrap>
        </Field>
        <Segmented
          label="Tipo de resultado"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "todos", label: "Todos" },
            { value: "user", label: "Jugadores" },
            { value: "club", label: "Clubes" },
          ]}
        />
        <span className="tw-toolbar-spacer" />
        {query.trim().length >= 2 && !loading && !error && (
          <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
            {hits.length} {hits.length === 1 ? "resultado" : "resultados"}
          </span>
        )}
      </div>

      {query.trim().length < 2 ? (
        <Card>
          <EmptyState
            icon={<IconSearch size={22} />}
            title="Escribe para buscar"
            body="Busca por nombre de usuario, nombre real o nombre de club."
          />
        </Card>
      ) : loading ? (
        <SkeletonCard />
      ) : error ? (
        <Card>
          <EmptyState icon={<IconUsers size={22} />} title="Error en la búsqueda" body={error} />
        </Card>
      ) : sections.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Sin resultados"
            body="Prueba con otro nombre o cambia el filtro."
          />
        </Card>
      ) : (
        sections.map((s, si) => (
          <Card key={s.key} flush style={si > 0 ? { marginTop: 16 } : undefined}>
            <CardHead title={s.title} count={s.rows.length} />
            {s.rows.map((h) => {
              const on = follow[h.id] ?? h.is_following;
              return (
                <ListRow
                  key={h.id}
                  icon={<Avatar initials={initialsOf(h.name)} src={h.avatar_url} size={36} />}
                  // Los jugadores tienen perfil público (`/u/:id`); los clubes
                  // aún no, así que su nombre no enlaza (evita el enlace muerto).
                  title={
                    h.type === "user" ? (
                      <Link href={`/u/${h.id}`} style={{ color: "inherit" }}>
                        {h.name}
                      </Link>
                    ) : (
                      h.name
                    )
                  }
                  sub={`${h.subtitle ?? (h.type === "club" ? "Club" : "Jugador")} · ${
                    h.followers_count
                  } ${h.followers_count === 1 ? "seguidor" : "seguidores"}`}
                  right={
                    <Btn
                      size="sm"
                      variant={on ? "ghost" : "accent"}
                      disabled={busy === h.id}
                      onClick={() => void toggleFollow(h)}
                    >
                      {on ? "Siguiendo" : "Seguir"}
                    </Btn>
                  }
                />
              );
            })}
          </Card>
        ))
      )}

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ═══ PERFIL PÚBLICO ══════════════════════════════════════════════ */
export function PublicProfileView({ username }: { username: string }) {
  // La RPC recibe el id del usuario; el buscador enlaza con ese id.
  const { data, loading, error } = useAsync(
    () => fetchPublicProfile(username),
    [username],
    true
  );

  if (loading) return <SkeletonPage />;
  if (error || !data) {
    return (
      <div className="tw-page-narrow">
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Perfil no disponible"
            body={error ?? "Puede que el perfil no exista o no sea público."}
          />
        </Card>
      </div>
    );
  }

  const p = data as Record<string, unknown>;
  const name = (p.full_name as string) ?? (p.username as string) ?? "Jugador";
  // `get_public_user_profile` trae los amistosos como casual_played/casual_won
  // (los matches_* antiguos no existen: se dejan de reserva).
  const played = Number(p.casual_played ?? p.matches_played ?? 0);
  const won = Number(p.casual_won ?? p.matches_won ?? 0);
  const rate = played ? Math.round((won / played) * 100) : null;

  return (
    <div className="tw-page-narrow">
      <PageHeader
        title={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12 }}>
            <Avatar initials={initialsOf(name)} src={p.avatar_url as string | null} size={44} />
            {name}
          </span>
        }
        meta={[
          (p.username as string) ? `@${p.username as string}` : null,
          (p.home_club as string) ?? null,
        ].filter(Boolean) as string[]}
      />

      <StatRow>
        <Stat label="Seguidores" value={Number(p.followers_count ?? 0)} />
        <Stat label="Siguiendo" value={Number(p.following_count ?? 0)} />
        <Stat label="Partidos jugados" value={played} />
      </StatRow>

      {played > 0 && (
        <div style={{ marginTop: 16 }}>
          {/* Solo datos públicos: amistosos. La liga es privada del equipo. */}
          <RecordBlock
            record={{
              played,
              won,
              lost: Math.max(0, played - won),
              winRate: rate,
              partners: [],
              bestPartner: null,
              currentStreak: 0,
              bestStreak: 0,
              lastFive: [],
            }}
            title="Récord · amistosos"
          />
        </div>
      )}
      {p.level_display ? (
        <StatRow style={{ marginTop: played > 0 ? 0 : 16 }}>
          <Stat label="Nivel" value={String(p.level_display)} />
        </StatRow>
      ) : null}
    </div>
  );
}

/* ═══ RÉCORD (perfil y /stats) ════════════════════════════════════ */
/** Victorias · Derrotas · % ganados, racha con los últimos 5 y mejor pareja. */
function RecordBlock({
  record,
  sub,
  title,
}: {
  record: RecordSummary;
  sub?: string;
  title?: string;
}) {
  // Sin partidos decididos no hay récord que enseñar.
  if (record.played <= 0) return null;
  const streak = record.currentStreak;
  const showStreak = record.lastFive.length > 0;
  const bp = record.bestPartner;
  return (
    <section aria-label={title ?? "Récord"} style={{ marginBottom: 16 }}>
      {title && (
        <div style={{ fontSize: 15, fontWeight: 700, margin: "0 0 10px" }}>{title}</div>
      )}
      <StatRow>
        <Stat label="Victorias" value={record.won} tone="accent" sub={sub} />
        <Stat label="Derrotas" value={record.lost} />
        <Stat label="Ganados" value={record.winRate ?? "—"} unit={record.winRate !== null ? "%" : undefined} />
      </StatRow>

      {(showStreak || bp) && (
        <div className="tw-club-grid" style={{ marginTop: 16 }}>
          {showStreak && (
            <Card>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                <span style={{ fontSize: 14 }}>
                  {streak > 0 ? (
                    <>
                      🔥 Racha: <b>{streak} {streak === 1 ? "victoria" : "victorias"}</b>
                    </>
                  ) : (
                    "Últimos partidos"
                  )}
                </span>
                {record.lastFive.length > 0 && (
                  <span
                    style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
                    aria-label={`Últimos ${record.lastFive.length}: ${record.lastFive
                      .map((r) => (r === "W" ? "victoria" : "derrota"))
                      .join(", ")}`}
                  >
                    {record.lastFive.map((r, i) => (
                      <span
                        key={i}
                        title={r === "W" ? "Victoria" : "Derrota"}
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: r === "W" ? "var(--accent)" : "var(--error)",
                        }}
                      />
                    ))}
                  </span>
                )}
              </div>
            </Card>
          )}
          {bp && (
            <Card>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Mejor pareja</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{bp.name}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                <span className="mono">{bp.won}</span> de <span className="mono">{bp.played}</span>{" "}
                juntos · <span className="mono">{Math.round((bp.won / bp.played) * 100)} %</span>
                {bp.court != null && (
                  <>
                    {" "}· pista <span className="mono">{bp.court}</span>
                  </>
                )}
              </div>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}

/* ═══ MIS ESTADÍSTICAS ════════════════════════════════════════════ */
/** Lado en el que jugó `uid` (0/1), o null si no figura con su cuenta. */
function sideOf(m: DbCasual, uid: string | undefined): 0 | 1 | null {
  if (!uid) return null;
  if (m.userIdsA.includes(uid)) return 0;
  if (m.userIdsB.includes(uid)) return 1;
  return null;
}

/** Amistosos decididos en los que juega `uid`, como partidos del récord. */
function casualRecordGames(matches: DbCasual[], uid: string | undefined): RecordGame[] {
  const out: RecordGame[] = [];
  for (const m of matches) {
    const side = sideOf(m, uid);
    if (side === null || m.winnerSide === null) continue;
    const names = side === 0 ? m.sideA : m.sideB;
    const ids = side === 0 ? m.userIdsA : m.userIdsB;
    const i = ids.findIndex((id, idx) => id !== uid && !!names[idx]);
    const partnerName = i >= 0 ? names[i] : null;
    out.push({
      sortKey: `${m.playedOn ?? "9999"}·c`,
      won: m.winnerSide === side,
      // Como en la app: los compañeros de amistosos se agrupan por nombre.
      partnerKey: partnerName ? `n:${partnerName.trim().toLowerCase()}` : null,
      partnerName,
    });
  }
  return out;
}

export function MyStats() {
  const { user } = useSession();
  const { data, loading, error } = useAsync(
    async () => {
      const [matches, league] = await Promise.all([
        fetchCasualMatches(100),
        // La liga no debe tumbar la pantalla: sin ella, récord solo de amistosos.
        fetchMyLeagueStats(user!.id).catch(() => null),
      ]);
      return { matches, league };
    },
    [user?.id],
    !!user
  );
  const matches: DbCasual[] = data?.matches ?? [];
  const league = data?.league ?? null;

  if (loading) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="No se pudieron cargar tus partidos"
            body={error}
          />
        </Card>
      </div>
    );
  }

  // El usuario NO siempre es el lado 0 (si le apuntó otro, puede ir en el 1):
  // su lado sale de su user_id en los participantes. Los partidos en los que
  // no figura con su cuenta no cuentan para victorias ni derrotas.
  const uid = user?.id;
  const casualGames = casualRecordGames(matches, uid);
  const won = casualGames.filter((g) => g.won).length;
  const lost = casualGames.length - won;
  const played = casualGames;
  const rate = played.length ? Math.round((won / played.length) * 100) : 0;
  const record = combineRecord(league?.games ?? [], casualGames);

  const byType = ["amistoso", "entreno", "torneo"].map((t) => ({
    label: t.charAt(0).toUpperCase() + t.slice(1),
    value: matches.filter((m) => m.type === t).length,
  }));

  // Con quién más se ha jugado: los compañeros de tu lado, sin contarte a ti.
  const mateCount = new Map<string, number>();
  for (const m of matches) {
    const side = sideOf(m, uid) ?? 0;
    const names = side === 0 ? m.sideA : m.sideB;
    const ids = side === 0 ? m.userIdsA : m.userIdsB;
    names.forEach((n, i) => {
      if (ids[i] && ids[i] === uid) return;
      mateCount.set(n, (mateCount.get(n) ?? 0) + 1);
    });
  }
  const mates = [...mateCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, value]) => ({ label, value }));

  const photos = matches.filter((m) => m.photoUrl);

  return (
    <div className="tw-page">
      <PageHeader
        title="Mis estadísticas"
        lede="Tus partidos, con quién los juegas y cómo se te dan."
        meta={[`${matches.length} ${matches.length === 1 ? "partido" : "partidos"}`]}
        actions={
          <BtnLink href="/amistosos/nuevo" variant="accent" icon={<IconPlus size={15} />}>
            Registrar amistoso
          </BtnLink>
        }
      />

      {record.played > 0 && (
        <RecordBlock
          record={record}
          sub={
            league && league.played > 0
              ? `Liga y amistosos · ${league.played} de liga y ${casualGames.length} amistosos`
              : "Amistosos con resultado"
          }
        />
      )}

      {matches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title={record.played > 0 ? "Sin amistosos todavía" : "Sin partidos todavía"}
            body="Registra tu primer amistoso y empieza a acumular números."
            action={
              <BtnLink href="/amistosos/nuevo" variant="accent" size="sm">
                Registrar un amistoso
              </BtnLink>
            }
          />
        </Card>
      ) : (
        <>
          <StatRow style={{ marginBottom: 16 }}>
            <Stat label="Partidos" value={matches.length} />
            <Stat label="Con resultado" value={played.length} />
            <Stat
              label="Amistosos"
              value={matches.filter((m) => m.type === "amistoso").length}
            />
            <Stat
              label="Entrenos"
              value={matches.filter((m) => m.type === "entreno").length}
            />
          </StatRow>

          <div className="tw-club-grid">
            <Card flush>
              <CardHead title="Victorias en amistosos" />
              <div className="card-body">
                <Ring value={rate} label="de victorias" />
              </div>
            </Card>

            <Card flush>
              <CardHead title="Resultados" sub={`${played.length} partidos con resultado`} />
              <div className="card-body">
                <WonLostBar won={won} lost={lost} />
              </div>
            </Card>
          </div>

          <div className="tw-club-grid" style={{ marginTop: 16 }}>
            {mates.length > 0 && (
              <Card flush>
                <CardHead
                  title="Con quién juegas"
                  sub="Nombres que más aparecen en tu lado"
                />
                <div className="card-body">
                  <BarList data={mates} valueLabel="partidos" />
                </div>
              </Card>
            )}

            <Card flush>
              <CardHead title="Por tipo" sub="Reparto de tus partidos" />
              <div className="card-body">
                <BarList data={byType} valueLabel="partidos" />
              </div>
            </Card>
          </div>

          <Card flush style={{ marginTop: 16 }}>
            <CardHead title="Últimos partidos" count={matches.length} />
            {matches.slice(0, 8).map((c) => {
              // Tu lado y el marcador desde tu lado (los sets se guardan [lado 0, lado 1]).
              const mine = sideOf(c, uid) === 1;
              return (
                <ListRow
                  key={c.id}
                  href={`/amistosos/${c.id}`}
                  title={(mine ? c.sideB : c.sideA).join(" · ") || "—"}
                  sub={`${TYPE_LABEL[c.type] ?? c.type}${
                    c.playedOn ? ` · ${formatDate(c.playedOn)}` : ""
                  }`}
                  right={
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                      {c.sets.map(([a, b]) => (mine ? `${b}-${a}` : `${a}-${b}`)).join(" ")}
                    </span>
                  }
                />
              );
            })}
          </Card>

          {photos.length > 0 && (
            <Card flush style={{ marginTop: 16 }}>
              <CardHead title="Fotos de tus partidos" count={photos.length} />
              <div className="card-body">
                <div className="tw-photo-grid">
                  {photos.slice(0, 12).map((c) => (
                    <Link
                      key={c.id}
                      href={`/amistosos/${c.id}`}
                      aria-label={`Ver el partido del ${formatDate(c.playedOn)}`}
                      style={{
                        display: "block",
                        aspectRatio: "1 / 1",
                        borderRadius: "var(--r-md)",
                        border: "1px solid var(--line)",
                        backgroundImage: `url(${c.photoUrl})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    />
                  ))}
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
