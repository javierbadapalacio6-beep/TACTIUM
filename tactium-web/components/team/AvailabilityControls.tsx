"use client";

import { useState } from "react";

import {
  MAYBE_REASONS,
  STATUS_LABEL,
  type AvailRow,
  type AvailStatus,
  type MaybeReason,
} from "@/lib/queries";
import { Btn } from "@/components/ui";

/*
 * Controles de «Disponibilidad en un toque» para la web. Espejo de la app
 * (TACTIUM/src/features/availability): Voy · Duda · No puedo; la duda pide
 * motivo y nota, y cierra 24 h antes del partido.
 */

export const STATUS_COLOR: Record<AvailStatus, { c: string; bg: string }> = {
  yes: { c: "var(--accent)", bg: "var(--accent-10)" },
  maybe: { c: "var(--warning)", bg: "var(--warning-soft)" },
  no: { c: "var(--error)", bg: "var(--error-soft)" },
};

const DAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

/** «vie 10:30» */
export function formatDeadline(d: Date): string {
  return `${DAYS[d.getDay()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** «24:49 h» / «3 días» hasta una fecha. */
export function timeLeft(to: Date): string {
  const ms = to.getTime() - Date.now();
  if (ms <= 0) return "cerrado";
  const h = Math.floor(ms / 3_600_000);
  if (h >= 48) return `${Math.floor(h / 24)} días`;
  return `${h}:${String(Math.floor((ms % 3_600_000) / 60_000)).padStart(2, "0")} h`;
}

export function reasonLabel(r: MaybeReason | null | undefined): string | null {
  return r ? MAYBE_REASONS.find((x) => x.id === r)?.label ?? null : null;
}

/**
 * Tres botones + panel de duda. `value` null = sin contestar. En duda (o con
 * la duda ya cerrada) solo quedan Voy / No puedo: la duda tiene que resolverse.
 */
export function RsvpButtons({
  value,
  maybeClosed,
  deadline,
  disabled,
  onAnswer,
  forName,
}: {
  value: AvailRow | undefined;
  maybeClosed: boolean;
  deadline: Date | null;
  disabled?: boolean;
  onAnswer: (status: AvailStatus, reason?: MaybeReason | null, note?: string | null) => void;
  /** Capitán marcando por otro: cambia el texto del panel de duda. */
  forName?: string;
}) {
  const status = value?.status ?? null;
  const [maybeOpen, setMaybeOpen] = useState(false);
  const [reason, setReason] = useState<MaybeReason | null>(value?.reason ?? null);
  const [note, setNote] = useState(value?.note ?? "");
  const options: AvailStatus[] =
    status === "maybe" || maybeClosed ? ["yes", "no"] : ["yes", "maybe", "no"];

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        {options.map((s) => {
          const on = status === s;
          const col = STATUS_COLOR[s];
          return (
            <button
              key={s}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => {
                if (s === "maybe") {
                  setMaybeOpen((o) => !o);
                  return;
                }
                setMaybeOpen(false);
                onAnswer(s);
              }}
              className="btn btn-ghost btn-sm"
              style={{
                flex: 1,
                minHeight: 40,
                ...(on
                  ? s === "yes"
                    ? { background: col.c, color: "var(--text-inverse)", borderColor: col.c, fontWeight: 700 }
                    : { background: col.bg, color: col.c, borderColor: col.c, fontWeight: 700 }
                  : status
                    ? { opacity: 0.65 }
                    : null),
              }}
            >
              {STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      {maybeOpen && (
        <div
          style={{
            display: "grid",
            gap: 10,
            padding: 12,
            borderRadius: 12,
            border: "1px solid var(--warning)",
            background: "var(--warning-soft)",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>
            {forName ? `¿Qué le frena a ${forName}?` : "¿Qué te frena?"}{" "}
            <span style={{ fontWeight: 400, color: "var(--text-muted)" }}>(opcional)</span>
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {MAYBE_REASONS.map((r) => {
              const on = reason === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setReason(on ? null : r.id)}
                  className="btn btn-ghost btn-sm"
                  style={on ? { borderColor: "var(--warning)", color: "var(--warning)", fontWeight: 700 } : undefined}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <input
            className="input"
            value={note}
            maxLength={140}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Añade una nota… «salgo de guardia a las 10»"
            aria-label="Nota de la duda"
          />
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Btn
              variant="accent"
              onClick={() => {
                setMaybeOpen(false);
                onAnswer("maybe", reason, note.trim() || null);
              }}
            >
              Guardar duda
            </Btn>
            {deadline && (
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Si no se decide antes del {formatDeadline(deadline)}, contará como «No puedo».
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Barra apilada de la convocatoria + leyenda. */
export function ConvoBar({
  counts,
}: {
  counts: { yes: number; maybe: number; no: number; pending: number; total: number };
}) {
  const total = Math.max(1, counts.total);
  const segs = [
    { n: counts.yes, color: "var(--accent)", label: "Van" },
    { n: counts.maybe, color: "var(--warning)", label: "Duda" },
    { n: counts.no, color: "var(--error)", label: "No pueden" },
    { n: counts.pending, color: "var(--surface-line-hi)", label: "Sin contestar" },
  ];
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div
        role="img"
        aria-label={`${counts.yes} van, ${counts.maybe} en duda, ${counts.no} no pueden, ${counts.pending} sin contestar`}
        style={{ display: "flex", gap: 2, height: 10, borderRadius: 5, overflow: "hidden", background: "var(--surface-line)" }}
      >
        {segs
          .filter((s) => s.n > 0)
          .map((s) => (
            <span key={s.label} style={{ flex: s.n / total, background: s.color }} />
          ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12.5 }}>
        {segs.map((s) => (
          <span key={s.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-muted)" }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                background: s.label === "Sin contestar" ? "transparent" : s.color,
                border: s.label === "Sin contestar" ? "1px dashed var(--text-faint)" : undefined,
              }}
            />
            {s.label} <b className="mono" style={{ color: "var(--text)" }}>{s.n}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
