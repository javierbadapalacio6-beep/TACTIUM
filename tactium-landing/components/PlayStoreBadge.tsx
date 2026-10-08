// Badge OFICIAL «Disponible en Google Play» → ficha de TACTIUM en Android.
// Archivo de Google en /public/brand/stores/google-play-es.png (646×250; el badge visible mide
// 646×192 y el resto son 29 px transparentes arriba y abajo, que se recortan con la ventana, no
// tocando el archivo). Normas de Google: no modificarlo ni animarlo; igual o mayor que el resto
// de badges de la fila. Versión vigente: Partner Marketing Hub (requiere solicitar acceso):
// https://partnermarketinghub.withgoogle.com/brands/google-play/google-play/lockups-icons-badges/
//
// RSC pura (sin estado): es solo un enlace externo.

// Bundle id definitivo io.tactium.app → URL estándar de ficha de Play.
// (confirmar con el link que pases de la Play Console)
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=io.tactium.app";

export function PlayStoreBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href={PLAY_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Disponible en Google Play"
      className={`inline-block shrink-0 overflow-hidden h-[54px] aspect-[646/192] ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/stores/google-play-es.png"
        alt="Disponible en Google Play"
        width={646}
        height={250}
        className="block w-full h-auto"
        style={{ marginTop: "calc(54px * -29 / 192)" }}
      />
    </a>
  );
}
