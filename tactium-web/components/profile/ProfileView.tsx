"use client";

import Link from "next/link";
import { useState } from "react";

import {
  IconChart,
  IconCreditCard,
  IconGlobe,
  IconReceipt,
  IconSettings,
  IconUser,
} from "@/components/Icon";
import {
  Avatar,
  Btn,
  BtnLink,
  Card,
  CardHead,
  IconTile,
  ListRow,
  PageHeader,
  Stat,
  StatRow,
} from "@/components/ui";
import { SkeletonCard, SkeletonPage, Toast } from "@/components/states";
import {
  combineRecord,
  fetchMyLeagueStats,
  type RecordGame,
  type RecordSummary,
} from "@/lib/player-stats";
import { fetchCasualMatches, fetchPublicProfile, type DbCasual } from "@/lib/queries";
import { ROLE_LABELS, useSession } from "@/lib/session";
import { casualRecordGames } from "@/components/social/social";
import { useAsync } from "@/lib/use-async";

/**
 * «Perfil» de la navegación única: el perfil SOCIAL, como en la app
 * (`TACTIUM/src/features/profile/screens/ProfileScreen.tsx`).
 *
 * Escaparate (avatar, amistosos, seguidores, siguiendo) · nombre, nivel y
 * rol · bio · «Editar perfil» y «Compartir» · récord con racha y mejor
 * pareja (liga + amistosos) · accesos · rejilla de fotos. Los ajustes van
 * aparte, detrás del engranaje de la cabecera.
 */

interface ProfilePhoto {
  kind?: "casual" | "jornada";
  match_id?: string | null;
  matchday_id?: string | null;
  photo_url: string;
  positive?: boolean | null;
}

