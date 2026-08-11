import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { AppPreview } from "@/components/AppPreview";
import { FederationsMarquee } from "@/components/FederationsMarquee";
import { LigaCantabraSection } from "@/components/LigaCantabraSection";
import { ForWho } from "@/components/ForWho";
import { ForClubs } from "@/components/ForClubs";
import { Features } from "@/components/Features";
import { AmistososSection } from "@/components/AmistososSection";
import { TorneosSection } from "@/components/TorneosSection";
import { Pricing } from "@/components/Pricing";
import { Faq } from "@/components/Faq";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";

// Home: RSC pura. Las islas client (WaitlistForm dentro de Hero/FinalCta,
// Pricing por su toggle, Features por mouse trail, AppPreview y ForClubs
// por scroll-reveal con anime.js) están encapsuladas en sus componentes.
//
// Orden narrativo:
//   1. Hero — qué es + waitlist (con pista 3D de fondo)
//   2. AppPreview — flujo de uso real (3 phones con storytelling)
//   3. FederationsMarquee — prueba social (federaciones soportadas)
//   4. LigaCantabraSection — la liga federada viva en la app (diferenciador)
//   5. ForWho — segmentación (capitán / club)
//   6. ForClubs — deep-dive en el plan Club (multi-equipo)
//   7. Features — bento con todas las features (icono+texto)
//   8. AmistososSection — lado social/casual
//   9. TorneosSection — organización de torneos de club
//  10. Pricing — planes + pago por torneo
//  11. Faq, FinalCta, Footer
export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <AppPreview />
        <FederationsMarquee />
        <LigaCantabraSection />
        <ForWho />
        <ForClubs />
        <Features />
        <AmistososSection />
        <TorneosSection />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
