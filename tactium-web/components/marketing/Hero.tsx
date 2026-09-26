import { BtnLink } from "@/components/ui";
import { IconChevronDown } from "@/components/Icon";
import { HeroBackdrop } from "./HeroBackdrop";

export function Hero() {
  return (
    <section className="mk-hero" aria-labelledby="mk-hero-title">
      <div className="mk-hero-glow" aria-hidden="true" />
      <HeroBackdrop />

      <div className="mk-wrap mk-hero-inner">
        <div className="mk-hero-copy">
          <h1 id="mk-hero-title" className="mk-h1">
            El sistema operativo del <em>pádel federado</em>
          </h1>
          <p className="mk-lede">
            Alineaciones con orden de fuerza, disponibilidad de la plantilla,
            torneos completos y la competición federada al día. Para capitanes,
            clubs y jugadores, en iOS, Android y web.
          </p>
          <div className="mk-actions">
            <BtnLink href="/empezar" variant="accent" size="lg">
              Crear cuenta gratis
            </BtnLink>
            <BtnLink href="#explorar" variant="ghost" size="lg">
              Explorar sin cuenta
            </BtnLink>
          </div>
          <p className="mk-fine">
            14 días gratis · sin tarjeta para empezar · los jugadores no pagan
          </p>
        </div>
        <div className="mk-hero-stage" aria-hidden="true" />
      </div>

      <a href="#flujo" className="mk-hero-scroll">
        Cómo funciona <IconChevronDown size={14} />
      </a>
    </section>
  );
}
