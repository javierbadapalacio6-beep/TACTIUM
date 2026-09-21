// Página de retorno cuando el club cancela el pago del torneo.
//
// `src` marca el origen: `app` (checkout iniciado desde el móvil) ofrece volver
// a la app por el esquema propio; `web` se queda en el navegador con un atajo al
// panel. Sin `paid` — aquí no se ha cobrado nada.
//
// Mismos tokens que el resto de la web (antes traía sus propios hex y un emoji
// como icono).
export default async function PagoCanceladoPage({
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
            background: "var(--bg-card-2)",
            border: "1px solid var(--line)",
            color: "var(--text-muted)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 18,
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 14 4 9l5-5" />
            <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
          </svg>
        </span>
        <h1>Pago cancelado</h1>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 14,
            color: "var(--text-muted)",
            lineHeight: 1.5,
          }}
        >
          {fromApp
            ? "No se ha cobrado nada. Puedes volver a la app y publicar el torneo cuando quieras."
            : "No se ha cobrado nada. Puedes volver a tu panel y publicar el torneo cuando quieras."}
        </p>
        <a
          href={tid && fromApp ? `tactium://tournament/${tid}` : "/club/torneos"}
          className="btn btn-ghost btn-lg"
          style={{ marginTop: 22 }}
        >
          {tid && fromApp ? "Volver a la app" : "Ir a mis torneos"}
        </a>
      </div>
    </main>
  );
}
