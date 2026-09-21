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
      className="btn btn-ghost btn-sm"
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
      {resolved === "dark" ? <IconSun size={14} /> : <IconMoon size={14} />}
      <span suppressHydrationWarning>
        {resolved === "dark" ? "Modo oscuro" : "Modo claro"}
      </span>
    </button>
  );
}
