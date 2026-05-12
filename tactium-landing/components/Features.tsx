"use client";

import { useCallback, type MouseEvent } from "react";
import {
  Sparkles,
  Layers,
  BellRing,
  ScanLine,
  CalendarClock,
  BarChart3,
} from "lucide-react";

// Marquee horizontal infinito de features. Todas las tarjetas en una sola
// línea desplazándose lentamente de derecha a izquierda. Pausa al hover
// para que se puedan leer cómodamente. Loop seamless duplicando el array.
//
// En prefers-reduced-motion: cae a un wrap normal sin animación
// (definido en globals.css → .features-marquee).
const features = [
  {
    icon: Sparkles,
    title: "Alineaciones inteligentes",
    description:
      "Auto-balance por puntos FEP y orden por fuerza. Cumple las reglas de cada federación.",
  },
  {
    icon: Layers,
    title: "Hasta 5 variantes",
    description:
      "Prueba 5 escenarios por jornada sin perder la oficial. Cambia entre ellos con un toque.",
  },
  {
    icon: BarChart3,
    title: "Histórico completo",
    description:
      "Temporadas, jornadas y resultados con métricas comparativas.",
  },
  {
    icon: BellRing,
    title: "Notificaciones push",
    description:
      "Tus jugadores reciben al instante la convocatoria, hora y pista.",
  },
  {
    icon: CalendarClock,
    title: "Disponibilidad por jornada",
    description:
      "Cada jugador confirma su disponibilidad. Tú ves todo en una sola pantalla.",
  },
  {
    icon: ScanLine,
    title: "Escanea tu plantilla",
    description:
      "Importa el ranking FEP haciendo una foto. OCR multimodal.",
  },
];

export function Features() {
  // Mouse-spotlight glow: actualiza CSS vars del cursor sobre la card
  // siendo apuntada. Funciona aunque la card se esté trasladando porque
  // getBoundingClientRect tiene en cuenta transforms en curso.
  const handleMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    target.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }, []);

  // Doblamos el array para que el translateX(-50%) del CSS encaje sin saltos.
  const doubled = [...features, ...features];

  return (
    <section
      id="features"
      className="py-14 sm:py-20 border-t border-[var(--color-hair)] overflow-hidden"
    >
      <div className="max-w-6xl mx-auto px-6 mb-12 sm:mb-16">
        <p className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3">
          FEATURES
        </p>
        <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl">
          Todo lo que necesitas para gestionar tu equipo,{" "}
          <span className="text-[var(--color-accent)]">en un solo sitio</span>
        </h2>
      </div>

      <div className="features-marquee-wrap relative">
        {/* Máscara lateral para fade-in/out en los bordes. */}
        <div
          className="absolute inset-y-0 left-0 w-24 z-[2] pointer-events-none bg-gradient-to-r from-[var(--color-bg)] to-transparent"
          aria-hidden="true"
        />
        <div
          className="absolute inset-y-0 right-0 w-24 z-[2] pointer-events-none bg-gradient-to-l from-[var(--color-bg)] to-transparent"
          aria-hidden="true"
        />

        <div className="features-marquee">
          {doubled.map(({ icon: Icon, title, description }, i) => (
            <article
              key={`${title}-${i}`}
              onMouseMove={handleMove}
              aria-hidden={i >= features.length}
              className="bento-card group w-[300px] flex-shrink-0 p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-hair)] hover:border-[var(--color-accent-40)] transition flex flex-col gap-3 overflow-hidden"
            >
              <Icon className="w-5 h-5 text-[var(--color-accent)]" />
              <h3 className="text-lg font-bold tracking-tight">{title}</h3>
              <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                {description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
