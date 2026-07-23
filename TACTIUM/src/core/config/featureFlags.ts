/**
 * Feature flags de la app.
 *
 * Permiten que código nuevo viaje EMBEBIDO en un build nativo pero quede
 * inerte/invisible hasta que decidamos activarlo. Como son constantes JS,
 * el cambio de un flag se publica por OTA (eas update) sin pasar por review.
 *
 * FCP_ENABLED: conector de la Federación Cántabra (importar plantilla).
 *   Apagado de momento: el código está en el binario pero los puntos de
 *   entrada (icono 🏛️ en Equipo y atajo en el onboarding) no se muestran,
 *   hasta que el flujo esté bien estructurado y probado para producción.
 */
export const FCP_ENABLED = false;

/**
 * TOURNAMENTS_ENABLED: módulo de torneos del club (pestaña "Torneos" en la
 * barra del club_admin). Apagado mientras se construye la Fase 1 (KO) para no
 * exponer media feature; se enciende por OTA cuando esté usable.
 */
export const TOURNAMENTS_ENABLED = true;
