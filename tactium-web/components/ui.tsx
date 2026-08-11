"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef } from "react";

/* ── Eyebrow ───────────────────────────────────────────────────────
   MAYÚSCULAS, mono, tracking 0.25em. Separador `·`. */
export function Eyebrow({
  children,
  tone = "accent",
  style,
}: {
  children: ReactNode;
  tone?: "accent" | "faint" | "error";
  style?: CSSProperties;
}) {
  return (
    <div
      className={
        "eyebrow" +
        (tone === "faint"
          ? " eyebrow-faint"
          : tone === "error"
            ? " eyebrow-error"
            : "")
      }
      style={style}
    >
      {children}
    </div>
  );
}

/* ── Card ──────────────────────────────────────────────────────────*/
export function Card({
  children,
  style,
  danger,
  className,
  ...rest
}: {
  children: ReactNode;
  style?: CSSProperties;
  /** Hairline en color error — zona de peligro. */
  danger?: boolean;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style" | "className">) {
  return (
    <div
      className={"card" + (className ? " " + className : "")}
      style={{
        padding: 28,
        ...(danger
          ? {
              boxShadow:
                "var(--shadow-card), inset 0 0 0 1.5px var(--error)",
            }
          : null),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ── Cabecera de pantalla ──────────────────────────────────────────*/
export function PageHeader({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede?: string;
}) {
  return (
    <header style={{ marginBottom: 28 }}>
      <Eyebrow style={{ marginBottom: 10 }}>{eyebrow}</Eyebrow>
      <h1 style={{ fontSize: 34, lineHeight: 1.04 }}>{title}</h1>
      {lede && (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 14.5,
            color: "var(--text-muted)",
            maxWidth: "68ch",
            textWrap: "pretty",
          }}
        >
          {lede}
        </p>
      )}
    </header>
  );
}

/* ── Interruptor ───────────────────────────────────────────────────
   Botón real: accesible con teclado y anunciado con su estado. */
export function Toggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      style={{
        width: 46,
        height: 27,
        borderRadius: 999,
        flex: "none",
        border: "none",
        padding: 3,
        cursor: disabled ? "default" : "pointer",
        background: on ? "var(--accent)" : "var(--hair-strong)",
        display: "flex",
        alignItems: "center",
        justifyContent: on ? "flex-end" : "flex-start",
        transition: "background var(--dur-base) var(--ease)",
      }}
    >
      <span
        style={{
          width: 21,
          height: 21,
          borderRadius: 999,
          display: "block",
          background: on ? "var(--text-inverse)" : "var(--text-faint)",
          transition: "background var(--dur-base) var(--ease)",
        }}
      />
    </button>
  );
}

/* ── Modal ─────────────────────────────────────────────────────────
   Diálogo centrado en escritorio. Cierra con Escape y devuelve el foco
   al elemento que lo abrió. */
export function Modal({
  open,
  onClose,
  labelledBy,
  children,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
  width?: number;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // `onClose` suele llegar como arrow inline, así que su identidad cambia en
  // cada render del padre. Guardarla en un ref permite que el efecto dependa
  // SÓLO de `open`: si dependiera de `onClose`, se desmontaría y volvería a
  // montar en cada pulsación de tecla, robando el foco del campo y haciendo
  // imposible escribir dentro del diálogo.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);

    // El foco entra en el diálogo una sola vez, al abrirse.
    panelRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      openerRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 95,
        background: "var(--scrim)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        style={{
          width: "100%",
          maxWidth: width,
          borderRadius: 24,
          background: "var(--bg-raised)",
          border: "1px solid var(--hair-strong)",
          boxShadow: "var(--shadow-card-strong)",
          padding: 28,
          outline: "none",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Fila de lista con hairline inferior ───────────────────────────*/
export function Row({
  children,
  last,
  style,
}: {
  children: ReactNode;
  last?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "15px 0",
        borderBottom: last ? "none" : "1px solid var(--hair)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
