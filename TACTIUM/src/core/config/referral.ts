// Programa capitán-trae-capitán (plan de escalado · ventana sept-oct).
//
// El mensaje de invitación funciona YA sin premio. Cuando Javier cree la
// campaña de Offer Codes en App Store Connect (Suscripciones → códigos de
// oferta → p. ej. 1 mes gratis del plan Capitán), basta con rellenar
// CAPTAIN_OFFER_CODE y el mensaje pasará a incluir el regalo y el enlace
// de canje automáticamente. Cero cambios de código.

export const CAPTAIN_OFFER_CODE = ''; // p. ej. 'CAPITAN1MES' — vacío = sin premio

const APP_STORE_ID = '6769825905';

/** Enlace de canje directo del offer code en App Store. */
export function offerRedeemUrl(code: string): string {
  return `https://apps.apple.com/redeem?ctx=offercodes&id=${APP_STORE_ID}&code=${code}`;
}

/**
 * Mensaje de invitación de capitán a capitán. Pitch corto y concreto:
 * el dolor (Excel + WhatsApp cada jornada) y la solución en una línea.
 */
export function buildCaptainInviteMessage(fromTeam?: string | null): string {
  const lines = [
    `🎾 ¿Capitaneas un equipo de pádel?`,
    ``,
    `Yo llevo ${fromTeam ? `al ${fromTeam}` : 'mi equipo'} con TACTIUM: la alineación de cada jornada lista en 30 segundos (equilibra parejas por puntos y respeta el orden de fuerza), disponibilidad y resultados en un sitio. Se acabó el Excel.`,
    ``,
  ];
  if (CAPTAIN_OFFER_CODE) {
    lines.push(
      `Te regalo 1 MES GRATIS con este código: ${CAPTAIN_OFFER_CODE}`,
      `Canjéalo aquí: ${offerRedeemUrl(CAPTAIN_OFFER_CODE)}`,
    );
  } else {
    lines.push(`Pruébala 14 días gratis: https://tactium.io`);
  }
  return lines.join('\n');
}
