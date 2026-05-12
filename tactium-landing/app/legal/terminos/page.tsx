import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos de uso",
  description: "Términos de uso de TACTIUM durante el periodo pre-lanzamiento.",
};

export default function TerminosPage() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-20">
      <Link
        href="/"
        className="font-mono text-[11px] tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition"
      >
        ← VOLVER
      </Link>
      <h1 className="mt-8 text-3xl font-extrabold tracking-tight">
        Términos de uso
      </h1>
      <p className="mt-4 text-[var(--color-text-muted)]">
        Versión preliminar pre-lanzamiento.
      </p>

      <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
        <p>
          Durante el periodo de pre-lanzamiento, esta web informa sobre el
          producto TACTIUM y permite registrar tu interés. Al apuntarte al
          waitlist aceptas que te enviemos comunicaciones relacionadas
          exclusivamente con el lanzamiento del producto.
        </p>
        <p>
          Los precios y planes mostrados son indicativos y pueden ajustarse
          antes del lanzamiento público. Los términos definitivos del
          servicio se publicarán al abrir la beta y deberás aceptarlos
          dentro de la app para usarla.
        </p>
        <p className="text-xs text-[var(--color-text-faint)] mt-12">
          Texto definitivo pendiente.
        </p>
      </div>
    </main>
  );
}
