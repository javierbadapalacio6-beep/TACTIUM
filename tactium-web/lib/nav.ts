import type { Role } from "./session";

/**
 * Navegación por rol y metadatos de ruta.
 *
 * Los destinos salen de `Marco TACTIUM.dc.html` (Tanda 1). El icono se
 * referencia por nombre y lo resuelve `components/Icon.tsx`, para que este
 * módulo no arrastre JSX y pueda importarse desde el servidor.
 */
export type IconName =
  | "home"
  | "calendar"
  | "users"
  | "trophy"
  | "flag"
  | "chart"
  | "globe"
  | "shield"
  | "building"
  | "clock"
  | "receipt"
  | "userPlus";

export interface NavEntry {
  href: string;
  label: string;
  icon: IconName;
}

export const NAV_BY_ROLE: Record<Role, NavEntry[]> = {
  capitan: [
    { href: "/", label: "Inicio", icon: "home" },
    { href: "/temporadas", label: "Temporadas", icon: "calendar" },
    { href: "/equipo", label: "Equipo", icon: "users" },
    { href: "/torneos", label: "Torneos", icon: "trophy" },
    { href: "/torneos/mios", label: "Mis torneos", icon: "trophy" },
    { href: "/federacion", label: "Federación", icon: "flag" },
    { href: "/stats", label: "Stats", icon: "chart" },
    { href: "/comunidad", label: "Comunidad", icon: "globe" },
  ],
  club: [
    { href: "/club", label: "Club", icon: "building" },
    { href: "/club/equipos", label: "Equipos", icon: "shield" },
    { href: "/club/torneos", label: "Torneos", icon: "trophy" },
    { href: "/club/horarios", label: "Horarios", icon: "clock" },
    { href: "/federacion", label: "Federación", icon: "flag" },
    { href: "/club/facturacion", label: "Facturación", icon: "receipt" },
    { href: "/comunidad", label: "Comunidad", icon: "globe" },
  ],
  jugador: [
    { href: "/", label: "Inicio", icon: "home" },
    { href: "/equipo", label: "Equipo", icon: "users" },
    { href: "/stats", label: "Stats", icon: "chart" },
    { href: "/torneos", label: "Torneos", icon: "trophy" },
    { href: "/torneos/mios", label: "Mis torneos", icon: "trophy" },
    { href: "/federacion", label: "Federación", icon: "flag" },
    { href: "/comunidad", label: "Comunidad", icon: "globe" },
  ],
  suelto: [
    { href: "/", label: "Mi pádel", icon: "home" },
    { href: "/amistosos", label: "Amistosos", icon: "userPlus" },
    { href: "/stats", label: "Stats", icon: "chart" },
    { href: "/torneos", label: "Torneos", icon: "trophy" },
    { href: "/torneos/mios", label: "Mis torneos", icon: "trophy" },
    { href: "/comunidad", label: "Comunidad", icon: "globe" },
  ],
};

/**
 * Navegación del marco PÚBLICO (visitante sin sesión).
 *
 * Sólo destinos que la base de datos sirve sin sesión: torneos, comunidad y
 * perfiles por RPC `SECURITY DEFINER`; federación por política de lectura
 * pública sobre las tablas `fcp_*`.
 */
export const PUBLIC_NAV: NavEntry[] = [
  { href: "/torneos", label: "Torneos", icon: "trophy" },
  { href: "/federacion", label: "Federación", icon: "flag" },
  { href: "/comunidad", label: "Comunidad", icon: "globe" },
  { href: "/pro", label: "Planes", icon: "receipt" },
];

/** Prefijos de ruta que funcionan sin sesión. */
export const PUBLIC_ROUTES = [
  "/torneos",
  "/federacion",
  "/comunidad",
  "/u/",
  "/pro",
];

/**
 * ¿Esta ruta se puede ver sin sesión?
 *
 * La portada va aparte y con igualdad exacta: `"/"` es prefijo de TODO, así
 * que meterla en la lista de arriba abriría la aplicación entera.
 */
export function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_ROUTES.some((r) => pathname.startsWith(r));
}

/** Prefijos de TODAS las rutas reales (públicas + de app + entrada). Sirve para
 *  distinguir una ruta protegida de una que NO existe: la desconocida es un 404,
 *  no un "necesitas sesión". Mantener alineado con las carpetas de `app/`. */
const KNOWN_ROUTE_PREFIXES = [
  "/torneos",
  "/federacion",
  "/comunidad",
  "/u/",
  "/pro",
  "/entrar",
  "/empezar",
  "/bienvenida",
  "/auth",
  "/ajustes",
  "/amistosos",
  "/club",
  "/equipo",
  "/jornada",
  "/novedades",
  "/stats",
  "/suscripcion",
  "/temporadas",
];

