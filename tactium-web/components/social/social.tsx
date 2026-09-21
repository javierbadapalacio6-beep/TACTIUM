"use client";

import Link from "next/link";
import { useState } from "react";

import {
  fetchCasualMatches,
  fetchFeed,
  fetchPublicProfile,
  followTarget,
  searchCommunity,
  unfollowTarget,
  type CommunityHit,
  type DbCasual,
} from "@/lib/queries";
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
import { IconGlobe, IconPlus, IconSearch, IconUsers } from "@/components/Icon";

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
export function Feed() {
  const { user } = useSession();
  const { data, loading, error } = useAsync(() => fetchFeed(30), [user?.id], !!user);
  const rows = data ?? [];

  if (loading) return <SkeletonPage />;

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
          <CardHead title="Actividad reciente" count={rows.length} />
          {rows.map((n) => (
            <ListRow
              key={`${n.kind}-${n.ref_id}`}
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
    </div>
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
  const played = Number(p.matches_played ?? p.played ?? 0);
  const won = Number(p.matches_won ?? p.won ?? 0);
  const rate = played ? Math.round((won / played) * 100) : 0;

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
        <StatRow style={{ marginTop: 16 }}>
          <Stat label="Victorias" value={won} tone="accent" />
          <Stat label="Porcentaje de victorias" value={rate} unit="%" />
          <Stat label="Nivel" value={String(p.level_display ?? "—")} />
        </StatRow>
      )}
    </div>
  );
}

/* ═══ MIS ESTADÍSTICAS ════════════════════════════════════════════ */
export function MyStats() {
  const { user } = useSession();
  const { data, loading, error } = useAsync(
    () => fetchCasualMatches(100),
    [user?.id],
    !!user
  );
  const matches: DbCasual[] = data ?? [];

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

  const played = matches.filter((m) => m.winnerSide !== null);
  // Sin saber en qué lado jugó el usuario no se puede atribuir la victoria:
  // se usa el lado 0 como «nosotros», que es como se guardan los amistosos
  // creados desde la app.
  const won = played.filter((m) => m.winnerSide === 0).length;
  const lost = played.length - won;
  const rate = played.length ? Math.round((won / played.length) * 100) : 0;

  const byType = ["amistoso", "entreno", "torneo"].map((t) => ({
    label: t.charAt(0).toUpperCase() + t.slice(1),
    value: matches.filter((m) => m.type === t).length,
  }));

  // Con quién más se ha jugado, contando los nombres del propio lado.
  const mateCount = new Map<string, number>();
  for (const m of matches) {
    for (const n of m.sideA) mateCount.set(n, (mateCount.get(n) ?? 0) + 1);
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

      {matches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={22} />}
            title="Sin partidos todavía"
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
              <CardHead title="Porcentaje de victorias" />
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
            {matches.slice(0, 8).map((c) => (
              <ListRow
                key={c.id}
                href={`/amistosos/${c.id}`}
                title={c.sideA.join(" · ") || "—"}
                sub={`${TYPE_LABEL[c.type] ?? c.type}${
                  c.playedOn ? ` · ${formatDate(c.playedOn)}` : ""
                }`}
                right={
                  <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                    {c.sets.map(([a, b]) => `${a}-${b}`).join(" ")}
                  </span>
                }
              />
            ))}
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
