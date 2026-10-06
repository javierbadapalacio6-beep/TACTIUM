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
  IconMoon,
  IconPlus,
  IconSearch,
  IconShield,
  IconSun,
  IconTrash,
} from "./Icon";
import { LogoMark } from "./LogoMark";
import { LogoSpinner } from "./TactiumLogo3D";
import { PublicShell } from "./PublicShell";
import { Wordmark } from "./Wordmark";
import { Avatar } from "./ui";
import { NoticeList, type Notice } from "./notifications/NoticeList";
import { NOTICES_CHANGED, asRead, toNotice } from "./notifications/notices";
import { CreateMenu } from "./nav/CreateMenu";
import {
  hasTeamSwitcher,
  isKnownRoute,
  isPublicPath,
  mainNav,
  sectionOf,
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
  markNotificationRead,
  markNotificationsRead,
} from "@/lib/queries";
import { WRITES_ENABLED } from "@/lib/writes";

/**
 * Shell persistente del panel.
 *
 * La navegación va ARRIBA, en píldoras, dentro de un marco redondeado que
 * flota sobre un lienzo más oscuro. A la izquierda la marca y los cuatro
 * apartados de la navegación única (Inicio · Competir · Equipo · Perfil, los
 * mismos para todos los roles); a la derecha «＋ Crear», el contexto (club y
 * equipo) y los controles. En móvil, la barra inferior con «＋» en el centro.
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

/* ── Avisos (campanita) ── datos reales de la tabla `notifications` ────
   La lista (agrupada por día, con botones en línea) vive en
   `components/notifications/NoticeList.tsx`; el paso de fila a aviso, en
   `components/notifications/notices.ts`. */

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
  const [createOpen, setCreateOpen] = useState(false);

  const ctxRef = useDismiss(ctxOpen, () => setCtxOpen(false));
  const bellRef = useDismiss(bellOpen, () => setBellOpen(false));
  const userRef = useDismiss(userOpen, () => setUserOpen(false));

  useEffect(() => {
    setCtxOpen(false);
    setBellOpen(false);
    setUserOpen(false);
    setCreateOpen(false);
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
  // Se recarga al entrar, al volver a la pestaña (`visibilitychange`), cada
  // dos minutos mientras se ve, y cuando `/avisos` cambia algo. La web no
  // usa Realtime en ningún otro sitio: no se abre un canal solo para esto.
  useEffect(() => {
    if (!user) {
      setNotices([]);
      return;
    }
    let alive = true;
    const load = () => {
      fetchNotifications()
        .then((rows) => {
          if (alive) setNotices(rows.map(toNotice));
        })
        .catch(() => {
          /* se queda lo que hubiera */
        });
    };
    load();
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(NOTICES_CHANGED, load);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 120_000);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(NOTICES_CHANGED, load);
      window.clearInterval(timer);
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

  // Navegación única: los mismos cuatro apartados para todos los roles. El
  // organizador («solo torneos») sólo cambia a dónde apunta «Equipo».
  const tournamentsOnly =
    role === "club" && (clubs.find((c) => c.id === clubId)?.tournamentsOnly ?? false);
  const nav = mainNav(role, { tournamentsOnly });
  const home = nav[0];
  // El apartado se enciende en TODAS sus rutas (Competir en /temporadas,
  // /federacion, /torneos…), no sólo en la de su enlace.
  const section = sectionOf(pathname, user.username);
  const unread = notices.filter((n) => n.unread).length;
  const activeClub = clubs.find((c) => c.id === clubId) ?? null;

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
    setNotices((ns) => ns.map(asRead));
    if (WRITES_ENABLED) markNotificationsRead().catch(() => {});
  }

  // Al tocar un aviso se da por leído (como `markOneRead` en la app): el
  // contador baja en el acto aunque el servidor tarde.
  function marcarLeidos(ids: string[]) {
    setNotices((ns) => ns.map((n) => (ids.includes(n.id) ? asRead(n) : n)));
    if (WRITES_ENABLED) for (const id of ids) markNotificationRead(id).catch(() => {});
  }

  // Se quita de la lista antes de que conteste el servidor: si fallara, el
  // aviso vuelve al recargar, que es mejor que una campana que no responde.
  // Una fila agrupada («3 nuevos seguidores») son varios avisos.
  function borrarAvisos(ids: string[]) {
    setNotices((ns) => ns.filter((n) => !ids.includes(n.id)));
    if (WRITES_ENABLED) for (const id of ids) deleteNotification(id).catch(() => {});
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
      <a href="#contenido" className="tw-skip">
        Saltar al contenido
      </a>
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

          <nav className="tw-pills" aria-label="Navegación principal">
            {nav.map((g) => (
              <NavPill key={g.key} group={g} active={section === g.key} pathname={pathname} />
            ))}
          </nav>

          <div className="tw-topnav-right">
            {/* «＋ Crear»: acciones rápidas del rol. En móvil va en la barra
                inferior, centrado. */}
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn btn-accent btn-sm tw-createbtn"
              aria-haspopup="dialog"
            >
              <IconPlus size={15} />
              Crear
            </button>

            {/* Contexto: club y equipo activos. */}
            {showCtx && (
              <div ref={ctxRef} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => setCtxOpen((v) => !v)}
                  aria-expanded={ctxOpen}
                  className="tw-ctx"
                  title="Club y equipo activos"
                  aria-label={`Cambiar de club o equipo. Ahora: ${ctxLabel}`}
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
                  <IconChevronDown
                    size={14}
                    className="tw-ctx-chev"
                    style={{ flex: "none", opacity: 0.7 }}
                  />
                </button>

                {ctxOpen && (
                  <div
                    className="tw-popover tw-ctx-pop"
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

            <Link
              href="/comunidad"
              className="tw-iconbtn"
              aria-label="Buscar jugadores"
              title="Buscar jugadores"
            >
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
                    <NoticeList
                      notices={notices}
                      onNavigate={() => setBellOpen(false)}
                      onDelete={borrarAvisos}
                      onRead={marcarLeidos}
                    />
                  </div>
                  <Link href="/avisos" className="tw-bell-foot">
                    Ver todos
                  </Link>
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
                  <Link href="/perfil" className="tw-popitem">
                    <span style={{ flex: 1, textAlign: "left" }}>Mi perfil</span>
                  </Link>
                  <Link href="/ajustes/preferencias" className="tw-popitem">
                    <span style={{ flex: 1, textAlign: "left" }}>Ajustes</span>
                  </Link>
                  <Link href="/ajustes/cuenta#mis-datos" className="tw-popitem">
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
        <main className="tw-main" id="contenido" tabIndex={-1}>
          <div className="tw-content">{children}</div>
        </main>
      </div>

      {/* ══ Tab bar · móvil ════════════════════════════════════════ */}
      <nav className="tw-tabbar" aria-label="Navegación principal">
        {nav.flatMap((t, i) => {
          const active = section === t.key;
          const Icon = ICONS[t.icon];
          const tab = (
            <Link
              key={t.key}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={"tw-tab" + (active ? " is-active" : "")}
            >
              <Icon size={19} />
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 500 }}>
                {t.label}
              </span>
            </Link>
          );
          // «＋» en el centro: Inicio · Competir · ＋ · Equipo · Perfil.
          if (i !== 2) return [tab];
          return [
            <button
              key="crear"
              type="button"
              onClick={() => setCreateOpen(true)}
              className="tw-tab tw-tab-create"
              aria-label="Crear"
              aria-haspopup="dialog"
            >
              <span className="tw-tab-create-dot">
                <IconPlus size={20} />
              </span>
            </button>,
            tab,
          ];
        })}
      </nav>

      <CreateMenu open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
