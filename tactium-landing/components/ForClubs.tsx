"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { Building2, Users, Calendar, Shield } from "lucide-react";
import { PhoneFrame } from "./PhoneFrame";

// ForClubs: sección dedicada al plan Club / multi-equipo. Split layout:
//   - Izq: copy con eyebrow, headline, 4 bullets (categorías que cubre).
//   - Dcha: stack de 2 phones (panel admin + listado de equipos) en
//     perspectiva ligera para mostrar escalabilidad sin saturar.

const bullets = [
  {
    icon: Users,
    text: "Hasta 25 equipos bajo un mismo club",
  },
  {
    icon: Calendar,
    text: "Vista única de próximas jornadas y resultados",
  },
  {
    icon: Shield,
    text: "Roles: admin de club + capitanes por equipo",
  },
  {
    icon: Building2,
    text: "Una sola suscripción para todo el club",
  },
];

export function ForClubs() {
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
      id="for-clubs"
      className="relative py-16 sm:py-24 border-t border-[var(--color-hair)] overflow-hidden"
    >
      <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-[1fr_1.1fr] gap-12 lg:gap-16 items-center">
        {/* Izq: copy */}
        <div className="flex flex-col gap-6">
          <div data-reveal style={{ opacity: 0 }}>
            <p className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3">
              PARA CLUBS Y FEDERACIONES
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.05]">
              Gestiona tu club entero{" "}
              <span className="text-[var(--color-accent)]">
                desde una sola pantalla
              </span>
            </h2>
          </div>

          <p
            data-reveal
            style={{ opacity: 0 }}
            className="text-lg leading-relaxed text-[var(--color-text-muted)] max-w-md"
          >
            El plan Club da acceso al admin a una vista global con todos los
            equipos, jornadas y resultados. Los capitanes siguen gestionando
            su equipo como siempre.
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

        {/* Dcha: 2 phones lado a lado con stagger Y y rotate sutil */}
        <div
          data-reveal
          style={{ opacity: 0 }}
          className="relative flex justify-center items-center min-h-[520px]"
        >
          {/* Glow detrás */}
          <div
            className="absolute w-[80%] h-[80%] bg-[var(--color-accent)] opacity-[0.12] blur-3xl rounded-full"
            aria-hidden="true"
          />
          {/* Phone 1 — dashboard club, ligero rotate izq y arriba */}
          <div className="relative z-[2] -translate-x-6 -rotate-[5deg]">
            <PhoneFrame
              src="/screens/club.jpg"
              alt="Panel admin del club con próximas jornadas y últimos resultados"
              size="card"
              glow="subtle"
            />
          </div>
          {/* Phone 2 — listado de equipos, rotate dcha y abajo, detrás */}
          <div className="relative z-[1] translate-x-6 translate-y-12 rotate-[5deg]">
            <PhoneFrame
              src="/screens/equipos-club.jpg"
              alt="Listado de equipos del club, multi-categoría"
              size="card"
              glow="subtle"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
