"use client";

import { useState } from "react";

import {
  fetchActiveSeason,
  fetchClubTeams,
  fetchMatchdays,
  fetchPlayers,
  fetchTeamFcpGroup,
  type DbMatchday,
  type DbPlayer,
  type DbSeason,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import {
  Avatar,
  Btn,
  BtnLink,
  Card,
  CardHead,
  Chip,
  Note,
  PageHeader,
  Stat,
  StatRow,
  Table,
} from "@/components/ui";

function initialsOf(n: string) {
  return n
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
import { EmptyState, SkeletonPage } from "@/components/states";
import {
  IconCalendar,
  IconChevronDown,
  IconFlag,
  IconInfo,
  IconShield,
} from "@/components/Icon";

/**
 * Vista de un equipo desde el club — SOLO LECTURA.
 *
 * El club administra la estructura; las jornadas, la alineación y los
 * resultados los gestiona el capitán de cada equipo.
 */
interface TeamData {
  team: { id: string; name: string; category: string | null; gender: string | null } | null;
  season: DbSeason | null;
  matchdays: DbMatchday[];
  players: DbPlayer[];
  fcpGroup: { fed: string; idGrupo: string } | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "Fecha por confirmar";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function ClubTeamView({ id }: { id: string }) {
  const { clubId } = useSession();
  const [showPlayers, setShowPlayers] = useState(true);

  const { data, loading, error } = useAsync<TeamData>(
    async () => {
      const teams = await fetchClubTeams(clubId!);
      const team = teams.find((t) => t.id === id) ?? null;
      const season = await fetchActiveSeason(id);
      const [matchdays, players, fcpGroup] = await Promise.all([
        season ? fetchMatchdays(season.id) : Promise.resolve([]),
        fetchPlayers(id),
        fetchTeamFcpGroup(id).catch(() => null),
      ]);
      return { team, season, matchdays, players, fcpGroup };
    },
    [id, clubId],
    !!clubId
  );

  if (!clubId) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState icon={<IconShield size={24} />} title="Sin club activo" />
        </Card>
      </div>
    );
  }
  if (loading) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconShield size={24} />}
            title="No se pudo cargar el equipo."
            body={error}
          />
        </Card>
      </div>
    );
  }

  const team = data?.team;
  const season = data?.season ?? null;
  const players = data?.players ?? [];
  const fcpGroup = data?.fcpGroup ?? null;
  const grupoHref = fcpGroup
    ? `/federacion/${fcpGroup.fed}/grupo/${encodeURIComponent(fcpGroup.idGrupo)}`
    : "/federacion";
  const finished = (data?.matchdays ?? []).filter((m) => m.status === "finished");
  const next = (data?.matchdays ?? []).find((m) => m.status !== "finished") ?? null;

  const won = finished.filter((m) => m.outcome === "win").length;
  const drawn = finished.filter((m) => m.outcome === "draw").length;
  const lost = finished.filter((m) => m.outcome === "loss").length;

  return (
    <div className="tw-page">
      <PageHeader
        back={{ href: "/club/equipos", label: "Equipos" }}
        title={team?.name ?? "Equipo"}
        meta={[
          [team?.category, team?.gender].filter(Boolean).join(" · ") || "Sin categoría",
          season?.name ?? null,
        ]}
        actions={
          <BtnLink href={grupoHref} icon={<IconFlag size={15} />}>
            {fcpGroup ? "Mi grupo" : "Federación"}
          </BtnLink>
        }
      />

      <Note icon={<IconInfo size={16} />} style={{ marginBottom: 16 }}>
        Solo lectura para el club. Las jornadas, la alineación y los resultados
        los gestiona el capitán del equipo.
      </Note>

      <StatRow style={{ marginBottom: 16 }}>
        <Stat label="Jugadas" value={finished.length} />
        <Stat label="Victorias" value={won} tone={won > 0 ? "accent" : undefined} />
        <Stat label="Empates" value={drawn} tone={drawn > 0 ? "warning" : undefined} />
        <Stat label="Derrotas" value={lost} tone={lost > 0 ? "error" : undefined} />
      </StatRow>

      <Card flush style={{ marginBottom: 16 }}>
        <CardHead title="Próxima jornada">
          {next && (
            <Chip tone={next.isHome ? "accent" : "mute"}>
              {next.isHome ? "Local" : "Visitante"}
            </Chip>
          )}
        </CardHead>
        {next ? (
          <div className="card-body">
            <h2 style={{ fontSize: 20 }}>vs {next.opponent}</h2>
            <div
              style={{
                marginTop: 6,
                fontSize: 13.5,
                color: "var(--text-muted)",
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <span>{formatDate(next.date)}</span>
              <span style={{ color: "var(--text-faint)" }}>·</span>
              {next.time ? (
                <span className="mono">{next.time.slice(0, 5)}</span>
              ) : (
                <span>Sin hora</span>
              )}
              {next.location && (
                <>
                  <span style={{ color: "var(--text-faint)" }}>·</span>
                  <span>{next.location}</span>
                </>
              )}
            </div>
          </div>
        ) : !season ? (
          <EmptyState
            compact
            icon={<IconCalendar size={22} />}
            title="Sin temporada activa"
            body="El capitán debe crear una temporada para empezar."
          />
        ) : (
          <EmptyState
            compact
            icon={<IconCalendar size={22} />}
            title="Sin jornadas configuradas"
            body="El capitán de este equipo añadirá las jornadas."
          />
        )}
      </Card>

      <Card flush>
        <CardHead title="Plantilla" count={players.length}>
          <Btn
            size="sm"
            variant="quiet"
            onClick={() => setShowPlayers((v) => !v)}
            aria-expanded={showPlayers}
            icon={
              <IconChevronDown
                size={15}
                style={{
                  transform: showPlayers ? "rotate(180deg)" : "none",
                  transition: "transform var(--dur-base) var(--ease)",
                }}
              />
            }
          >
            {showPlayers ? "Ocultar" : "Mostrar"}
          </Btn>
        </CardHead>

        {showPlayers &&
          (players.length === 0 ? (
            <EmptyState compact title="Plantilla vacía" />
          ) : (
            <Table dense>
              <thead>
                <tr>
                  <th>Jugador</th>
                  <th className="num">Puntos</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p) => (
                  <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                    <td className="cell-main">
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                        <Avatar initials={initialsOf(p.name)} src={p.photoUrl} size={28} />
                        {p.name}
                      </span>
                    </td>
                    <td className="num">{p.pts}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ))}
      </Card>
    </div>
  );
}
