"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { ICONS } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";
import { PUBLIC_NAV } from "@/lib/nav";

/**
 * Marco PÚBLICO — lo que ve quien llega sin cuenta.
 *
 * Un torneo tiene una sola dirección y esa dirección funciona para todos: lo
 * que cambia según quién mire no es la ruta, es el marco. Con sesión manda
 * `AppShell` (barra lateral por rol); sin ella, esto: cabecera ligera,
 * contenido a todo el ancho y dos llamadas — entrar o crear cuenta.
 *
 * Sin barra lateral ni tab bar a propósito. Un visitante no tiene equipo, ni
 * jornadas, ni ajustes: enseñarle una navegación llena de destinos cerrados
 * es prometerle un producto y darle una fila de puertas con candado.
 */
export function PublicShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Al entrar se vuelve a donde estabas, nunca al inicio.
  const next = encodeURIComponent(pathname || "/");

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="tw-pub">
      <header className="tw-pub-bar">
        <Link href="/torneos" className="tw-pub-brand" aria-label="TACTIUM">
          <Wordmark />
        </Link>

        <nav className="tw-pub-nav" aria-label="Navegación pública">
          {PUBLIC_NAV.map((item) => {
            const active = isActive(item.href);
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={"tw-pub-link" + (active ? " is-active" : "")}
              >
                <Icon size={15} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="tw-pub-actions">
          <ThemeToggle />
          <Link href={`/entrar?next=${next}`} className="tw-pub-ghost">
            Entrar
          </Link>
          <Link href="/empezar" className="btn btn-accent tw-pub-cta">
            Crear cuenta
          </Link>
        </div>
      </header>

      <main className="tw-pub-content">{children}</main>

      <footer className="tw-pub-foot">
        <Wordmark size={13} />
        <p className="tw-pub-foot-txt">
          Gestión de equipos de pádel federado: alineaciones, jornadas,
          temporadas y torneos.
        </p>
        <nav className="tw-pub-foot-nav" aria-label="Enlaces del pie">
          <Link href="/pro">Planes</Link>
          <Link href={`/entrar?next=${next}`}>Entrar</Link>
          <Link href="/empezar">Crear cuenta</Link>
        </nav>
      </footer>
    </div>
  );
}
