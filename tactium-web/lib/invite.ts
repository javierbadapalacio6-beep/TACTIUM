/**
 * Invitar con enlace: textos y utilidades compartidas por la web.
 *
 * El enlace `https://tactium.io/i/{CODE}` abre la app si está instalada
 * (enlaces universales: `public/.well-known/*`) y, si no, la página pública
 * `app/i/[code]` con la vista previa del equipo. El MENSAJE es el mismo que en
 * la app (especificación compartida): no cambiar uno sin el otro.
 */

export const INVITE_BASE_URL = "https://tactium.io/i/";
export const INVITE_APP_STORE_URL = "https://apps.apple.com/app/id6769825905";
export const INVITE_PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=io.tactium.app";

/** Normaliza lo que escribe la gente: sin espacios y en mayúsculas. */
export function normalizeInviteCode(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

export function inviteUrl(code: string): string {
  return INVITE_BASE_URL + encodeURIComponent(normalizeInviteCode(code));
}

/** Enlace profundo a la app (si está instalada). */
export function inviteDeepLink(code: string): string {
  return "tactium://i/" + encodeURIComponent(normalizeInviteCode(code));
}

/**
 * Mensaje EXACTO de la especificación (idéntico en la app). Sin nombre de
 * equipo, «Nuestro equipo»; en la invitación de capitán solo cambia la línea
 * de llamada.
 */
export function inviteMessage(
  teamName: string | null | undefined,
  code: string,
  role: "player" | "captain" = "player",
): string {
  const c = normalizeInviteCode(code);
  const name = teamName?.trim() || "Nuestro equipo";
  const cta = role === "captain" ? "Únete como capitán aquí:" : "Únete a la plantilla aquí:";
  return (
    `🎾 ${name} ya está en TACTIUM: jornadas, alineaciones y resultados en un sitio.\n\n` +
    `${cta}\n${INVITE_BASE_URL}${c}\n\n` +
    `(o en la app con el código ${c})`
  );
}

export function whatsappShareUrl(text: string): string {
  return "https://wa.me/?text=" + encodeURIComponent(text);
}

/** ¿El navegador tiene hoja de compartir nativa? (solo en cliente). */
export function canNativeShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

/**
 * Comparte la invitación: hoja nativa si existe; si no, WhatsApp en otra
 * pestaña. Cancelar la hoja nativa no es un error.
 */
export async function shareInvite(
  teamName: string | null | undefined,
  code: string,
  role: "player" | "captain" = "player",
): Promise<void> {
  const text = inviteMessage(teamName, code, role);
  if (canNativeShare()) {
    try {
      await navigator.share({ text });
      return;
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      // Otro fallo (permiso, contexto): se cae a WhatsApp.
    }
  }
  window.open(whatsappShareUrl(text), "_blank", "noopener,noreferrer");
}

/**
 * Copia al portapapeles. Si el navegador no deja (sin HTTPS, permiso), se
 * selecciona el texto del elemento indicado para que se copie a mano y se
 * devuelve false.
 */
export async function copyText(text: string, fallbackEl?: HTMLElement | null): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    if (fallbackEl) {
      try {
        if (fallbackEl instanceof HTMLInputElement || fallbackEl instanceof HTMLTextAreaElement) {
          fallbackEl.focus();
          fallbackEl.select();
        } else {
          const range = document.createRange();
          range.selectNodeContents(fallbackEl);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      } catch {
        /* nada más que hacer: el texto está a la vista */
      }
    }
    return false;
  }
}
