/**
 * Contenido de la próxima newsletter.
 * ─────────────────────────────────────────────────────────────────────────
 * EDITA ESTE ARCHIVO y luego ejecuta:
 *   npm run newsletter:preview     → genera scripts/newsletter-preview.html
 *   npm run newsletter:test        → te lo envía a ti (TEST_TO abajo)
 *   npm run newsletter:dry-run     → lista destinatarios sin enviar
 *   npm run newsletter:send        → envía a toda la lista
 *
 * - `paragraphs`: cada string es un párrafo. Escribe en tono cercano.
 * - `ctaLabel` + `ctaUrl`: opcionales. Si los dejas vacíos, no sale botón.
 * - `campaignId`: cámbialo en cada envío (sirve para el log anti-duplicados).
 */

export const newsletter = {
  // ID único de esta campaña (cambia en cada nueva newsletter).
  campaignId: "2026-06-update",

  // Email de prueba para `newsletter:test`.
  testTo: "javierbadapalacio6@gmail.com",

  subject: "Novedades de TACTIUM",
  preview: "Lo último que hemos mejorado en la app.",
  heading: "Novedades de este mes",
  paragraphs: [
    "Hola, soy Javier. Te escribo con un resumen rápido de lo nuevo en TACTIUM.",
    "Hemos añadido notificaciones push: tus jugadores reciben un aviso al instante cuando publicas la alineación o se crea una nueva jornada.",
    "Si todavía no la has probado, tienes 14 días gratis. Y si ya la usas, cuéntame qué te gustaría ver: respondo a todos los correos.",
  ],
  ctaLabel: "Abrir TACTIUM en la App Store",
  ctaUrl: "https://apps.apple.com/es/app/tactium/id6769825905",
};
