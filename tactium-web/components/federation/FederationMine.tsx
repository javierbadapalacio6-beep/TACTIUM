"use client";

import Link from "next/link";

import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Avatar, Btn, BtnLink, Card, Chip, ListRow, SectionHead } from "@/components/ui";
import { IconSearch } from "@/components/Icon";
import {
  fetchClubTeamsLite,
  fetchMyFollows,
  fetchTeamStanding,
  shortGroupName,
  type TeamStanding,
} from "./fed-data";

function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  if (w.length === 0) return "?";
  if (w.length === 1) return w[0].slice(0, 2).toUpperCase();
  return (w[0][0] + w[1][0]).toUpperCase();
}

/**
 * Federación · «primero lo tuyo» (solo con sesión). Tu equipo y tu grupo
 * (capitán y jugador), los equipos del club (club), o la invitación a
 * buscarse (suelto). Debajo, lo que sigues con la ☆ de la app.
 */
export function FederationMine({ slug, onFindMe }: { slug: string; onFindMe: () => void }) {
  const { user, role, activeTeam, clubId } = useSession();
  const teamId = activeTeam?.id ?? null;
  const isTeam = role === "capitan" || role === "jugador";
  const mine = useAsync(() => fetchTeamStanding(teamId!), [teamId], !!user && isTeam && !!teamId);
  const club = useAsync(
    async () => {
      const teams = await fetchClubTeamsLite(clubId!);
      const rows = await Promise.all(
        teams.map(async (t) => ({ ...t, st: await fetchTeamStanding(t.id).catch(() => null) })),
      );
      return rows.filter((r): r is { id: string; name: string; st: TeamStanding } => !!r.st && r.st.fcpId != null);
    },
    [clubId],
    !!user && role === "club" && !!clubId,
  );
  const follows = useAsync(() => fetchMyFollows(), [user?.id], !!user);

  if (!user) return null;

  const st = mine.data;
  const base = `/federacion/${slug}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 20 }}>
      {isTeam && st && st.fcpId != null ? (
        <Card style={{ borderColor: "var(--accent-40)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Avatar initials={initials(st.me?.equipo ?? activeTeam?.name ?? "?")} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }} className="truncate">
                {st.me?.equipo ?? activeTeam?.name}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {["Tu equipo", shortGroupName(st.grupo)].filter(Boolean).join(" · ")}
              </div>
            </div>
            {st.me ? (
              <span
                className="mono"
                style={{ fontSize: 24, fontWeight: 700, color: st.zone?.color ?? "var(--accent)" }}
                title={st.zone?.label}
              >
                {st.me.posicion}º
              </span>
            ) : (
              <Chip tone="mute">Sin sorteo</Chip>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {st.idGrupo ? (
              <BtnLink href={`${base}/grupo/${encodeURIComponent(st.idGrupo)}`} size="sm" variant="accent">
                Tu grupo
              </BtnLink>
            ) : null}
            <BtnLink href={`${base}/equipo/${st.me?.idEquipo ?? st.fcpId}`} size="sm">
              Ficha del equipo
            </BtnLink>
          </div>
        </Card>
      ) : role === "club" && (club.data ?? []).length > 0 ? (
        <>
          <SectionHead title="Tus equipos en la Federación" count={club.data!.length} style={{ margin: 0 }} />
          <Card flush>
            {club.data!.map(({ id, name, st: s }) => (
              <ListRow
                key={id}
                href={`${base}/equipo/${s.me?.idEquipo ?? s.fcpId}`}
                icon={<Avatar initials={name.trim().slice(-1).toUpperCase()} size={32} />}
                title={name}
                sub={shortGroupName(s.grupo) ?? "En inscripción"}
                right={
                  s.me ? (
                    <span className="mono" style={{ fontSize: 16, fontWeight: 700, color: s.zone?.color ?? "var(--text)" }}>
                      {s.me.posicion}º
                    </span>
                  ) : (
                    <Chip tone="mute" plain>
                      Sin sorteo
                    </Chip>
                  )
                }
              />
            ))}
          </Card>
        </>
      ) : role === "suelto" ? (
        <Card>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 700 }}>¿Juegas en la Cántabra?</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Búscate y sigue tu ficha desde la app: puntos, partidos y parejas.
              </div>
            </div>
            <Btn size="sm" icon={<IconSearch size={15} />} onClick={onFindMe}>
              Buscarme
            </Btn>
          </div>
        </Card>
      ) : null}

      <div>
        <SectionHead title="Siguiendo" count={(follows.data ?? []).length} style={{ margin: "0 0 10px" }} />
        {(follows.data ?? []).length === 0 ? (
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
            Toca ☆ en un equipo o un jugador en la app para tenerlo aquí.
          </p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(follows.data ?? []).map((f) => (
              <Link
                key={`${f.kind}:${f.refId}`}
                href={
                  f.kind === "team"
                    ? `${base}/equipo/${f.refId}`
                    : `${base}/jugador/${encodeURIComponent(f.refId)}`
                }
                className="chip"
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <span style={{ fontWeight: 600 }}>{f.label}</span>
                {f.meta ? <span style={{ color: "var(--text-faint)" }}>{f.meta}</span> : null}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