export function isKnownRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return KNOWN_ROUTE_PREFIXES.some(
    (r) => pathname === r || pathname.startsWith(r + "/") || pathname.startsWith(r),
  );
}

/** El jugador suelto no pertenece a ninguna plantilla: sin selector. */
export function hasTeamSwitcher(role: Role): boolean {
  return role !== "suelto";
}

/** Tab bar de móvil, máximo 5 destinos. */
export const TABS_BY_ROLE: Record<Role, NavEntry[]> = {
  capitan: [
    { href: "/", label: "Inicio", icon: "home" },
    { href: "/temporadas", label: "Temporadas", icon: "calendar" },
    { href: "/equipo", label: "Equipo", icon: "users" },
    { href: "/stats", label: "Stats", icon: "chart" },
    { href: "/ajustes", label: "Perfil", icon: "userPlus" },
  ],
  club: [
    { href: "/club", label: "Club", icon: "building" },
    { href: "/club/equipos", label: "Equipos", icon: "shield" },
    { href: "/club/torneos", label: "Torneos", icon: "trophy" },
    { href: "/club/horarios", label: "Horarios", icon: "clock" },
    { href: "/ajustes", label: "Perfil", icon: "userPlus" },
  ],
  jugador: [
    { href: "/", label: "Inicio", icon: "home" },
    { href: "/equipo", label: "Equipo", icon: "users" },
    { href: "/stats", label: "Stats", icon: "chart" },
    { href: "/torneos", label: "Torneos", icon: "trophy" },
    { href: "/ajustes", label: "Perfil", icon: "userPlus" },
  ],
  suelto: [
    { href: "/", label: "Mi pádel", icon: "home" },
    { href: "/amistosos", label: "Amistosos", icon: "userPlus" },
    { href: "/stats", label: "Stats", icon: "chart" },
    { href: "/torneos", label: "Torneos", icon: "trophy" },
    { href: "/ajustes", label: "Perfil", icon: "userPlus" },
  ],
};

/**
 * Eyebrow + título de la barra superior por ruta. Se resuelve por el prefijo
 * más largo que case, así `/torneos/abc` hereda el de `/torneos`.
 */
const ROUTE_META: { prefix: string; eyebrow: string; title: string }[] = [
  { prefix: "/ajustes", eyebrow: "CUENTA · AJUSTES", title: "Ajustes" },
  { prefix: "/suscripcion", eyebrow: "CUENTA · SUSCRIPCIÓN", title: "Mi suscripción" },
  { prefix: "/pro", eyebrow: "TACTIUM PRO", title: "Planes" },
  { prefix: "/club/facturacion", eyebrow: "CLUB · FACTURACIÓN", title: "Facturación" },
  { prefix: "/club/horarios", eyebrow: "CLUB · HORARIOS", title: "Horarios de local" },
  { prefix: "/club/equipos", eyebrow: "CLUB · EQUIPOS", title: "Equipos" },
  { prefix: "/club/torneos", eyebrow: "CLUB · TORNEOS", title: "Torneos" },
  { prefix: "/club", eyebrow: "CLUB · ADMIN", title: "Club" },
  { prefix: "/temporadas", eyebrow: "TEMPORADA", title: "Temporadas" },
  { prefix: "/jornada", eyebrow: "JORNADA", title: "Jornada" },
  { prefix: "/equipo", eyebrow: "EQUIPO", title: "Plantilla" },
  { prefix: "/torneos/mios", eyebrow: "TORNEOS", title: "Mis torneos" },
  { prefix: "/torneos", eyebrow: "TORNEOS", title: "Torneos" },
  { prefix: "/federacion", eyebrow: "FEDERACIÓN", title: "Federación" },
  { prefix: "/stats", eyebrow: "MIS ESTADÍSTICAS", title: "Stats" },
  { prefix: "/comunidad", eyebrow: "COMUNIDAD", title: "Comunidad" },
  { prefix: "/novedades", eyebrow: "COMUNIDAD · NOVEDADES", title: "Novedades" },
  { prefix: "/amistosos", eyebrow: "AMISTOSOS", title: "Amistosos" },
  { prefix: "/u", eyebrow: "PERFIL", title: "Perfil" },
];

export function routeMeta(pathname: string, role: Role) {
  const match = ROUTE_META.filter((m) => pathname.startsWith(m.prefix)).sort(
    (a, b) => b.prefix.length - a.prefix.length
  )[0];
  if (match) return match;
  return {
    eyebrow: role === "suelto" ? "TU PÁDEL" : "INICIO",
    title: role === "suelto" ? "Mi pádel" : "Inicio",
  };
}
