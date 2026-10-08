// Badge OFICIAL «Consíguelo en el App Store» → ficha de TACTIUM en iOS.
// Archivo de Apple en /public/brand/stores/app-store-es.svg (badge negro, español de España).
// Normas de Apple: no modificarlo, inclinarlo ni animarlo (por eso sin hover ni transición);
// uno solo y el primero de la fila; nunca dibujar una réplica ni traducir «App Store».
// https://developer.apple.com/app-store/marketing/guidelines/
//
// RSC pura (sin estado): es solo un enlace externo.

export const APP_STORE_URL = "https://apps.apple.com/app/tactium/id6769825905";

export function AppStoreBadge({ className = "" }: { className?: string }) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Consíguelo en el App Store"
      className={`inline-block shrink-0 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/stores/app-store-es.svg"
        alt="Consíguelo en el App Store"
        width={120}
        height={40}
        className="block h-[54px] w-auto"
      />
    </a>
  );
}
