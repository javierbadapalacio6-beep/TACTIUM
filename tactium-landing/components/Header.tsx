import Link from "next/link";
import { TactiumMark } from "./TactiumMark";
import { APP_STORE_URL } from "./AppStoreBadge";

// Header sticky con blur backdrop. Mobile-first: en small screens el nav
// se oculta y queda solo el CTA. Desktop muestra los anchors.
export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-md bg-[color-mix(in_srgb,var(--color-bg)_75%,transparent)] border-b border-[var(--color-hair)]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2.5 group"
          aria-label="TACTIUM · inicio"
        >
          <TactiumMark size={44} />
          <span className="font-bold tracking-tight text-[15px] text-[var(--color-text)]">
            TACTIUM
          </span>
        </Link>

        <nav
          aria-label="Navegación principal"
          className="hidden md:flex items-center gap-7 text-sm text-[var(--color-text-muted)]"
        >
          <a
            href="#para-quien"
            className="hover:text-[var(--color-text)] transition"
          >
            Para quién
          </a>
          <a
            href="#features"
            className="hover:text-[var(--color-text)] transition"
          >
            Features
          </a>
          <a
            href="#precios"
            className="hover:text-[var(--color-text)] transition"
          >
            Precios
          </a>
          <a
            href="#faq"
            className="hover:text-[var(--color-text)] transition"
          >
            FAQ
          </a>
        </nav>

        <a
          href={APP_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium px-4 h-9 inline-flex items-center rounded-full bg-[var(--color-accent-10)] border border-[var(--color-accent-40)] text-[var(--color-accent)] hover:bg-[var(--color-accent-25)] transition"
        >
          Descargar
        </a>
      </div>
    </header>
  );
}
