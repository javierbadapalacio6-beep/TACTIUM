import { FAQ_QUESTIONS } from "@/lib/faq";

// FAQ con <details> nativo. Sin CSS de animación de altura (causa CLS).
// Las preguntas viven en `lib/faq.ts` para compartirlas con el JSON-LD
// FAQPage que se inyecta en layout.tsx (rich snippet en Google + LLM citation).

export function Faq() {
  return (
    <section
      id="faq"
      className="py-20 sm:py-28 border-t border-[var(--color-hair)]"
    >
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <p className="font-mono text-[11px] tracking-[0.25em] font-medium text-[var(--color-accent)] mb-3">
            FAQ
          </p>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Preguntas frecuentes
          </h2>
        </div>

        <div className="flex flex-col gap-2">
          {FAQ_QUESTIONS.map(({ q, a }) => (
            <details
              key={q}
              className="group p-5 rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-hair)] hover:border-[var(--color-hair-strong)] transition"
            >
              <summary className="cursor-pointer list-none flex items-center justify-between gap-4 font-semibold text-[15px] text-[var(--color-text)]">
                {q}
                <span
                  aria-hidden="true"
                  className="flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-bg-raised)] border border-[var(--color-hair-strong)] flex items-center justify-center text-[var(--color-text-muted)] group-open:bg-[var(--color-accent-10)] group-open:border-[var(--color-accent-40)] group-open:text-[var(--color-accent)] transition"
                >
                  <span className="group-open:hidden">+</span>
                  <span className="hidden group-open:inline">−</span>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
                {a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
