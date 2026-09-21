import { ReturnToApp } from "./ReturnToApp";

// Página de retorno tras un pago de torneo correcto. La confirmación REAL la
// hace el webhook (fuente de verdad); esto es solo la pantalla de vuelta.
//
// `src` marca el origen del checkout:
//   · app → el pago se inició desde el móvil: ofrecemos volver a la app.
//   · web → el usuario ya está en el navegador (pagó desde el escritorio):
//           se queda en la web, con un atajo a su panel de torneos.
//
// Va fuera del shell y sin sesión garantizada, pero usa los MISMOS tokens que
// el resto: antes traía sus propios hex, su tipografía del sistema y un emoji
// como icono, y se notaba que era otra web.
export default async function PagoOkPage({
  searchParams,
}: {
  searchParams: Promise<{ tid?: string; src?: string }>;
}) {
  const { tid, src } = await searchParams;
  const fromApp = src === "app";

  return (
    <main
      className="amb"
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 440, textAlign: "center" }}>
        <span
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: "var(--accent-10)",
            color: "var(--accent)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1>Pago completado</h1>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 14,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          {fromApp
            ? "Tu torneo ya está publicado. Vuelve a la app de TACTIUM para gestionarlo."
            : "Tu torneo ya está publicado. Puedes volver a tu panel para gestionarlo."}
        </p>

        {tid && fromApp ? (
          // Iniciado desde el móvil → volver a la app (contador + botón).
          <ReturnToApp tid={tid} />
        ) : (
          // Pago desde la web → se queda en la web.
          <a
            href="/club/torneos"
            className="btn btn-accent btn-lg"
            style={{ marginTop: 22 }}
          >
            Ir a mis torneos
          </a>
        )}
      </div>
    </main>
  );
}
