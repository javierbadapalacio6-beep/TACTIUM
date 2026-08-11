"use client";

import Link from "next/link";
import { useState } from "react";

import { EntryFrame } from "./EntryFrame";

const SLIDES = [
  {
    title: "El laboratorio táctico de tu equipo",
    body: "Alineaciones, actas y puntos FEP en un mismo sitio. Todo lo que decides antes de pisar la pista.",
    visual: "pareja",
  },
  {
    title: "Crea parejas que ganan",
    body: "Ordena por puntos FEP, cruza drive y revés, y valida el orden de fuerza sin hojas de cálculo.",
    visual: "pareja",
  },
  {
    title: "Sabe quién juega en segundos",
    body: "La disponibilidad de la plantilla, siempre a la vista. Sin cadenas de mensajes.",
    visual: "disponibilidad",
  },
  {
    title: "Lleva el control de la liga",
    body: "Jornadas, actas y clasificación al día con los datos de la federación.",
    visual: "temporada",
  },
  {
    title: "Tus partidos, tus números",
    body: "Cada set cuenta. Mira tu ratio, tu racha y tus puntos FEP temporada a temporada.",
    visual: "ratio",
  },
] as const;

/**
 * Ilustraciones de interfaz hechas sólo con tokens — nada de fotos ni stock.
 * Cada una es un fragmento reconocible del producto.
 */
function Visual({ kind }: { kind: (typeof SLIDES)[number]["visual"] }) {
  if (kind === "pareja") {
    return (
      <div className="card" style={{ padding: 22 }}>
        <div className="eyebrow">PAREJA · PISTA 1</div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { name: "Jugador 01", pos: "DRIVE", pts: "2400" },
            { name: "Jugador 02", pos: "REVÉS", pts: "2200" },
          ].map((p) => (
            <div
              key={p.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: 12,
                background: "var(--bg-card-2)",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "var(--primary-dim)",
                  flex: "none",
                }}
              />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>
                {p.name}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  color: "var(--text-faint)",
                }}
              >
                {p.pos}
              </span>
              <span
                className="mono"
                style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)" }}
              >
                {p.pts}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "disponibilidad") {
    return (
      <div className="card" style={{ padding: 22 }}>
        <div className="eyebrow">DISPONIBILIDAD</div>
        <div
          style={{
            marginTop: 16,
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span className="mono" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1 }}>
            12
          </span>
          <span
            className="mono"
            style={{ fontSize: 15, color: "var(--text-faint)" }}
          >
            / 16
          </span>
        </div>
        <div
          style={{
            marginTop: 16,
            height: 8,
            borderRadius: 999,
            background: "var(--hair-strong)",
            overflow: "hidden",
          }}
        >
          <div style={{ width: "75%", height: "100%", background: "var(--accent)" }} />
        </div>
        <div
          style={{
            marginTop: 18,
            display: "grid",
            gridTemplateColumns: "repeat(8, 1fr)",
            gap: 6,
          }}
        >
          {Array.from({ length: 16 }).map((_, i) => (
            <span
              key={i}
              style={{
                height: 22,
                borderRadius: 6,
                background: i < 12 ? "var(--accent-25)" : "var(--bg-card-2)",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (kind === "temporada") {
    return (
      <div className="card" style={{ padding: 22 }}>
        <div className="eyebrow">TEMPORADA 25/26</div>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { j: "J·12", rival: "vs CD Norte", res: "3-2", win: true },
            { j: "J·13", rival: "vs Pádel Sur", res: "1-4", win: false },
            { j: "J·14", rival: "vs CD Este", res: "—", win: null },
          ].map((r) => (
            <div
              key={r.j}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 13px",
                borderRadius: 10,
                background: "var(--bg-card-2)",
              }}
            >
              <span
                className="mono"
                style={{ fontSize: 11, color: "var(--text-faint)", letterSpacing: "0.1em" }}
              >
                {r.j}
              </span>
              <span style={{ flex: 1, fontSize: 13 }}>{r.rival}</span>
              <span
                className="mono"
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color:
                    r.win === null
                      ? "var(--text-faint)"
                      : r.win
                        ? "var(--accent)"
                        : "var(--error)",
                }}
              >
                {r.res}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ratio
  const pct = 68;
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="card"
      style={{ padding: 22, display: "flex", alignItems: "center", gap: 24 }}
    >
      <svg width="130" height="130" viewBox="0 0 130 130" aria-hidden="true">
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke="var(--hair-strong)"
          strokeWidth="10"
        />
        <circle
          cx="65"
          cy="65"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          transform="rotate(-90 65 65)"
        />
      </svg>
      <div>
        <div
          className="mono"
          style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}
        >
          {pct}%
        </div>
        <div
          className="mono"
          style={{
            marginTop: 8,
            fontSize: 10,
            letterSpacing: "0.2em",
            color: "var(--text-faint)",
          }}
        >
          DE VICTORIAS
        </div>
      </div>
    </div>
  );
}

export function Welcome() {
  const [i, setI] = useState(0);
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;

  return (
    <EntryFrame wide>
      <div className="tw-welcome">
        <div>
          <div className="eyebrow">CREATE · ANALYZE · ELEVATE</div>
          <h1
            style={{
              margin: "20px 0 0",
              fontSize: "clamp(32px, 5vw, 46px)",
              lineHeight: 1.04,
              textWrap: "balance",
            }}
          >
            {s.title}
          </h1>
          <p
            style={{
              margin: "18px 0 0",
              fontSize: 15.5,
              color: "var(--text-muted)",
              maxWidth: "46ch",
              textWrap: "pretty",
            }}
          >
            {s.body}
          </p>

          <div
            style={{
              marginTop: 32,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
            role="tablist"
            aria-label="Carrusel de bienvenida"
          >
            {SLIDES.map((_, k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={k === i}
                aria-label={`Slide ${k + 1} de ${SLIDES.length}`}
                onClick={() => setI(k)}
                style={{
                  width: k === i ? 22 : 7,
                  height: 7,
                  borderRadius: 999,
                  border: "none",
                  padding: 0,
                  background: k === i ? "var(--accent)" : "var(--hair-strong)",
                  cursor: "pointer",
                  transition: "all var(--dur-base) var(--ease)",
                }}
              />
            ))}
          </div>

          <div
            style={{
              marginTop: 28,
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            {last ? (
              <Link
                href="/entrar"
                className="btn btn-accent"
                style={{ padding: "14px 26px", fontSize: 14.5 }}
              >
                Empezar
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => setI(i + 1)}
                className="btn btn-accent"
                style={{ padding: "14px 26px", fontSize: 14.5 }}
              >
                Continuar
              </button>
            )}
            {!last && (
              <button
                type="button"
                onClick={() => setI(SLIDES.length - 1)}
                className="btn"
                style={{
                  padding: "14px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                }}
              >
                Saltar
              </button>
            )}
          </div>
        </div>

        <div className="tw-welcome-visual">
          <Visual kind={s.visual} />
        </div>
      </div>
    </EntryFrame>
  );
}
