"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  ICONS,
  IconBell,
  IconCheck,
  IconChevronDown,
  IconMoon,
  IconPlus,
  IconSearch,
  IconShield,
  IconSun,
} from "./Icon";
import { LogoMark } from "./LogoMark";
import { LogoSpinner } from "./TactiumLogo3D";
import { PublicShell } from "./PublicShell";
import { Wordmark } from "./Wordmark";
import {
  NAV_BY_ROLE,
  TABS_BY_ROLE,
  hasTeamSwitcher,
  isPublicPath,
  routeMeta,
} from "@/lib/nav";
import { useSession } from "@/lib/session";
import { useTheme } from "@/lib/theme";
import { fetchNotifications } from "@/lib/queries";

/**
 * Shell persistente (Tanda 1 · `Marco TACTIUM.dc.html`).
 *
 *  - Escritorio (>=1024px): barra lateral 240px + barra superior 64px.
 *  - Tablet (768–1023px): barra lateral colapsada a 72px, sólo iconos.
 *  - Móvil (<768px): sin barra lateral; tab bar inferior flotante.
 *
 * Las pantallas de entrada (`/entrar`, `/empezar`…) van a pantalla completa y
 * se saltan el shell — ver `BARE_ROUTES`.
 */

/** Rutas sin shell: onboarding y acceso ocupan toda la pantalla. */
const BARE_ROUTES = ["/entrar", "/alta", "/recuperar", "/empezar", "/bienvenida"];

// Qué rutas funcionan sin sesión vive en `lib/nav.ts` (`isPublicPath`), que es
// donde está también el menú del marco público.

/** Pantalla para rutas privadas sin sesión. */
function SignedOut() {
  return (
    <div
      className="amb"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div className="eyebrow">SESIÓN NECESARIA</div>
        <h1 style={{ margin: "16px 0 0", fontSize: 28 }}>
          Entra para ver tu equipo
        </h1>
        <p
          style={{
            margin: "12px 0 24px",
            fontSize: 14,
            color: "var(--text-muted)",
            textWrap: "pretty",
          }}
        >
          Tus jornadas, alineaciones y plantilla están protegidas. Sólo tú y tu
          equipo podéis verlas.
        </p>
        <Link
          href="/entrar"
          className="btn btn-accent"
          style={{ padding: "14px 26px", fontSize: 14.5 }}
        >
          Iniciar sesión
        </Link>
      </div>
    </div>
  );
}

/* ── Avisos (campanita) ── datos reales de la tabla `notifications` ──── */
type NoticeTone = "accent" | "warning" | "muted";
interface Notice {
  icon: keyof typeof ICONS;
  text: string;
  time: string;
  unread: boolean;
  tone: NoticeTone;
}

// Icono por tipo de notificación (mismos que la app; ver notifications.ts).
function iconForNotif(type: string): keyof typeof ICONS {
  if (["member_joined", "joined_team", "player_claimed"].includes(type))
    return "userPlus";
  if (["matchday_created", "lineup_published"].includes(type)) return "calendar";
  if (type.includes("reminder")) return "clock";
  if (type.includes("follow")) return "users";
  return "calendar";
}

