"use client";

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import { Camera, Share2, BarChart3, UserPlus } from "lucide-react";
import { PhoneFrame } from "./PhoneFrame";

// AmistososSection: sección dedicada al lado social/casual de TACTIUM.
// No todo es liga federada: cualquier partido entre colegas o entreno se
// registra, se le pone foto y se comparte como tarjeta estilo Strava —
// y cuenta en tus estadísticas. Split layout: phone (tarjeta) izq, copy dcha.

const bullets = [
  {
    icon: Camera,
    text: "Amistosos, entrenos y partidos entre equipos, con foto del partido",
  },
  {
    icon: Share2,
    text: "Tarjeta estilo Strava lista para compartir por WhatsApp",
  },
  {
    icon: BarChart3,
    text: "Cuenta en tus estadísticas: victorias, rachas y % de acierto",
  },
  {
    icon: UserPlus,
    text: "Invita a tus colegas: al instalarse, sus partidos también suman",
  },
];

export function AmistososSection() {
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
      id="amistosos"
      className="relative py-16 sm:py-24 border-t border-[var(--color-hair)] overflow-hidden"
    >
      <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
        {/* Izq: phone con la tarjeta del amistoso */}
        <div
          data-reveal
          style={{ opacity: 0 }}
          className="relative flex justify-center items-center min-h-[520px] order-last lg:order-first"
        >
          <div
            className="absolute w-[75%] h-[80%] bg-[var(--color-accent)] opacity-[0.12] blur-3xl rounded-full"
            aria-hidden="true"
          />
          <div className="relative -rotate-[3deg]">
            <PhoneFrame
              src="/screens/amistoso-card.jpg"
              alt="Tarjeta de amistoso con foto del partido, resultado y sets estilo Strava"
              size="hero"
              glow="subtle"
            />
          </div>
        </div>

        {/* Dcha: copy */}
        <div className="flex flex-col gap-6">
          <div data-reveal style={{ opacity: 0 }}>
            <p className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3">
              NO SOLO LIGA
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-[1.05]">
              Registra tus amistosos{" "}
              <span className="text-[var(--color-accent)]">y compártelos</span>
            </h2>
          </div>

          <p
            data-reveal
            style={{ opacity: 0 }}
            className="text-lg leading-relaxed text-[var(--color-text-muted)] max-w-md"
          >
            Cualquier partido cuenta: amistosos con tus colegas, entrenos o
            enfrentamientos entre equipos. Apunta el marcador, ponle la foto y
            comparte el resultado. Se guarda en tus estadísticas para siempre.
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
