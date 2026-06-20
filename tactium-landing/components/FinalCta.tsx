import { TactiumMark } from "./TactiumMark";
import { AppStoreBadge } from "./AppStoreBadge";

// CTA final. Estrategia: el usuario que ha llegado hasta abajo está más
// caliente — segunda oportunidad de convertir, ahora con descarga directa.
export function FinalCta() {
  return (
    <section className="relative py-16 sm:py-24 border-t border-[var(--color-hair)] overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-accent-10)] via-transparent to-transparent pointer-events-none" />
      <div className="relative max-w-2xl mx-auto px-6 text-center flex flex-col items-center gap-6">
        <TactiumMark size={64} />
        <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
          Listo para subir el nivel{" "}
          <span className="text-[var(--color-accent)]">de tu equipo</span>
        </h2>
        <p className="text-lg text-[var(--color-text-muted)] max-w-xl">
          Descárgala gratis y prueba 14 días con acceso completo. Sin tarjeta
          para empezar, cancela cuando quieras.
        </p>
        <AppStoreBadge />
      </div>
    </section>
  );
}
