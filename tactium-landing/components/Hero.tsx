import { TactiumMarkAnimated } from "./TactiumMarkAnimated";
import { WaitlistForm } from "./WaitlistForm";
import { HeroAnimator } from "./HeroAnimator";
import { HeroAuroraCursor } from "./HeroAuroraCursor";
import { PhoneFrame } from "./PhoneFrame";

// Hero principal. Estructura:
//   - Eyebrow mono "PRE-LANZAMIENTO · 2026"
//   - Logo + headline 2 líneas
//   - Sub-headline
//   - Formulario waitlist primario
//   - Mockup iPhone con glow ambient
//
// Mobile-first: stack vertical. Desktop: 2 columnas con form a la izq,
// mockup a la derecha.
export function Hero() {
  return (
    <section
      id="hero"
      className="relative overflow-hidden pt-16 pb-12 sm:pt-24 sm:pb-16"
    >
      {/* Aurora animada + grid sutil — capas decorativas, no interactivas. */}
      <div className="aurora" aria-hidden="true">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
        <div className="aurora-blob-cursor" />
      </div>
      <div className="aurora-grid" aria-hidden="true" />

      <HeroAnimator />
      <HeroAuroraCursor />
      <div className="relative max-w-6xl mx-auto px-6 grid lg:grid-cols-[1.05fr_1fr] gap-16 lg:gap-24 items-start">
        {/* Columna izq: copy + form */}
        <div className="flex flex-col gap-6 lg:gap-8">
          <div
            data-hero="brand"
            style={{ opacity: 0 }}
            className="flex items-center gap-3"
          >
            <TactiumMarkAnimated size={48} />
            <span className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)]">
              PRE-LANZAMIENTO · 2026
            </span>
          </div>

          <h1
            data-hero="headline"
            style={{ opacity: 0 }}
            className="text-[40px] sm:text-[56px] lg:text-[64px] leading-[1.05] font-extrabold tracking-tight text-[var(--color-text)]"
          >
            El sistema operativo del{" "}
            <span className="text-[var(--color-accent)]">pádel federado</span>
          </h1>

          <p
            data-hero="sub"
            style={{ opacity: 0 }}
            className="text-lg sm:text-xl leading-relaxed text-[var(--color-text-muted)] max-w-xl"
          >
            Alineaciones automáticas con orden de fuerza FEP, hasta 5
            variantes por jornada y notificaciones push a tu plantilla.
            La app para capitanes y clubs federados en España.
          </p>

          <div
            id="hero-form"
            data-hero="form"
            className="max-w-md mt-2 scroll-mt-28"
          >
            <WaitlistForm source="hero" />
            <p className="mt-3 text-xs text-[var(--color-text-faint)] font-mono tracking-wide">
              14 DÍAS GRATIS · CANCELA CUANDO QUIERAS
            </p>
          </div>
        </div>

        {/* Columna der: 2 phones en esquinas opuestas del contenedor, con
            mucho aire entre ellos (no se solapan). Splash arriba-izquierda,
            alineación abajo-derecha. Glow accent centrado detrás del conjunto. */}
        <div
          data-hero="mockup"
          style={{ opacity: 0 }}
          className="relative min-h-[640px] sm:min-h-[760px] lg:min-h-[820px]"
        >
          {/* Glow ambient detrás del conjunto */}
          <div
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
            aria-hidden="true"
          >
            <div className="w-[70%] h-[60%] bg-[var(--color-accent)] opacity-[0.14] blur-3xl rounded-full" />
          </div>

          {/* Phone secundario: splash, esquina ARRIBA-IZQUIERDA del contenedor.
              Hidden en mobile (no hay espacio horizontal). */}
          <div
            className="hidden sm:block absolute top-0 left-0 z-[1] -rotate-[9deg] opacity-90"
            aria-hidden="true"
          >
            <PhoneFrame
              src="/screens/splash.jpg"
              alt=""
              size="card"
              glow="subtle"
            />
          </div>

          {/* Phone primario: alineación, abajo-derecha pero levantado del
              suelo para mejor balance visual, rotado dcha. Sin float
              (la animación de tilt 3D daba sensación tipo radar). */}
          <div className="absolute bottom-16 sm:bottom-24 lg:bottom-28 right-0 z-[2] sm:rotate-[5deg]">
            <PhoneFrame
              src="/screens/alineacion.jpg"
              alt="Pantalla de Alineación en TACTIUM: 3 parejas ordenadas por puntos FEP con auto-balance"
              size="hero"
              glow="ambient"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
