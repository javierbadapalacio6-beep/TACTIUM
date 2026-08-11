"use client";

import { useState } from "react";

/**
 * Primitivas de visualización.
 *
 * TACTIUM es monocromática: un solo accent. Eso encaja bien con los datos que
 * hay aquí, que son de MAGNITUD (una escala) o de POLARIDAD ganado/perdido
 * (dos colores semánticos que ya existen en el sistema). No hay ninguna serie
 * categórica, así que no hace falta paleta de categorías — y por tanto no se
 * introduce ningún segundo hue.
 *
 * Reglas aplicadas: marcas finas, extremos redondeados 4px anclados a la base,
 * separación de 2px entre segmentos apilados, leyenda siempre con dos series,
 * el texto va con tokens de texto (nunca del color de la serie) y hay capa de
 * hover en todo lo que tiene marcas.
 */

/* ── Anillo de progreso · un solo titular ──────────────────────── */
export function Ring({
  value,
  label,
  size = 132,
}: {
  value: number;
  label: string;
  size?: number;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${label}: ${value}%`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--hair-strong)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div>
        <div className="mono" style={{ fontSize: 38, fontWeight: 700, lineHeight: 1 }}>
          {value}%
        </div>
        <div
          className="mono"
          style={{
            marginTop: 10,
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "var(--text-faint)",
          }}
        >
          {label}
        </div>
      </div>
    </div>
  );
}

/* ── Barra apilada · polaridad ganado / perdido ────────────────── */
export function WonLostBar({
  won,
  lost,
}: {
  won: number;
  lost: number;
}) {
  const total = won + lost || 1;
  const wPct = (won / total) * 100;

  return (
    <div>
      {/* La barra: 2px de hueco entre segmentos, extremos redondeados. */}
      <div
        style={{ display: "flex", gap: 2, height: 22 }}
        role="img"
        aria-label={`${won} ganados y ${lost} perdidos de ${total}`}
      >
        <div
          title={`Ganados · ${won}`}
          style={{
            width: `${wPct}%`,
            background: "var(--accent)",
            borderRadius: "4px 2px 2px 4px",
            transition: "width var(--dur-base) var(--ease)",
          }}
        />
        <div
          title={`Perdidos · ${lost}`}
          style={{
            flex: 1,
            background: "var(--error)",
            borderRadius: "2px 4px 4px 2px",
          }}
        />
      </div>

      {/* Leyenda: siempre con dos series. El texto va en tokens de texto. */}
      <div
        style={{
          marginTop: 14,
          display: "flex",
          gap: 22,
          flexWrap: "wrap",
        }}
      >
        {[
          { c: "var(--accent)", l: "Ganados", v: won },
          { c: "var(--error)", l: "Perdidos", v: lost },
        ].map((s) => (
          <span
            key={s.l}
            style={{ display: "flex", alignItems: "center", gap: 9 }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 3,
                background: s.c,
                flex: "none",
              }}
            />
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{s.l}</span>
            <span className="mono" style={{ fontSize: 13, fontWeight: 700 }}>
              {s.v}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Lista de barras · magnitud, una sola escala ───────────────── */
export function BarList({
  data,
  valueLabel,
  formatValue,
}: {
  data: { label: string; value: number; sub?: string }[];
  valueLabel: string;
  formatValue?: (v: number) => string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {data.map((d) => {
        const pct = (d.value / max) * 100;
        const on = hover === d.label;
        return (
          <div
            key={d.label}
            onMouseEnter={() => setHover(d.label)}
            onMouseLeave={() => setHover(null)}
            style={{ cursor: "default" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 6,
              }}
            >
              <span style={{ fontSize: 13, color: "var(--text)" }}>{d.label}</span>
              <span
                className="mono"
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: on ? "var(--accent)" : "var(--text-muted)",
                  transition: "color var(--dur-fast) var(--ease)",
                }}
              >
                {formatValue ? formatValue(d.value) : d.value}
                {d.sub && (
                  <span
                    style={{
                      marginLeft: 8,
                      color: "var(--text-faint)",
                      fontWeight: 400,
                    }}
                  >
                    {d.sub}
                  </span>
                )}
              </span>
            </div>
            {/* Marca fina, anclada a la izquierda, extremo redondeado 4px. */}
            <div
              style={{
                height: 8,
                borderRadius: 4,
                background: "var(--hair-strong)",
                overflow: "hidden",
              }}
              role="img"
              aria-label={`${d.label}: ${d.value} ${valueLabel}`}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: 4,
                  background: on ? "var(--accent)" : "var(--accent-40)",
                  transition:
                    "width var(--dur-base) var(--ease), background var(--dur-fast) var(--ease)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
