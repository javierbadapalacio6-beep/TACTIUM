"use client";

import { useTheme, type ThemeMode } from "@/lib/theme";
import { Card, Eyebrow } from "@/components/ui";
import { IconCheckCircle } from "@/components/Icon";

/**
 * Selector de tema. Es la pantalla donde se demuestra el doble tema, así que
 * las miniaturas pintan los colores REALES de cada tema con hex literales —
 * no con tokens, porque un token siempre resolvería al tema activo y las tres
 * miniaturas saldrían idénticas.
 */
const SWATCHES = {
  light: { bg: "#F4F7F5", card: "#FFFFFF", side: "#EEF3F0", accent: "#00995E" },
  dark: { bg: "#030F0F", card: "#0C2222", side: "#081818", accent: "#00DF82" },
} as const;

const MODES: {
  key: ThemeMode;
  name: string;
  tag: string;
  swatch: keyof typeof SWATCHES;
}[] = [
  { key: "light", name: "Claro", tag: "SIEMPRE CLARO", swatch: "light" },
  { key: "dark", name: "Oscuro", tag: "SIEMPRE OSCURO", swatch: "dark" },
  { key: "system", name: "Sistema", tag: "SIGUE A TU EQUIPO", swatch: "dark" },
];

export function Apariencia() {
  const { mode, resolved, setMode, ready } = useTheme();

  return (
    <Card>
      <Eyebrow>APARIENCIA</Eyebrow>
      <h2 style={{ margin: "14px 0 6px", fontSize: 24 }}>Modo</h2>
      <p
        style={{
          margin: "0 0 24px",
          fontSize: 13.5,
          color: "var(--text-muted)",
        }}
      >
        Elige cómo se ve TACTIUM en este navegador.
      </p>

      <div
        role="radiogroup"
        aria-label="Modo de color"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 16,
        }}
      >
        {MODES.map((m) => {
          // "Sistema" enseña lo que el equipo está pidiendo ahora mismo.
          const swatchKey =
            m.key === "system" ? (ready ? resolved : "dark") : m.swatch;
          const p = SWATCHES[swatchKey];
          const active = ready && mode === m.key;

          return (
            <button
              key={m.key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(m.key)}
              style={{
                textAlign: "left",
                borderRadius: 16,
                padding: 16,
                cursor: "pointer",
                background: "var(--bg-card-2)",
                color: "var(--text)",
                border: `1.5px solid ${
                  active ? "var(--accent)" : "var(--hair-strong)"
                }`,
                transition: "all var(--dur-fast) var(--ease)",
              }}
            >
              {/* Miniatura de la interfaz en ese tema */}
              <div
                style={{
                  height: 108,
                  borderRadius: 10,
                  overflow: "hidden",
                  display: "flex",
                  background: p.bg,
                  border: "1px solid var(--hair-strong)",
                }}
              >
                <div
                  style={{ width: 26, background: p.side, flex: "none" }}
                />
                <div
                  style={{
                    flex: 1,
                    padding: 8,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{ height: 10, borderRadius: 3, background: p.card }}
                  />
                  <div
                    style={{ height: 32, borderRadius: 5, background: p.card }}
                  />
                  <div
                    style={{
                      height: 20,
                      width: "62%",
                      borderRadius: 5,
                      background: p.card,
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 14.5,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {m.name}
                </span>
                {active && (
                  <span style={{ color: "var(--accent)", display: "flex" }}>
                    <IconCheckCircle size={17} />
                  </span>
                )}
              </div>
              <div
                className="mono"
                style={{
                  marginTop: 5,
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  color: "var(--text-faint)",
                }}
              >
                {m.tag}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
