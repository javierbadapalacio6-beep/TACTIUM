"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";

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
  summarize,
  type PlayerLeagueStats,
  type RecordGame,
  type RecordSummary,
} from "@/lib/player-stats";
import { fetchTeamRanking } from "@/lib/account-queries";
import { supabaseBrowser } from "@/lib/supabase/client";
import { CodeRedeem } from "@/components/settings/CodeRedeem";
import { PairStats } from "@/components/team/PairStats";
import { fetchPeopleYouKnow, profileHref, type PersonSuggestion } from "@/lib/people";
import { useSession } from "@/lib/session";
import { whatsappShareUrl } from "@/lib/invite";
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
const FEED_PAGE = 20;

/**
 * Fotos de los resultados del feed. Los amistosos públicos se leen directo
 * (`casual_matches` tiene lectura pública); las jornadas, por la RPC
 * `public_get_matchday`, que es la que sirve el detalle `/partido/[id]`.
 */
async function fetchFeedPhotos(rows: FeedRow[]): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const sb = supabaseBrowser();
  const casualIds = [...new Set(rows.filter((r) => r.kind === "casual").map((r) => r.ref_id))];
  const leagueIds = [...new Set(rows.filter((r) => r.kind === "league").map((r) => r.ref_id))];
  await Promise.all([
    casualIds.length
      ? sb
          .from("casual_matches")
          .select("id, photo_url")
          .in("id", casualIds)
          .then(({ data }) => {
            for (const r of (data ?? []) as { id: string; photo_url: string | null }[]) {
              if (r.photo_url) out[`casual-${r.id}`] = r.photo_url;
            }
          })
      : null,
    ...leagueIds.map((id) =>
      sb.rpc("public_get_matchday", { p_id: id }).then(({ data }) => {
        const url = ((data ?? []) as { photo_url: string | null }[])[0]?.photo_url;
        if (url) out[`league-${id}`] = url;
      }),
    ),
  ]);
  return out;
}

/** Dónde se ve el resultado entero. */
const feedHref = (n: FeedRow) => (n.kind === "casual" ? `/amistosos/${n.ref_id}` : `/partido/${n.ref_id}`);

export function Feed({ embedded = false, limit = 5 }: { embedded?: boolean; limit?: number } = {}) {
  const { user } = useSession();
  // La RPC `social_feed` solo acepta un tope: «Ver más» lo sube de 20 en 20.
  const [pageLimit, setPageLimit] = useState(embedded ? Math.max(limit, 10) : FEED_PAGE);
  const { data, loading, error } = useAsync(() => fetchFeed(pageLimit), [user?.id, pageLimit], !!user);
  const all = data ?? [];
  const rows = embedded ? all.slice(0, limit) : all;
  const hasMore = !embedded && all.length >= pageLimit;
  const photoKey = rows.map((r) => `${r.kind}-${r.ref_id}`).join(",");
  const photos = useAsync<Record<string, string>>(
    () => fetchFeedPhotos(rows).catch(() => ({})),
    [photoKey],
    rows.length > 0,
  );

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

  // «Ver más» recarga con más filas: se mantiene lo que ya se ve.
  if (loading && !data) return embedded ? <SkeletonCard /> : <SkeletonPage />;

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
            <FeedItem
              key={`${n.kind}-${n.ref_id}-${n.actor_id ?? ""}`}
              n={n}
              photo={photos.data?.[`${n.kind}-${n.ref_id}`] ?? null}
              kudos={
                <KudosButton
                  state={kudosOf(n)}
                  // Sin kudos a uno mismo: en tu propio amistoso solo se ve el recuento.
                  own={n.kind === "casual" && !!user && n.actor_id === user.id}
                  busy={kudosBusy === kudosKey(n)}
                  onToggle={() => void toggleKudos(n)}
                />
              }
            />
          ))}
          {hasMore && (
            <div className="card-foot" style={{ justifyContent: "center" }}>
              <Btn
                size="sm"
                disabled={loading}
                onClick={() => setPageLimit((l) => l + FEED_PAGE)}
              >
                {loading ? "Cargando…" : "Ver más"}
              </Btn>
            </div>
          )}
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
/**
 * Una entrada del feed. El avatar y el nombre llevan al perfil de quien
 * jugó; el resultado, al detalle del partido. No es un enlace entero porque
 * dentro hay otros controles (kudos).
 */
