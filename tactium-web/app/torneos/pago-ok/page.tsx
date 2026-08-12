import { ReturnToApp } from "./ReturnToApp";

// Página de retorno tras un pago de torneo correcto. La confirmación REAL la
// hace el webhook (fuente de verdad); esto es solo la pantalla de vuelta.
//
// `src` marca el origen del checkout:
//   · app → el pago se inició desde el móvil: ofrecemos volver a la app.
//   · web → el usuario ya está en el navegador (pagó desde el escritorio):
//           se queda en la web, con un atajo a su panel de torneos.
export default async function PagoOkPage({
  searchParams,
}: {
  searchParams: Promise<{ tid?: string; src?: string }>;
}) {
  const { tid, src } = await searchParams;
  const fromApp = src === "app";

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#030F0F",
        color: "#E8F5EF",
        fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        textAlign: "center",
      }}
    >
      <div style={{ maxWidth: 460 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 10px" }}>
          Pago completado
        </h1>
        <p style={{ color: "rgba(232,245,239,0.7)", lineHeight: 1.5 }}>
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
            style={{
              display: "inline-block",
              marginTop: 20,
              padding: "12px 22px",
              borderRadius: 999,
              background: "#00DF82",
              color: "#001810",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Ir a mis torneos
          </a>
        )}
      </div>
    </main>
  );
}