export function ProfileView() {
  const { user, role, clubs, clubId } = useSession();
  const [toast, setToast] = useState<string | null>(null);

  const profile = useAsync(
    async () => (await fetchPublicProfile(user!.id)) as Record<string, unknown> | null,
    [user?.id],
    !!user,
  );
  // El récord no tumba la pantalla: si falla, simplemente no sale.
  const record = useAsync(
    async (): Promise<RecordSummary | null> => {
      const [matches, league] = await Promise.all([
        fetchCasualMatches(100).catch(() => [] as DbCasual[]),
        fetchMyLeagueStats(user!.id).catch(() => null),
      ]);
      return combineRecord(league?.games ?? [], casualRecordGames(matches, user!.id));
    },
    [user?.id],
    !!user,
  );

  if (!user || profile.loading) return <SkeletonPage />;

  const p = profile.data ?? {};
  const name = (p.full_name as string)?.trim() || user.name;
  const username = (p.username as string) || user.username;
  const followers = Number(p.followers_count ?? 0);
  const following = Number(p.following_count ?? 0);
  const casualPlayed = Number(p.casual_played ?? 0);
  const bio = typeof p.bio === "string" && p.bio.trim() ? p.bio.trim() : null;
  const level = p.level_display != null ? `Nivel ${String(p.level_display)}` : null;
  const photos = (Array.isArray(p.photos) ? p.photos : []) as ProfilePhoto[];
  const tournamentsOnly =
    role === "club" && (clubs.find((c) => c.id === clubId)?.tournamentsOnly ?? false);
  const rec = record.data;

  async function share() {
    const url = `https://tactium.io/u/${username || user!.id}`;
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
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <Avatar initials={user.initials} src={(p.avatar_url as string) ?? user.avatarUrl} size={48} />
            <span className="truncate">{name}</span>
          </span>
        }
        meta={[username ? `@${username}` : null, level, ROLE_LABELS[role]].filter(
          (x): x is string => !!x,
        )}
        actions={
          <BtnLink
            href="/ajustes"
            variant="quiet"
            size="sm"
            icon={<IconSettings size={16} />}
            aria-label="Ajustes"
            title="Ajustes"
          >
            Ajustes
          </BtnLink>
        }
      />
      {bio && <p style={{ margin: "-4px 0 16px", fontSize: 14 }}>{bio}</p>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <BtnLink href="/ajustes/perfil#editar-perfil" block>
          Editar perfil
        </BtnLink>
        <Btn block onClick={() => void share()}>
          Compartir
        </Btn>
      </div>

      <StatRow>
        <Stat label="Amistosos" value={casualPlayed} />
        <Stat label="Seguidores" value={followers} />
        <Stat label="Siguiendo" value={following} />
      </StatRow>

      {record.loading ? (
        <div style={{ marginTop: 16 }}>
          <SkeletonCard />
        </div>
      ) : rec && rec.played > 0 ? (
        <section aria-label="Tu récord" style={{ marginTop: 16 }}>
          <Link href="/stats" style={{ color: "inherit", textDecoration: "none", display: "block" }}>
            <StatRow>
              <Stat label="Victorias" value={rec.won} tone="accent" sub="Liga y amistosos" />
              <Stat label="Derrotas" value={rec.lost} />
              <Stat
                label="Ganados"
                value={rec.winRate ?? "—"}
                unit={rec.winRate !== null ? "%" : undefined}
              />
            </StatRow>
          </Link>
          {(rec.lastFive.length > 0 || rec.bestPartner) && (
            <div className="tw-club-grid" style={{ marginTop: 16 }}>
              {rec.lastFive.length > 0 && (
                <Card hover>
                  <Link
                    href="/stats"
                    style={{
                      color: "inherit",
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 14 }}>
                      {rec.currentStreak > 0 ? (
                        <>
                          Racha:{" "}
                          <b>
                            {rec.currentStreak}{" "}
                            {rec.currentStreak === 1 ? "victoria" : "victorias"}
                          </b>
                        </>
                      ) : (
                        "Últimos partidos"
                      )}
                    </span>
                    <span
                      style={{ display: "inline-flex", gap: 4, alignItems: "center" }}
                      aria-label={`Últimos ${rec.lastFive.length}: ${rec.lastFive
                        .map((r) => (r === "W" ? "victoria" : "derrota"))
                        .join(", ")}`}
                    >
                      {rec.lastFive.map((r, i) => (
                        <span
                          key={i}
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 3,
                            background: r === "W" ? "var(--accent)" : "var(--error)",
                          }}
                        />
                      ))}
                    </span>
                  </Link>
                </Card>
              )}
              {rec.bestPartner && (
                <Card hover>
                  <Link href="/stats" style={{ color: "inherit", textDecoration: "none", display: "block" }}>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Mejor pareja</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>
                      {rec.bestPartner.name}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
                      <span className="mono">{rec.bestPartner.won}</span> de{" "}
                      <span className="mono">{rec.bestPartner.played}</span> juntos
                    </div>
                  </Link>
                </Card>
              )}
            </div>
          )}
        </section>
      ) : null}

      <Card flush style={{ marginTop: 16 }}>
        <ListRow
          href="/stats"
          icon={<IconTile small><IconChart size={15} /></IconTile>}
          title="Mi récord"
          sub="Estadísticas de liga y amistosos"
        />
        <ListRow
          href="/novedades"
          icon={<IconTile small><IconGlobe size={15} /></IconTile>}
          title="Novedades"
          sub="Lo último de la gente que sigues"
        />
        {username && (
          <ListRow
            href={`/u/${username}`}
            icon={<IconTile small><IconUser size={15} /></IconTile>}
            title="Perfil público"
            sub="Cómo te ven los demás"
          />
        )}
        <ListRow
          href="/suscripcion"
          icon={<IconTile small><IconCreditCard size={15} /></IconTile>}
          title="Mi suscripción"
          sub="Plan, prueba y renovación"
        />
        {role === "club" && !tournamentsOnly && (
          <ListRow
            href="/club/facturacion"
            icon={<IconTile small><IconReceipt size={15} /></IconTile>}
            title="Facturación del club"
            sub="Plan del club y equipos cubiertos"
          />
        )}
      </Card>

      <Card flush style={{ marginTop: 16 }}>
        <CardHead title="Fotos de partidos" count={photos.length || undefined} />
        <div className="card-body">
          {photos.length === 0 ? (
            <p style={{ margin: 0, fontSize: 13.5, color: "var(--text-muted)" }}>
              Tus fotos de partidos aparecerán aquí.
            </p>
          ) : (
            <div className="tw-photo-grid">
              {photos.slice(0, 24).map((ph, i) => {
                const href =
                  ph.kind === "jornada" && ph.matchday_id
                    ? `/jornada/${ph.matchday_id}`
                    : ph.match_id
                      ? `/amistosos/${ph.match_id}`
                      : null;
                const tile = (
                  <span
                    style={{
                      position: "relative",
                      display: "block",
                      aspectRatio: "1 / 1",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--line)",
                      backgroundImage: `url(${ph.photo_url})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {ph.positive != null && (
                      <span
                        className="chip chip-plain"
                        style={{ position: "absolute", left: 6, bottom: 6 }}
                      >
                        {ph.positive ? "Ganado" : "Perdido"}
                      </span>
                    )}
                  </span>
                );
                return href ? (
                  <Link key={`${href}-${i}`} href={href} aria-label="Ver el partido">
                    {tile}
                  </Link>
                ) : (
                  <span key={`${ph.photo_url}-${i}`}>{tile}</span>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
