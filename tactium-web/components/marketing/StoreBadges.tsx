import { APP_STORE_URL, PLAY_STORE_URL } from "@/lib/site";

/** Los dos badges de tienda, juntos: siempre van en pareja. */
export function StoreBadges() {
  return (
    <div className="mk-stores">
      <a
        href={APP_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mk-store"
        aria-label="Descárgalo en el App Store"
      >
        <svg viewBox="0 0 384 512" width="22" height="26" aria-hidden="true" fill="#fff">
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
        <span>
          <small>Descárgalo en el</small>
          <strong>App Store</strong>
        </span>
      </a>
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mk-store"
        aria-label="Disponible en Google Play"
      >
        <svg viewBox="0 0 512 512" width="22" height="24" aria-hidden="true">
          <path fill="#00D3FF" d="M47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l1.9 1L284 256v-1L48.9-.9 47 0z" />
          <path fill="#FFCE00" d="M363.3 340.1l-79.4-79.4v-9.4l79.5-79.5 1.8 1 94 53.4c26.8 15.2 26.8 40.2 0 55.5l-94 53.4z" />
          <path fill="#FF3A44" d="M365.2 339.1L283.9 256 47 493c8.8 9.4 23.4 10.5 39.9 1.2z" />
          <path fill="#00E676" d="M365.2 172.9L86.9 17.8C70.4 8.4 55.8 9.6 47 19L283.9 256z" />
        </svg>
        <span>
          <small>Disponible en</small>
          <strong>Google Play</strong>
        </span>
      </a>
    </div>
  );
}
