"use client";

import { useState } from "react";

import { EntryFrame } from "./EntryFrame";
import { Btn, BtnLink, Card, Eyebrow, Progress } from "@/components/ui";

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

/** Rótulo de la ilustración: frase normal, nunca mayúsculas con tracking. */
function VisualLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)" }}>
      {children}
    </div>
  );
}

/**
 * Ilustraciones de interfaz hechas sólo con tokens — nada de fotos ni stock.
 * Cada una es un fragmento reconocible del producto.
 */
function Visual({ kind }: { kind: (typeof SLIDES)[number]["visual"] }) {
  if (kind === "pareja") {
    return (
      <Card>
        <VisualLabel>Pareja · pista 1</VisualLabel>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { name: "Jugador 01", pos: "Drive", pts: "2400" },
            { name: "Jugador 02", pos: "Revés", pts: "2200" },
          ].map((p) => (
            <div
              key={p.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 14px",
                borderRadius: "var(--r-md)",
                background: "var(--bg-card-2)",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "var(--tile-bg)",
                  flex: "none",
                }}
              />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>
                {p.name}
              </span>
              <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
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
      </Card>
    );
  }

  if (kind === "disponibilidad") {
    return (
      <Card>
        <VisualLabel>Disponibilidad</VisualLabel>
        <div
          style={{
            marginTop: 12,
            display: "flex",
            alignItems: "baseline",
            gap: 8,
          }}
        >
          <span className="mono" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
            12
          </span>
          <span className="mono" style={{ fontSize: 14, color: "var(--text-faint)" }}>
            / 16
          </span>
        </div>
        <Progress value={75} style={{ marginTop: 16 }} />
        <div
          style={{
            marginTop: 16,
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
                borderRadius: "var(--r-xs)",
                background: i < 12 ? "var(--accent-25)" : "var(--bg-card-2)",
              }}
            />
          ))}
        </div>
      </Card>
    );
  }

  if (kind === "temporada") {
    return (
      <Card>
        <VisualLabel>Temporada 25/26</VisualLabel>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { j: "J12", rival: "vs CD Norte", res: "3-2", win: true },
            { j: "J13", rival: "vs Pádel Sur", res: "1-4", win: false },
            { j: "J14", rival: "vs CD Este", res: "—", win: null },
          ].map((r) => (
            <div
              key={r.j}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "11px 13px",
                borderRadius: "var(--r-md)",
                background: "var(--bg-card-2)",
              }}
            >
              <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                {r.j}
              </span>
              <span style={{ flex: 1, fontSize: 13.5 }}>{r.rival}</span>
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
      </Card>
    );
  }

  // ratio
  const pct = 68;
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 24 }}>
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
        <div className="mono" style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>
          {pct}%
        </div>
        <div style={{ marginTop: 8, fontSize: 12.5, color: "var(--text-muted)" }}>
          de victorias
        </div>
      </div>
    </Card>
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
          {/* La web es en español y el antetítulo estaba en inglés. */}
          <Eyebrow>Tu equipo, jornada a jornada</Eyebrow>
          <h1
            style={{
              margin: "18px 0 0",
              fontSize: "clamp(28px, 4vw, 38px)",
              lineHeight: 1.06,
            }}
          >
            {s.title}
          </h1>
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 15,
              color: "var(--text-muted)",
              maxWidth: "46ch",
            }}
          >
            {s.body}
          </p>

          <div
            style={{
              marginTop: 28,
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
              marginTop: 24,
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            {last ? (
              <BtnLink href="/entrar" variant="accent" size="lg">
                Empezar
              </BtnLink>
            ) : (
              <Btn variant="accent" size="lg" onClick={() => setI(i + 1)}>
                Continuar
              </Btn>
            )}
            {!last && (
              <Btn variant="quiet" size="lg" onClick={() => setI(SLIDES.length - 1)}>
                Saltar
              </Btn>
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
