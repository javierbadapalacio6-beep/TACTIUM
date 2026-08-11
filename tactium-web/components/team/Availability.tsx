"use client";

import { useState } from "react";

import { NEXT_MATCHDAY, PLAYERS, type Availability as Av } from "@/lib/team-data";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState } from "@/components/states";
import { IconCheck, IconUsers } from "@/components/Icon";

type Filter = "todos" | "disp" | "bajas";

function initials(n: string) {
  return n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function AvailabilityView({ isCaptain }: { isCaptain: boolean }) {
  const [state, setState] = useState<Record<string, Av>>(
    () => Object.fromEntries(PLAYERS.map((p) => [p.id, p.avail]))
  );
  const [filter, setFilter] = useState<Filter>("todos");
  const [saving, setSaving] = useState(false);

  const active = PLAYERS.filter((p) => !p.out);
  const yes = active.filter((p) => state[p.id] === "yes").length;
  const unset = active.filter((p) => state[p.id] === "unset").length;
  const pct = Math.round((yes / active.length) * 100);

  const list = PLAYERS.filter((p) => {
    if (filter === "disp") return state[p.id] === "yes";
    if (filter === "bajas") return state[p.id] === "no" || p.out;
    return true;
  });
  // El jugador vinculado a la cuenta va primero: es su propia marca.
  const sorted = [...list].sort((a, b) => Number(!!b.isMe) - Number(!!a.isMe));

  function mark(id: string, v: Av) {
    setState((s) => ({ ...s, [id]: s[id] === v ? "unset" : v }));
  }

  function markAll() {
    setSaving(true);
    setState((s) =>
      Object.fromEntries(
        Object.entries(s).map(([k, v]) => [
          k,
          PLAYERS.find((p) => p.id === k)?.out ? v : "yes",
        ])
      )
    );
    setTimeout(() => setSaving(false), 600);
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <Eyebrow>DISPONIBILIDAD</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>
          {isCaptain ? "¿Quién está disponible?" : "¿Estás disponible?"}
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13.5,
            color: "var(--text-muted)",
          }}
        >
          Jornada {NEXT_MATCHDAY.round} · vs {NEXT_MATCHDAY.rival} · cierra el
          jueves a las 20:00
        </p>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 150 }}>
            <div className="mono tw-stat-label">DISPONIBLES</div>
            <div className="mono tw-stat-value" style={{ color: "var(--accent)" }}>
              {yes}/{active.length}
            </div>
          </div>

          <div style={{ flex: 1, minWidth: 200 }}>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "var(--hair-strong)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  background: "var(--accent)",
                  transition: "width var(--dur-base) var(--ease)",
                }}
              />
            </div>
            {unset > 0 && (
              <p
                className="mono"
                style={{
                  margin: "10px 0 0",
                  fontSize: 10,
                  letterSpacing: "0.14em",
                  color: "var(--warning)",
                }}
              >
                {unset} SIN MARCAR
              </p>
            )}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(
              [
                ["todos", "Todos"],
                ["disp", "Disp."],
                ["bajas", "Bajas"],
              ] as const
            ).map(([k, label]) => {
              const on = filter === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k)}
                  className="btn"
                  style={{
                    padding: "9px 16px",
                    fontSize: 12.5,
                    fontWeight: on ? 700 : 500,
                    background: on ? "var(--accent-10)" : "transparent",
                    color: on ? "var(--accent)" : "var(--text-muted)",
                    border: `1px solid ${on ? "var(--accent)" : "var(--hair-strong)"}`,
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {isCaptain && (
            <button
              type="button"
              className="btn btn-accent"
              onClick={markAll}
              disabled={saving}
              style={{ padding: "11px 20px", fontSize: 13 }}
            >
              {saving ? "Marcando…" : "Marcar todo"}
            </button>
          )}
        </div>
      </Card>

      {sorted.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconUsers size={34} />}
            title="Nadie en este filtro."
            body="Prueba con otro filtro o marca a alguien."
          />
        </Card>
      ) : (
        <div className="tw-avail-grid">
          {sorted.map((p) => {
            const v = state[p.id];
            return (
              <Card
                key={p.id}
                style={{
                  padding: 18,
                  border: `1.5px solid ${p.isMe ? "var(--accent)" : "transparent"}`,
                  opacity: p.out ? 0.6 : 1,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    className="mono"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 999,
                      background: "var(--primary-dim)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11.5,
                      fontWeight: 700,
                      flex: "none",
                    }}
                  >
                    {initials(p.name)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontSize: 14,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {p.name}
                    </span>
                    <span
                      className="mono"
                      style={{
                        display: "block",
                        marginTop: 3,
                        fontSize: 9.5,
                        letterSpacing: "0.14em",
                        color: "var(--text-faint)",
                      }}
                    >
                      {p.pos.toUpperCase()} · {p.pts} PTS
                    </span>
                  </span>
                  {p.isMe && <span className="chip">Soy yo</span>}
                  {p.out && <span className="chip chip-warning">Baja</span>}
                </div>

                <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
                  {(
                    [
                      ["yes", "Disponible", "var(--accent)", "var(--accent-10)"],
                      ["no", "No puedo", "var(--error)", "var(--error-soft)"],
                    ] as const
                  ).map(([k, label, color, bg]) => {
                    const on = v === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={on}
                        disabled={p.out || (!isCaptain && !p.isMe)}
                        onClick={() => mark(p.id, k as Av)}
                        style={{
                          flex: 1,
                          padding: "10px 8px",
                          borderRadius: 10,
                          cursor:
                            p.out || (!isCaptain && !p.isMe) ? "default" : "pointer",
                          fontFamily: "'Satoshi', sans-serif",
                          fontSize: 12.5,
                          fontWeight: on ? 700 : 500,
                          background: on ? bg : "transparent",
                          color: on ? color : "var(--text-muted)",
                          border: `1.5px solid ${on ? color : "var(--hair-strong)"}`,
                          opacity: p.out || (!isCaptain && !p.isMe) ? 0.5 : 1,
                          transition: "all var(--dur-fast) var(--ease)",
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {saving && (
        <p
          className="mono"
          style={{
            marginTop: 18,
            fontSize: 10.5,
            letterSpacing: "0.16em",
            color: "var(--accent)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <IconCheck size={14} /> MARCANDO…
        </p>
      )}
    </div>
  );
}
