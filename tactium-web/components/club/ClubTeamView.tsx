"use client";

import Link from "next/link";
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
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import {
  IconCalendar,
  IconChevronDown,
  IconChevronRight,
  IconFlag,
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
      <Card>
        <EmptyState icon={<IconShield size={34} />} title="Sin club activo" />
      </Card>
    );
  }
  if (loading) return <SkeletonCard />;
  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<IconShield size={34} />}
          title="No se pudo cargar el equipo."
          body={error}
        />
      </Card>
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
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>CLUB · EQUIPO</Eyebrow>
        <div
          style={{
            marginTop: 10,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "var(--primary-dim)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <IconShield size={20} />
          </span>
          <h1 style={{ fontSize: 30 }}>{team?.name ?? "Equipo"}</h1>
        </div>
        <p
          className="mono"
          style={{
            margin: "10px 0 0",
            fontSize: 11,
            letterSpacing: "0.14em",
            color: "var(--text-faint)",
          }}
        >
          {[team?.category, team?.gender, season?.name]
            .filter(Boolean)
            .join(" · ")
            .toUpperCase() || "SIN CATEGORÍA"}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "13px 18px",
          borderRadius: 12,
          background: "var(--bg-card-2)",
          border: "1px solid var(--hair-strong)",
          color: "var(--text-muted)",
          marginBottom: 22,
          fontSize: 13,
          textWrap: "pretty",
        }}
      >
        Solo lectura para el club. Las jornadas, la alineación y los resultados
        los gestiona el capitán del equipo.
      </div>

      <div className="tw-solo-stats" style={{ marginBottom: 22 }}>
        {[
          { l: "JUGADAS", v: String(finished.length) },
          { l: "VICTORIAS", v: String(won), c: "var(--accent)" },
          { l: "EMPATES", v: String(drawn), c: "var(--warning)" },
          { l: "DERROTAS", v: String(lost), c: "var(--error)" },
        ].map((k) => (
          <Card key={k.l} style={{ padding: 18 }}>
            <div className="mono tw-stat-label">{k.l}</div>
            <div
              className="mono tw-stat-value"
              style={{ fontSize: 24, ...(k.c ? { color: k.c } : null) }}
            >
              {k.v}
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ marginBottom: 20 }}>
        <Eyebrow>PRÓXIMA JORNADA</Eyebrow>
        {next ? (
          <div
            style={{
              marginTop: 18,
              display: "flex",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <span style={{ flex: 1, minWidth: 180 }}>
              <span style={{ display: "block", fontSize: 18, fontWeight: 700 }}>
                vs {next.opponent}
              </span>
              <span
                className="mono"
                style={{
                  display: "block",
                  marginTop: 6,
                  fontSize: 11.5,
                  letterSpacing: "0.1em",
                  color: "var(--text-muted)",
                }}
              >
                {formatDate(next.date)}
                {next.time ? ` · ${next.time.slice(0, 5)}` : " · sin hora"}
                {next.location ? ` · ${next.location}` : ""}
              </span>
            </span>
            <span className={"chip " + (next.isHome ? "" : "chip-mute")}>
              {next.isHome ? "Local" : "Visitante"}
            </span>
          </div>
        ) : !season ? (
          <EmptyState
            icon={<IconCalendar size={30} />}
            title="Sin temporada activa"
            body="El capitán debe crear una temporada para empezar."
          />
        ) : (
          <EmptyState
            icon={<IconCalendar size={30} />}
            title="Sin jornadas configuradas"
            body="El capitán de este equipo añadirá las jornadas."
          />
        )}
      </Card>

      <Card style={{ marginBottom: 20 }}>
        <button
          type="button"
          onClick={() => setShowPlayers((v) => !v)}
          aria-expanded={showPlayers}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            border: "none",
            background: "transparent",
            color: "var(--text)",
            cursor: "pointer",
            padding: 0,
          }}
        >
          <span className="eyebrow">PLANTILLA · {players.length} JUGADORES</span>
          <span
            style={{
              color: "var(--text-faint)",
              display: "flex",
              transform: showPlayers ? "rotate(180deg)" : "none",
              transition: "transform var(--dur-base) var(--ease)",
            }}
          >
            <IconChevronDown size={16} />
          </span>
        </button>

        {showPlayers &&
          (players.length === 0 ? (
            <p style={{ margin: "18px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
              Plantilla vacía.
            </p>
          ) : (
            <div
              style={{
                marginTop: 18,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 8,
              }}
            >
              {players.map((p) => (
                <div
                  key={p.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: "var(--bg-card-2)",
                    opacity: p.active ? 1 : 0.55,
                  }}
                >
                  <span style={{ flex: 1, fontSize: 13, minWidth: 0 }}>{p.name}</span>
                  <span className="mono" style={{ fontSize: 12, color: "var(--accent)" }}>
                    {p.pts}
                  </span>
                </div>
              ))}
            </div>
          ))}
      </Card>

      <Link href={grupoHref} style={{ color: "inherit" }}>
        <Card
          style={{
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span style={{ color: "var(--accent)", display: "flex" }}>
            <IconFlag size={17} />
          </span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>
            {fcpGroup
              ? "Mi grupo · clasificación y jornadas"
              : "Explorar la Federación"}
          </span>
          <IconChevronRight size={16} />
        </Card>
      </Link>
    </div>
  );
}
