"use client";

import { Field, Input, Note } from "@/components/ui";
import {
  DAY_KINDS,
  DAY_KIND_LABEL,
  dayKindOf,
  playWindowsValid,
  windowForDay,
  type DayKind,
  type PlayWindows,
} from "@/lib/tournament-windows";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const dayLabel = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DOW[dt.getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};

/**
 * Franjas de juego del torneo: a qué horas se juega entre semana, en fin de semana y en festivos. El horario, la
 * tabla del club y la rejilla de inscripción solo usan estas horas. Los días del torneo se enseñan con su franja y
 * se pueden marcar como festivo. Espejo del editor de la app.
 */
export function PlayWindowsEditor({
  windows,
  onWindows,
  days,
  holidays,
  onHolidays,
}: {
  windows: PlayWindows;
  onWindows: (next: PlayWindows) => void;
  /** Días del torneo (ISO). Vacío si aún no hay fechas. */
  days: string[];
  holidays: string[];
  onHolidays: (next: string[]) => void;
}) {
  const valid = playWindowsValid(windows);
  const set = (k: DayKind, key: "from" | "to", v: string) =>
    onWindows({ ...windows, [k]: { ...windows[k], [key]: v } });
  const toggle = (iso: string) =>
    onHolidays(holidays.includes(iso) ? holidays.filter((x) => x !== iso) : [...holidays, iso].sort());

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Franjas de juego</div>
        <div style={{ color: "var(--text-muted)", fontSize: 12.5, marginTop: 2 }}>
          A qué horas se juega cada tipo de día. El horario y la inscripción solo ofrecen estas horas.
        </div>
      </div>

      {DAY_KINDS.map((k) => (
        <div key={k} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>{DAY_KIND_LABEL[k]}</div>
          <div className="tw-form-grid">
            <Field label="Desde" htmlFor={`pw-${k}-from`}>
              <Input
                id={`pw-${k}-from`}
                type="time"
                value={windows[k].from}
                step={1800}
                onChange={(e) => set(k, "from", e.target.value)}
              />
            </Field>
            <Field label="Hasta" htmlFor={`pw-${k}-to`}>
              <Input
                id={`pw-${k}-to`}
                type="time"
                value={windows[k].to}
                step={1800}
                min={windows[k].from || undefined}
                onChange={(e) => set(k, "to", e.target.value)}
              />
            </Field>
          </div>
          {k === "holiday" && (
            <div style={{ color: "var(--text-faint)", fontSize: 12.5 }}>
              Solo se usa en los días que marques como festivo.
            </div>
          )}
        </div>
      ))}
      {!valid && <Note tone="error">En cada franja, la hora de fin tiene que ser posterior a la de inicio.</Note>}

      {days.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Días del torneo</div>
          <div style={{ color: "var(--text-muted)", fontSize: 12.5 }}>
            Pulsa un día para marcarlo como festivo (usa la franja de festivos).
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {days.map((iso) => {
              const w = windowForDay({ play_windows: windows, holidays }, iso);
              const holiday = dayKindOf(iso, holidays) === "holiday";
              return (
                <button
                  key={iso}
                  type="button"
                  aria-pressed={holiday}
                  onClick={() => toggle(iso)}
                  style={{
                    cursor: "pointer",
                    textAlign: "left",
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: `1px solid ${holiday ? "var(--accent)" : "var(--line-strong)"}`,
                    background: holiday ? "var(--accent)" : "transparent",
                    color: holiday ? "var(--text-inverse)" : "var(--text)",
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {dayLabel(iso)}
                    {holiday ? " · festivo" : ""}
                  </div>
                  <div className="mono" style={{ fontSize: 12, opacity: 0.85 }}>
                    {w.from}–{w.to}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div style={{ color: "var(--text-faint)", fontSize: 12.5 }}>
          Cuando pongas las fechas del torneo verás aquí cada día con su franja.
        </div>
      )}
    </div>
  );
}