// Tiempo relativo en español ("hace 2 h", "hace 3 d").
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(0, (Date.now() - then) / 1000);
  if (s < 60) return "ahora";
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `hace ${w} sem`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} ${mo === 1 ? "mes" : "meses"}`;
}

function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <span
      className="mono"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: "var(--primary-dim)",
        color: "var(--accent)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.36,
        fontWeight: 700,
        flex: "none",
      }}
    >
      {initials}
    </span>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Cierra el popover al pulsar fuera o con Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return ref;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { role, user, teams, activeTeam, setActiveTeam, ready, signOut } =
    useSession();
  const { resolved, toggle } = useTheme();

  const [teamOpen, setTeamOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const teamRef = useDismiss(teamOpen, () => setTeamOpen(false));
  const bellRef = useDismiss(bellOpen, () => setBellOpen(false));
  const roleRef = useDismiss(roleOpen, () => setRoleOpen(false));

  // Cerrar los popovers al cambiar de ruta: si no, se quedan abiertos encima
  // de la pantalla nueva.
  useEffect(() => {
    setTeamOpen(false);
    setBellOpen(false);
    setRoleOpen(false);
  }, [pathname]);

  // Avisos reales (campanita): la RLS acota a los del usuario. Antes esto era un
  // array de maqueta ("Marco se ha unido a Halcones A"…) que se colaba en una
  // vista autenticada real. Solo lectura; marcar leídas es una escritura aparte.
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    if (!user) {
      setNotices([]);
      return;
    }
    let alive = true;
    fetchNotifications()
      .then((rows) => {
        if (!alive) return;
        setNotices(
          rows.map((n) => ({
            icon: iconForNotif(n.type),
            text: n.title,
            time: timeAgo(n.created_at),
            unread: n.read_at == null,
            tone: n.type.includes("reminder")
              ? "warning"
              : n.read_at == null
                ? "accent"
                : "muted",
          })),
        );
      })
      .catch(() => {
        if (alive) setNotices([]);
      });
    return () => {
      alive = false;
    };
  }, [user]);

  if (BARE_ROUTES.some((r) => pathname.startsWith(r))) {
    return <>{children}</>;
  }

  // Mientras se resuelve la sesión no se pinta el shell: si no, aparece con el
  // rol por defecto y salta al real medio segundo después.
  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "var(--bg)",
          display: "grid",
          placeItems: "center",
        }}
      >
        {/* Resolver la sesión suele ser instantáneo; cuando no lo es, el
            spinner de marca aparece solo (lleva su propio retardo). */}
        <LogoSpinner size={104} />
      </div>
    );
  }

  // Sin sesión: las rutas privadas mandan a la entrada y las públicas van con
  // el MARCO PÚBLICO. Antes se servían con este mismo shell y el visitante veía
  // una barra lateral de rol "INVITADO" llena de destinos que no podía abrir.
  if (!user) {
    if (!isPublicPath(pathname)) return <SignedOut />;
    return <PublicShell>{children}</PublicShell>;
  }

  const nav = NAV_BY_ROLE[role];
  const tabs = TABS_BY_ROLE[role];
  const meta = routeMeta(pathname, role);
  const unread = notices.filter((n) => n.unread).length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* ══ Barra lateral ══════════════════════════════════════════ */}
      <aside className="tw-sidebar">
        <div className="tw-side-brand">
          <Wordmark />
          {/* Barra lateral colapsada (tablet): sólo la tesela con el isotipo. */}
          <span className="tw-side-brand-mini">
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LogoMark size={19} color="var(--accent)" />
            </span>
          </span>
        </div>

        <nav className="tw-side-nav" aria-label="Navegación principal">
          <div className="eyebrow tw-side-eyebrow">{(user?.roleLabel ?? "INVITADO")}</div>
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = ICONS[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.label}
                className={"tw-navitem" + (active ? " is-active" : "")}
              >
                <Icon size={17} />
                <span className="tw-navitem-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Selector de equipo — el jugador suelto no tiene plantilla */}
        {hasTeamSwitcher(role) ? (
          <div className="tw-side-team" ref={teamRef}>
            <div className="eyebrow eyebrow-faint tw-side-eyebrow">
              EQUIPO ACTIVO
            </div>
            <button
              type="button"
              onClick={() => setTeamOpen((v) => !v)}
              aria-expanded={teamOpen}
              className="tw-teambtn"
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: "var(--primary-dim)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <IconShield size={15} />
              </span>
              <span className="tw-navitem-label" style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {activeTeam?.name ?? "Sin equipo"}
                </span>
                <span
                  className="mono"
                  style={{
                    display: "block",
                    fontSize: 10,
                    letterSpacing: "0.14em",
                    color: "var(--text-faint)",
                    marginTop: 2,
                  }}
                >
                  {[activeTeam?.category, activeTeam?.gender]
                    .filter(Boolean)
                    .join(" · ")
                    .toUpperCase() || "SIN CATEGORÍA"}
                </span>
              </span>
              <span
                className="tw-navitem-label"
                style={{
                  color: "var(--text-faint)",
                  display: "flex",
                  transform: teamOpen ? "rotate(180deg)" : "none",
                  transition: "transform var(--dur-base) var(--ease)",
                }}
              >
                <IconChevronDown size={15} />
              </span>
            </button>

            {teamOpen && (
              <div className="tw-popover" style={{ marginTop: 6, padding: 6 }}>
                {teams.map((t) => {
                  const on = t.id === activeTeam?.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setActiveTeam(t.id);
                        setTeamOpen(false);
                      }}
                      className="tw-popitem"
                      style={{
                        color: on ? "var(--accent)" : "var(--text-muted)",
                        background: on ? "var(--accent-10)" : "transparent",
                        fontWeight: on ? 700 : 500,
                      }}
                    >
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          background: on
                            ? "var(--primary-dim)"
                            : "var(--bg-card-2)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: "none",
                        }}
                      >
                        <IconShield size={12} />
                      </span>
                      <span style={{ flex: 1, textAlign: "left" }}>{t.name}</span>
                      {on && <IconCheck size={14} />}
                    </button>
                  );
                })}
                {teams.length === 0 && (
                  <span
                    className="mono"
                    style={{
                      padding: "10px 12px",
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      color: "var(--text-faint)",
                    }}
                  >
                    SIN EQUIPOS
                  </span>
                )}
                <div
                  style={{
                    height: 1,
                    background: "var(--hair)",
                    margin: "4px 6px",
                  }}
                />
                <Link href="/empezar" className="tw-popitem" style={{ color: "var(--accent)", fontWeight: 700 }}>
                  <span
                    style={{
                      width: 20,
                      display: "flex",
                      justifyContent: "center",
                      flex: "none",
                    }}
                  >
                    <IconPlus size={14} />
                  </span>
                  <span style={{ flex: 1, textAlign: "left" }}>Crear equipo</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="tw-side-team tw-navitem-label">
            <div
              style={{
                margin: "4px 0 0",
                padding: 12,
                borderRadius: 12,
                border: "1px dashed var(--hair-strong)",
                textAlign: "center",
                fontSize: 12.5,
                color: "var(--text-faint)",
                textWrap: "pretty",
              }}
            >
              Sin equipo · no hay selector
            </div>
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Bloque de usuario · el rol lo deriva la sesión, no se elige */}
        <div className="tw-side-user" ref={roleRef}>
          {roleOpen && (
            <div
              className="tw-popover"
              style={{ marginBottom: 8, padding: 6 }}
              role="menu"
            >
              <Link href="/ajustes/apariencia" className="tw-popitem">
                <span style={{ flex: 1, textAlign: "left" }}>Ajustes</span>
              </Link>
              <Link href="/ajustes/datos" className="tw-popitem">
                <span style={{ flex: 1, textAlign: "left" }}>Mis datos</span>
              </Link>
              <div
                style={{ height: 1, background: "var(--hair)", margin: "4px 6px" }}
              />
              <button
                type="button"
                onClick={() => void signOut()}
                className="tw-popitem"
                style={{ color: "var(--error)" }}
              >
                <span style={{ flex: 1, textAlign: "left" }}>Cerrar sesión</span>
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => setRoleOpen((v) => !v)}
            aria-expanded={roleOpen}
            className="tw-userbtn"
            title="Tu cuenta"
          >
            <Avatar initials={(user?.initials ?? "··")} />
            <span
              className="tw-navitem-label"
              style={{ flex: 1, minWidth: 0, textAlign: "left" }}
            >
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {(user?.name ?? "Invitado")}
              </span>
              <span
                className="mono"
                style={{
                  display: "block",
                  fontSize: 10,
                  letterSpacing: "0.16em",
                  marginTop: 2,
                  color: !!user?.roleIsPrivileged
                    ? "var(--accent)"
                    : "var(--text-faint)",
                }}
              >
                {(user?.roleLabel ?? "INVITADO")}
              </span>
            </span>
            <span
              className="tw-navitem-label"
              style={{ color: "var(--text-faint)", display: "flex" }}
            >
              <IconChevronDown size={15} />
            </span>
          </button>
        </div>
      </aside>

      {/* ══ Contenido ══════════════════════════════════════════════ */}
      <div className="tw-main">
        <header className="tw-topbar">
          <div className="tw-topbar-title">
            <div
              className="eyebrow"
              style={{ lineHeight: 1, whiteSpace: "nowrap" }}
            >
              {meta.eyebrow}
            </div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                marginTop: 5,
              }}
            >
              {meta.title}
            </div>
          </div>

          <div className="tw-topbar-brand">
            <Wordmark size={14} />
          </div>

          <div className="tw-search">
            <Link href="/comunidad" className="tw-searchbox">
              <IconSearch size={15} />
              <span style={{ flex: 1, textAlign: "left" }}>
                Busca jugadores, equipos o torneos
              </span>
              <span className="mono tw-kbd">⌘K</span>
            </Link>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: 8, flex: "none" }}
            ref={bellRef}
          >
            <button
              type="button"
              onClick={() => setBellOpen((v) => !v)}
              aria-expanded={bellOpen}
              aria-label={`Avisos${unread ? ` · ${unread} sin leer` : ""}`}
              className="tw-iconbtn"
            >
              <IconBell size={17} />
              {unread > 0 && (
                <span className="mono tw-badge">{unread}</span>
              )}
            </button>

            <button
              type="button"
              onClick={toggle}
              className="tw-iconbtn"
              aria-label={
                resolved === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"
              }
              suppressHydrationWarning
            >
              {resolved === "dark" ? <IconSun size={17} /> : <IconMoon size={17} />}
            </button>

            <Link href="/ajustes" aria-label="Tu cuenta">
              <Avatar initials={(user?.initials ?? "··")} size={34} />
            </Link>

            {bellOpen && (
              <div className="tw-popover tw-bell">
                <div className="tw-bell-head">
                  <span className="eyebrow">AVISOS</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.1em",
                      color: "var(--text-faint)",
                    }}
                  >
                    {unread} sin leer
                  </span>
                </div>
                {notices.length === 0 && (
                  <div
                    style={{
                      padding: "22px 16px",
                      textAlign: "center",
                      fontSize: 13,
                      color: "var(--text-faint)",
                    }}
                  >
                    No tienes avisos.
                  </div>
                )}
                {notices.map((n, i) => {
                  const Icon = ICONS[n.icon as keyof typeof ICONS];
                  const color =
                    n.tone === "accent"
                      ? "var(--accent)"
                      : n.tone === "warning"
                        ? "var(--warning)"
                        : "var(--text-muted)";
                  return (
                    <div
                      key={i}
                      className="tw-bell-row"
                      style={{
                        borderBottom:
                          i === notices.length - 1
                            ? "none"
                            : "1px solid var(--hair)",
                      }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          background:
                            n.tone === "accent"
                              ? "var(--accent-10)"
                              : "var(--bg-card-2)",
                          color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: "none",
                        }}
                      >
                        <Icon size={15} />
                      </span>
                      <span style={{ flex: 1 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 13.5,
                            lineHeight: 1.35,
                            color: n.unread
                              ? "var(--text)"
                              : "var(--text-muted)",
                          }}
                        >
                          {n.text}
                        </span>
                        <span
                          className="mono"
                          style={{
                            display: "block",
                            fontSize: 10.5,
                            letterSpacing: "0.1em",
                            color: "var(--text-faint)",
                            marginTop: 5,
                          }}
                        >
                          {n.time}
                        </span>
                      </span>
                      {n.unread && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 999,
                            background: "var(--accent)",
                            marginTop: 6,
                            flex: "none",
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </header>

        <main className="tw-content">{children}</main>
      </div>

      {/* ══ Tab bar · móvil ════════════════════════════════════════ */}
      <nav className="tw-tabbar" aria-label="Navegación principal">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = ICONS[t.icon];
          return (
            <Link
              key={t.href + t.label}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={"tw-tab" + (active ? " is-active" : "")}
            >
              <Icon size={19} />
              <span style={{ fontSize: 10, fontWeight: active ? 700 : 500 }}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
