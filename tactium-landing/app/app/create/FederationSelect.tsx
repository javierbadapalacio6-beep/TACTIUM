"use client";

import { useEffect, useRef, useState } from "react";
import { FEDERATIONS, type Federation } from "./federations";

// Selector de federación (espejo del FederationPickerSheet móvil): botón que
// despliega un panel con todas las federaciones. On-brand, sin librerías.
export function FederationSelect({
  value,
  onChange,
  placeholder = "Selecciona federación",
}: {
  value: Federation | null;
  onChange: (f: Federation) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    // Doble rAF para que el panel monte en su estado inicial y luego
    // transicione (entrada fade + slide). Sin librerías ni CSS global.
    const raf = requestAnimationFrame(() => setShown(true));
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-3.5 py-3 min-h-[54px] text-left transition hover:border-[var(--color-accent-40)]"
      >
        <span className="min-w-0">
          {value ? (
            <>
              <span className="block text-[14px] font-semibold truncate">
                {value.name}
              </span>
              <span className="block font-mono text-[11px] tracking-wide text-[var(--color-text-faint)] mt-0.5">
                {value.region} · {value.shortName}
              </span>
            </>
          ) : (
            <span className="text-[14px] text-[var(--color-text-faint)]">
              {placeholder}
            </span>
          )}
        </span>
        <span
          className={`shrink-0 text-[var(--color-text-faint)] transition ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div
          className="absolute z-30 mt-2 w-full max-h-72 overflow-y-auto rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-raised)] p-1.5 shadow-2xl"
          style={{
            opacity: shown ? 1 : 0,
            transform: shown ? "translateY(0)" : "translateY(-6px)",
            transition:
              "opacity 160ms cubic-bezier(0.22,1,0.36,1), transform 160ms cubic-bezier(0.22,1,0.36,1)",
          }}
        >
          {FEDERATIONS.map((f) => {
            const sel = value?.code === f.code;
            return (
              <button
                key={f.code}
                type="button"
                onClick={() => {
                  onChange(f);
                  setOpen(false);
                }}
                className={`w-full flex items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${
                  sel
                    ? "bg-[var(--color-accent-10)] border border-[var(--color-accent-40)]"
                    : "border border-transparent hover:bg-[var(--color-bg-card)]"
                }`}
              >
                <span className="shrink-0 min-w-[52px] h-8 grid place-items-center rounded-md border border-[var(--color-hair-strong)] bg-[var(--color-bg-card-2)] font-mono text-[11px] font-semibold tracking-wide text-[var(--color-accent)]">
                  {f.shortName}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold truncate">
                    {f.name}
                  </span>
                  <span className="block text-[11px] text-[var(--color-text-faint)] mt-0.5">
                    {f.region}
                  </span>
                </span>
                {sel && (
                  <span className="shrink-0 text-[var(--color-accent)]">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
