/**
 * Datos de ejemplo del área de Cuenta.
 *
 * Vienen literalmente del diseño `Cuenta TACTIUM.dc.html` (Claude Design).
 * Cuando se conecte Supabase, cada constante se sustituye por su consulta;
 * los tipos de abajo son el contrato que deben cumplir esas consultas.
 */

// ── Ajustes · secciones ────────────────────────────────────────────
export const SETTINGS_SECTIONS = [
  { slug: "apariencia", label: "APARIENCIA" },
  { slug: "notificaciones", label: "NOTIFICACIONES" },
  { slug: "jugador", label: "MI JUGADOR" },
  { slug: "equipo", label: "EQUIPO ACTUAL" },
  { slug: "invitaciones", label: "INVITACIONES" },
  { slug: "suscripcion", label: "SUSCRIPCIÓN" },
  { slug: "torneos", label: "TORNEOS" },
  { slug: "soporte", label: "SOPORTE" },
  { slug: "datos", label: "MIS DATOS" },
  { slug: "peligro", label: "ZONA DE PELIGRO" },
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
  { name: "Marco Bilbao", meta: "REVÉS · 4180 PTS" },
  { name: "Iván Sáez", meta: "AMBOS · 3950 PTS" },
  { name: "Nacho Vega", meta: "REVÉS · 3480 PTS" },
  { name: "Hugo Palacio", meta: "AMBOS · 2610 PTS" },
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

// ── Mis datos (RGPD) ───────────────────────────────────────────────
export interface DataRow {
  label: string;
  value: string;
  /** Se pinta en mono con tabular-nums (ids, fechas, contadores). */
  mono: boolean;
}

export const ACCOUNT_EMAIL = "diego@halcones.es";

export const DATA_ROWS: DataRow[] = [
  { label: "Nombre", value: "Diego Ruiz", mono: false },
  { label: "Email", value: ACCOUNT_EMAIL, mono: false },
  { label: "ID interno", value: "usr_9F3K2M8QX1", mono: true },
  { label: "Registro", value: "12/03/2024", mono: true },
  { label: "Equipos que diriges", value: "1", mono: true },
  { label: "Equipos a los que perteneces", value: "2", mono: true },
  { label: "Clubes que diriges", value: "0", mono: true },
  { label: "Clubes a los que perteneces", value: "1", mono: true },
  { label: "Jugadores vinculados a ti", value: "1", mono: true },
  { label: "Invitaciones creadas", value: "6", mono: true },
  { label: "Suscripciones", value: "1 activa · Stripe", mono: false },
];

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
      return "STRIPE · WEB";
    case "app_store":
      return "APP STORE";
    case "play_store":
      return "GOOGLE PLAY";
    default:
      return "SIN ORIGEN";
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
