"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { DAYS, HOURS } from "@/lib/club-data";
import {
  fetchClubHomeSchedule,
  type DbClubHomeMatch,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { EmptyState, SkeletonCard, Toast } from "@/components/states";
import { IconCheck, IconClock } from "@/components/Icon";

/**
 * Horarios de local.
 *
 * Es un lienzo, no un formulario: el club asigna día, hora y pista a cada
 * equipo que juega en casa. Al abrir el selector, las franjas que ese equipo
 * marcó como favoritas se resaltan en accent; las demás quedan atenuadas pero
 * siguen siendo elegibles.
 *
 * Datos REALES (solo lectura): los partidos de local, sus horas/pistas actuales
 * y las franjas favoritas salen de la RPC `get_club_home_schedule`. Asignar y
 * «guardar y avisar» siguen en estado local — la escritura llega en la fase 2.
 */
interface Slot {
  day: string;
  hour: string;
  court: string;
}

const WEEKDAY = ["DOM", "LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB"];
const dayOf = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? "" : WEEKDAY[d.getDay()];
};

export function ClubSchedule() {
  const { clubId } = useSession();
  const { data, loading, error } = useAsync(
    () => fetchClubHomeSchedule(clubId!),
    [clubId],
    !!clubId,
  );
  const fixtures: DbClubHomeMatch[] = useMemo(() => data ?? [], [data]);

  // Franjas favoritas reales por equipo (horas 'HH:MM').
  const favByTeam = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const f of fixtures) m[f.team_name] = f.preferred_home_slots ?? [];
    return m;
  }, [fixtures]);

  const [slots, setSlots] = useState<Record<string, Slot | null>>({});
  // Inicializa los slots con lo que ya hay en la BD cuando llegan los datos.
  // Solo la primera vez por equipo — no pisa lo que el usuario toque en sesión.
  const initedFor = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!fixtures.length) return;
    setSlots((prev) => {
      const next = { ...prev };
      for (const f of fixtures) {
        if (initedFor.current.has(f.team_name)) continue;
        initedFor.current.add(f.team_name);
        next[f.team_name] = f.match_time
          ? {
              day: dayOf(f.match_date),
              hour: f.match_time.slice(0, 5),
              court: f.location ?? "",
            }
          : null;
      }
      return next;
    });
  }, [fixtures]);

  const [picking, setPicking] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  const assigned = fixtures.filter((f) => slots[f.team_name]).length;

  function assign(team: string, day: string, hour: string) {
    setSlots((s) => ({
      ...s,
      [team]: { day, hour, court: s[team]?.court ?? "" },
    }));
    setPicking(null);
  }

  function setCourt(team: string, court: string) {
    setSlots((s) => ({
      ...s,
      [team]: s[team] ? { ...s[team]!, court } : null,
    }));
  }

  const favHours = picking ? (favByTeam[picking] ?? []) : [];

  if (loading) return <SkeletonCard />;
  if (error) {
    return (
      <Card>
        <EmptyState
          icon={<IconClock size={34} />}
          title="No se pudo cargar el horario"
          body={error}
        />
      </Card>
    );
  }
  if (fixtures.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<IconClock size={34} />}
          title="Sin partidos de local"
          body="Cuando tus equipos tengan jornadas en casa por jugar, aparecerán aquí para asignarles día, hora y pista."
        />
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 22 }}>
        <Eyebrow>HORARIOS DE LOCAL</Eyebrow>
        <h1 style={{ marginTop: 10, fontSize: 30 }}>Horarios de local</h1>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13.5,
            color: "var(--text-muted)",
            textWrap: "pretty",
          }}
        >
          Asigna día, hora y pista a los equipos que juegan en casa esta jornada.
        </p>
      </div>

      <div className="tw-schedule-grid">
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "18px 20px",
              borderBottom: "1px solid var(--hair)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <Eyebrow>PARTIDOS DE LOCAL</Eyebrow>
            <span
              className="mono"
              style={{
                fontSize: 10.5,
                letterSpacing: "0.14em",
                color:
                  assigned === fixtures.length
                    ? "var(--accent)"
                    : "var(--warning)",
              }}
            >
              {assigned}/{fixtures.length} ASIGNADOS
            </span>
          </div>

          <div className="tw-sched-head">
            <span>Equipo</span>
            <span>Día y hora</span>
            <span>Pista / lugar</span>
            <span>Estado</span>
          </div>

          {fixtures.map((f, i) => {
            const s = slots[f.team_name];
            return (
              <div
                key={f.matchday_id}
                className="tw-sched-row"
                style={{
                  borderBottom:
                    i === fixtures.length - 1 ? "none" : "1px solid var(--hair)",
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, fontWeight: 700 }}>
                    {f.team_name}
                  </span>
                  <span
                    style={{
                      display: "block",
                      marginTop: 3,
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {f.jornada_number != null ? `J·${f.jornada_number} · ` : ""}
                    vs {f.opponent ?? "—"}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => setPicking(f.team_name)}
                  className="mono"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1px solid ${s ? "var(--accent-40)" : "var(--hair-strong)"}`,
                    background: s ? "var(--accent-10)" : "var(--bg-card-2)",
                    color: s ? "var(--accent)" : "var(--text-faint)",
                    fontSize: 12,
                    letterSpacing: "0.1em",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {s ? `${s.day} ${s.hour}`.trim() : "Sin fecha · HH:MM"}
                </button>

                <input
                  type="text"
                  value={s?.court ?? ""}
                  disabled={!s}
                  onChange={(e) => setCourt(f.team_name, e.target.value)}
                  placeholder="Pista 1, Central…"
                  aria-label={`Pista para ${f.team_name}`}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: "1px solid var(--hair-strong)",
                    background: s ? "var(--bg-card-2)" : "transparent",
                    color: "var(--text)",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "'Satoshi', sans-serif",
                    opacity: s ? 1 : 0.5,
                  }}
                />

                <span>
                  {s ? (
                    <span className="chip">Listo</span>
                  ) : (
                    <span className="chip chip-warning">Sin horario</span>
                  )}
                </span>
              </div>
            );
          })}

          <div style={{ padding: "18px 20px", borderTop: "1px solid var(--hair)" }}>
            <button
              className="btn btn-accent"
              onClick={() => setToast(true)}
              style={{ padding: "13px 22px", fontSize: 13.5 }}
            >
              <IconCheck size={15} />
              Guardar y avisar al equipo
            </button>
          </div>
        </Card>

        {/* ── Franjas favoritas ──────────────────────────────────── */}
        <Card>
          <Eyebrow>FRANJAS FAVORITAS POR EQUIPO</Eyebrow>
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            {fixtures.map((f) => {
              const list = favByTeam[f.team_name] ?? [];
              return (
                <div key={f.matchday_id}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
                    {f.team_name}
                  </div>
                  {list.length === 0 ? (
                    <span
                      className="mono"
                      style={{
                        fontSize: 10,
                        letterSpacing: "0.14em",
                        color: "var(--text-faint)",
                      }}
                    >
                      SIN FRANJAS FAVORITAS
                    </span>
                  ) : (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {list.map((slot) => (
                        <span key={slot} className="chip">
                          {slot}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Selector día × hora ──────────────────────────────────── */}
      <Modal
        open={picking !== null}
        onClose={() => setPicking(null)}
        labelledBy="elige-hora"
        width={560}
      >
        <Eyebrow>ELIGE DÍA Y HORA</Eyebrow>
        <h2 id="elige-hora" style={{ margin: "14px 0 6px", fontSize: 23 }}>
          {picking}
        </h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-muted)" }}>
          {favHours.length > 0
            ? "Sus franjas favoritas van resaltadas · o elige otro día y hora."
            : "Este equipo no ha marcado franjas favoritas."}
        </p>

        <div className="tw-slot-grid">
          <span />
          {HOURS.map((h) => (
            <span
              key={h}
              className="mono"
              style={{
                fontSize: 9.5,
                letterSpacing: "0.12em",
                color: "var(--text-faint)",
                textAlign: "center",
              }}
            >
              {h}
            </span>
          ))}

          {DAYS.map((d) => (
            // Fragment con key: si no, React avisa por cada fila de la rejilla.
            <Fragment key={d}>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  color: "var(--text-faint)",
                  alignSelf: "center",
                }}
              >
                {d}
              </span>
              {HOURS.map((h) => {
                const fav = favHours.includes(h);
                const cur =
                  picking && slots[picking]?.day === d && slots[picking]?.hour === h;
                return (
                  <button
                    key={d + h}
                    type="button"
                    onClick={() => picking && assign(picking, d, h)}
                    className="mono"
                    style={{
                      padding: "11px 4px",
                      borderRadius: 9,
                      fontSize: 10,
                      cursor: "pointer",
                      background: cur
                        ? "var(--accent)"
                        : fav
                          ? "var(--accent-10)"
                          : "var(--bg-card-2)",
                      color: cur
                        ? "var(--text-inverse)"
                        : fav
                          ? "var(--accent)"
                          : "var(--text-faint)",
                      border: `1px solid ${
                        cur ? "var(--accent)" : fav ? "var(--accent-40)" : "transparent"
                      }`,
                      opacity: fav || cur ? 1 : 0.6,
                      transition: "all var(--dur-fast) var(--ease)",
                    }}
                  >
                    {cur ? "✓" : fav ? "★" : "·"}
                  </button>
                );
              })}
            </Fragment>
          ))}
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            className="btn btn-ghost"
            onClick={() => setPicking(null)}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
        </div>
      </Modal>

      {toast && (
        <Toast
          title="Horario enviado al equipo"
          body="Los jugadores reciben un aviso con el día, la hora y la pista."
          onClose={() => setToast(false)}
        />
      )}
    </div>
  );
}
