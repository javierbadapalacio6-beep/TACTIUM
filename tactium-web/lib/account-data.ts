/**
 * Datos de ejemplo del área de Cuenta.
 *
 * Vienen literalmente del diseño `Cuenta TACTIUM.dc.html` (Claude Design).
 * Cuando se conecte Supabase, cada constante se sustituye por su consulta;
 * los tipos de abajo son el contrato que deben cumplir esas consultas.
 */

// ── Ajustes · secciones ────────────────────────────────────────────
// El icono se resuelve por nombre en `components/Icon.tsx` (`ICONS`), igual
// que la navegación principal: este módulo no arrastra JSX.
export const SETTINGS_SECTIONS = [
  { slug: "apariencia", label: "Apariencia", icon: "sun" },
  { slug: "notificaciones", label: "Notificaciones", icon: "bell" },
  { slug: "jugador", label: "Mi jugador", icon: "user" },
  { slug: "equipo", label: "Equipo actual", icon: "shield" },
  { slug: "invitaciones", label: "Invitaciones", icon: "userPlus" },
  { slug: "suscripcion", label: "Suscripción", icon: "creditCard" },
  { slug: "torneos", label: "Torneos", icon: "trophy" },
  { slug: "soporte", label: "Soporte", icon: "info" },
  { slug: "datos", label: "Mis datos", icon: "file" },
  { slug: "peligro", label: "Zona de peligro", icon: "alert" },
] as const;

export type SettingsSlug = (typeof SETTINGS_SECTIONS)[number]["slug"];

export const SETTINGS_SLUGS = SETTINGS_SECTIONS.map((s) => s.slug);

export function isSettingsSlug(v: string): v is SettingsSlug {
  return (SETTINGS_SLUGS as readonly string[]).includes(v);
}

// ── Notificaciones ─────────────────────────────────────────────────
export interface NotifPref {
  key: string;
  label: string;
  /** Valor inicial; el usuario lo cambia en la pantalla. */
  on: boolean;
}

export const NOTIF_PREFS: NotifPref[] = [
  { key: "jornada", label: "Jornada publicada", on: true },
  { key: "alineacion", label: "Alineación publicada", on: true },
  { key: "disponibilidad", label: "Recordatorio de disponibilidad", on: false },
  { key: "crear", label: "Recordatorio de crear alineación", on: true },
];

// ── Mi jugador · plantilla sin dueño ───────────────────────────────
export interface FreePlayer {
  name: string;
  meta: string;
}

export const FREE_PLAYERS: FreePlayer[] = [
  { name: "Marco Bilbao", meta: "Revés · 4180 pts" },
  { name: "Iván Sáez", meta: "Ambos · 3950 pts" },
  { name: "Nacho Vega", meta: "Revés · 3480 pts" },
  { name: "Hugo Palacio", meta: "Ambos · 2610 pts" },
];

/** Iniciales para el avatar de respaldo. */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Los datos de "Mis datos" (RGPD) salen ahora de la sesión REAL del usuario
// (ver components/settings/MisDatos.tsx). Se eliminó la maqueta ACCOUNT_EMAIL /
// DATA_ROWS que mostraba una cuenta demo (diego@halcones.es) a cualquiera.

// ── Facturación del club ───────────────────────────────────────────
export interface ClubTeam {
  name: string;
  meta: string;
  /** Dentro del límite del plan contratado. */
  covered: boolean;
}





// ── Suscripción · origen de compra ─────────────────────────────────
/**
 * De dónde viene la suscripción. Es la distinción que evita cobros
 * duplicados: la web sólo puede vender y gestionar cuando el origen es
 * Stripe. Si la compra vive en una tienda móvil, aquí es SOLO LECTURA.
 */
export type SubscriptionSource = "none" | "stripe" | "app_store" | "play_store";

export interface Subscription {
  source: SubscriptionSource;
  planName: string;
  state: string;
  price: string;
  period: string;
  renewNote: string;
  /** Cambio de plan diferido pendiente de aplicarse (downgrade). */
  scheduledPlan?: { name: string; date: string };
  /** Cancelada pero aún dentro del periodo pagado. */
  willNotRenew?: boolean;
}


/** Etiqueta corta del origen, para el badge de la tarjeta de plan. */
export function sourceLabel(source: SubscriptionSource): string {
  switch (source) {
    case "stripe":
      return "Stripe · web";
    case "app_store":
      return "App Store";
    case "play_store":
      return "Google Play";
    default:
      return "Sin origen";
  }
}

/** Nombre de la tienda para el aviso de solo lectura. */
export function storeName(source: SubscriptionSource): string {
  return source === "play_store" ? "Google Play" : "la App Store";
}

/**
 * Regla de negocio central: la web sólo puede cobrar y gestionar cuando la
 * suscripción es suya. Con una compra de tienda móvil no se muestra ningún
 * botón de contratar, cambiar plan ni cancelar — sólo consulta.
 */
export function isStoreManaged(source: SubscriptionSource): boolean {
  return source === "app_store" || source === "play_store";
}
