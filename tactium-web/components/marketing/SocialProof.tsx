import { Reveal } from "./Reveal";
import type { SiteStats } from "./explore-data";

/**
 * Prueba social. REGLA: nada inventado.
 *
 * - Testimonios: el array está vacío a propósito. Se rellena solo con frases
 *   reales y con permiso de quien las dice (nombre, rol y club). Mientras esté
 *   vacío, no se pinta nada.
 * - Cifras: salen de la RPC anon `public_site_stats()` (agregados sin datos
 *   personales, sin cuentas internas ni clubes demo). Una cifra de USO solo se
 *   enseña si es lo bastante grande como para sumar; la de la federación es
 *   cobertura de datos y se dice así.
 */

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
  club?: string;
}

export const TESTIMONIALS: Testimonial[] = [];

/** Por debajo de esto, una cifra de uso resta más de lo que suma. */
const MIN_CLOSED_MATCHDAYS = 50;
const MIN_ACTIVE_TEAMS = 25;

const fmt = (n: number) => n.toLocaleString("es-ES");

export function SocialProof({ stats }: { stats: SiteStats | null }) {
  const figures: { value: string; label: string }[] = [];
  if (stats) {
    if (stats.closedMatchdaysSeason >= MIN_CLOSED_MATCHDAYS)
      figures.push({ value: fmt(stats.closedMatchdaysSeason), label: "jornadas cerradas con TACTIUM esta temporada" });
    if (stats.activeTeamsSeason >= MIN_ACTIVE_TEAMS)
      figures.push({ value: fmt(stats.activeTeamsSeason), label: "equipos llevando su temporada aquí" });
    if (stats.fcpMatches > 0)
      figures.push({ value: fmt(stats.fcpMatches), label: "partidos de la Federación Cántabra, consultables sin cuenta" });
  }

  if (TESTIMONIALS.length === 0 && figures.length === 0) return null;

  return (
    <section className="mk-sec mk-proof" aria-labelledby="mk-proof-title">
      <div className="mk-wrap">
        <h2 id="mk-proof-title" className="sr-only">
          TACTIUM en cifras
        </h2>
        {figures.length > 0 && (
          <Reveal as="div" className="mk-proof-figures">
            {figures.map((f) => (
              <div key={f.label} className="mk-proof-figure">
                <strong>{f.value}</strong>
                <span>{f.label}</span>
              </div>
            ))}
          </Reveal>
        )}
        {TESTIMONIALS.length > 0 && (
          <div className="mk-quotes">
            {TESTIMONIALS.map((t, i) => (
              <Reveal as="article" key={t.name} className="mk-quote" delay={0.05 * i}>
                <figure>
                  <blockquote>{t.quote}</blockquote>
                  <figcaption>
                    <b>{t.name}</b>
                    <span>{[t.role, t.club].filter(Boolean).join(" · ")}</span>
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
