import { TactiumMark } from "./TactiumMark";
import { WaitlistForm } from "./WaitlistForm";

// CTA final con segundo formulario. Estrategia: el usuario que ha llegado
// hasta abajo está más caliente — segunda oportunidad de convertir.
export function FinalCta() {
  return (
    <section className="relative py-24 sm:py-32 border-t border-[var(--color-hair)] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-accent-10)] via-transparent to-transparent pointer-events-none" />
      <div className="relative max-w-2xl mx-auto px-6 text-center flex flex-col items-center gap-6">
        <TactiumMark size={64} />
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          Listo para subir el nivel{" "}
          <span className="text-[var(--color-accent)]">de tu equipo</span>
        </h2>
        <p className="text-lg text-[var(--color-text-muted)] max-w-xl">
          Apúntate al waitlist. Los primeros 100 capitanes y clubs tendrán 30
          días extra de prueba al lanzar.
        </p>
        <div className="w-full max-w-md">
          <WaitlistForm source="final-cta" />
        </div>
      </div>
    </section>
  );
}
