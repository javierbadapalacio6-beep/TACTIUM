import { APP_STORE_URL, PLAY_STORE_URL, SITE_URL } from "@/lib/site";

/**
 * Descarga de la app para los QR de la cartelería de los clubs
 * (`tactium.io/descargar?club=<slug>`).
 *
 * Un solo QR por club en lugar de dos (App Store y Google Play): el servidor
 * mira el sistema del móvil, manda a la tienda que toca y apunta la visita
 * con el club de origen. Así se ve qué club trae descargas. Ver
 * `docs/DESCARGAR.md`.
 */

export type DownloadPlatform = "ios" | "android" | "escritorio";

/**
 * Sistema del dispositivo a partir del User-Agent. Android primero: ningún UA
 * de iOS contiene «android», pero sí al revés en navegadores raros.
 *
 * Un iPad con Safari en «sitio de escritorio» se presenta como Mac y cae en
 * `escritorio`: ve la página con los dos botones y elige. No se adivina con
 * JavaScript para no contar dos visitas.
 */
export function detectPlatform(userAgent: string): DownloadPlatform {
  if (/android/i.test(userAgent)) return "android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "ios";
  return "escritorio";
}

/**
 * Rastreadores y vistas previas de enlaces (WhatsApp, Telegram, Slack…).
 * No son personas: ni se redirigen ni se cuentan. Googlebot-móvil trae
 * «Android» en el UA y, si se le redirigiese, vería la ficha de Play.
 */
const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|telegram|slack|discord|preview|embedly|lighthouse|headless|curl\/|wget\/|python-requests/i;

export function isBot(userAgent: string): boolean {
  return !userAgent || BOT_UA.test(userAgent);
}

/**
 * Slug del club tal como viene en `?club=`. Letras minúsculas, números, `-`
 * y `_`, hasta 40. Cualquier otra cosa se descarta (la visita se cuenta sin
 * club) en vez de guardar texto libre de un enlace que puede escribir cualquiera.
 */
export function cleanClub(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim().toLowerCase();
  return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(s) ? s : null;
}

/** Tienda que corresponde a cada sistema móvil. */
export function storeUrl(platform: Exclude<DownloadPlatform, "escritorio">): string {
  return platform === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
}

/** URL completa que va dentro del QR de un club (sin club: la genérica). */
export function downloadUrl(club?: string | null): string {
  const slug = cleanClub(club);
  return slug ? `${SITE_URL}/descargar?club=${slug}` : `${SITE_URL}/descargar`;
}
