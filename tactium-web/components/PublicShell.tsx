"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { ICONS, IconMoon, IconSun } from "./Icon";
import { Wordmark } from "./Wordmark";
import { BtnLink } from "./ui";
import { PUBLIC_NAV, SIGNUP_HREF } from "@/lib/nav";
import { useTheme } from "@/lib/theme";
import { APP_STORE_URL, CONTACT_EMAIL, PLAY_STORE_URL } from "@/lib/site";

/**
 * Marco PÚBLICO — lo que ve quien llega sin cuenta.
 *
 * Un torneo tiene una sola dirección y esa dirección funciona para todos: lo
 * que cambia según quién mire no es la ruta, es el marco. Con sesión manda
 * `AppShell`; sin ella, esto: cabecera ligera, contenido a todo el ancho y dos
 * llamadas — entrar o crear cuenta.
 *
 * Sin barra lateral ni tab bar a propósito. Un visitante no tiene equipo, ni
 * jornadas, ni ajustes: enseñarle una navegación llena de destinos cerrados
 * es prometerle un producto y darle una fila de puertas con candado.
 */
export function PublicShell({
  children,
  dark,
}: {
  children: ReactNode;
  /** Portada: forzada a oscuro (regla de marca) y sin selector de tema. */
  dark?: boolean;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Al cambiar de ruta se cierra el menú móvil (si quedaba abierto).
  useEffect(() => setMenuOpen(false), [pathname]);

  // Al entrar se vuelve a donde estabas, nunca al inicio.
  const next = encodeURIComponent(pathname || "/");

  // Gana el destino más concreto: en /torneos/organizar se marca «Organizar
  // torneo», no también «Torneos».
  const matches = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const activeHref = PUBLIC_NAV.map((i) => i.href)
    .filter(matches)
    .sort((a, b) => b.length - a.length)[0];
  const isActive = (href: string) => href === activeHref;

  const navLinks = PUBLIC_NAV.map((item) => {
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
  });

  return (
    <div className={"tw-pub-shell" + (dark ? " mk-dark" : "")}>
    <a href="#contenido" className="tw-skip">
      Saltar al contenido
    </a>
    <div className="tw-pub">
      <header className="tw-pub-bar">
        <Link href="/" className="tw-pub-brand" aria-label="TACTIUM · Inicio">
          <Wordmark />
        </Link>

        {/* Nav inline (tablet/escritorio). En móvil se oculta y se usa el menú. */}
        <nav className="tw-pub-nav" aria-label="Navegación pública">
          {navLinks}
        </nav>

        <div className="tw-pub-actions">
          {!dark && <PublicThemeToggle />}
          <Link
            href={`/entrar?next=${next}`}
            className="tw-pub-ghost tw-pub-deskonly"
          >
            Entrar
          </Link>
          <BtnLink
            href={SIGNUP_HREF}
            variant="accent"
            className="tw-pub-cta tw-pub-deskonly"
          >
            Crear cuenta
          </BtnLink>
          {/* Hamburguesa: sólo en móvil. */}
          <button
            type="button"
            className="tw-pub-burger"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* Panel desplegable (móvil): navegación + entrar/crear cuenta. */}
        {menuOpen && (
          <div className="tw-pub-menu">
            {navLinks}
            <div className="tw-pub-menu-actions">
              <Link href={`/entrar?next=${next}`} className="tw-pub-ghost">
                Entrar
              </Link>
              <BtnLink href={SIGNUP_HREF} variant="accent" className="tw-pub-cta">
                Crear cuenta
              </BtnLink>
            </div>
          </div>
        )}
      </header>

      <div className="tw-pub-scroll">
      <main id="contenido" tabIndex={-1} className="tw-pub-content">
        {children}
      </main>

      <footer className="tw-pub-foot tw-pub-foot--big">
        <div className="mk-foot-brand">
          <Wordmark size={14} />
          <p>
            El sistema operativo del pádel federado: alineaciones, jornadas,
            temporadas, torneos y federación.
          </p>
        </div>
        <div className="mk-foot-col">
          <h4>Producto</h4>
          <nav aria-label="Producto">
            <Link href="/#funciones">Funciones</Link>
            <Link href="/pro">Planes</Link>
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer">
              App Store
            </a>
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
              Google Play
            </a>
          </nav>
        </div>
        <div className="mk-foot-col">
          <h4>Explorar</h4>
          <nav aria-label="Explorar">
            <Link href="/torneos">Torneos</Link>
            <Link href="/torneos/organizar">Organizar un torneo</Link>
            <Link href="/federacion">Federación</Link>
            <Link href="/comunidad">Comunidad</Link>
          </nav>
        </div>
        <div className="mk-foot-col">
          <h4>Cuenta</h4>
          <nav aria-label="Cuenta">
            <Link href={`/entrar?next=${next}`}>Entrar</Link>
            <Link href={SIGNUP_HREF}>Crear cuenta</Link>
            <Link href="/legal/eliminar-cuenta">Eliminar cuenta</Link>
          </nav>
        </div>
        <div className="mk-foot-col">
          <h4>Legal y contacto</h4>
          <nav aria-label="Legal y contacto">
            <Link href="/legal/aviso-legal">Aviso legal</Link>
            <Link href="/legal/privacidad">Privacidad</Link>
            <Link href="/legal/terminos">Términos</Link>
            <Link href="/legal/cookies">Cookies</Link>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </nav>
        </div>
        <div className="mk-foot-bottom">
          <span>© {new Date().getFullYear()} TACTIUM · Hecho en España para el pádel federado.</span>
        </div>
      </footer>
      </div>
    </div>
    </div>
  );
}

/**
 * Botón de tema del marco público. Dice la ACCIÓN («Cambiar a oscuro»), no el
 * estado: quien llega sin cuenta lee «Modo claro» como una etiqueta, no como
 * un botón.
 */
function PublicThemeToggle() {
  const { resolved, toggle, ready } = useTheme();
  const toDark = resolved !== "dark";
  const label = ready ? (toDark ? "Cambiar a oscuro" : "Cambiar a claro") : "Cambiar tema";
  return (
    <button
      type="button"
      onClick={toggle}
      className="btn btn-ghost btn-sm"
      aria-label={label}
      suppressHydrationWarning
    >
      {toDark ? <IconMoon size={14} /> : <IconSun size={14} />}
      <span className="tw-pub-deskonly" suppressHydrationWarning>
        {label}
      </span>
    </button>
  );
}
