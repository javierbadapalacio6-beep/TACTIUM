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
  IconHome,
  IconMoon,
  IconPlus,
  IconSearch,
  IconShield,
  IconSun,
  IconTrash,
  IconX,
} from "./Icon";
import { LogoMark } from "./LogoMark";
import { LogoSpinner } from "./TactiumLogo3D";
import { PublicShell } from "./PublicShell";
import { Wordmark } from "./Wordmark";
import { Avatar } from "./ui";
import {
  TABS_BY_ROLE,
  TABS_TOURNAMENTS_ONLY,
  hasTeamSwitcher,
  isKnownRoute,
  isPublicPath,
  topNav,
  type NavGroup,
} from "@/lib/nav";
import { ROLE_LABELS, useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDismiss } from "@/lib/use-dismiss";
import { useTheme } from "@/lib/theme";
import {
  deleteAllNotifications,
  deleteNotification,
  fetchNotifications,
  markNotificationsRead,
} from "@/lib/queries";
import { WRITES_ENABLED } from "@/lib/writes";

/**
 * Shell persistente del panel.
 *
 * La navegación va ARRIBA, en píldoras, dentro de un marco redondeado que
 * flota sobre un lienzo más oscuro. A la izquierda la marca y el botón de
 * inicio; a la derecha el contexto (club y equipo) y los controles.
 *
 * El scroll vive en `tw-main`, no en el body: es lo que mantiene el marco
 * quieto y el redondeo intacto.
 */

/** Rutas sin shell: onboarding y acceso ocupan toda la pantalla. */
const BARE_ROUTES = [
  "/entrar",
  "/alta",
  "/recuperar",
  "/empezar",
  "/bienvenida",
  "/auth/reset-password",
];

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
      style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}
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
        <p style={{ margin: "10px 0 22px", fontSize: 14, color: "var(--text-muted)" }}>
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
  id: string;
  icon: keyof typeof ICONS;
  text: string;
  time: string;
  unread: boolean;
  tone: NoticeTone;
  /** A dónde lleva. Null si ese tipo no tiene destino. */
  href: string | null;
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