function FeedItem({
  n,
  photo,
  kudos,
}: {
  n: FeedRow;
  photo: string | null;
  kudos: ReactNode;
}) {
  // En amistosos el actor es un usuario con perfil público; en jornadas es
  // el club, que no tiene ficha propia en la web.
  const profile = n.kind === "casual" && n.actor_id ? profileHref(n.actor_id) : null;
  const name = n.actor_name ?? "";
  const rest = name && n.title.startsWith(name) ? n.title.slice(name.length) : null;
  const avatar = <Avatar initials={initialsOf(name || "?")} src={n.avatar_url} size={36} />;

  return (
    <div className="list-row" style={{ alignItems: "flex-start", paddingTop: 14, paddingBottom: 14 }}>
      {profile ? (
        <Link href={profile} aria-label={`Perfil de ${name}`} style={{ flex: "none" }}>
          {avatar}
        </Link>
      ) : (
        avatar
      )}
      <span className="list-row-main">
        <span className="list-row-title" style={{ fontWeight: 600 }}>
          {profile && rest !== null ? (
            <>
              <Link href={profile} style={{ color: "inherit", fontWeight: 700 }}>
                {name}
              </Link>
              <Link href={feedHref(n)} style={{ color: "inherit" }}>
                {rest}
              </Link>
            </>
          ) : (
            <Link href={feedHref(n)} style={{ color: "inherit", fontWeight: 700 }}>
              {n.title}
            </Link>
          )}
        </span>
        <span className="list-row-sub">
          {n.kind === "casual" ? "Amistoso" : "Jornada"}
          {n.occurred_on ? ` · ${formatDate(n.occurred_on)}` : ""}
        </span>
        {n.subtitle && (
          <Link
            href={feedHref(n)}
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
          </Link>
        )}
        {kudos}
      </span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8, flex: "none" }}>
        {n.positive !== null && (
          <Chip tone={n.positive ? "accent" : "mute"}>{n.positive ? "Victoria" : "Jugado"}</Chip>
        )}
        {photo && (
          <Link href={feedHref(n)} aria-label="Ver la foto del partido">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo}
              alt=""
              loading="lazy"
              style={{
                display: "block",
                width: 64,
                height: 64,
                objectFit: "cover",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--line)",
              }}
            />
          </Link>
        )}
      </span>
    </div>
  );
}

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
const INVITE_TEXT =
  "Te espero en TACTIUM para seguirnos y apuntar los partidos 🎾\nhttps://tactium.io";
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
        // Nunca en blanco: antes de escribir, la gente que conoces (tu
        // equipo y tu club) con «Seguir» en cada tarjeta.
        <>
          {user && filter !== "club" && <PeopleYouKnow />}
          <Card style={{ marginTop: 16 }}>
            <EmptyState
              compact
              icon={<IconSearch size={22} />}
              title="Busca a tu gente"
              body="Por nombre de usuario, nombre real o nombre de club. Si aún no está, invítale."
              action={
                <BtnLink href={whatsappShareUrl(INVITE_TEXT)} size="sm" target="_blank" rel="noopener noreferrer">
                  Invitar por WhatsApp
                </BtnLink>
              }
            />
          </Card>
        </>
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
            title="¿No está?"
            body="Pásale un enlace y, cuando entre, os seguís."
            action={
              <BtnLink href={whatsappShareUrl(INVITE_TEXT)} size="sm" variant="accent" target="_blank" rel="noopener noreferrer">
                Invitar por WhatsApp
              </BtnLink>
            }
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

  return <PublicProfileBody data={data as Record<string, unknown>} />;
}

/** Perfil público: Seguir a lo ancho con Compartir, números, récord de
 *  amistosos, equipos y fotos (mismo orden que la app). */
