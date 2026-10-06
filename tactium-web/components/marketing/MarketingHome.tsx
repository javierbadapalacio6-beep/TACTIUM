import { ExploreBand } from "./ExploreBand";
import { Faq } from "./Faq";
import { Features } from "./Features";
import { FinalCta } from "./FinalCta";
import { ForClubs } from "./ForClubs";
import { Hero } from "./Hero";
import { Personas } from "./Personas";
import { PricingTeaser } from "./PricingTeaser";
import { SocialProof } from "./SocialProof";
import { Steps } from "./Steps";
import { Tournaments } from "./Tournaments";
import { loadHomeData } from "./explore-data";

/**
 * Portada para quien llega sin cuenta. Primero qué hace TACTIUM (hero y una
 * puerta por perfil, flujo de una jornada, funciones, clubs, torneos); después
 * lo que se puede usar sin cuenta (torneos en marcha y federación); y al final
 * cifras, precio, dudas y cierre.
 *
 * Los datos vivos se leen en servidor y se cachean 5 minutos (`explore-data`).
 */
export async function MarketingHome() {
  const data = await loadHomeData();
  return (
    <div className="mk">
      <Hero />
      <Personas />
      <Steps />
      <Features />
      <ForClubs />
      <Tournaments />
      <ExploreBand data={data} />
      <SocialProof stats={data.stats} />
      <PricingTeaser />
      <Faq />
      <FinalCta />
    </div>
  );
}
