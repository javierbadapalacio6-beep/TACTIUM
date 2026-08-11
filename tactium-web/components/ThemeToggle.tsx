"use client";

import { useTheme } from "@/lib/theme";
import { IconMoon, IconSun } from "./Icon";

/** Alterna claro/oscuro desde la barra superior. La elección de los tres
 *  modos (incluido "Sistema") vive en Ajustes → APARIENCIA. */
export function ThemeToggle() {
  const { resolved, toggle, ready } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost mono"
      style={{
        padding: "8px 14px",
        fontSize: 11,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
      // Antes de rehidratar no sabemos el tema real: ocultamos el texto al
      // lector de pantalla en vez de anunciar uno que puede cambiar.
      aria-live="off"
      aria-label={
        ready
          ? resolved === "dark"
            ? "Cambiar a modo claro"
            : "Cambiar a modo oscuro"
          : "Cambiar de tema"
      }
      suppressHydrationWarning
    >
      {resolved === "dark" ? <IconSun size={15} /> : <IconMoon size={15} />}
      <span suppressHydrationWarning>
        {resolved === "dark" ? "Modo oscuro" : "Modo claro"}
      </span>
    </button>
  );
}
