/**
 * Datos fijos del sitio: dominio canónico y fichas en las tiendas.
 *
 * `SITE_URL` es el apex: desde la fusión con la landing, tactium.io es la
 * única web (portada, explorar y app). `app.tactium.io` redirige aquí.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://tactium.io";

export const APP_STORE_URL = "https://apps.apple.com/app/tactium/id6769825905";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=io.tactium.app";

export const CONTACT_EMAIL = "hola@tactium.io";

/**
 * Origen al que Supabase debe devolver tras OAuth o un email de recuperación,
 * visto desde el NAVEGADOR. En local se respeta el origen; en cualquier otro
 * sitio (previews …vercel.app, dominios secundarios) se fuerza el canónico,
 * que es el que está en la allowlist de Supabase.
 */
export function canonicalOrigin(): string {
  if (typeof window === "undefined") return SITE_URL;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return window.location.origin;
  return SITE_URL;
}

export const SITE_TITLE = "TACTIUM · Alineaciones inteligentes para tu equipo de pádel";
export const SITE_DESCRIPTION =
  "El sistema operativo del pádel federado. Alineaciones con orden de fuerza, hasta 5 variantes por jornada, torneos y la competición federada al día. Para capitanes, clubs y jugadores.";
