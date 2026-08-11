"use client";

import Link from "next/link";

import {
  CASUAL_KIND_LABEL,
  CASUAL_MATCHES,
  SOLO_STATS,
  formatSets,
} from "@/lib/team-data";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState } from "@/components/states";
import {
  IconChevronRight,
  IconPlus,
  IconTicket,
  IconUserPlus,
  IconUsers,
} from "@/components/Icon";

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
  const s = SOLO_STATS;

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Eyebrow>TU PÁDEL</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 32 }}>Sara León</h1>
      </div>

      <div className="tw-solo-stats">
        {[
          { label: "PARTIDOS", value: String(s.matches) },
          { label: "% DE VICTORIAS", value: `${s.winRate}%`, accent: true },
          { label: "RACHA", value: String(s.streak) },
          { label: "MEJOR RACHA", value: String(s.bestStreak) },
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

        {CASUAL_MATCHES.length === 0 ? (
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
            {CASUAL_MATCHES.map((c) => (
              <Link key={c.id} href={`/amistosos/${c.id}`} style={{ color: "inherit" }}>
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
                      {CASUAL_KIND_LABEL[c.kind]}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 11,
                        letterSpacing: "0.1em",
                        color: "var(--text-faint)",
                      }}
                    >
                      {c.date}
                    </span>
                    <div style={{ flex: 1 }} />
                    <span
                      className={"chip " + (c.won ? "" : "chip-error")}
                      style={{
                        color: c.won ? "var(--accent)" : "var(--error)",
                        borderColor: c.won ? "var(--accent-40)" : "var(--error)",
                      }}
                    >
                      {c.won ? "Victoria" : "Derrota"}
                    </span>
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
                        {c.ourPair}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 13,
                          color: "var(--text-muted)",
                        }}
                      >
                        {c.rivalPair}
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
                      {formatSets(c.sets)}
                    </span>
                    {c.photo && (
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
                    <span style={{ color: "var(--text-faint)", display: "flex" }}>
                      <IconChevronRight size={16} />
                    </span>
                  </div>
                </Card>
              </Link>
            ))}
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
