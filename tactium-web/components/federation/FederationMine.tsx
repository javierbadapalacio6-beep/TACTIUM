"use client";

import Link from "next/link";

import { proHref } from "@/lib/nav";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Avatar, Btn, BtnLink, Card, Chip, ListRow, Note, SectionHead } from "@/components/ui";
import { IconCalendar, IconInfo, IconSearch } from "@/components/Icon";

import {
  fetchClubTeamsLite,
  fetchFcpGroupUnlocked,
  fetchMyFollows,
  fetchTeamStanding,
  fmtFcpDate,
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
 * Federación · «primero lo tuyo» (solo con sesión). Arriba del explorador,
 * fija, la tarjeta «Tu grupo» (capitán y jugador): puesto, puntos, próxima
 * jornada y enlace a la clasificación. Si el vínculo apunta a una
 * inscripción sin grupos, enseña la final de la temporada anterior con el
 * mismo aviso que la app (`FcpGroupSheet`). Para el club, sus equipos; para
 * el suelto, la invitación a buscarse. Debajo, lo que sigues con la ☆.
 *
 * `onOpenGroup`: con la vista partida (≥1100 px) el grupo se abre a la
 * derecha en vez de navegar.
 */
export function FederationMine({
  slug,
  onFindMe,
  onOpenGroup,
}: {
  slug: string;
  onFindMe: () => void;
  onOpenGroup?: (idGrupo: string) => void;
}) {
  const { user, role, activeTeam, clubId } = useSession();
  const teamId = activeTeam?.id ?? null;
  const isTeam = role === "capitan" || role === "jugador";
  const mine = useAsync(
    () => fetchTeamStanding(teamId!, { withPrevious: true }),
    [teamId],
    !!user && isTeam && !!teamId,
  );
  // «Tu grupo» es Pro (como en la app; el explorador de debajo, no). Mismo
  // gate por equipo: al jugador no se le bloquea.
  const groupAccess = useAsync(
    () => fetchFcpGroupUnlocked(teamId!, role === "capitan"),
    [teamId, role],
    !!user && isTeam && !!teamId,
  );
  const groupLocked = groupAccess.data === false;
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
        <Card style={{ borderColor: "var(--accent-40)" }} aria-label="Tu grupo">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <Avatar initials={initials(st.me?.equipo ?? activeTeam?.name ?? "?")} size={40} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Tu grupo</div>
              <div style={{ fontSize: 15, fontWeight: 700 }} className="truncate">
                {st.me?.equipo ?? activeTeam?.name}
              </div>
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                {[shortGroupName(st.grupo), st.previous ? st.temporada : null]
                  .filter(Boolean)
                  .join(" · ") || "En inscripción"}
              </div>
            </div>
            {st.me ? (
              <span style={{ textAlign: "right" }}>
                <span
                  className="mono"
                  style={{
                    display: "block",
                    fontSize: 24,
                    fontWeight: 700,
                    color: st.zone?.color ?? "var(--accent)",
                  }}
                  title={st.zone?.label}
                >
                  {st.me.posicion}º
                </span>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                  <span className="mono">{st.me.puntos}</span> pts
                </span>
              </span>
            ) : (
              <Chip tone="mute">Sin sorteo</Chip>
            )}
          </div>

          {st.previous ? (
            <Note icon={<IconInfo size={15} />} style={{ marginTop: 12 }}>
              <b>
                Clasificación final
                {st.temporada ? ` de la ${st.temporada}` : " de la temporada pasada"}
              </b>
              . La Federación aún no ha publicado los grupos de la temporada nueva. Cuando lo
              haga, aquí verás tu grupo nuevo.
            </Note>
          ) : st.finished ? (
            <Note icon={<IconInfo size={15} />} style={{ marginTop: 12 }}>
              Temporada{st.temporada ? ` ${st.temporada}` : ""} terminada · clasificación final
            </Note>
          ) : st.nextMatch ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginTop: 12,
                padding: "10px 12px",
                borderRadius: "var(--r-md)",
                background: "var(--bg-card-2)",
                fontSize: 13.5,
              }}
            >
              <IconCalendar size={15} style={{ flex: "none", color: "var(--text-muted)" }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ color: "var(--text-muted)" }}>
                  Próxima
                  {st.nextMatch.jornada != null ? ` · jornada ${st.nextMatch.jornada}` : ""}
                  {st.nextMatch.fecha ? ` · ${fmtFcpDate(st.nextMatch.fecha)}` : ""}
                  {st.nextMatch.hora ? ` · ${st.nextMatch.hora.slice(0, 5)}` : ""}
                </span>
                <span className="truncate" style={{ display: "block", fontWeight: 600 }}>
                  {st.nextMatch.local} – {st.nextMatch.visitante}
                </span>
              </span>
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
            {st.idGrupo && groupLocked ? (
              <BtnLink href={proHref("fcp_group")} size="sm" aria-label="Ver clasificación (Pro)">
                Ver clasificación
                <Chip tone="accent" plain>
                  Pro
                </Chip>
              </BtnLink>
            ) : st.idGrupo ? (
              <BtnLink
                href={`${base}/grupo/${encodeURIComponent(st.idGrupo)}`}
                size="sm"
                variant="accent"
                onClick={(e) => {
                  if (!onOpenGroup || e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault();
                  onOpenGroup(st.idGrupo!);
                }}
              >
                Ver clasificación
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
