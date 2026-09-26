import { ExploreBand } from "./ExploreBand";
import { Faq } from "./Faq";
import { Features } from "./Features";
import { FinalCta } from "./FinalCta";
import { ForClubs } from "./ForClubs";
import { Hero } from "./Hero";
import { PricingTeaser } from "./PricingTeaser";
import { Steps } from "./Steps";
import { Tournaments } from "./Tournaments";

/**
 * Portada para quien llega sin cuenta. Primero qué hace TACTIUM (hero, flujo
 * de una jornada, funciones, clubs, torneos); después lo que se puede usar sin
 * cuenta (torneos en marcha y federación); y al final precio, dudas y cierre.
 */
export function MarketingHome() {
  return (
    <div className="mk">
      <Hero />
      <Steps />
      <Features />
      <ForClubs />
      <Tournaments />
      <ExploreBand />
      <PricingTeaser />
      <Faq />
      <FinalCta />
    </div>
  );
}
