"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { useTheme } from "@/lib/theme";
import { IconMoon, IconSun } from "@/components/Icon";
import {
  Input as UiInput,
  Segmented as UiSegmented,
} from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";

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
          style={{ display: "flex", alignItems: "center", color: "var(--text)" }}
          aria-label="TACTIUM"
        >
          <Wordmark />
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
        style={{
          textAlign: "center",
          padding: "0 24px 28px",
          fontSize: 12,
          color: "var(--text-faint)",
        }}
      >
        Pádel primero, deporte siempre
      </footer>
    </div>
  );
}

/* ── Campo de formulario ───────────────────────────────────────────
   Misma receta que `Field` del panel (`.field` / `.field-label`), con una
   acción opcional alineada a la derecha de la etiqueta (p. ej. "¿Olvidaste?"). */
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
    <label className="field">
      <span
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span className="field-label">{label}</span>
        {action}
      </span>
      {children}
      {error ? (
        <span className="field-error">{error}</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

/** Input del sistema (`.input`), con el tamaño grande del alta. */
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <UiInput large {...props} />;
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
    <UiSegmented<T>
      value={value}
      options={options.map((o) => ({ value: o, label: o }))}
      onChange={onChange}
      label={label}
    />
  );
}
