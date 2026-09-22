"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import {
  fetchClubHomeSchedule,
  fetchVenueHomeSchedule,
  setHomeMatchSlot,
  type DbClubHomeMatch,
} from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
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
 * Incluye los equipos INVITADOS: los que juegan en estas pistas sin ser del
 * club (`teams.venue_club_id`). Se mezclan con los propios porque para quien
 * reparte pistas son lo mismo —un partido que colocar—, pero se guardan por
 * caminos distintos y por eso llevan su marca.
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

/**
 * Fecha que toca guardar al elegir un día de la semana.
 *
 * Si la jornada ya tiene fecha, se MUEVE a ese día dentro de su propia semana
 * —no se inventa otra—; si no la tiene, se coge la próxima vez que caiga ese
 * día. Puerto de `snapToDow` de la app: sin esto, elegir «sábado» en una
 * jornada sin fecha dejaría «Sin fecha · 10:00», que no le sirve a nadie.
 *
 * Todo en hora local y montando la cadena a mano: `toISOString()` pasa por
 * UTC y en España puede devolver el día anterior.
 */
function dateForSlot(currentIso: string | null, day: number): string {
  const fmt = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(
      dt.getDate(),
    ).padStart(2, "0")}`;
  if (currentIso) {
    const [y, m, d] = currentIso.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + (day - dt.getDay()));
    return fmt(dt);
  }
  const dt = new Date();
  dt.setDate(dt.getDate() + ((day - dt.getDay() + 7) % 7));
  return fmt(dt);
}

const slotKey = (day: number, hour: string) => `${day}|${hour}`;
const slotLabel = (day: number, hour: string) => `${WEEKDAY[day]} ${hour}`;

/** Días por defecto de la liga (sábado y domingo), en orden de fin de semana. */
const DEFAULT_DAYS = [6, 0];
/** Horas por defecto cuando aún no hay ninguna franja declarada. */
const DEFAULT_HOURS = ["10:00", "12:00", "16:00", "18:00"];

/** Un partido de local, de un equipo propio o de uno invitado. */
type Fixture = DbClubHomeMatch & { is_guest: boolean };

export function ClubSchedule() {
  const { clubId } = useSession();
  const [reloadKey, setReloadKey] = useState(0);

  // Propios e invitados en la misma lista. Las dos RPC devuelven la misma
  // forma justamente para poder hacer esto.
  const { data, loading, error } = useAsync(
    async () => {
      const [propios, invitados] = await Promise.all([
        fetchClubHomeSchedule(clubId!),
        fetchVenueHomeSchedule(clubId!).catch(() => [] as DbClubHomeMatch[]),
      ]);
      return [
        ...propios.map((m) => ({ ...m, is_guest: false })),
        ...invitados.map((m) => ({ ...m, is_guest: true })),
      ] as Fixture[];
    },
    [clubId, reloadKey],
    !!clubId,
  );
  const fixtures: Fixture[] = useMemo(() => data ?? [], [data]);

  // Franjas favoritas por JORNADA. Antes se indexaba por NOMBRE de equipo, y
  // el nombre no identifica a nadie: «MEDIO CUDEYO A» existe masculino y
  // femenino, y un mismo equipo juega varias jornadas en casa — todas
  // compartían el mismo hueco y se pisaban entre ellas.
  const favByMatch = useMemo(() => {
    const m: Record<string, { day: number; hour: string }[]> = {};
    for (const f of fixtures) {
      m[f.matchday_id] = (f.preferred_home_slots ?? [])
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
        if (initedFor.current.has(f.matchday_id)) continue;
        initedFor.current.add(f.matchday_id);
        const day = dayOf(f.match_date);
        next[f.matchday_id] =
          f.match_time && day !== null
            ? { day, hour: f.match_time.slice(0, 5), court: f.location ?? "" }
            : null;
      }
      return next;
    });
  }, [fixtures]);

  const [picking, setPicking] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const assigned = fixtures.filter((f) => slots[f.matchday_id]).length;

  /**
   * Guarda de verdad. Antes este botón solo enseñaba el aviso de éxito: el
   * club creía que había puesto los horarios y avisado a su gente, y no había
   * pasado nada.
   *
   * Jornada a jornada, porque cada una puede ir por un camino distinto
   * (propia o invitada) y porque así un fallo en una no tumba a las demás.
   */
  async function guardar() {
    if (saving) return;
    setSaving(true);
    let ok = 0;
    const fallos: string[] = [];
    for (const f of fixtures) {
      const s = slots[f.matchday_id];
      if (!s) continue;
      const res = await guardedWrite("guardar el horario", () =>
        setHomeMatchSlot({
          matchdayId: f.matchday_id,
          isGuest: f.is_guest,
          matchDate: dateForSlot(f.match_date, s.day),
          matchTime: `${s.hour}:00`,
          location: s.court.trim() || null,
        }),
      );
      if (res.ok) ok += 1;
      else fallos.push(`${f.team_name}: ${res.reason}`);
    }
    setSaving(false);
    setReloadKey((k) => k + 1);
    setToast(
      fallos.length === 0
        ? `${ok} ${ok === 1 ? "horario guardado y avisado" : "horarios guardados y avisados"}`
        : `Guardados ${ok}. Sin guardar → ${fallos[0]}`,
    );
  }

  // La rejilla del selector se DERIVA de los datos: los días y horas que los
  // equipos han marcado como favoritos, más el fin de semana y unas horas
  // razonables de respaldo. Antes era una lista fija de maqueta que no podía
  // representar la mitad de las franjas reales.
  const { gridDays, gridHours } = useMemo(() => {
    const days = new Set<number>(DEFAULT_DAYS);
    const hours = new Set<string>();
    for (const list of Object.values(favByMatch)) {
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
  }, [favByMatch, slots]);

  function assign(matchdayId: string, day: number, hour: string) {
    setSlots((s) => ({
      ...s,
      [matchdayId]: { day, hour, court: s[matchdayId]?.court ?? "" },
    }));
    setPicking(null);
  }

  function setCourt(matchdayId: string, court: string) {
    setSlots((s) => ({
      ...s,
      [matchdayId]: s[matchdayId] ? { ...s[matchdayId]!, court } : null,
    }));
  }

  const favSlots = picking ? (favByMatch[picking] ?? []) : [];
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
              const s = slots[f.matchday_id];
              return (
                <div key={f.matchday_id} className="tw-sched-row">
                  <span style={{ minWidth: 0 }}>
                    <span
                      className="truncate"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      <span className="truncate">{f.team_name}</span>
                      {/* El club no administra a un invitado: solo le pone
                          hora. Decirlo evita que alguien espere aquí su
                          plantilla o su alineación. */}
                      {f.is_guest && (
                        <Chip tone="mute" plain>
                          Invitado
                        </Chip>
                      )}
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
                    onClick={() => setPicking(f.matchday_id)}
                    aria-label={`Elegir día y hora para ${f.team_name}`}
                    style={{ justifyContent: "flex-start" }}
                  >
                    {s ? slotLabel(s.day, s.hour) : "Elegir hora"}
                  </Btn>

                  <Input
                    type="text"
                    value={s?.court ?? ""}
                    disabled={!s}
                    onChange={(e) => setCourt(f.matchday_id, e.target.value)}
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
            <Btn
              variant="accent"
              onClick={() => void guardar()}
              disabled={saving || assigned === 0}
              icon={<IconCheck size={15} />}
            >
              {saving ? "Guardando…" : "Guardar y avisar"}
            </Btn>
            <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
              Los jugadores reciben el día, la hora y la pista. En los equipos
              invitados el aviso va a su capitán.
            </span>
          </div>
        </Card>

        {/* ── Franjas favoritas ──────────────────────────────────── */}
        <Card flush>
          <CardHead title="Franjas favoritas" sub="Las que cada equipo ha marcado" />
          {fixtures.map((f) => {
            const list = favByMatch[f.matchday_id] ?? [];
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
          title="Horarios guardados"
          body={toast}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
