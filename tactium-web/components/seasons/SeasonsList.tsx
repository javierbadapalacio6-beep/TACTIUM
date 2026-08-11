"use client";

import Link from "next/link";
import { useState } from "react";

import { type SeasonFormat } from "@/lib/team-data";
import { fetchSeasons, type DbSeason } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
import { IconCalendar, IconChevronRight, IconPlus } from "@/components/Icon";

const FORMATS: { key: SeasonFormat; note: string }[] = [
  { key: "Liga regular", note: "Jornadas en orden" },
  { key: "Liga + Playoff", note: "Formato completo" },
  { key: "Eliminatorias", note: "Playoff" },
];

/** Nombre legible de la fase que guarda la base de datos. */
const PHASE_LABEL: Record<DbSeason["phase"], string> = {
  liga: "Liga regular",
  playoff: "Eliminatorias",
  mixto: "Liga + Playoff",
};

export function SeasonsList() {
  const { activeTeam } = useSession();
  const teamId = activeTeam?.id ?? null;
  const { data, loading, error } = useAsync(
    () => fetchSeasons(teamId!),
    [teamId],
    !!teamId
  );
  const SEASONS = data ?? [];

  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<SeasonFormat>("Liga + Playoff");

  const active = SEASONS.filter((s) => s.active);
  const past = SEASONS.filter((s) => !s.active);

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 20,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <Eyebrow>TEMPORADAS</Eyebrow>
          <h1 style={{ marginTop: 10, fontSize: 30 }}>Temporadas</h1>
          <p
            className="mono"
            style={{
              margin: "8px 0 0",
              fontSize: 11,
              letterSpacing: "0.14em",
              color: "var(--text-faint)",
            }}
          >
            {activeTeam?.name} · {activeTeam?.category ?? ""}
          </p>
        </div>
        <button
          className="btn btn-accent"
          onClick={() => setOpen(true)}
          style={{ padding: "13px 22px", fontSize: 14 }}
        >
          <IconPlus size={16} />
          Crear nueva temporada
        </button>
      </div>

      {!teamId ? (
        <Card>
          <EmptyState
            icon={<IconCalendar size={34} />}
            title="Sin equipo activo"
            body="Entra con una cuenta que pertenezca a un equipo."
          />
        </Card>
      ) : loading ? (
        <SkeletonCard />
      ) : error ? (
        <Card>
          <EmptyState
            icon={<IconCalendar size={34} />}
            title="No se pudieron cargar las temporadas"
            body={error}
          />
        </Card>
      ) : SEASONS.length === 0 ? (
        <Card>
          <EmptyState
            icon={<IconCalendar size={34} />}
            title="Sin temporadas"
            body="Crea la primera y empieza a planificar jornadas."
            action={
              <button
                className="btn btn-accent"
                onClick={() => setOpen(true)}
                style={{ padding: "13px 22px" }}
              >
                Crear primera temporada
              </button>
            }
          />
        </Card>
      ) : (
        <>
          {active.map((s) => (
            <Card
              key={s.id}
              style={{ border: "1.5px solid var(--accent)", marginBottom: 24 }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: 20,
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className="chip">Activa</span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.16em",
                        color: "var(--text-faint)",
                      }}
                    >
                      {PHASE_LABEL[s.phase].toUpperCase()}
                    </span>
                  </div>
                  <h2 style={{ margin: "14px 0 0", fontSize: 26 }}>{s.name}</h2>
                </div>
                <Link
                  href={`/temporadas/${s.id}`}
                  className="btn btn-accent"
                  style={{ padding: "12px 20px", fontSize: 13.5 }}
                >
                  Abrir temporada
                </Link>
              </div>

              <div
                style={{
                  marginTop: 24,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 20,
                }}
              >
                {[
                  { l: "JORNADAS", v: String(s.totalMatchdays ?? "—") },
                  { l: "CATEGORÍA", v: s.category ?? "—" },
                                    { l: "FASE", v: PHASE_LABEL[s.phase], accent: true },
                ].map((k) => (
                  <div key={k.l}>
                    <div className="mono tw-stat-label">{k.l}</div>
                    <div
                      className="mono tw-stat-value"
                      style={{
                        fontSize: 24,
                        ...(k.accent ? { color: "var(--accent)" } : null),
                      }}
                    >
                      {k.v}
                    </div>
                  </div>
                ))}
              </div>

              <div
                style={{
                  marginTop: 20,
                  height: 8,
                  borderRadius: 999,
                  background: "var(--hair-strong)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "0%",
                    height: "100%",
                    background: "var(--accent)",
                  }}
                />
              </div>
            </Card>
          ))}

          {past.length > 0 && (
            <>
              <Eyebrow tone="faint" style={{ marginBottom: 12 }}>
                HISTÓRICO
              </Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {past.map((s) => (
                  <Link
                    key={s.id}
                    href={`/temporadas/${s.id}`}
                    style={{ color: "inherit" }}
                  >
                    <Card style={{ padding: 20, opacity: 0.8 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 160 }}>
                          <span
                            style={{
                              display: "block",
                              fontSize: 16,
                              fontWeight: 700,
                            }}
                          >
                            {s.name}
                          </span>
                          <span
                            className="mono"
                            style={{
                              display: "block",
                              marginTop: 5,
                              fontSize: 10,
                              letterSpacing: "0.14em",
                              color: "var(--text-faint)",
                            }}
                          >
                            {PHASE_LABEL[s.phase].toUpperCase()} · {s.totalMatchdays ?? "—"} JORNADAS
                          </span>
                        </span>
                        <span
                          className="mono"
                          style={{ fontSize: 13, color: "var(--text-muted)" }}
                        >
                          {PHASE_LABEL[s.phase]}
                        </span>
                        {!s.active && (
                          <span className="chip chip-mute">Archivada</span>
                        )}
                        <span style={{ color: "var(--text-faint)", display: "flex" }}>
                          <IconChevronRight size={16} />
                        </span>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Crear temporada ──────────────────────────────────────── */}
      <Modal open={open} onClose={() => setOpen(false)} labelledBy="nueva-temp" width={520}>
        <h2 id="nueva-temp" style={{ fontSize: 23 }}>
          Crear temporada
        </h2>
        {active.length > 0 && (
          <p
            style={{
              margin: "12px 0 0",
              padding: "12px 16px",
              borderRadius: 10,
              background: "var(--warning-soft)",
              border: "1px solid var(--warning)",
              color: "var(--warning)",
              fontSize: 12.5,
            }}
          >
            Ya tienes una temporada activa. Al crear una nueva, la actual se
            cierra y pasa al histórico.
          </p>
        )}

        <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 18 }}>
          <label>
            <span
              className="mono"
              style={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "var(--text-faint)",
                marginBottom: 7,
              }}
            >
              NOMBRE
            </span>
            <input
              type="text"
              placeholder="Temporada 26/27"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: "1px solid var(--hair-strong)",
                background: "var(--bg-card)",
                color: "var(--text)",
                fontSize: 14,
                outline: "none",
                fontFamily: "'Satoshi', sans-serif",
              }}
            />
          </label>

          <div>
            <span
              className="mono"
              style={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.2em",
                color: "var(--text-faint)",
                marginBottom: 8,
              }}
            >
              FORMATO
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {FORMATS.map((f) => {
                const on = format === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFormat(f.key)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "14px 16px",
                      borderRadius: 12,
                      cursor: "pointer",
                      textAlign: "left",
                      background: on ? "var(--accent-10)" : "var(--bg-card-2)",
                      color: on ? "var(--accent)" : "var(--text)",
                      border: `1.5px solid ${on ? "var(--accent)" : "transparent"}`,
                      fontFamily: "'Satoshi', sans-serif",
                    }}
                  >
                    <span style={{ fontSize: 14, fontWeight: on ? 700 : 500 }}>
                      {f.key}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: 9.5,
                        letterSpacing: "0.14em",
                        color: on ? "var(--accent)" : "var(--text-faint)",
                      }}
                    >
                      {f.note.toUpperCase()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="tw-form-grid">
            {[
              "NÚMERO DE JORNADAS · OPCIONAL",
              "NÚMERO DE ELIMINATORIAS · OPCIONAL",
            ].map((l) => (
              <label key={l}>
                <span
                  className="mono"
                  style={{
                    display: "block",
                    fontSize: 10,
                    letterSpacing: "0.18em",
                    color: "var(--text-faint)",
                    marginBottom: 7,
                  }}
                >
                  {l}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="mono"
                  style={{
                    width: "100%",
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: "1px solid var(--hair-strong)",
                    background: "var(--bg-card)",
                    color: "var(--text)",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </label>
            ))}
          </div>
        </div>

        <div
          style={{
            marginTop: 24,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            className="btn btn-ghost"
            onClick={() => setOpen(false)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button
            className="btn btn-accent"
            onClick={() => setOpen(false)}
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            {active.length > 0 ? "Cerrar y crear nueva" : "Crear temporada"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
