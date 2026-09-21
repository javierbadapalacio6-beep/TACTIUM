"use client";

import { useTheme, type ThemeMode } from "@/lib/theme";
import { Card, CardHead } from "@/components/ui";
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
  { key: "light", name: "Claro", tag: "Siempre claro", swatch: "light" },
  { key: "dark", name: "Oscuro", tag: "Siempre oscuro", swatch: "dark" },
  { key: "system", name: "Sistema", tag: "Sigue a tu equipo", swatch: "dark" },
];

export function Apariencia() {
  const { mode, resolved, setMode, ready } = useTheme();

  return (
    <Card flush>
      <CardHead title="Modo" sub="Elige cómo se ve TACTIUM en este navegador." />

      <div
        className="card-body"
        role="radiogroup"
        aria-label="Modo de color"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 12,
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
                borderRadius: 10,
                padding: 12,
                cursor: "pointer",
                background: active ? "var(--accent-10)" : "var(--bg-card-2)",
                color: "var(--text)",
                border: `1px solid ${active ? "var(--accent-40)" : "var(--line)"}`,
                transition: "background var(--dur-fast) var(--ease), border-color var(--dur-fast) var(--ease)",
              }}
            >
              {/* Miniatura de la interfaz en ese tema */}
              <div
                style={{
                  height: 96,
                  borderRadius: "var(--r-sm)",
                  overflow: "hidden",
                  display: "flex",
                  background: p.bg,
                  border: "1px solid var(--line-strong)",
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
                  marginTop: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                  }}
                >
                  {m.name}
                </span>
                {active && (
                  <span style={{ color: "var(--accent)", display: "flex" }}>
                    <IconCheckCircle size={16} />
                  </span>
                )}
              </div>
              <div style={{ marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>
                {m.tag}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
