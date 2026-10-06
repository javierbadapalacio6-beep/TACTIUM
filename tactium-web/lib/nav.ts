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
  | "userPlus"
  | "sun"
  | "bell"
  | "user"
  | "creditCard"
  | "info"
  | "file"
  | "alert"
  | "settings"
  | "lock"
  | "search"
  | "plus";

export interface NavEntry {
  href: string;
  label: string;
  icon: IconName;
}

/**
 * Navegación única (mejora n.º 11): los MISMOS cuatro apartados para todos
 * los roles —Inicio · Competir · Equipo · Perfil— más el botón «＋ Crear»,
 * igual que la barra de la app. Lo único que cambia por rol es a dónde
 * apunta «Equipo» y qué acciones salen al pulsar «＋ Crear».
 */
export type MainSection = "inicio" | "competir" | "equipo" | "perfil";

export interface MainNavEntry extends NavEntry {
  key: MainSection;
}

export function mainNav(role: Role, opts?: { tournamentsOnly?: boolean }): MainNavEntry[] {
  // El club con gestión de equipos tiene su lista de equipos; el resto
  // (capitán, jugador, suelto y organizador) entra por `/equipo`, que pinta
  // la plantilla o el estado vacío que toque.
  const equipoHref = role === "club" && !opts?.tournamentsOnly ? "/club/equipos" : "/equipo";
  return [
    { key: "inicio", href: "/", label: "Inicio", icon: "home" },
    { key: "competir", href: "/competir", label: "Competir", icon: "trophy" },
    { key: "equipo", href: equipoHref, label: "Equipo", icon: "users" },
    // El perfil SOCIAL (récord, fotos, seguidores), como en la app. Los
    // ajustes cuelgan de él (engranaje) y del menú del avatar.
    { key: "perfil", href: "/perfil", label: "Perfil", icon: "user" },
  ];
}

/** Rutas que cuelgan de cada apartado. Gana el prefijo más largo. */
const SECTION_PREFIXES: { prefix: string; key: MainSection; exact?: boolean }[] = [
  { prefix: "/", key: "inicio", exact: true },
  { prefix: "/club", key: "inicio", exact: true }, // panel del club
  { prefix: "/novedades", key: "inicio" },
  { prefix: "/comunidad", key: "inicio" },
  { prefix: "/amistosos", key: "inicio" },
  { prefix: "/competir", key: "competir" },
  { prefix: "/temporadas", key: "competir" },
  { prefix: "/jornada", key: "competir" },
  { prefix: "/federacion", key: "competir" },
  { prefix: "/torneos", key: "competir" },
  { prefix: "/club/torneos", key: "competir" },
  { prefix: "/club/horarios", key: "competir" },
  { prefix: "/club/cobros", key: "competir" },
  { prefix: "/equipo", key: "equipo" },
  { prefix: "/club/equipos", key: "equipo" },
  { prefix: "/club/importar", key: "equipo" },
  { prefix: "/perfil", key: "perfil" },
  { prefix: "/ajustes", key: "perfil" },
  { prefix: "/stats", key: "perfil" },
  { prefix: "/suscripcion", key: "perfil" },
  { prefix: "/pro", key: "perfil" },
  { prefix: "/club/facturacion", key: "perfil" },
];

/**
 * ¿Qué apartado del menú se enciende en esta ruta? `null` si ninguno (p. ej.
 * el perfil público de OTRO jugador). Con `username`, el perfil propio cuenta
 * como «Perfil».
 */
export function sectionOf(pathname: string, username?: string | null): MainSection | null {
  if (username && pathname === `/u/${username}`) return "perfil";
  let best: { prefix: string; key: MainSection } | null = null;
  for (const r of SECTION_PREFIXES) {
    const hit = r.exact
      ? pathname === r.prefix
      : pathname === r.prefix || pathname.startsWith(r.prefix + "/");
    if (hit && (!best || r.prefix.length > best.prefix.length)) best = r;
  }
  return best?.key ?? null;
}

/**
 * Navegación del marco PÚBLICO (visitante sin sesión).
 *
 * Sólo destinos que la base de datos sirve sin sesión: torneos, comunidad y
 * perfiles por RPC `SECURITY DEFINER`; federación por política de lectura
 * pública sobre las tablas `fcp_*`.
 */
export const PUBLIC_NAV: NavEntry[] = [
  { href: "/torneos", label: "Torneos", icon: "trophy" },
  { href: "/torneos/organizar", label: "Organizar torneo", icon: "plus" },
  { href: "/federacion", label: "Federación", icon: "flag" },
  { href: "/comunidad", label: "Comunidad", icon: "globe" },
  { href: "/pro", label: "Planes", icon: "receipt" },
];

/**
 * Alta de cuenta. Sin sesión, todos los «Crear cuenta» van aquí: `/entrar`
 * abierto en Crear cuenta y, tras el alta, al onboarding (`/empezar`). Antes
 * mandaban a `/empezar` sin cuenta y dejaban rellenar el equipo antes de
 * pedirla.
 */
export function signupHref(next = "/empezar"): string {
  return `/entrar?modo=alta&next=${encodeURIComponent(next)}`;
}

export const SIGNUP_HREF = signupHref();

/**
 * Enlace al paywall con el motivo (el gate que lo abre) y la familia de
 * planes. Los motivos son los de la app: `matchday_close`, `lineup_edit`,
 * `calendar_scan`, `availability_remind`, `roster_import`, `fcp_group`,
 * `trial_expiring` y, solo web de momento, `club_import`.
 */
export function proHref(motivo?: string, para?: "club" | "capitan"): string {
  const q = new URLSearchParams();
  if (motivo) q.set("motivo", motivo);
  if (para) q.set("para", para);
  const s = q.toString();
  return s ? `/pro?${s}` : "/pro";
}

/** Prefijos de ruta que funcionan sin sesión. */
export const PUBLIC_ROUTES = [
  "/torneos",
  "/federacion",
  "/comunidad",
  "/u/",
  "/pro",
  "/legal",
  // Enlaces de invitación (tactium.io/i/CÓDIGO). Con barra: "/i" a secas
  // sería prefijo de cualquier ruta futura que empiece por «i».
  "/i/",
  // Detalle público de una jornada de liga (RPC public_get_matchday, anon).
  "/partido/",
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
  "/legal",
  "/i/",
  "/partido/",
  "/entrar",
  "/empezar",
  "/auth",
  "/ajustes",
  "/avisos",
  "/perfil",
  "/amistosos",
  "/club",
  "/competir",
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

/** Un destino del nav superior. Con `items`, es un desplegable. */
export interface NavGroup extends NavEntry {
  items?: NavEntry[];
}
