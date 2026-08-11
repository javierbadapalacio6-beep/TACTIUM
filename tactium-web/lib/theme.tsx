"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/** Los tres modos de la app móvil (`useThemeStore`). */
export type ThemeMode = "light" | "dark" | "system";
/** El tema realmente pintado tras resolver `system`. */
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "tactium-theme";

/**
 * Script que corre ANTES del primer pintado para evitar el destello de tema
 * equivocado. Se inyecta en el <head> con `dangerouslySetInnerHTML`.
 *
 * Sólo escribe el atributo cuando el modo guardado es explícito: para "system"
 * lo deja sin poner, que es lo que devuelve el control a la media query.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var m=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(m==="light"||m==="dark"){document.documentElement.setAttribute("data-theme",m)}}catch(e){}})();`;

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", mode);
}

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  /** Alterna claro/oscuro. Desde "system" salta al contrario de lo que se ve. */
  toggle: () => void;
  /** false hasta que el cliente ha leído localStorage — para no pintar el
   *  estado del selector con un valor que aún no es el real. */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>("dark");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");
  const [ready, setReady] = useState(false);

  // Rehidratación: leemos el modo guardado y sincronizamos el estado con lo
  // que el script del <head> ya dejó puesto en el DOM.
  useEffect(() => {
    let stored: ThemeMode = "system";
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === "light" || raw === "dark" || raw === "system") stored = raw;
    } catch {
      /* Safari en privado puede lanzar al leer localStorage. */
    }
    setModeState(stored);
    setResolved(stored === "system" ? systemTheme() : stored);
    applyMode(stored);
    setReady(true);
  }, []);

  // En modo "system" seguimos los cambios del sistema operativo en vivo.
  useEffect(() => {
    if (mode !== "system" || typeof window === "undefined" || !window.matchMedia)
      return;
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => setResolved(mq.matches ? "light" : "dark");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setResolved(next === "system" ? systemTheme() : next);
    applyMode(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* sin persistencia, pero el tema sigue aplicándose en esta sesión */
    }
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === "dark" ? "light" : "dark");
  }, [resolved, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, toggle, ready }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
