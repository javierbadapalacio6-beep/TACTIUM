"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { Users, Calendar, Shield, Crown } from "lucide-react";

// Sección de TORNEOS: TACTIUM organiza torneos completos de club, del cartel a
// la final. Cards con los formatos + bullets de las capacidades clave. Enlaza a
// #precios (donde vive el pago por torneo / incluido en el plan).

const formats = [
  { tag: "KO", name: "Eliminación directa", desc: "Un cuadro. Pierdes y fuera." },
  { tag: "KO+", name: "Eliminación + consolación", desc: "Quien cae en 1ª ronda sigue jugando." },
  { tag: "Liga", name: "Todos contra todos", desc: "Gana quien más suma. Sin cuadro." },
  { tag: "G+KO", name: "Grupos + eliminatorias", desc: "Liguilla y luego cuadro. El de club." },
];

const bullets = [
  { icon: Users, text: "Inscripción desde la app, por categorías y con reglas de nivel/puntos" },
  { icon: Calendar, text: "Horario automático por pistas + rejilla para moverlo a mano" },
  { icon: Shield, text: "Grupos, cuadros y consolación que se generan solos" },
  { icon: Crown, text: "Incluido en tu plan de club, o pago por torneo si solo quieres eso" },
];

export function TorneosSection() {
  const sectionRef = useRef<HTMLElement | null>(null);

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
              translateY: [28, 0],
              duration: 600,
              delay: stagger(70),
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
      id="torneos"
      className="relative py-16 sm:py-24 border-t border-[var(--color-hair)] overflow-hidden"
    >
      <div className="relative max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <p
            data-reveal
            style={{ opacity: 0 }}
            className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3"
          >
            TORNEOS
          </p>
          <h2
            data-reveal
            style={{ opacity: 0 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.05]"
          >
            Organiza torneos completos,{" "}
            <span className="text-[var(--color-accent)]">sin hojas de cálculo</span>
          </h2>
          <p
            data-reveal
            style={{ opacity: 0 }}
            className="mt-4 text-lg leading-relaxed text-[var(--color-text-muted)]"
          >
            Del cartel a la final: eliges el formato, los jugadores se apuntan
            desde el móvil, los cuadros se generan solos y el horario se reparte
            por pistas. También en tu club.
          </p>
        </div>

        {/* Cards de formato */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {formats.map((f) => (
            <div
              key={f.name}
              data-reveal
              style={{ opacity: 0 }}
              className="rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] p-5 flex flex-col gap-3 hover:border-[var(--color-accent-40)] transition-colors"
            >
              <span className="inline-flex self-start items-center font-mono text-[11px] font-bold tracking-wider text-[var(--color-accent)] bg-[var(--color-accent-10)] border border-[var(--color-accent-40)] rounded-lg px-2.5 py-1">
                {f.tag}
              </span>
              <h3 className="text-[15px] font-bold tracking-tight leading-snug">
                {f.name}
              </h3>
              <p className="text-[13px] text-[var(--color-text-muted)] leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Bullets de capacidades */}
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 mt-10">
          {bullets.map(({ icon: Icon, text }) => (
            <div
              key={text}
              data-reveal
              style={{ opacity: 0 }}
              className="flex items-start gap-3"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--color-accent-10)] border border-[var(--color-accent-40)] flex items-center justify-center">
                <Icon className="w-4 h-4 text-[var(--color-accent)]" />
              </span>
              <span className="pt-1.5 text-sm text-[var(--color-text)] leading-relaxed">
                {text}
              </span>
            </div>
          ))}
        </div>

        <div data-reveal style={{ opacity: 0 }} className="mt-10">
          <a
            href="#precios"
            className="inline-flex items-center justify-center h-11 px-6 rounded-xl font-semibold text-sm bg-[var(--color-accent)] text-[var(--color-text-inverse)] hover:opacity-90 transition"
          >
            Ver precios de torneos
          </a>
        </div>
      </div>
    </section>
  );
}
