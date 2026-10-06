import { BtnLink } from "@/components/ui";
import { IconChevronDown } from "@/components/Icon";
import { HeroBackdrop } from "./HeroBackdrop";
import { PhoneFrame } from "./PhoneFrame";
import { StoreBadges } from "./StoreBadges";
import { SIGNUP_HREF } from "@/lib/nav";

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
            {/* La frase de producto, la misma que abre la app. */}
            <strong style={{ color: "var(--text)", fontWeight: 700 }}>
              Convoca, alinea y cierra la jornada.
            </strong>{" "}
            Disponibilidad de la plantilla, alineaciones con orden de fuerza,
            torneos completos y la competición federada al día. Para capitanes,
            clubs y jugadores, en iOS, Android y web.
          </p>
          <div className="mk-actions">
            <BtnLink href={SIGNUP_HREF} variant="accent" size="lg">
              Crear cuenta gratis
            </BtnLink>
            <BtnLink href="#explorar" variant="ghost" size="lg">
              Explorar sin cuenta
            </BtnLink>
          </div>
          {/* Las tiendas justo debajo de los botones, no al final: en un
              portátil con zoom quedaban por debajo del pliegue y no se veía
              dónde descargar la app. */}
          <div className="mk-hero-stores">
            <StoreBadges />
          </div>
          <p className="mk-fine">
            14 días gratis · sin tarjeta para empezar · los jugadores no pagan
          </p>
        </div>

        {/* Captura con 5 parejas (Liga Cántabra): la de alineación enseña 3 y
            hay que repetirla antes de usarla aquí. */}
        {/* El producto de verdad, delante de la pista 3D. En móvil va DEBAJO
            del texto (rejilla de una columna), nunca encima. */}
        <div className="mk-hero-stage">
          <div className="mk-hero-phone">
            <PhoneFrame
              src="/screens/jornada-pendiente.jpg"
              alt="Pantalla de una jornada en TACTIUM: rival, sede, hora y las cinco parejas por alinear"
              size="hero"
              priority
            />
          </div>
        </div>
      </div>

      <a href="#flujo" className="mk-hero-scroll">
        Cómo funciona <IconChevronDown size={14} />
      </a>
    </section>
  );
}