/** Envuelve el contenido de un aviso en un enlace si tiene destino. */
function cuerpoDe(n: Notice, contenido: ReactNode, alPulsar: () => void) {
  if (!n.href) return <span className="tw-bell-body">{contenido}</span>;
  return (
    <Link href={n.href} className="tw-bell-body" onClick={alPulsar}>
      {contenido}
    </Link>
  );
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

/** Una píldora del nav superior: destino suelto o grupo desplegable. */
function NavPill({
  group,
  active,
  pathname,
}: {
  group: NavGroup;
  active: boolean;
  pathname: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const Icon = ICONS[group.icon];
  // Dentro del desplegable, igual: sólo la opción más específica se marca.
  const itemActiveHref = activeHref(pathname, group.items?.map((i) => i.href) ?? []);

  useEffect(() => setOpen(false), [pathname]);

  if (!group.items) {
    return (
      <Link
        href={group.href}
        aria-current={active ? "page" : undefined}
        className={"tw-pill" + (active ? " is-active" : "")}
      >
        <Icon size={16} className="tw-pill-ico" />
        <span>{group.label}</span>
      </Link>
    );
  }

  return (
    <div ref={ref} style={{ position: "relative", flex: "none" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={"tw-pill" + (active ? " is-active" : "")}
      >
        <Icon size={16} className="tw-pill-ico" />
        <span>{group.label}</span>
        <IconChevronDown
          size={14}
          style={{
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform var(--dur-base) var(--ease)",
          }}
        />
      </button>
      {open && (
        <div
          className="tw-popover"
          style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: 220, padding: 6 }}
        >
          {group.items.map((it) => {
            const ItemIcon = ICONS[it.icon];
            const on = it.href === itemActiveHref;
            return (
              <Link
                key={it.href}
                href={it.href}
                className="tw-popitem"
                style={{
                  color: on ? "var(--accent)" : undefined,
                  background: on ? "var(--accent-10)" : undefined,
                  fontWeight: on ? 700 : 500,
                }}
              >
                <ItemIcon size={15} />
                <span style={{ flex: 1 }}>{it.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
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

  const [ctxOpen, setCtxOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const ctxRef = useDismiss(ctxOpen, () => setCtxOpen(false));
  const bellRef = useDismiss(bellOpen, () => setBellOpen(false));
  const userRef = useDismiss(userOpen, () => setUserOpen(false));

  useEffect(() => {
    setCtxOpen(false);
    setBellOpen(false);
    setUserOpen(false);
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
            id: n.id,
            href: n.href,
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
    // La portada de marketing es solo oscura (regla de marca): el marco se
    // fuerza a oscuro ahí y sigue siendo de doble tema en el resto.
    if (pathname === "/") return <PublicShell dark>{children}</PublicShell>;
    if (isPublicPath(pathname)) return <PublicShell>{children}</PublicShell>;
    if (!isKnownRoute(pathname)) return <PublicShell>{children}</PublicShell>;
    return <SignedOut />;
  }

  // Espacio de organizador («solo torneos»): menú recortado, como en la app.
  const tournamentsOnly =
    role === "club" && (clubs.find((c) => c.id === clubId)?.tournamentsOnly ?? false);
  const { home, groups } = topNav(role, { tournamentsOnly });
  const pillActiveHref = activeHref(
    pathname,
    groups.flatMap((g) => [g.href, ...(g.items?.map((i) => i.href) ?? [])]),
  );
  const tabs = tournamentsOnly ? TABS_TOURNAMENTS_ONLY : TABS_BY_ROLE[role];
  const tabsActiveHref = activeHref(pathname, tabs.map((t) => t.href));
  const unread = notices.filter((n) => n.unread).length;
  const activeClub = clubs.find((c) => c.id === clubId) ?? null;
  const atHome = matchesHref(pathname, home.href);

  // Qué contexto se enseña en la píldora: el club manda cuando se usa como
  // club; si no, el equipo, que es sobre lo que actúan las pantallas.
  const ctxLabel =
    role === "club"
      ? (activeClub?.name ?? "Sin club")
      : (activeTeam?.name ?? "Sin equipo");
  const ctxLogo = role === "club" ? activeClub?.logoUrl : activeTeam?.logoUrl;
  const showCtx = clubs.length > 0 || hasTeamSwitcher(role);

  function toggleBell() {
    setBellOpen((v) => !v);
  }

  function marcarTodasLeidas() {
    setNotices((ns) => ns.map((n) => ({ ...n, unread: false })));
    if (WRITES_ENABLED) markNotificationsRead().catch(() => {});
  }

  // Se quita de la lista antes de que conteste el servidor: si fallara, el
  // aviso vuelve al recargar, que es mejor que una campana que no responde.
  function borrarAviso(id: string) {
    setNotices((ns) => ns.filter((n) => n.id !== id));
    if (WRITES_ENABLED) deleteNotification(id).catch(() => {});
  }

  function borrarTodos() {
    setNotices([]);
    setBellOpen(false);
    if (WRITES_ENABLED) deleteAllNotifications().catch(() => {});
  }

  return (
    // El panel no llega al borde: `tw-shell` es el lienzo de fuera y
    // `tw-frame` el marco redondeado que lo contiene todo.
    <div className="tw-shell">
      <div className="tw-frame">
        {/* ══ Navegación superior ═══════════════════════════════════ */}
        <header className="tw-topnav">
          <Link href={home.href} className="tw-brand" aria-label="TACTIUM">
            <span className="tw-brand-full">
              <Wordmark size={15} />
            </span>
            <span className="tw-brand-mini">
              <LogoMark size={20} color="var(--accent)" />
            </span>
          </Link>

          {/* Botón de inicio: siempre a la vista, vuelve a la portada del rol. */}
          <Link
            href={home.href}
            className={"tw-homebtn" + (atHome ? " is-active" : "")}
            aria-label={`Ir a ${home.label}`}
            aria-current={atHome ? "page" : undefined}
            title={home.label}
          >
            <IconHome size={17} />
          </Link>

          <nav className="tw-pills" aria-label="Navegación principal">
            {groups.map((g) => {
              const hrefs = [g.href, ...(g.items?.map((i) => i.href) ?? [])];
              // Sólo la píldora MÁS específica se enciende: `/club/equipos`
              // empieza por `/club`, así que con un `some` se marcaban las dos.
              const active = pillActiveHref !== null && hrefs.includes(pillActiveHref);
              return <NavPill key={g.href} group={g} active={active} pathname={pathname} />;
            })}
          </nav>

          <div className="tw-topnav-right">
            {/* Contexto: club y equipo activos. */}
            {showCtx && (
              <div ref={ctxRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setCtxOpen((v) => !v)}
                  aria-expanded={ctxOpen}
                  className="tw-ctx"
                  title="Club y equipo activos"
                >
                  <span className={"tw-ctx-icon" + (ctxLogo ? " has-img" : "")}>
                    {ctxLogo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={ctxLogo} alt="" />
                    ) : role === "club" ? (
                      <IconBuilding size={14} />
                    ) : (
                      <IconShield size={14} />
                    )}
                  </span>
                  <span className="tw-ctx-name truncate">{ctxLabel}</span>
                  <IconChevronDown size={14} style={{ flex: "none", opacity: 0.7 }} />
                </button>

                {ctxOpen && (
                  <div
                    className="tw-popover"
                    style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 250, padding: 6 }}
                  >
                    {clubs.length > 0 && (
                      <>
                        <span className="tw-pop-label">Club</span>
                        {clubs.map((c) => {
                          const on = c.id === clubId;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setActiveClub(c.id);
                                setCtxOpen(false);
                              }}
                              className="tw-popitem"
                              style={{
                                color: on ? "var(--accent)" : undefined,
                                background: on ? "var(--accent-10)" : undefined,
                                fontWeight: on ? 700 : 500,
                              }}
                            >
                              <IconBuilding size={14} />
                              <span className="truncate" style={{ flex: 1, textAlign: "left" }}>
                                {c.name}
                              </span>
                              {on && <IconCheck size={14} />}
                            </button>
                          );
                        })}
                      </>
                    )}

                    {hasTeamSwitcher(role) && (
                      <>
                        {clubs.length > 0 && <div className="tw-pop-sep" />}
                        <span className="tw-pop-label">Equipo</span>
                        {teams.map((t) => {
                          const on = t.id === activeTeam?.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setActiveTeam(t.id);
                                setCtxOpen(false);
                              }}
                              className="tw-popitem"
                              style={{
                                color: on ? "var(--accent)" : undefined,
                                background: on ? "var(--accent-10)" : undefined,
                                fontWeight: on ? 700 : 500,
                              }}
                            >
                              <IconShield size={14} />
                              <span className="truncate" style={{ flex: 1, textAlign: "left" }}>
                                {t.name}
                              </span>
                              {on && <IconCheck size={14} />}
                            </button>
                          );
                        })}
                        {teams.length === 0 && (
                          <span
                            style={{ padding: "8px 10px", fontSize: 12.5, color: "var(--text-faint)" }}
                          >
                            Sin equipos
                          </span>
                        )}
                        <Link
                          href="/empezar"
                          className="tw-popitem"
                          style={{ color: "var(--accent)", fontWeight: 600 }}
                        >
                          <IconPlus size={14} />
                          <span style={{ flex: 1, textAlign: "left" }}>Crear equipo</span>
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <Link href="/comunidad" className="tw-iconbtn" aria-label="Buscar">
              <IconSearch size={17} />
            </Link>

            <div ref={bellRef} style={{ position: "relative", display: "flex" }}>
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

              {bellOpen && (
                <div className="tw-popover tw-bell">
                  <div className="tw-bell-head">
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Avisos</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {unread > 0 ? (
                        <button
                          type="button"
                          onClick={marcarTodasLeidas}
                          className="tw-bell-clear"
                          title="Marcar todas como leídas"
                        >
                          <IconCheck size={13} />
                          Leídas
                        </button>
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--text-faint)" }}>
                          Al día
                        </span>
                      )}
                      {notices.length > 0 && (
                        <button
                          type="button"
                          onClick={borrarTodos}
                          className="tw-bell-clear is-danger"
                          title="Borrar todos los avisos"
                          aria-label="Borrar todos los avisos"
                        >
                          <IconTrash size={13} />
                          Vaciar
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="tw-bell-list">
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
                        key={n.id}
                        className={"tw-bell-row" + (n.href ? " is-link" : "")}
                        style={{
                          borderBottom:
                            i === notices.length - 1 ? "none" : "1px solid var(--line)",
                        }}
                      >
                        {/* Cuerpo pinchable cuando el aviso lleva a algún
                            sitio; si no, texto suelto. El botón de borrar va
                            FUERA: un `button` dentro de un `Link` no es HTML
                            válido. */}
                        {cuerpoDe(
                          n,
                          <>
                        <span
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 999,
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
                          </>,
                          () => setBellOpen(false)
                        )}
                        <button
                          type="button"
                          className="tw-bell-del"
                          onClick={(e) => {
                            e.stopPropagation();
                            borrarAviso(n.id);
                          }}
                          aria-label="Borrar este aviso"
                          title="Borrar"
                        >
                          <IconX size={14} />
                        </button>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}
            </div>

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

            {/* Cuenta: rol, ajustes y salir. */}
            <div ref={userRef} style={{ position: "relative", display: "flex" }}>
              <button
                type="button"
                onClick={() => setUserOpen((v) => !v)}
                aria-expanded={userOpen}
                className="tw-avatarbtn"
                title={user.name}
                aria-label="Tu cuenta"
              >
                <Avatar initials={user.initials} src={user.avatarUrl} size={34} />
              </button>

              {userOpen && (
                <div
                  className="tw-popover"
                  style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, width: 230, padding: 6 }}
                  role="menu"
                >
                  <div style={{ padding: "8px 10px 10px" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700 }}>{user.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                      {ROLE_LABELS[role]}
                    </div>
                  </div>
                  {availableRoles.length > 1 && (
                    <>
                      <div className="tw-pop-sep" />
                      <span className="tw-pop-label">Usar TACTIUM como</span>
                      {availableRoles.map((r) => {
                        const on = r === role;
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => {
                              setRole(r);
                              setUserOpen(false);
                            }}
                            className="tw-popitem"
                            style={{
                              color: on ? "var(--accent)" : undefined,
                              background: on ? "var(--accent-10)" : undefined,
                              fontWeight: on ? 700 : 500,
                            }}
                          >
                            <span style={{ flex: 1, textAlign: "left" }}>{ROLE_LABELS[r]}</span>
                            {on && <IconCheck size={14} />}
                          </button>
                        );
                      })}
                    </>
                  )}
                  <div className="tw-pop-sep" />
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
            </div>
          </div>
        </header>

        {/* ══ Contenido ═════════════════════════════════════════════ */}
        <main className="tw-main">
          <div className="tw-content">{children}</div>
        </main>
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
