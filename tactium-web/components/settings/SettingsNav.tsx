"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SETTINGS_SECTIONS } from "@/lib/account-data";
import { ICONS } from "@/components/Icon";

/** Navegación de secciones de Ajustes. Sticky en escritorio, scroll
 *  horizontal en móvil (no se apila: son 10 entradas).
 *
 *  La etiqueta y el icono salen de `SETTINGS_SECTIONS`: una sola fuente para
 *  el menú, el título de cada sección y las migas. */
export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="tw-settings-nav card" aria-label="Secciones de ajustes">
      {SETTINGS_SECTIONS.map((s) => {
        const href = `/ajustes/${s.slug}`;
        const active = pathname === href;
        const danger = s.slug === "peligro";
        const Icon = ICONS[s.icon as keyof typeof ICONS];
        return (
          <Link
            key={s.slug}
            href={href}
            aria-current={active ? "page" : undefined}
            className={
              "tw-settings-link" +
              (active ? " is-active" : "") +
              (danger && !active ? " is-danger" : "")
            }
          >
            {Icon && <Icon size={16} />}
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
