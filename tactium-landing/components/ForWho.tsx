import { Crown, Building2, Users } from "lucide-react";

// Sección "Para quién" — 3 columnas con icono + título + 2 líneas.
// El badge "GRATIS" en Players es deliberado: anti-friction message.
const audiences = [
  {
    icon: Crown,
    title: "Capitanes",
    description:
      "Gestiona tu equipo desde el móvil. Alineaciones inteligentes, variantes y comunicación con jugadores en un solo sitio.",
    priceHint: "4,99 €/mes · 14 días gratis",
    badge: null,
  },
  {
    icon: Building2,
    title: "Clubs",
    description:
      "Coordina todos tus equipos desde un panel. Tus capitanes acceden gratis bajo tu plan.",
    priceHint: "Desde 11,99 €/mes",
    badge: null,
  },
  {
    icon: Users,
    title: "Jugadores",
    description:
      "Confirma disponibilidad, recibe convocatorias y ve tu histórico. Sin pagar nada.",
    priceHint: null,
    badge: "GRATIS",
  },
];

export function ForWho() {
  return (
    <section
      id="para-quien"
      className="py-14 sm:py-20 border-t border-[var(--color-hair)]"
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="mb-12 sm:mb-16">
          <p className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3">
            PARA QUIÉN
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight max-w-2xl">
            Un producto para todo el ecosistema del pádel federado
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {audiences.map(({ icon: Icon, title, description, priceHint, badge }) => (
            <article
              key={title}
              className="relative p-6 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-hair)] hover:border-[var(--color-hair-strong)] transition flex flex-col gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-[var(--color-accent-10)] border border-[var(--color-accent-40)] flex items-center justify-center">
                <Icon className="w-5 h-5 text-[var(--color-accent)]" />
              </div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold tracking-tight">{title}</h3>
                {badge && (
                  <span className="font-mono text-[9px] font-bold tracking-widest px-2 py-1 rounded bg-[var(--color-accent-10)] text-[var(--color-accent)] border border-[var(--color-accent-40)]">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-[15px] leading-relaxed text-[var(--color-text-muted)]">
                {description}
              </p>
              {priceHint && (
                <p className="font-mono text-xs text-[var(--color-text-faint)] mt-auto pt-2 border-t border-[var(--color-hair)]">
                  {priceHint}
                </p>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
