import Link from "next/link";
import { TactiumMark } from "./TactiumMark";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-hair)] py-12 mt-auto">
      <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-2.5">
          <TactiumMark size={24} />
          <span className="font-bold text-sm tracking-tight">TACTIUM</span>
          <span className="font-mono text-[10px] tracking-widest text-[var(--color-text-faint)] ml-2">
            CREATE · ANALYZE · ELEVATE
          </span>
        </div>

        <nav
          aria-label="Enlaces de pie de página"
          className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-[var(--color-text-muted)]"
        >
          <Link
            href="/legal/privacidad"
            className="hover:text-[var(--color-text)] transition"
          >
            Privacidad
          </Link>
          <Link
            href="/legal/terminos"
            className="hover:text-[var(--color-text)] transition"
          >
            Términos
          </Link>
          <Link
            href="/legal/eliminar-cuenta"
            className="hover:text-[var(--color-text)] transition"
          >
            Eliminar cuenta
          </Link>
          <a
            href="mailto:hola@tactium.io"
            className="hover:text-[var(--color-text)] transition"
          >
            hola@tactium.io
          </a>
        </nav>
      </div>
      <div className="max-w-6xl mx-auto px-6 mt-8 pt-6 border-t border-[var(--color-hair)]">
        <p className="text-xs text-[var(--color-text-faint)]">
          © {new Date().getFullYear()} TACTIUM · Hecho en España para el
          pádel federado.
        </p>
      </div>
    </footer>
  );
}
