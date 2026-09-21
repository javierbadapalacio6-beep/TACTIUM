"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchClubHomeSchedule,
  type DbClubHomeMatch,
} from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import {
  Btn,
  Card,
  CardHead,
  Chip,
  Input,
  Modal,
  PageHeader,
} from "@/components/ui";
import { EmptyState, SkeletonPage, Toast } from "@/components/states";
import { IconCheck, IconClock } from "@/components/Icon";

/**
 * Horarios de local.
 *
 * Es un lienzo, no un formulario: el club asigna día, hora y pista a cada
 * equipo que juega en casa. Al abrir el selector, las franjas que ese equipo
 * marcó como favoritas se resaltan; las demás quedan atenuadas pero siguen
 * siendo elegibles.
 *
 * Datos REALES (solo lectura): los partidos de local, sus horas/pistas actuales
 * y las franjas favoritas salen de la RPC `get_club_home_schedule`. Asignar y
 * «guardar y avisar» siguen en estado local — la escritura llega en la fase 2.
 */
interface Slot {
  /** Índice de día de la semana, como `Date.getDay()` (0 = domingo). */
  day: number;
  hour: string;
  court: string;
}

const WEEKDAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Día de la semana (0-6) de una fecha ISO; null si no hay fecha. */
const dayOf = (iso: string | null): number | null => {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.getDay();
};

/**
 * Las franjas favoritas se guardan como `dow|HH:MM` (p. ej. `6|10:00`), igual
 * que en la app. Antes se pintaban en crudo y la rejilla las comparaba contra
 * horas sueltas, así que NUNCA casaban: ni se resaltaban ni se leían.
 */
function parseSlot(raw: string): { day: number; hour: string } | null {
  const [d, h] = raw.split("|");
  const day = Number(d);
  if (!h || Number.isNaN(day) || day < 0 || day > 6) return null;
  return { day, hour: h.slice(0, 5) };
}

const slotKey = (day: number, hour: string) => `${day}|${hour}`;
const slotLabel = (day: number, hour: string) => `${WEEKDAY[day]} ${hour}`;

/** Días por defecto de la liga (sábado y domingo), en orden de fin de semana. */
const DEFAULT_DAYS = [6, 0];
/** Horas por defecto cuando aún no hay ninguna franja declarada. */
const DEFAULT_HOURS = ["10:00", "12:00", "16:00", "18:00"];

