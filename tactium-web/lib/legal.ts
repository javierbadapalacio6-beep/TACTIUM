/**
 * Datos del titular de TACTIUM para los textos legales (aviso legal, privacidad,
 * términos y cookies). ÚNICO sitio donde viven.
 *
 * ⚠ PENDIENTE DE RELLENAR ANTES DE DESPLEGAR: los marcadores entre corchetes
 * se ven tal cual en la web a propósito, para que no pase desapercibido. La
 * LSSI (art. 10) obliga a publicar nombre o razón social, NIF y domicilio.
 */
export const LEGAL_ENTITY = {
  /** Nombre y apellidos del titular (autónomo) o razón social de la sociedad. */
  name: "[RAZÓN SOCIAL]",
  nif: "[NIF]",
  address: "[DOMICILIO]",
  email: "hola@tactium.io",
  site: "tactium.io",
} as const;

/** ¿Quedan marcadores por rellenar? Útil para un aviso o un test. */
export const LEGAL_ENTITY_PENDING = Object.values(LEGAL_ENTITY).some((v) => v.startsWith("["));

/** Fecha de la versión vigente de los textos legales. */
export const LEGAL_UPDATED = "6 de octubre de 2026";
