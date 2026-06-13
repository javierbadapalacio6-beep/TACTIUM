// API keys públicas de RevenueCat. Pueden vivir en el bundle del cliente
// — RevenueCat las diseñó para eso (toda la sensibilidad del flujo de
// IAP queda en el StoreKit del device + el server-side webhook con
// `secret_...` que NUNCA va al cliente).
//
// Estas keys identifican qué app de RC consume el SDK. Si las rotas en
// el dashboard, hay que pushear update (OTA o nuevo build) con las
// nuevas. Se rota cuando se detecta abuso; en condiciones normales son
// permanentes.

export const REVENUECAT_IOS_API_KEY = 'appl_HgGvdsLGLkZLREwiZllDmuZmHFE';

// Cuando la app Android esté lista, generar la key en RC dashboard
// (Project settings → API keys → Public app-specific API key for
// Android, formato `goog_...`) y pegarla aquí. El init del SDK ya
// detecta plataforma y elige la correcta.
export const REVENUECAT_ANDROID_API_KEY = 'goog_cKsinXjSnlhnzPSJDNEdoOXeBul';
