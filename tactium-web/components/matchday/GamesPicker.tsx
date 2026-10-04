"use client";

import { useState, type CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * Botonera de juegos 0-7 por set (espejo de la app:
 * TACTIUM/src/features/home/components/match/GamesPicker.tsx).
 *
 * La usan Resultados de liga y Amistosos. Dos filas (nosotros / rival), un
 * toque por lado; el set se cierra solo y se abre el siguiente; con 2-0 el
 * tercero desaparece. Un resultado imposible (7-4, 6-5) avisa en ámbar sin
 * bloquear.
 */

export interface SetScore {
  us: number | null;
  them: number | null;
}

export const emptySets = (n = 3): SetScore[] =>
  Array.from({ length: n }, () => ({ us: null, them: null }));

export const isSetDone = (s: SetScore) =>
  s.us !== null && s.them !== null && s.us !== s.them;

/** 6-0…6-4, 7-5 o 7-6; super tie-break (>7) a 10 con 2 de ventaja. */
export function isPlausibleSet(us: number, them: number): boolean {
  const hi = Math.max(us, them);
  const lo = Math.min(us, them);
  if (hi > 7) return hi >= 10 && hi - lo >= 2 && (hi === 10 || hi - lo === 2);
  if (hi === 6) return lo <= 4;
  if (hi === 7) return lo === 5 || lo === 6;
  return false;
}

export function summarize(sets: SetScore[]) {
  let usSets = 0;
  let themSets = 0;
  for (const s of sets) {
    if (!isSetDone(s)) continue;
    if ((s.us as number) > (s.them as number)) usSets++;
    else themSets++;
  }
  return { usSets, themSets, decided: usSets >= 2 || themSets >= 2, won: usSets > themSets };
}

export function thirdSetNeeded(sets: SetScore[]): boolean {
  const third = sets[2];
  if (third && (third.us !== null || third.them !== null)) return true;
  const [a, b] = sets;
  if (!a || !b || !isSetDone(a) || !isSetDone(b)) return true;
  return ((a.us as number) > (a.them as number)) !== ((b.us as number) > (b.them as number));
}

export const setsLine = (sets: SetScore[]) =>
  sets
    .filter((s) => s.us !== null && s.them !== null)
    .map((s) => `${s.us}-${s.them}`)
    .join(" ");

/* ── Fila de botones ──────────────────────────────────────────────── */
export function GamesPicker({
  label,
  value,
  onChange,
  tone,
  max = 7,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  tone: "us" | "them";
  max?: number;
  disabled?: boolean;
}) {
  const reduce = useReducedMotion();
  const nums = Array.from({ length: max + 1 }, (_, i) => i);
  return (
    <div style={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr)", gap: 8, alignItems: "center" }}>
      <span className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
        {label}
      </span>
      <div
        role="radiogroup"
        aria-label={`Juegos de ${label}`}
        style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0,1fr))", gap: 4 }}
      >
        {nums.map((n) => {
          const on = value === n;
          const style: CSSProperties = {
            height: 36,
            borderRadius: 8,
            border: "1px solid var(--line)",
            background: "var(--bg-card-2)",
            color: "var(--text-muted)",
            fontWeight: 700,
            fontSize: 14,
            cursor: disabled ? "default" : "pointer",
            opacity: disabled && !on ? 0.45 : 1,
            ...(on && tone === "us"
              ? { background: "var(--accent)", borderColor: "var(--accent)", color: "var(--text-inverse)" }
              : null),
            ...(on && tone === "them"
              ? { background: "var(--bg-card-3)", borderColor: "var(--text-faint)", color: "var(--text)" }
              : null),
          };
          return (
            <motion.button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${n} juegos`}
              disabled={disabled}
              className="mono"
              style={style}
              animate={on && !reduce ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              transition={{ duration: 0.25 }}
              onClick={() => onChange(on ? null : n)}
            >
              {n}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Editor de sets ───────────────────────────────────────────────── */
export function SetsEditor({
  sets,
  onChange,
  usLabel,
  themLabel,
  disabled,
  allowSuperTiebreak,
}: {
  sets: SetScore[];
  onChange: (setIdx: number, side: "us" | "them", value: number | null) => void;
  usLabel: string;
  themLabel: string;
  disabled?: boolean;
  allowSuperTiebreak?: boolean;
}) {
  const reduce = useReducedMotion();
  const [manualOpen, setManualOpen] = useState<number | null>(null);
  const third = sets[2];
  const [superTb, setSuperTb] = useState(!!third && ((third.us ?? 0) > 7 || (third.them ?? 0) > 7));

  const visible = thirdSetNeeded(sets) ? [0, 1, 2] : [0, 1];
  const current = visible.find((i) => !isSetDone(sets[i] ?? { us: null, them: null }));
  const expanded = disabled ? null : manualOpen ?? current ?? null;
  const sum = summarize(sets);
  const implausible = sets.some(
    (s, i) => visible.includes(i) && isSetDone(s) && !isPlausibleSet(s.us as number, s.them as number),
  );

  const change = (i: number, side: "us" | "them", v: number | null) => {
    const next = { ...sets[i], [side]: v };
    if (isSetDone(next)) setManualOpen(null);
    onChange(i, side, v);
  };

  const box: CSSProperties = {
    borderRadius: 10,
    background: "var(--bg-card-2)",
    border: "1px solid var(--line)",
  };
  const head: CSSProperties = { fontSize: 12, fontWeight: 600, color: "var(--text-muted)" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {visible.map((i) => {
        const s = sets[i] ?? { us: null, them: null };
        const done = isSetDone(s);
        const open = expanded === i;
        const max = i === 2 && superTb ? 15 : 7;
        if (!open) {
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => setManualOpen(i)}
              style={{
                ...box,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                cursor: disabled ? "default" : "pointer",
                color: "var(--text)",
                textAlign: "left",
              }}
              aria-label={`Set ${i + 1}${done ? `, ${s.us} a ${s.them}` : ", sin marcador"}`}
            >
              <span style={head}>
                Set {i + 1}
                {s.us !== null || s.them !== null ? (
                  <span className="mono"> · {s.us ?? "–"}-{s.them ?? "–"}</span>
                ) : null}
              </span>
              <span style={{ fontSize: 12, color: done ? "var(--accent)" : "var(--text-faint)" }}>
                {done ? "✓" : disabled ? "" : "Apuntar"}
              </span>
            </button>
          );
        }
        return (
          <motion.div
            key={i}
            initial={reduce ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            style={{ ...box, borderColor: "var(--accent-40)", padding: 12, display: "grid", gap: 8 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={head}>
                Set {i + 1}
                {i === 2 && superTb ? " · super tie-break" : ""}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Toca los juegos</span>
            </div>
            <GamesPicker label={usLabel} tone="us" value={s.us} max={max} onChange={(v) => change(i, "us", v)} />
            <GamesPicker label={themLabel} tone="them" value={s.them} max={max} onChange={(v) => change(i, "them", v)} />
            {i === 2 && allowSuperTiebreak && (
              <button
                type="button"
                className="link-action"
                style={{ justifySelf: "start", fontSize: 12.5, background: "none", border: 0, padding: 0, cursor: "pointer" }}
                onClick={() => setSuperTb((v) => !v)}
              >
                {superTb ? "Set normal (hasta 7)" : "¿Super tie-break? Apuntar hasta 15"}
              </button>
            )}
          </motion.div>
        );
      })}

      <AnimatePresence>
        {implausible && (
          <motion.p
            key="warn"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="status"
            style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: "var(--warning)" }}
          >
            ¿Seguro? Un set acaba 6-4, 7-5 o 7-6
          </motion.p>
        )}
      </AnimatePresence>

      {sum.decided && (
        <div
          role="status"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            borderRadius: 10,
            fontSize: 12.5,
            fontWeight: 700,
            background: sum.won ? "var(--accent-10)" : "var(--bg-card-2)",
            border: `1px solid ${sum.won ? "var(--accent-40)" : "var(--line-strong)"}`,
            color: sum.won ? "var(--accent)" : "var(--text)",
          }}
        >
          <span>
            {sum.won ? "Ganado" : "Perdido"} {sum.usSets}-{sum.themSets} ·{" "}
            <span className="mono">{setsLine(sets)}</span>
          </span>
          {!thirdSetNeeded(sets) && <span>Sin 3.er set</span>}
        </div>
      )}
    </div>
  );
}

/* ── Tabla de sets (solo lectura) ─────────────────────────────────── */
export function SetsTable({
  sets,
  usLabel,
  themLabel,
  columns = 3,
}: {
  sets: SetScore[];
  usLabel: string;
  themLabel: string;
  columns?: number;
}) {
  const cols = Array.from({ length: Math.max(columns, sets.length) }, (_, i) => i);
  const cell = (i: number, side: "us" | "them") => {
    const s = sets[i];
    if (!s || s[side] === null) return { txt: "–", win: false };
    const other = side === "us" ? s.them : s.us;
    return { txt: String(s[side]), win: other !== null && (s[side] as number) > (other as number) };
  };
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
      <thead>
        <tr>
          <th />
          {cols.map((i) => (
            <th key={i} style={{ width: 44, fontSize: 12, fontWeight: 500, color: "var(--text-faint)", textAlign: "center" }}>
              Set {i + 1}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {(["us", "them"] as const).map((side) => (
          <tr key={side}>
            <td className="truncate" style={{ padding: "4px 0", fontWeight: 600, maxWidth: 160 }}>
              {side === "us" ? usLabel : themLabel}
            </td>
            {cols.map((i) => {
              const v = cell(i, side);
              return (
                <td
                  key={i}
                  className="mono"
                  style={{
                    textAlign: "center",
                    fontWeight: v.win ? 700 : 600,
                    color: v.win ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {v.txt}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
