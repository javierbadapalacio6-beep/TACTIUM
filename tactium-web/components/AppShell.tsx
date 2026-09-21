"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  ICONS,
  IconBell,
  IconBuilding,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
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
import { Avatar } from "./ui";
import {
  NAV_BY_ROLE,
  TABS_BY_ROLE,
  hasTeamSwitcher,
  isKnownRoute,
  isPublicPath,
  routeCrumbs,
} from "@/lib/nav";
import { ROLE_LABELS, useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useTheme } from "@/lib/theme";
import { fetchNotifications, markNotificationsRead } from "@/lib/queries";
import { WRITES_ENABLED } from "@/lib/writes";

/**
 * Shell persistente del panel.
 *
 *  - Escritorio (>=1024px): barra lateral 240px + barra superior 56px con
 *    migas de pan, buscador y avisos.
 *  - Tablet (768–1023px): barra lateral colapsada a 72px, sólo iconos.
 *  - Móvil (<768px): sin barra lateral; tab bar inferior flotante.
 *
 * Las pantallas de entrada (`/entrar`, `/empezar`…) van a pantalla completa y
 * se saltan el shell — ver `BARE_ROUTES`.
 */

/** Rutas sin shell: onboarding y acceso ocupan toda la pantalla. */
const BARE_ROUTES = ["/entrar", "/alta", "/recuperar", "/empezar", "/bienvenida"];

const REHEAL_KEY = "tw_session_reheal";

/** Pantalla para rutas privadas sin sesión. */
function SignedOut() {
  // Auto-cura del "salto a login" al volver de un sitio externo (p. ej. el alta
  // de Stripe Connect): el token puede haber caducado durante el rodeo y
  // `getUser()` devolver null aunque las cookies de sesión sigan siendo válidas.
  useEffect(() => {
    let done = false;
    try {
      if (sessionStorage.getItem(REHEAL_KEY)) return;
    } catch {
      return;
    }
    const sb = supabaseBrowser();
    sb.auth.getSession().then(({ data }) => {
      if (done || !data.session) return;
      try {
        sessionStorage.setItem(REHEAL_KEY, "1");
      } catch {
        return;
      }
      sb.auth.refreshSession().finally(() => window.location.reload());
    });
    return () => {
      done = true;
    };
  }, []);

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
      <div style={{ textAlign: "center", maxWidth: 400 }}>
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--primary)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <LogoMark size={28} color="var(--accent)" />
        </span>
        <h1 style={{ fontSize: 26 }}>Entra para ver tu equipo</h1>
        <p
          style={{
            margin: "10px 0 22px",
            fontSize: 14,
            color: "var(--text-muted)",
          }}
        >
          Tus jornadas, alineaciones y plantilla están protegidas. Sólo tú y tu
          equipo podéis verlas.
        </p>
        <Link href="/entrar" className="btn btn-accent btn-lg">
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

function iconForNotif(type: string): keyof typeof ICONS {
  if (["member_joined", "joined_team", "player_claimed"].includes(type))
    return "userPlus";
  if (["matchday_created", "lineup_published"].includes(type)) return "calendar";
  if (type.includes("reminder")) return "clock";
  if (type.includes("follow")) return "users";
  return "calendar";
}

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

