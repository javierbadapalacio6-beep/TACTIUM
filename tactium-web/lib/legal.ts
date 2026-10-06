/**
 * Datos del titular de TACTIUM para los textos legales (aviso legal, privacidad,
 * términos y cookies). ÚNICO sitio donde viven.
 *
 * TACTIUM lo presta una persona física (autónomo), no una sociedad: por eso es
 * «Titular» y no «Razón social». La LSSI (art. 10) obliga a publicar nombre,
 * NIF y domicilio.
 */
export const LEGAL_ENTITY = {
  /** Nombre y apellidos del titular. */
  name: "Javier Bada Palacio",
  nif: "72177857Q",
  address: "Calle Emilio Maza Cifrián, n.º 6, 1.º D, 39710 Solares (Cantabria)",
  email: "hola@tactium.io",
  site: "tactium.io",
} as const;

/** ¿Quedan marcadores por rellenar? Útil para un aviso o un test. */
export const LEGAL_ENTITY_PENDING = Object.values(LEGAL_ENTITY).some((v) => v.includes("["));

/** Fecha de la versión vigente de los textos legales. */
export const LEGAL_UPDATED = "6 de octubre de 2026";
