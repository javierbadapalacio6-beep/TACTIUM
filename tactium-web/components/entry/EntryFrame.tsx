"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useTheme } from "@/lib/theme";
import { IconMoon, IconSun } from "@/components/Icon";

/**
 * Marco de las pantallas de entrada: acceso y alta.
 *
 * Van a pantalla completa, sin el shell de la app, y con el fondo ambiental a
 * máxima intensidad — es donde se fija el tono de la marca. En modo claro el
 * fondo baja a un cuarto (lo resuelve `--amb`), no se apaga a mano.
 */
export function EntryFrame({
  children,
  wide,
}: {
  children: ReactNode;
  /** Para las pantallas de alta, que necesitan más ancho que un formulario. */
  wide?: boolean;
}) {
  const { resolved, toggle } = useTheme();

  return (
    <div
      className="amb"
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 24px",
          gap: 16,
        }}
      >
        <Link
          href="/bienvenida"
          style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)" }}
          aria-label="TACTIUM"
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: "var(--primary)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
              fontSize: 16,
            }}
          >
            T
          </span>
          <span
            style={{
              fontWeight: 900,
              letterSpacing: "-0.02em",
              fontSize: 16,
              display: "flex",
              alignItems: "baseline",
            }}
          >
            TACT
            <span style={{ position: "relative", display: "inline-block" }}>
              I
              <span
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  top: -5,
                  width: 3,
                  height: 3,
                  background: "var(--accent)",
                }}
              />
            </span>
            UM
          </span>
        </Link>

        <button
          type="button"
          onClick={toggle}
          className="tw-iconbtn"
          aria-label={
            resolved === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
          }
          suppressHydrationWarning
        >
          {resolved === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
        </button>
      </header>

      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "16px 24px 56px",
        }}
      >
        <div style={{ width: "100%", maxWidth: wide ? 1080 : 460 }}>
          {children}
        </div>
      </main>

      <footer
        className="eyebrow eyebrow-faint"
        style={{ textAlign: "center", padding: "0 24px 28px", fontSize: 10 }}
      >
        PADEL FIRST · SPORTS ALWAYS
      </footer>
    </div>
  );
}

/** Campo de formulario con etiqueta mono y error inline. */
export function Field({
  label,
  hint,
  error,
  children,
  action,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <span
          className="mono"
          style={{
            fontSize: 10,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
          }}
        >
          {label}
        </span>
        {action}
      </span>
      {children}
      {hint && !error && (
        <span
          style={{
            display: "block",
            marginTop: 7,
            fontSize: 12,
            color: "var(--text-faint)",
          }}
        >
          {hint}
        </span>
      )}
      {error && (
        <span
          style={{
            display: "block",
            marginTop: 7,
            fontSize: 12,
            color: "var(--error)",
          }}
        >
          {error}
        </span>
      )}
    </label>
  );
}

/** Input con los tokens del sistema. */
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { style, ...rest } = props;
  return (
    <input
      {...rest}
      style={{
        width: "100%",
        padding: "13px 15px",
        borderRadius: 12,
        // Longhand (no el shorthand `border`) para que un override de
        // `borderColor` desde `style` no mezcle shorthand+longhand en el mismo
        // objeto (React avisa de eso y puede dejar estilos obsoletos).
        borderWidth: 1,
        borderStyle: "solid",
        borderColor: "var(--hair-strong)",
        background: "var(--bg-card)",
        color: "var(--text)",
        fontFamily: "'Satoshi', sans-serif",
        fontSize: 14.5,
        outline: "none",
        transition: "border-color var(--dur-fast) var(--ease)",
        ...style,
      }}
    />
  );
}

/** Segmentado de opciones excluyentes (género, orden de fuerza…). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        borderRadius: 12,
        background: "var(--bg-card-2)",
        flexWrap: "wrap",
      }}
    >
      {options.map((o) => {
        const on = o === value;
        return (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o)}
            style={{
              flex: 1,
              minWidth: 80,
              padding: "9px 14px",
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              fontFamily: "'Satoshi', sans-serif",
              fontSize: 13.5,
              fontWeight: on ? 700 : 500,
              background: on ? "var(--accent-10)" : "transparent",
              color: on ? "var(--accent)" : "var(--text-muted)",
              boxShadow: on ? "inset 0 0 0 1.5px var(--accent)" : "none",
              transition: "all var(--dur-fast) var(--ease)",
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
