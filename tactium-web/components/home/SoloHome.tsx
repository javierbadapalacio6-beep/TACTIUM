"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { fetchCasualMatches, type DbCasual } from "@/lib/queries";
import {
  IconChevronRight,
  IconPlus,
  IconTicket,
  IconUserPlus,
  IconUsers,
} from "@/components/Icon";

const KIND_LABEL: Record<string, string> = {
  amistoso: "AMISTOSO",
  entreno: "ENTRENO",
  torneo: "TORNEO",
};

const scoreOf = (sets: [number, number][]) =>
  sets.map(([a, b]) => `${a}-${b}`).join(" ");

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
    title: "Invita a tus colegas",
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

  // Mismas reglas que /stats: el lado 0 es «nosotros» (así se guardan los
  // amistosos creados desde la app). Las rachas se calculan sobre los partidos
  // con resultado, que llegan más reciente primero.
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
    return { matches: matches.length, winRate, streak, bestStreak: best };
  }, [matches]);

  const recent = matches.slice(0, 4);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Eyebrow>TU PÁDEL</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 32 }}>
          {user?.name ?? "Tu pádel"}
        </h1>
      </div>

      <div className="tw-solo-stats">
        {[
          { label: "PARTIDOS", value: String(stats.matches) },
          { label: "% DE VICTORIAS", value: `${stats.winRate}%`, accent: true },
          { label: "RACHA", value: String(stats.streak) },
          { label: "MEJOR RACHA", value: String(stats.bestStreak) },
        ].map((k) => (
          <Card key={k.label} style={{ padding: 22 }}>
            <div className="mono tw-stat-label">{k.label}</div>
            <div
              className="mono tw-stat-value"
              style={k.accent ? { color: "var(--accent)" } : undefined}
            >
              {k.value}
            </div>
          </Card>
        ))}
      </div>

      <section style={{ marginTop: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Eyebrow>ÚLTIMOS PARTIDOS</Eyebrow>
          <Link href="/stats" style={{ fontSize: 13 }}>
            Ver todas mis stats →
          </Link>
        </div>

        {loading ? (
          <SkeletonCard />
        ) : error ? (
          <Card>
            <EmptyState
              icon={<IconUsers size={34} />}
              title="No se pudieron cargar tus partidos"
              body={error}
            />
          </Card>
        ) : recent.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconUsers size={34} />}
              title="Sin partidos todavía"
              body="Registra tu primer amistoso y empieza a acumular números."
              action={
                <Link
                  href="/amistosos/nuevo"
                  className="btn btn-accent"
                  style={{ padding: "13px 22px" }}
                >
                  Registrar un amistoso
                </Link>
              }
            />
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {recent.map((c) => {
              const won = c.winnerSide === 0;
              const decided = c.winnerSide !== null;
              return (
                <Link
                  key={c.id}
                  href={`/amistosos/${c.id}`}
                  style={{ color: "inherit" }}
                >
                  <Card style={{ padding: 20 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        className="mono"
                        style={{
                          fontSize: 9.5,
                          letterSpacing: "0.16em",
                          color: "var(--text-faint)",
                        }}
                      >
                        {KIND_LABEL[c.type] ?? c.type.toUpperCase()}
                      </span>
                      <span
                        className="mono"
                        style={{
                          fontSize: 11,
                          letterSpacing: "0.1em",
                          color: "var(--text-faint)",
                        }}
                      >
                        {fmtDate(c.playedOn)}
                      </span>
                      <div style={{ flex: 1 }} />
                      {decided && (
                        <span
                          className={"chip " + (won ? "" : "chip-error")}
                          style={{
                            color: won ? "var(--accent)" : "var(--error)",
                            borderColor: won
                              ? "var(--accent-40)"
                              : "var(--error)",
                          }}
                        >
                          {won ? "Victoria" : "Derrota"}
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        marginTop: 14,
                        display: "flex",
                        alignItems: "center",
                        gap: 20,
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <div style={{ fontSize: 14.5, fontWeight: 700 }}>
                          {c.sideA.join(" / ") || "Nosotros"}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 13,
                            color: "var(--text-muted)",
                          }}
                        >
                          {c.sideB.join(" / ") || "Rivales"}
                        </div>
                      </div>
                      <span
                        className="mono"
                        style={{
                          fontSize: 22,
                          fontWeight: 700,
                          letterSpacing: "0.04em",
                        }}
                      >
                        {scoreOf(c.sets)}
                      </span>
                      {c.photoUrl && (
                        <span
                          className="mono"
                          style={{
                            fontSize: 9,
                            letterSpacing: "0.16em",
                            color: "var(--text-faint)",
                            border: "1px solid var(--hair-strong)",
                            borderRadius: 999,
                            padding: "4px 9px",
                          }}
                        >
                          FOTO
                        </span>
                      )}
                      <span
                        style={{ color: "var(--text-faint)", display: "flex" }}
                      >
                        <IconChevronRight size={16} />
                      </span>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <Eyebrow style={{ marginBottom: 12 }}>EMPEZAR</Eyebrow>
        <div className="tw-shortcuts">
          {START.map((x) => (
            <Link key={x.href} href={x.href} style={{ color: "inherit" }}>
              <Card style={{ padding: 20, height: "100%" }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "var(--accent-10)",
                    color: "var(--accent)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <x.Icon size={17} />
                </span>
                <div
                  style={{
                    marginTop: 14,
                    fontSize: 14.5,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {x.title}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12.5,
                    color: "var(--text-muted)",
                    textWrap: "pretty",
                  }}
                >
                  {x.body}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
