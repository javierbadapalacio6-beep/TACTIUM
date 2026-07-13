// Badge "Disponible en Google Play" → ficha de TACTIUM en Android.
// Réplica del badge (misma píldora negra que AppStoreBadge, logo Play + 2 líneas)
// con el estilo del sitio. Si quieres el asset oficial exacto de Google, sustituye
// el contenido por el badge oficial:
// https://play.google.com/intl/es_es/badges/
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
      className={`inline-flex items-center gap-3 h-[54px] px-5 rounded-xl bg-black border border-[var(--color-hair-strong)] hover:opacity-90 active:opacity-80 transition ${className}`}
    >
      <svg
        viewBox="0 0 512 512"
        aria-hidden="true"
        className="h-6 w-auto shrink-0"
      >
        <path
          fill="#00D3FF"
          d="M47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l1.9 1L284 256v-1L48.9 -0.9 47 0z"
        />
        <path
          fill="#FFCE00"
          d="M363.3 340.1l-79.4-79.4v-9.4l79.5-79.5 1.8 1 94 53.4c26.8 15.2 26.8 40.2 0 55.5l-94 53.4z"
        />
        <path
          fill="#FF3A44"
          d="M365.2 339.1L283.9 256 47 493c8.8 9.4 23.4 10.5 39.9 1.2z"
        />
        <path
          fill="#00E676"
          d="M365.2 172.9L86.9 17.8C70.4 8.4 55.8 9.6 47 19L283.9 256z"
        />
      </svg>
      <span className="flex flex-col leading-none text-left">
        <span className="text-[10px] text-white/80 font-medium tracking-wide">
          Disponible en
        </span>
        <span className="text-[19px] text-white font-semibold tracking-tight mt-0.5">
          Google Play
        </span>
      </span>
    </a>
  );
}
