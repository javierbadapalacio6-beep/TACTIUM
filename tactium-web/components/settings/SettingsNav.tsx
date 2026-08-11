"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SETTINGS_SECTIONS } from "@/lib/account-data";

/** Navegación de secciones de Ajustes. Sticky en escritorio, scroll
 *  horizontal en móvil (no se apila: son 10 entradas). */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="tw-settings-nav card" aria-label="Secciones de ajustes">
      {SETTINGS_SECTIONS.map((s) => {
        const href = `/ajustes/${s.slug}`;
        const active = pathname === href;
        const danger = s.slug === "peligro";
        return (
          <Link
            key={s.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className="mono"
            style={{
              padding: "11px 14px",
              borderRadius: 10,
              fontSize: 10.5,
              letterSpacing: "0.18em",
              whiteSpace: "nowrap",
              color: active
                ? "var(--accent)"
                : danger
                  ? "var(--error)"
                  : "var(--text-muted)",
              background: active ? "var(--accent-10)" : "transparent",
              boxShadow: active ? "inset 2px 0 0 var(--accent-40)" : "none",
              transition: "all var(--dur-fast) var(--ease)",
            }}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
