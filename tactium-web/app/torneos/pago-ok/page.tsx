// Página de retorno tras un pago de torneo correcto. La confirmación REAL la
// hace el webhook (fuente de verdad); esto es solo la pantalla de vuelta.
export default async function PagoOkPage({
  searchParams,
}: {
  searchParams: Promise<{ tid?: string }>;
}) {
  const { tid } = await searchParams;
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
          Tu torneo ya está listo para publicar. Vuelve a la app de TACTIUM para
          abrir la inscripción.
        </p>
        {tid ? (
          <a
            href={`tactium://torneos/${tid}`}
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
            Volver a la app
          </a>
        ) : null}
      </div>
    </main>
  );
}
