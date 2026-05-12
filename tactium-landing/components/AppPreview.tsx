"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { PhoneFrame } from "./PhoneFrame";

// AppPreview: narrativa visual del flujo de uso. Tres pantallas que
// cuentan la historia "Jornada pendiente → Crea alineación → Cierra acta
// con resultados". Stagger diagonal: cada phone va más bajo + ligero
// rotate para sensación de profundidad estilo dribbble/linear.
//
// Mobile: stack vertical centrado (no diagonal — sería ilegible).
// Desktop: lado a lado con stagger Y + rotate alterno.

const steps = [
  {
    n: "01",
    label: "PROGRAMA",
    title: "Jornada en agenda",
    description:
      "Cada jornada con rival, sede, hora y estado. Empieza siempre desde aquí.",
    mockup: {
      src: "/screens/jornada-pendiente.jpg",
      alt: "Pantalla de Jornada pendiente con 5 parejas sin asignar",
    },
    rotate: "lg:-rotate-[6deg]",
    offset: "lg:translate-y-0",
  },
  {
    n: "02",
    label: "ALINEA",
    title: "Auto-balance por puntos",
    description:
      "Ordena las parejas por fuerza, respetando las reglas de la federación.",
    mockup: {
      src: "/screens/alineacion.jpg",
      alt: "Pantalla de Alineación con auto-orden y barras de puntos",
    },
    rotate: "lg:rotate-0",
    offset: "lg:-translate-y-10",
  },
  {
    n: "03",
    label: "CIERRA",
    title: "Resultados en directo",
    description:
      "Marcador por sets, V/D/Empate y W.O. Acta cerrada y compartible.",
    mockup: {
      src: "/screens/jornada-resultados.jpg",
      alt: "Pantalla de Jornada cerrada con resultados por pareja",
    },
    rotate: "lg:rotate-[6deg]",
    offset: "lg:translate-y-0",
  },
];

export function AppPreview() {
  const sectionRef = useRef<HTMLElement | null>(null);

  // Scroll-reveal en stagger. IntersectionObserver one-shot.
  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }
    const obs = new IntersectionObserver(
      (entries, o) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            animate(node.querySelectorAll("[data-reveal]"), {
              opacity: [0, 1],
              translateY: [40, 0],
              duration: 700,
              delay: stagger(110),
              ease: "out(3)",
            });
            o.disconnect();
          }
        });
      },
      { threshold: 0.15 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="app-preview"
      className="relative py-24 sm:py-32 border-t border-[var(--color-hair)] overflow-hidden"
    >
      {/* Glow ambient suave detrás del stack */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        aria-hidden="true"
      >
        <div className="w-[80%] max-w-[900px] h-[60%] bg-[var(--color-accent)] opacity-[0.08] blur-3xl rounded-full" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6">
        <div className="mb-16 sm:mb-20 text-center max-w-2xl mx-auto">
          <p className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3">
            FLUJO DE UNA JORNADA
          </p>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
            De la convocatoria al acta cerrada,{" "}
            <span className="text-[var(--color-accent)]">en una sola app</span>
          </h2>
        </div>

        {/* Grid de 3 phones + textos. Desktop: 3 columnas con stagger Y y
            rotate alterno (perspective natural). Mobile: stack vertical. */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 lg:gap-8 items-start">
          {steps.map((step) => (
            <div
              key={step.n}
              data-reveal
              style={{ opacity: 0, transform: "translateY(40px)" }}
              className={`flex flex-col items-center gap-6 ${step.offset}`}
            >
              <div
                className={`transition-transform duration-500 ${step.rotate} hover:rotate-0 hover:scale-[1.03]`}
              >
                <PhoneFrame
                  src={step.mockup.src}
                  alt={step.mockup.alt}
                  size="card"
                  glow="subtle"
                />
              </div>

              <div className="text-center max-w-[260px]">
                <p className="font-mono text-[10px] tracking-[0.3em] font-medium text-[var(--color-accent)] mb-2">
                  {step.n} · {step.label}
                </p>
                <h3 className="text-lg font-bold tracking-tight mb-2">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-[var(--color-text-muted)]">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
