"use client";

import Link from "next/link";
import { useMemo } from "react";

import {
  BtnLink,
  Card,
  CardHead,
  Chip,
  IconTile,
  ListRow,
  PageHeader,
  Stat,
  StatRow,
  Table,
} from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { fetchCasualMatches, type DbCasual } from "@/lib/queries";
import {
  IconPlus,
  IconTicket,
  IconUserPlus,
  IconUsers,
} from "@/components/Icon";

const KIND_LABEL: Record<string, string> = {
  amistoso: "Amistoso",
  entreno: "Entreno",
  torneo: "Torneo",
};

const scoreOf = (sets: [number, number][]) =>
  sets.map(([a, b]) => `${a}-${b}`).join("  ");

const fmtDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

const START = [
  {
    href: "/amistosos/nuevo",
    title: "Registrar un amistoso",
    body: "Apunta el resultado y súmalo a tus números.",
    Icon: IconPlus,
  },
  {
    href: "/comunidad",
    title: "Invitar a tus colegas",
    body: "Que apunten sus partidos y os midáis.",
    Icon: IconUserPlus,
  },
  {
    href: "/stats",
    title: "Canjear invitación",
    body: "¿Tienes un código? Úsalo aquí.",
    Icon: IconTicket,
  },
];

/** Panel del jugador suelto: sin equipo, todo gira sobre sus partidos. */
export function SoloHome() {
  const { user } = useSession();
  const { data, loading, error } = useAsync(
    () => fetchCasualMatches(50),
    [user?.id],
    !!user,
  );
  const matches: DbCasual[] = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const played = matches.filter((m) => m.winnerSide !== null);
    const won = played.filter((m) => m.winnerSide === 0).length;
    const winRate = played.length
      ? Math.round((won / played.length) * 100)
      : 0;
    let streak = 0;
    for (const m of played) {
      if (m.winnerSide === 0) streak++;
      else break;
    }
    let best = 0;
    let run = 0;
    for (const m of [...played].reverse()) {
      if (m.winnerSide === 0) {
        run++;
        best = Math.max(best, run);
      } else {
        run = 0;
      }
    }
    return { matches: matches.length, played: played.length, won, winRate, streak, bestStreak: best };
  }, [matches]);

  const recent = matches.slice(0, 6);

  if (loading) return <SkeletonPage />;

  return (
    <div className="tw-page">
      <PageHeader
        title={user?.name ?? "Mi pádel"}
        lede="Tus partidos, tu racha y tus números."
        actions={
          <BtnLink href="/amistosos/nuevo" variant="accent" icon={<IconPlus size={15} />}>
            Registrar amistoso
          </BtnLink>
        }
      />

      <StatRow style={{ marginBottom: 16 }}>
        <Stat label="Partidos" value={stats.matches} sub={`${stats.played} con resultado`} />
        <Stat
          label="Victorias"
          value={stats.winRate}
          unit="%"
          tone={stats.played > 0 && stats.winRate >= 50 ? "accent" : undefined}
          sub={`${stats.won} ganados`}
        />
        <Stat label="Racha actual" value={stats.streak} sub={stats.streak > 0 ? "victorias seguidas" : "sin racha"} />
        <Stat label="Mejor racha" value={stats.bestStreak} />
      </StatRow>

      <div className="tw-home-grid">
        <Card flush>
          <CardHead title="Últimos partidos" count={matches.length}>
            <Link href="/stats" className="link-action">
              Ver estadísticas
            </Link>
          </CardHead>
          {error ? (
            <EmptyState
              compact
              icon={<IconUsers size={22} />}
              title="No se pudieron cargar tus partidos"
              body={error}
            />
          ) : recent.length === 0 ? (
            <EmptyState
              compact
              icon={<IconUsers size={22} />}
              title="Sin partidos todavía"
              body="Registra tu primer amistoso y empieza a acumular números."
              action={
                <BtnLink href="/amistosos/nuevo" variant="accent" size="sm">
                  Registrar un amistoso
                </BtnLink>
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Partido</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                  <th className="num">Resultado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => {
                  const won = c.winnerSide === 0;
                  const decided = c.winnerSide !== null;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/amistosos/${c.id}`} style={{ color: "inherit" }}>
                          <span className="cell-main truncate" style={{ display: "block", maxWidth: 260 }}>
                            {c.sideA.join(" / ") || "Nosotros"}
                          </span>
                          <span className="cell-sub truncate" style={{ maxWidth: 260 }}>
                            vs {c.sideB.join(" / ") || "Rivales"}
                          </span>
                        </Link>
                      </td>
                      <td className="cell-muted">{KIND_LABEL[c.type] ?? c.type}</td>
                      <td className="cell-muted">{fmtDate(c.playedOn)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>
                        {scoreOf(c.sets)}
                      </td>
                      <td>
                        <div className="tw-table-actions">
                          {decided ? (
                            <Chip tone={won ? "accent" : "error"}>{won ? "Victoria" : "Derrota"}</Chip>
                          ) : (
                            <Chip tone="mute">Sin resultado</Chip>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>

        <Card flush>
          <CardHead title="Empezar" />
          {START.map((x) => (
            <ListRow
              key={x.href}
              href={x.href}
              icon={
                <IconTile>
                  <x.Icon size={16} />
                </IconTile>
              }
              title={x.title}
              sub={x.body}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}
