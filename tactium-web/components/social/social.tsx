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
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import { BarList, Ring, WonLostBar } from "@/components/charts";
import { IconChevronRight, IconGlobe, IconSearch, IconUsers } from "@/components/Icon";

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

function Avatar({
  name,
  url,
  size = 40,
}: {
  name: string;
  url?: string | null;
  size?: number;
}) {
  if (url) {
    return (
      <span
        style={{
          width: size,
          height: size,
          borderRadius: 999,
          flex: "none",
          backgroundImage: `url(${url})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    );
  }
  return (
    <span
      className="mono"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: "var(--primary-dim)",
        color: "var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.34,
        fontWeight: 700,
        flex: "none",
      }}
    >
      {initialsOf(name)}
    </span>
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

/* ═══ FEED ════════════════════════════════════════════════════════ */
export function Feed() {
  const { user } = useSession();
  const { data, loading, error } = useAsync(() => fetchFeed(30), [user?.id], !!user);
  const rows = data ?? [];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>NOVEDADES</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>Novedades</h1>
      </div>

      {loading ? (
        <SkeletonCard />
      ) : error ? (
        <Card>
          <EmptyState
            icon={<IconGlobe size={34} />}
            title="No se pudieron cargar las novedades"
            body={error}
          />
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconGlobe size={34} />}
            title="Aún no hay novedades"
            body="El feed muestra lo que hacen los jugadores y clubes a los que sigues. Empieza siguiendo a alguien."
            action={
              <Link href="/comunidad" className="btn btn-accent" style={{ padding: "13px 22px" }}>
                Buscar en la comunidad
              </Link>
            }
          />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rows.map((n) => (
            <Card key={`${n.kind}-${n.ref_id}`} style={{ padding: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Avatar name={n.actor_name ?? "?"} url={n.avatar_url} size={36} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                    {n.title}
                  </span>
                  <span
                    className="mono"
                    style={{
                      display: "block",
                      marginTop: 3,
                      fontSize: 10,
                      letterSpacing: "0.12em",
                      color: "var(--text-faint)",
                    }}
                  >
                    {formatDate(n.occurred_on)}
                  </span>
                </span>
                <span className="chip chip-mute">
                  {n.kind === "casual" ? "Amistoso" : "Jornada"}
                </span>
              </div>

              {n.subtitle && (
                <div
                  className="mono"
                  style={{
                    marginTop: 14,
                    padding: "14px 16px",
                    borderRadius: 12,
                    background: "var(--bg-card-2)",
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {n.subtitle}
                </div>
              )}

              {n.positive !== null && (
                <div style={{ marginTop: 12 }}>
                  <span
                    className="chip"
                    style={{
                      color: n.positive ? "var(--accent)" : "var(--text-faint)",
                      borderColor: n.positive ? "var(--accent-40)" : "var(--hair-strong)",
                    }}
                  >
                    {n.positive ? "Victoria" : "Jugado"}
                  </span>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══ BUSCAR EN LA COMUNIDAD ══════════════════════════════════════ */
export function Community() {
  const [query, setQuery] = useState("");
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

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>COMUNIDAD</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>Buscar en la comunidad</h1>
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
            placeholder="Busca jugadores o clubes"
            aria-label="Buscar en la comunidad"
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
        <p
          className="mono"
          style={{
            margin: "12px 0 0",
            fontSize: 9.5,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
          }}
        >
          MÍNIMO 2 LETRAS
        </p>
      </Card>

      {query.trim().length < 2 ? (
        <Card>
          <EmptyState
            icon={<IconSearch size={34} />}
            title="Escribe para buscar"
            body="Busca por nombre de usuario, nombre real o nombre de club."
          />
        </Card>
      ) : loading ? (
        <SkeletonCard />
      ) : error ? (
        <Card>
          <EmptyState icon={<IconUsers size={34} />} title="Error en la búsqueda" body={error} />
        </Card>
      ) : hits.length === 0 ? (
        <Card>
          <EmptyState icon={<IconUsers size={34} />} title="Sin resultados" />
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {[
            { title: "JUGADORES", rows: people },
            { title: "CLUBES", rows: clubs },
          ]
            .filter((s) => s.rows.length > 0)
            .map((s) => (
              <section key={s.title}>
                <Eyebrow style={{ marginBottom: 12 }}>{s.title}</Eyebrow>
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  {s.rows.map((h, i) => (
                    <div
                      key={h.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 20px",
                        borderBottom:
                          i === s.rows.length - 1 ? "none" : "1px solid var(--hair)",
                      }}
                    >
                      <Avatar name={h.name} url={h.avatar_url} size={38} />
                      <Link
                        href={h.type === "user" ? `/u/${h.id}` : "/comunidad"}
                        style={{ flex: 1, minWidth: 0, color: "inherit" }}
                      >
                        <span style={{ display: "block", fontSize: 14, fontWeight: 700 }}>
                          {h.name}
                        </span>
                        <span
                          className="mono"
                          style={{
                            display: "block",
                            marginTop: 3,
                            fontSize: 10.5,
                            color: "var(--text-faint)",
                          }}
                        >
                          {h.subtitle ?? (h.type === "club" ? "Club" : "Jugador")} ·{" "}
                          {h.followers_count} seguidores
                        </span>
                      </Link>
                      {(() => {
                        const on = follow[h.id] ?? h.is_following;
                        return (
                          <button
                            type="button"
                            disabled={busy === h.id}
                            onClick={() => toggleFollow(h)}
                            className={"chip " + (on ? "" : "chip-mute")}
                            style={{ cursor: "pointer" }}
                          >
                            {on ? "Siguiendo" : "Seguir"}
                          </button>
                        );
                      })()}
                    </div>
                  ))}
                </Card>
              </section>
            ))}
        </div>
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

  if (loading) return <SkeletonCard />;
  if (error || !data) {
    return (
      <Card>
        <EmptyState
          icon={<IconUsers size={34} />}
          title="Perfil no disponible"
          body={error ?? "Puede que el perfil no exista o no sea público."}
        />
      </Card>
    );
  }

  const p = data as Record<string, unknown>;
  const name = (p.full_name as string) ?? (p.username as string) ?? "Jugador";
  const played = Number(p.matches_played ?? p.played ?? 0);
  const won = Number(p.matches_won ?? p.won ?? 0);
  const rate = played ? Math.round((won / played) * 100) : 0;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 20 }}>
        <div className="amb" style={{ padding: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <Avatar name={name} url={p.avatar_url as string | null} size={72} />
            <div style={{ flex: 1, minWidth: 180 }}>
              <h1 style={{ fontSize: 28 }}>{name}</h1>
              {(p.username as string) && (
                <div
                  className="mono"
                  style={{
                    marginTop: 8,
                    fontSize: 11,
                    letterSpacing: "0.12em",
                    color: "var(--text-faint)",
                  }}
                >
                  @{p.username as string}
                  {p.home_club ? ` · ${(p.home_club as string).toUpperCase()}` : ""}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 22, display: "flex", gap: 28, flexWrap: "wrap" }}>
            {[
              { l: "SEGUIDORES", v: Number(p.followers_count ?? 0) },
              { l: "SIGUIENDO", v: Number(p.following_count ?? 0) },
              { l: "JUGADOS", v: played },
            ].map((k) => (
              <div key={k.l}>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700 }}>
                  {k.v}
                </div>
                <div
                  className="mono"
                  style={{
                    marginTop: 5,
                    fontSize: 9.5,
                    letterSpacing: "0.18em",
                    color: "var(--text-faint)",
                  }}
                >
                  {k.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {played > 0 && (
        <div className="tw-solo-stats">
          {[
            { l: "VICTORIAS", v: String(won), accent: true },
            { l: "TASA V.", v: `${rate}%` },
            { l: "NIVEL", v: String(p.level_display ?? "—") },
          ].map((k) => (
            <Card key={k.l} style={{ padding: 18 }}>
              <div className="mono tw-stat-label">{k.l}</div>
              <div
                className="mono tw-stat-value"
                style={{ fontSize: 24, ...(k.accent ? { color: "var(--accent)" } : null) }}
              >
                {k.v}
              </div>
            </Card>
          ))}
        </div>
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

  if (loading) return <SkeletonCard />;
  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<IconUsers size={34} />}
          title="No se pudieron cargar tus partidos"
          body={error}
        />
      </Card>
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

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>MIS ESTADÍSTICAS</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>Mis estadísticas</h1>
        <p
          className="mono"
          style={{
            margin: "8px 0 0",
            fontSize: 10.5,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
          }}
        >
          {matches.length} PARTIDOS · DATOS REALES
        </p>
      </div>

      {matches.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={34} />}
            title="Sin partidos todavía"
            body="Registra tu primer amistoso y empieza a acumular números."
            action={
              <Link href="/amistosos/nuevo" className="btn btn-accent" style={{ padding: "13px 22px" }}>
                Registrar un amistoso
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <div className="tw-solo-stats" style={{ marginBottom: 20 }}>
            {[
              { l: "PARTIDOS", v: String(matches.length) },
              { l: "CON RESULTADO", v: String(played.length) },
              { l: "AMISTOSOS", v: String(matches.filter((m) => m.type === "amistoso").length) },
              { l: "ENTRENOS", v: String(matches.filter((m) => m.type === "entreno").length) },
            ].map((k) => (
              <Card key={k.l} style={{ padding: 20 }}>
                <div className="mono tw-stat-label">{k.l}</div>
                <div className="mono tw-stat-value" style={{ fontSize: 26 }}>
                  {k.v}
                </div>
              </Card>
            ))}
          </div>

          <div className="tw-club-grid" style={{ marginBottom: 20 }}>
            <Card>
              <Eyebrow>% DE VICTORIAS</Eyebrow>
              <div style={{ marginTop: 20 }}>
                <Ring value={rate} label="DE VICTORIAS" />
              </div>
            </Card>

            <Card>
              <Eyebrow>RESULTADOS</Eyebrow>
              <div style={{ marginTop: 24 }}>
                <WonLostBar won={won} lost={lost} />
              </div>
            </Card>
          </div>

          <div className="tw-club-grid">
            {mates.length > 0 && (
              <Card>
                <Eyebrow>CON QUIÉN JUEGAS</Eyebrow>
                <p style={{ margin: "12px 0 20px", fontSize: 12.5, color: "var(--text-muted)" }}>
                  Nombres que más aparecen en tu lado
                </p>
                <BarList data={mates} valueLabel="partidos" />
              </Card>
            )}

            <Card>
              <Eyebrow>POR TIPO</Eyebrow>
              <p style={{ margin: "12px 0 20px", fontSize: 12.5, color: "var(--text-muted)" }}>
                Reparto de tus partidos
              </p>
              <BarList data={byType} valueLabel="partidos" />
            </Card>
          </div>

          <Card style={{ marginTop: 20 }}>
            <Eyebrow>ÚLTIMOS PARTIDOS</Eyebrow>
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
              {matches.slice(0, 8).map((c) => (
                <Link key={c.id} href={`/amistosos/${c.id}`} style={{ color: "inherit" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "13px 16px",
                      borderRadius: 12,
                      background: "var(--bg-card-2)",
                      flexWrap: "wrap",
                    }}
                  >
                    <span
                      className="mono"
                      style={{
                        fontSize: 9,
                        letterSpacing: "0.14em",
                        color: "var(--text-faint)",
                      }}
                    >
                      {c.type.toUpperCase()}
                    </span>
                    <span style={{ flex: 1, minWidth: 120, fontSize: 13, fontWeight: 700 }}>
                      {c.sideA.join(" · ") || "—"}
                    </span>
                    <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>
                      {c.sets.map(([a, b]) => `${a}-${b}`).join(" ")}
                    </span>
                    <IconChevronRight size={15} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