function matchesHref(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/** Href activo entre una lista: el prefijo MÁS específico que casa. */
function activeHref(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null;
  for (const href of hrefs) {
    if (matchesHref(pathname, href) && (best === null || href.length > best.length)) {
      best = href;
    }
  }
  return best;
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

/** Selector de contexto (club / equipo) de la barra lateral. */
function ContextPicker({
  label,
  icon,
  title,
  sub,
  open,
  onToggle,
  children,
  refEl,
}: {
  label: string;
  icon: ReactNode;
  title: string;
  sub: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  refEl: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="tw-side-team" ref={refEl}>
      <div className="tw-side-eyebrow">{label}</div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="tw-teambtn"
        title={title}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: "var(--tile-bg)",
            color: "var(--tile-fg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          {icon}
        </span>
        <span className="tw-navitem-label" style={{ flex: 1, minWidth: 0 }}>
          <span
            className="truncate"
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </span>
          <span
            className="truncate"
            style={{
              display: "block",
              fontSize: 11.5,
              color: "var(--text-faint)",
              marginTop: 1,
            }}
          >
            {sub}
          </span>
        </span>
        <span
          className="tw-navitem-label"
          style={{
            color: "var(--text-faint)",
            display: "flex",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform var(--dur-base) var(--ease)",
          }}
        >
          <IconChevronDown size={15} />
        </span>
      </button>
      {open && (
        <div className="tw-popover" style={{ marginTop: 6, padding: 6 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function PopItem({
  on,
  icon,
  label,
  onClick,
}: {
  on: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tw-popitem"
      style={{
        color: on ? "var(--accent)" : undefined,
        background: on ? "var(--accent-10)" : undefined,
        fontWeight: on ? 700 : 500,
      }}
    >
      {icon && (
        <span
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: on ? "var(--tile-bg)" : "var(--bg-card-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: "none",
          }}
        >
          {icon}
        </span>
      )}
      <span className="truncate" style={{ flex: 1, textAlign: "left" }}>
        {label}
      </span>
      {on && <IconCheck size={14} />}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    role,
    user,
    teams,
    activeTeam,
    setActiveTeam,
    clubs,
    clubId,
    setActiveClub,
    availableRoles,
    setRole,
    ready,
    signOut,
  } = useSession();
  const { resolved, toggle } = useTheme();

  const [teamOpen, setTeamOpen] = useState(false);
  const [clubOpen, setClubOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);

  const teamRef = useDismiss(teamOpen, () => setTeamOpen(false));
  const clubRef = useDismiss(clubOpen, () => setClubOpen(false));
  const bellRef = useDismiss(bellOpen, () => setBellOpen(false));
  const roleRef = useDismiss(roleOpen, () => setRoleOpen(false));

  useEffect(() => {
    setTeamOpen(false);
    setClubOpen(false);
    setBellOpen(false);
    setRoleOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (user) {
      try {
        sessionStorage.removeItem(REHEAL_KEY);
      } catch {
        /* sin storage */
      }
    }
  }, [user]);

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
        <LogoSpinner size={104} />
      </div>
    );
  }

  if (!user) {
    if (isPublicPath(pathname)) return <PublicShell>{children}</PublicShell>;
    if (!isKnownRoute(pathname)) return <PublicShell>{children}</PublicShell>;
    return <SignedOut />;
  }

  const nav = NAV_BY_ROLE[role];
  const tabs = TABS_BY_ROLE[role];
  const navActiveHref = activeHref(pathname, nav.map((i) => i.href));
  const tabsActiveHref = activeHref(pathname, tabs.map((t) => t.href));
  const crumbs = routeCrumbs(pathname, role);
  const unread = notices.filter((n) => n.unread).length;
  const activeClub = clubs.find((c) => c.id === clubId) ?? null;

  function toggleBell() {
    setBellOpen((v) => {
      const next = !v;
      if (next && unread > 0) {
        setNotices((ns) => ns.map((n) => ({ ...n, unread: false })));
        if (WRITES_ENABLED) markNotificationsRead().catch(() => {});
      }
      return next;
    });
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      {/* ══ Barra lateral ══════════════════════════════════════════ */}
      <aside className="tw-sidebar">
        <Link
          href={role === "club" ? "/club" : "/"}
          className="tw-side-brand"
          aria-label="TACTIUM · Inicio"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <Wordmark size={15} />
          <span className="tw-side-brand-mini">
            <span
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "var(--primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <LogoMark size={20} color="var(--accent)" />
            </span>
          </span>
        </Link>

        <nav className="tw-side-nav" aria-label="Navegación principal">
          {nav.map((item) => {
            const active = item.href === navActiveHref;
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

        {/* Selector de club */}
        {clubs.length > 0 && (
          <ContextPicker
            label="Club"
            icon={<IconBuilding size={15} />}
            title={activeClub?.name ?? "Sin club"}
            sub={clubs.length > 1 ? `${clubs.length} clubes` : "Club activo"}
            open={clubOpen}
            onToggle={() => setClubOpen((v) => !v)}
            refEl={clubRef}
          >
            {clubs.map((c) => (
              <PopItem
                key={c.id}
                on={c.id === clubId}
                icon={<IconBuilding size={12} />}
                label={c.name}
                onClick={() => {
                  setActiveClub(c.id);
                  setClubOpen(false);
                }}
              />
            ))}
          </ContextPicker>
        )}

        {/* Selector de equipo — el jugador suelto no tiene plantilla */}
        {hasTeamSwitcher(role) && (
          <ContextPicker
            label="Equipo"
            icon={<IconShield size={15} />}
            title={activeTeam?.name ?? "Sin equipo"}
            sub={
              [activeTeam?.category, activeTeam?.gender].filter(Boolean).join(" · ") ||
              "Sin categoría"
            }
            open={teamOpen}
            onToggle={() => setTeamOpen((v) => !v)}
            refEl={teamRef}
          >
            {teams.map((t) => (
              <PopItem
                key={t.id}
                on={t.id === activeTeam?.id}
                icon={<IconShield size={12} />}
                label={t.name}
                onClick={() => {
                  setActiveTeam(t.id);
                  setTeamOpen(false);
                }}
              />
            ))}
            {teams.length === 0 && (
              <span
                style={{
                  padding: "10px 12px",
                  fontSize: 12.5,
                  color: "var(--text-faint)",
                }}
              >
                Sin equipos
              </span>
            )}
            <div className="tw-pop-sep" />
            <Link href="/empezar" className="tw-popitem" style={{ color: "var(--accent)", fontWeight: 600 }}>
              <span style={{ width: 22, display: "flex", justifyContent: "center", flex: "none" }}>
                <IconPlus size={14} />
              </span>
              <span style={{ flex: 1, textAlign: "left" }}>Crear equipo</span>
            </Link>
          </ContextPicker>
        )}

        <div style={{ flex: 1 }} />

        {/* Bloque de usuario: rol elegido + ajustes + salir */}
        <div className="tw-side-user" ref={roleRef}>
          {roleOpen && (
            <div
              className="tw-popover"
              style={{ marginBottom: 8, padding: 6 }}
              role="menu"
            >
              {availableRoles.length > 1 && (
                <>
                  <span className="tw-pop-label">Usar TACTIUM como</span>
                  {availableRoles.map((r) => (
                    <PopItem
                      key={r}
                      on={r === role}
                      label={ROLE_LABELS[r]}
                      onClick={() => {
                        setRole(r);
                        setRoleOpen(false);
                      }}
                    />
                  ))}
                  <div className="tw-pop-sep" />
                </>
              )}
              <Link href="/ajustes/apariencia" className="tw-popitem">
                <span style={{ flex: 1, textAlign: "left" }}>Ajustes</span>
              </Link>
              <Link href="/ajustes/datos" className="tw-popitem">
                <span style={{ flex: 1, textAlign: "left" }}>Mis datos</span>
              </Link>
              <Link href="/suscripcion" className="tw-popitem">
                <span style={{ flex: 1, textAlign: "left" }}>Mi suscripción</span>
              </Link>
              <div className="tw-pop-sep" />
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
            <Avatar initials={user.initials} src={user.avatarUrl} size={30} />
            <span
              className="tw-navitem-label"
              style={{ flex: 1, minWidth: 0, textAlign: "left" }}
            >
              <span
                className="truncate"
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                }}
              >
                {user.name}
              </span>
              <span
                className="truncate"
                style={{
                  display: "block",
                  fontSize: 11.5,
                  marginTop: 1,
                  color: user.roleIsPrivileged ? "var(--accent)" : "var(--text-faint)",
                }}
              >
                {ROLE_LABELS[role]}
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
          <nav className="tw-topbar-title" aria-label="Migas de pan">
            <div className="tw-crumbs">
              {crumbs.map((c, i) => (
                <span key={i} style={{ display: "contents" }}>
                  {i > 0 && (
                    <span className="sep" aria-hidden="true">
                      <IconChevronRight size={13} />
                    </span>
                  )}
                  {c.href ? (
                    <Link href={c.href}>{c.label}</Link>
                  ) : (
                    <span className="cur">{c.label}</span>
                  )}
                </span>
              ))}
            </div>
          </nav>

          <Link
            href="/"
            className="tw-topbar-brand"
            aria-label="TACTIUM · Inicio"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <Wordmark size={14} />
          </Link>

          <div className="tw-search">
            <Link href="/comunidad" className="tw-searchbox">
              <IconSearch size={15} />
              <span style={{ flex: 1, textAlign: "left" }}>
                Buscar jugadores, equipos o torneos
              </span>
              <span className="tw-kbd">⌘K</span>
            </Link>
          </div>

          <div
            style={{ display: "flex", alignItems: "center", gap: 4, flex: "none", position: "relative" }}
            ref={bellRef}
          >
            <button
              type="button"
              onClick={toggleBell}
              aria-expanded={bellOpen}
              aria-label={`Avisos${unread ? ` · ${unread} sin leer` : ""}`}
              className="tw-iconbtn"
            >
              <IconBell size={17} />
              {unread > 0 && <span className="tw-badge">{unread}</span>}
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

            <Link href="/ajustes" aria-label="Tu cuenta" style={{ marginLeft: 6, display: "flex" }}>
              <Avatar initials={user.initials} src={user.avatarUrl} size={32} />
            </Link>

            {bellOpen && (
              <div className="tw-popover tw-bell">
                <div className="tw-bell-head">
                  <span style={{ fontSize: 14, fontWeight: 700 }}>Avisos</span>
                  <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
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
                          i === notices.length - 1 ? "none" : "1px solid var(--line)",
                      }}
                    >
                      <span
                        style={{
                          width: 30,
                          height: 30,
                          borderRadius: 9,
                          background:
                            n.tone === "accent" ? "var(--accent-10)" : "var(--bg-card-2)",
                          color,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flex: "none",
                        }}
                      >
                        <Icon size={15} />
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            display: "block",
                            fontSize: 13.5,
                            lineHeight: 1.35,
                            color: n.unread ? "var(--text)" : "var(--text-muted)",
                          }}
                        >
                          {n.text}
                        </span>
                        <span
                          style={{
                            display: "block",
                            fontSize: 12,
                            color: "var(--text-faint)",
                            marginTop: 4,
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
          const active = t.href === tabsActiveHref;
          const Icon = ICONS[t.icon];
          return (
            <Link
              key={t.href + t.label}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={"tw-tab" + (active ? " is-active" : "")}
            >
              <Icon size={19} />
              <span style={{ fontSize: 10.5, fontWeight: active ? 700 : 500 }}>
                {t.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