function PublicProfileBody({ data: p }: { data: Record<string, unknown> }) {
  const { user } = useSession();
  const id = String(p.id ?? "");
  const name = (p.full_name as string) ?? (p.username as string) ?? "Jugador";
  // `get_public_user_profile` trae los amistosos como casual_played/casual_won.
  const played = Number(p.casual_played ?? p.matches_played ?? 0);
  const won = Number(p.casual_won ?? p.matches_won ?? 0);
  const rate = played ? Math.round((won / played) * 100) : null;
  const isMe = Boolean(p.is_me) || (!!user && user.id === id);
  const [following, setFollowing] = useState(Boolean(p.is_following));
  const [followers, setFollowers] = useState(Number(p.followers_count ?? 0));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const teams = (Array.isArray(p.teams) ? p.teams : []) as { name: string; role: string }[];
  const photos = (Array.isArray(p.photos) ? p.photos : []) as {
    match_id?: string;
    photo_url: string;
    played_on: string | null;
  }[];

  async function toggle() {
    if (busy) return;
    if (!user) {
      window.location.href = `/entrar?next=${encodeURIComponent(window.location.pathname)}`;
      return;
    }
    const now = following;
    setBusy(true);
    setFollowing(!now);
    setFollowers((n) => Math.max(0, n + (now ? -1 : 1)));
    const res = await guardedWrite(now ? "dejar de seguir" : "seguir", () =>
      now ? unfollowTarget("user", id) : followTarget("user", id),
    );
    setBusy(false);
    if (!res.ok) {
      setFollowing(now);
      setFollowers((n) => Math.max(0, n + (now ? 1 : -1)));
      setToast(res.reason);
    }
  }

  async function share() {
    const url = `https://tactium.io/u/${(p.username as string) || id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${name} en TACTIUM`, url });
      else {
        await navigator.clipboard.writeText(url);
        setToast("Enlace copiado");
      }
    } catch {
      /* cancelado */
    }
  }

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
          p.level_display ? `Nivel ${String(p.level_display)}` : null,
        ].filter(Boolean) as string[]}
      />
      {p.bio ? (
        <p style={{ margin: "-4px 0 16px", fontSize: 14 }}>{String(p.bio)}</p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 8, marginBottom: 16 }}>
        {isMe ? (
          <BtnLink href="/ajustes/perfil#editar-perfil" block>
            Editar perfil
          </BtnLink>
        ) : (
          <Btn
            block
            variant={following ? "ghost" : "accent"}
            aria-pressed={following}
            disabled={busy}
            icon={following ? <IconCheck size={15} /> : undefined}
            onClick={() => void toggle()}
          >
            {following ? "Siguiendo" : "Seguir"}
          </Btn>
        )}
        <Btn onClick={() => void share()}>Compartir</Btn>
      </div>

      <StatRow>
        <Stat label="Seguidores" value={followers} />
        <Stat label="Siguiendo" value={Number(p.following_count ?? 0)} />
        <Stat label="Amistosos" value={played} />
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

      {teams.length > 0 && (
        <Card flush style={{ marginTop: 16 }}>
          <CardHead title="Equipos" count={teams.length} />
          {teams.map((t, i) => (
            <ListRow
              key={`${t.name}-${i}`}
              icon={<span className="tile-icon"><IconUsers size={16} /></span>}
              title={t.name}
              sub={t.role === "captain" || t.role === "admin" ? "Capitán" : "Jugador"}
            />
          ))}
        </Card>
      )}

      {photos.length > 0 && (
        <Card flush style={{ marginTop: 16 }}>
          <CardHead title="Fotos de partidos" count={photos.length} />
          <div className="card-body">
            <div className="tw-photo-grid">
              {photos.slice(0, 12).map((ph, i) =>
                ph.match_id ? (
                  <Link
                    key={ph.match_id}
                    href={`/amistosos/${ph.match_id}`}
                    aria-label="Ver el partido"
                    style={{
                      display: "block",
                      aspectRatio: "1 / 1",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--line)",
                      backgroundImage: `url(${ph.photo_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ) : (
                  <span
                    key={`${ph.photo_url}-${i}`}
                    style={{
                      display: "block",
                      aspectRatio: "1 / 1",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--line)",
                      backgroundImage: `url(${ph.photo_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                ),
              )}
            </div>
          </div>
        </Card>
      )}
      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

/* ═══ RÉCORD (perfil y /stats) ════════════════════════════════════ */
/** Victorias · Derrotas · % ganados, racha con los últimos 5 y mejor pareja. */
export function RecordBlock({
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
export function casualRecordGames(matches: DbCasual[], uid: string | undefined): RecordGame[] {
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

/**
 * Mis números: una sola barra «Liga · Amistosos · Plantilla» (como en la
 * app). Liga lleva el récord, las pistas y «Por pareja»; Amistosos, lo de
 * siempre y el campo para canjear un código de partido; Plantilla, el
 * ranking interno con tu fila resaltada.
 */
export function MyStats() {
  const { user, activeTeam } = useSession();
  const [tab, setTab] = useState<"liga" | "amistosos" | "plantilla">(
    activeTeam ? "liga" : "amistosos",
  );
  const [reload, setReload] = useState(0);
  const { data, loading, error } = useAsync(
    async () => {
      const [matches, league] = await Promise.all([
        fetchCasualMatches(100),
        // La liga no debe tumbar la pantalla: sin ella, récord solo de amistosos.
        fetchMyLeagueStats(user!.id).catch(() => null),
      ]);
      return { matches, league };
    },
    [user?.id, reload],
    !!user
  );
  const matches: DbCasual[] = data?.matches ?? [];
  const league = data?.league ?? null;
  const showTabs = !!activeTeam;
  const current = showTabs ? tab : "amistosos";

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
  const record = combineRecord([], casualGames);

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
        title="Mis números"
        lede="Tu récord, con quién juegas y cómo se te da."
        actions={
          <BtnLink href="/amistosos/nuevo" variant="accent" icon={<IconPlus size={15} />}>
            Registrar amistoso
          </BtnLink>
        }
      />

      {showTabs && (
        <Segmented
          label="Qué números ver"
          value={tab}
          onChange={setTab}
          style={{ marginBottom: 16 }}
          options={[
            { value: "liga", label: "Liga" },
            { value: "amistosos", label: "Amistosos" },
            { value: "plantilla", label: "Plantilla" },
          ]}
        />
      )}

      {current === "liga" ? (
        <LeagueTab league={league} />
      ) : current === "plantilla" ? (
        <SquadTab teamId={activeTeam!.id} />
      ) : (
      <>
      {record.played > 0 && (
        <RecordBlock record={record} sub="Amistosos con resultado" />
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

      <div style={{ marginTop: 16 }}>
        <CodeRedeem mode="casual" onClaimed={() => setReload((k) => k + 1)} />
      </div>
      </>
      )}
    </div>
  );
}

/* ── Mis números › Liga ─────────────────────────────────────────── */
function LeagueTab({ league }: { league: PlayerLeagueStats | null }) {
  if (!league || league.played === 0) {
    return (
      <>
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Sin partidos de liga todavía"
            body="Cuando juegues jornadas con alineación y resultado, tus números aparecerán aquí solos."
          />
        </Card>
        <div style={{ marginTop: 16 }}>
          <PairStats />
        </div>
      </>
    );
  }
  const streak = league.currentStreak;
  return (
    <>
      <RecordBlock record={summarize(league.games)} sub="Liga · todas tus temporadas" />
      <StatRow style={{ marginBottom: 16 }}>
        <Stat label="Partidos" value={league.played} />
        <Stat label="Sets" value={`${league.setsWon}–${league.setsLost}`} />
        <Stat
          label="Racha"
          value={streak === 0 ? "—" : streak > 0 ? `${streak}V` : `${Math.abs(streak)}D`}
          tone={streak >= 3 ? "accent" : undefined}
        />
        <Stat label="Mejor racha" value={league.bestStreak > 0 ? `${league.bestStreak}V` : "—"} />
      </StatRow>
      {league.byCourt.length > 0 && (
        <Card flush style={{ marginBottom: 16 }}>
          <CardHead title="Por pista" sub="Victorias sobre partidos en cada pista" />
          <div className="card-body">
            <BarList
              data={league.byCourt.map((c) => ({ label: `Pista ${c.court}`, value: c.won }))}
              valueLabel="victorias"
            />
          </div>
        </Card>
      )}
      <PairStats />
    </>
  );
}

/* ── Mis números › Plantilla ────────────────────────────────────── */
const RANK_TOP = 6;
function SquadTab({ teamId }: { teamId: string }) {
  const { user } = useSession();
  const { data, loading, error } = useAsync(() => fetchTeamRanking(teamId), [teamId]);
  if (loading) return <SkeletonCard />;
  const rows = data ?? [];
  if (error || rows.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconUsers size={22} />}
          title="Sin partidos todavía"
          body="El ranking de la plantilla se llena solo con las jornadas de liga que tengan alineación y resultado."
        />
      </Card>
    );
  }
  const myIdx = rows.findIndex((r) => r.userId && r.userId === user?.id);
  const shown = rows.slice(0, RANK_TOP).map((r, i) => ({ r, pos: i }));
  if (myIdx >= RANK_TOP) shown.push({ r: rows[myIdx], pos: myIdx });
  return (
    <Card flush>
      <CardHead title="Ranking de la plantilla" sub="Por % de victorias en liga" count={rows.length} />
      {shown.map(({ r, pos }) => {
        const mine = pos === myIdx;
        return (
          <ListRow
            key={r.playerId}
            icon={
              <span className="mono" style={{ width: 22, textAlign: "center", color: pos === 0 ? "var(--accent)" : "var(--text-faint)", fontWeight: 700 }}>
                {pos + 1}
              </span>
            }
            title={
              <span style={{ color: mine ? "var(--accent)" : undefined }}>
                {r.name}
                {mine ? " · tú" : ""}
              </span>
            }
            sub={`${r.played} PJ · ${r.won}V–${r.lost}D${r.currentStreak >= 3 ? ` · 🔥${r.currentStreak}` : ""}`}
            right={
              <span className="mono" style={{ fontSize: 15, fontWeight: 700, color: mine ? "var(--accent)" : undefined }}>
                {r.winRate}%
              </span>
            }
            style={mine ? { background: "var(--accent-10)" } : undefined}
          />
        );
      })}
    </Card>
  );
}