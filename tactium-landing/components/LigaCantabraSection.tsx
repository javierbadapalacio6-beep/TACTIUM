"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { BarChart3, Crown, Shield, Check } from "lucide-react";

// Sección diferenciadora: la liga federada, viva en la app. TACTIUM sigue la
// competición (clasificaciones, puntos y cuadros) y la muestra al día, sin que
// nadie copie nada de webs ni PDFs. Widget de clasificación (HTML) a la izq,
// copy a la dcha. La tabla es ILUSTRATIVA (demo de producto).

const bullets = [
  { icon: BarChart3, text: "Clasificación de tu grupo, siempre al día" },
  { icon: Crown, text: "Puntos y nivel de cada jugador, de su temporada real" },
  { icon: Shield, text: "Cuadros de playoff (principal y consolación) navegables" },
  { icon: Check, text: "Sin rebuscar en webs ni PDFs: lo tienes en el móvil" },
];

const standings = [
  { pos: 1, team: "C.P. Bahía A", sets: "123–30", pts: 13, leader: true },
  { pos: 2, team: "Sardinero Pádel", sets: "110–48", pts: 11, leader: false },
  { pos: 3, team: "Costa Verde PC", sets: "101–57", pts: 11, leader: false },
  { pos: 4, team: "Peña Norte A", sets: "75–83", pts: 7, leader: false },
];

export function LigaCantabraSection() {
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
              delay: stagger(80),
              ease: "out(3)",
            });
            o.disconnect();
          }
        });
      },
      { threshold: 0.2 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="federacion"
      className="relative py-16 sm:py-24 border-t border-[var(--color-hair)] overflow-hidden"
    >
      <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-[1fr_1.05fr] gap-12 lg:gap-16 items-center">
        {/* Izq: widget de clasificación en vivo */}
        <div
          data-reveal
          style={{ opacity: 0 }}
          className="relative order-last lg:order-first"
        >
          <div
            className="absolute -inset-6 bg-[var(--color-accent)] opacity-[0.10] blur-3xl rounded-full"
            aria-hidden="true"
          />
          <div className="relative rounded-2xl border border-[var(--color-accent-40)] bg-[var(--color-bg-card)] overflow-hidden shadow-[0_30px_70px_-28px_rgba(0,223,130,0.30)]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--color-hair)]">
              <span className="font-mono text-[11px] tracking-wide text-[var(--color-text-faint)] uppercase">
                2ª Masculina · Grupo B
              </span>
              <span className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-[var(--color-accent)] uppercase">
                <span className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
                En vivo
              </span>
            </div>
            {/* Column head */}
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-5 pt-3 pb-1 font-mono text-[10px] tracking-widest text-[var(--color-text-faint)] uppercase">
              <span>Equipo</span>
              <span className="text-right w-16">Sets</span>
              <span className="text-right w-10">Pts</span>
            </div>
            {/* Rows */}
            {standings.map((r) => (
              <div
                key={r.pos}
                className={`grid grid-cols-[1fr_auto_auto] gap-4 items-center px-5 py-3 border-t border-[var(--color-hair)] ${
                  r.leader ? "bg-[var(--color-accent-10)]" : ""
                }`}
              >
                <span
                  className={`flex items-center gap-2.5 ${
                    r.leader
                      ? "text-[var(--color-text)] font-bold"
                      : "text-[var(--color-text-muted)]"
                  }`}
                >
                  <span
                    className={`font-mono text-xs w-4 ${
                      r.leader
                        ? "text-[var(--color-accent)]"
                        : "text-[var(--color-text-faint)]"
                    }`}
                  >
                    {r.pos}
                  </span>
                  {r.team}
                </span>
                <span className="text-right w-16 font-mono text-sm tabular-nums text-[var(--color-text-muted)]">
                  {r.sets}
                </span>
                <span
                  className={`text-right w-10 font-mono text-sm font-bold tabular-nums ${
                    r.leader ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
                  }`}
                >
                  {r.pts}
                </span>
              </div>
            ))}
            {/* Footer */}
            <div className="px-5 py-3 border-t border-[var(--color-hair)] font-mono text-[10px] tracking-wide text-[var(--color-text-faint)]">
              Datos de la Federación · se actualiza cada jornada
            </div>
          </div>
        </div>

        {/* Dcha: copy */}
        <div className="flex flex-col gap-6">
          <div data-reveal style={{ opacity: 0 }}>
            <p className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3">
              TU LIGA, EN VIVO
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.05]">
              La competición federada,{" "}
              <span className="text-[var(--color-accent)]">al día en el móvil</span>
            </h2>
          </div>

          <p
            data-reveal
            style={{ opacity: 0 }}
            className="text-lg leading-relaxed text-[var(--color-text-muted)] max-w-md"
          >
            TACTIUM sigue tu liga: clasificaciones, puntos, resultados y cuadros
            de playoff, actualizados solos. Tus jugadores dejan de perseguir la
            información por webs y grupos de WhatsApp.
          </p>

          <ul className="flex flex-col gap-3 mt-2">
            {bullets.map(({ icon: Icon, text }) => (
              <li
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
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
