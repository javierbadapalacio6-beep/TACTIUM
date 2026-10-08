import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/site";

/**
 * Los dos badges OFICIALES de tienda, juntos y en este orden: Apple primero, Google igual o mayor.
 *
 * Normas de Apple y Google que se cumplen aquí (no relajarlas al retocar el estilo):
 *  - Los archivos de /public/brand/stores/ no se modifican, inclinan ni animan (por eso no hay
 *    transición ni efecto hover). Si una de las dos publica una versión nueva, se sustituye el archivo.
 *  - Badge negro de Apple, uno solo, el primero; el de Google igual o mayor.
 *  - Separación ≥ 1/4 del alto y alto ≥ 40 px (Apple) / 28 px (Google).
 *  - Nunca se dibuja una réplica ni se traduce «App Store».
 * El PNG de Google trae 29 px transparentes arriba y abajo (646×250, badge visible 646×192): se
 * recortan con CSS (`.mk-store--google`), no tocando el archivo.
 */
export function StoreBadges() {
  return (
    <div className="mk-stores">
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mk-store mk-store--apple"
        aria-label="Consíguelo en el App Store"
      >
        <img src="/brand/stores/app-store-es.svg" alt="Consíguelo en el App Store" width={120} height={40} />
      </a>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mk-store mk-store--google"
        aria-label="Disponible en Google Play"
      >
        <img src="/brand/stores/google-play-es.png" alt="Disponible en Google Play" width={646} height={250} />
      </a>
    </div>
  );
}
