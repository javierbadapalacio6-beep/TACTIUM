import { BtnLink } from "@/components/ui";
import { LogoMark } from "@/components/LogoMark";
import { TRIAL_DURATION_DAYS } from "@/lib/plans";
import { Reveal } from "./Reveal";
import { StoreBadges } from "./StoreBadges";

export function FinalCta() {
  return (
    <section className="mk-final" aria-labelledby="mk-final-title">
      <Reveal className="mk-wrap">
        <span className="mk-final-mark" aria-hidden="true">
          <LogoMark size={36} color="var(--accent)" />
        </span>
        <h2 id="mk-final-title" className="mk-h2">
          Tu próxima jornada, con la alineación hecha
        </h2>
        <p className="mk-lede">
          Crea la cuenta, mete la plantilla y prueba {TRIAL_DURATION_DAYS} días
          con todo. Sin tarjeta para empezar, cancela cuando quieras.
        </p>
        <div className="mk-actions">
          <BtnLink href="/empezar" variant="accent" size="lg">
            Crear cuenta gratis
          </BtnLink>
        </div>
        <StoreBadges />
        <dl className="mk-hero-stats">
          <div className="mk-hero-stat">
            <dt className="sr-only">Prueba</dt>
            <dd style={{ margin: 0 }}>
              <strong>{TRIAL_DURATION_DAYS}</strong>
              <span>días de prueba, sin tarjeta</span>
            </dd>
          </div>
          <div className="mk-hero-stat">
            <dt className="sr-only">Variantes</dt>
            <dd style={{ margin: 0 }}>
              <strong>5</strong>
              <span>variantes por jornada</span>
            </dd>
          </div>
          <div className="mk-hero-stat">
            <dt className="sr-only">Torneos</dt>
            <dd style={{ margin: 0 }}>
              <strong>16</strong>
              <span>parejas gratis por torneo</span>
            </dd>
          </div>
        </dl>
      </Reveal>
    </section>
  );
}