export function ClubSchedule() {
  const { clubId } = useSession();
  const { data, loading, error } = useAsync(
    () => fetchClubHomeSchedule(clubId!),
    [clubId],
    !!clubId,
  );
  const fixtures: DbClubHomeMatch[] = useMemo(() => data ?? [], [data]);

  // Franjas favoritas reales por equipo, ya interpretadas.
  const favByTeam = useMemo(() => {
    const m: Record<string, { day: number; hour: string }[]> = {};
    for (const f of fixtures) {
      m[f.team_name] = (f.preferred_home_slots ?? [])
        .map(parseSlot)
        .filter((s): s is { day: number; hour: string } => s !== null);
    }
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
        const day = dayOf(f.match_date);
        next[f.team_name] =
          f.match_time && day !== null
            ? { day, hour: f.match_time.slice(0, 5), court: f.location ?? "" }
            : null;
      }
      return next;
    });
  }, [fixtures]);

  const [picking, setPicking] = useState<string | null>(null);
  const [toast, setToast] = useState(false);

  const assigned = fixtures.filter((f) => slots[f.team_name]).length;

  // La rejilla del selector se DERIVA de los datos: los días y horas que los
  // equipos han marcado como favoritos, más el fin de semana y unas horas
  // razonables de respaldo. Antes era una lista fija de maqueta que no podía
  // representar la mitad de las franjas reales.
  const { gridDays, gridHours } = useMemo(() => {
    const days = new Set<number>(DEFAULT_DAYS);
    const hours = new Set<string>();
    for (const list of Object.values(favByTeam)) {
      for (const s of list) {
        days.add(s.day);
        hours.add(s.hour);
      }
    }
    for (const s of Object.values(slots)) {
      if (s) {
        days.add(s.day);
        hours.add(s.hour);
      }
    }
    if (hours.size === 0) DEFAULT_HOURS.forEach((h) => hours.add(h));
    return {
      // Sábado y domingo primero, el resto detrás en orden natural.
      gridDays: [...days].sort((a, b) => {
        const rank = (d: number) => (d === 6 ? -2 : d === 0 ? -1 : d);
        return rank(a) - rank(b);
      }),
      gridHours: [...hours].sort(),
    };
  }, [favByTeam, slots]);

  function assign(team: string, day: number, hour: string) {
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

  const favSlots = picking ? (favByTeam[picking] ?? []) : [];
  const favKeys = new Set(favSlots.map((s) => slotKey(s.day, s.hour)));

  const header = (
    <PageHeader
      title="Horarios de local"
      lede="Asigna día, hora y pista a los equipos que juegan en casa esta jornada."
    />
  );

  if (loading) return <SkeletonPage />;
  if (error) {
    return (
      <div className="tw-page">
        {header}
        <Card>
          <EmptyState
            icon={<IconClock size={24} />}
            title="No se pudo cargar el horario"
            body={error}
          />
        </Card>
      </div>
    );
  }
  if (fixtures.length === 0) {
    return (
      <div className="tw-page">
        {header}
        <Card>
          <EmptyState
            icon={<IconClock size={24} />}
            title="Sin partidos de local"
            body="Cuando tus equipos tengan jornadas en casa por jugar, aparecerán aquí para asignarles día, hora y pista."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="tw-page">
      {header}

      <div className="tw-schedule-grid">
        <Card flush>
          <CardHead title="Partidos de local" count={fixtures.length}>
            <Chip tone={assigned === fixtures.length ? "accent" : "warning"}>
              {assigned} de {fixtures.length} asignados
            </Chip>
          </CardHead>

          <div className="tw-table-wrap">
            <div className="tw-sched-head">
              <span>Equipo</span>
              <span>Día y hora</span>
              <span>Pista o lugar</span>
              <span>Estado</span>
            </div>

            {fixtures.map((f) => {
              const s = slots[f.team_name];
              return (
                <div key={f.matchday_id} className="tw-sched-row">
                  <span style={{ minWidth: 0 }}>
                    <span className="truncate" style={{ display: "block", fontSize: 14, fontWeight: 700, letterSpacing: "-0.01em" }}>
                      {f.team_name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 2,
                        fontSize: 12.5,
                        color: "var(--text-muted)",
                      }}
                    >
                      {f.jornada_number != null ? `Jornada ${f.jornada_number} · ` : ""}
                      vs {f.opponent ?? "—"}
                    </span>
                  </span>

                  <Btn
                    size="sm"
                    variant={s ? "tint" : "ghost"}
                    onClick={() => setPicking(f.team_name)}
                    aria-label={`Elegir día y hora para ${f.team_name}`}
                    style={{ justifyContent: "flex-start" }}
                  >
                    {s ? slotLabel(s.day, s.hour) : "Elegir hora"}
                  </Btn>

                  <Input
                    type="text"
                    value={s?.court ?? ""}
                    disabled={!s}
                    onChange={(e) => setCourt(f.team_name, e.target.value)}
                    placeholder="Pista 1, Central…"
                    aria-label={`Pista para ${f.team_name}`}
                  />

                  <span>
                    {s ? <Chip>Listo</Chip> : <Chip tone="warning">Sin horario</Chip>}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="card-foot">
            <Btn variant="accent" onClick={() => setToast(true)} icon={<IconCheck size={15} />}>
              Guardar y avisar
            </Btn>
            <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
              Los jugadores reciben el día, la hora y la pista.
            </span>
          </div>
        </Card>

        {/* ── Franjas favoritas ──────────────────────────────────── */}
        <Card flush>
          <CardHead title="Franjas favoritas" sub="Las que cada equipo ha marcado" />
          {fixtures.map((f) => {
            const list = favByTeam[f.team_name] ?? [];
            return (
              <div
                key={f.matchday_id}
                className="list-row"
                style={{ flexDirection: "column", alignItems: "stretch", gap: 8, minHeight: 0 }}
              >
                <span className="truncate" style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: "-0.01em" }}>
                  {f.team_name}
                </span>
                {list.length === 0 ? (
                  <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
                    Sin franjas favoritas
                  </span>
                ) : (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {list.map((s) => (
                      <Chip key={slotKey(s.day, s.hour)} tone="mute" plain>
                        {slotLabel(s.day, s.hour)}
                      </Chip>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </div>

      {/* ── Selector día × hora ──────────────────────────────────── */}
      <Modal
        open={picking !== null}
        onClose={() => setPicking(null)}
        labelledBy="elige-hora"
        width={560}
        title={picking ?? ""}
        lede={
          favSlots.length > 0
            ? "Sus franjas favoritas van resaltadas. También puedes elegir otro día y hora."
            : "Este equipo no ha marcado franjas favoritas."
        }
        footer={<Btn onClick={() => setPicking(null)}>Cancelar</Btn>}
      >
        <div
          className="tw-slot-grid"
          style={{ gridTemplateColumns: `52px repeat(${gridHours.length}, 1fr)` }}
        >
          <span />
          {gridHours.map((h) => (
            <span
              key={h}
              className="mono"
              style={{ fontSize: 11, color: "var(--text-faint)", textAlign: "center" }}
            >
              {h}
            </span>
          ))}

          {gridDays.map((d) => (
            // Fragment con key: si no, React avisa por cada fila de la rejilla.
            <Fragment key={d}>
              <span className="grid-head" style={{ alignSelf: "center" }}>
                {WEEKDAY[d]}
              </span>
              {gridHours.map((h) => {
                const fav = favKeys.has(slotKey(d, h));
                const cur =
                  picking && slots[picking]?.day === d && slots[picking]?.hour === h;
                return (
                  <button
                    key={slotKey(d, h)}
                    type="button"
                    onClick={() => picking && assign(picking, d, h)}
                    aria-label={`${WEEKDAY[d]} ${h}${fav ? ", franja favorita" : ""}`}
                    aria-pressed={!!cur}
                    style={{
                      minHeight: 36,
                      padding: 0,
                      borderRadius: "var(--r-sm)",
                      fontSize: 12,
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
                        cur ? "var(--accent)" : fav ? "var(--accent-40)" : "var(--line)"
                      }`,
                      transition: "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
                    }}
                  >
                    {cur ? <IconCheck size={14} /> : fav ? "★" : "·"}
                  </button>
                );
              })}
            </Fragment>
          ))}
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
