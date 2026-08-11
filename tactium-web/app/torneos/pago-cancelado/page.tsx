// Página de retorno cuando el club cancela el pago del torneo.
export default async function PagoCanceladoPage({
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
        <div style={{ fontSize: 40, marginBottom: 12 }}>↩️</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: "0 0 10px" }}>
          Pago cancelado
        </h1>
        <p style={{ color: "rgba(232,245,239,0.7)", lineHeight: 1.5 }}>
          No se ha cobrado nada. Puedes volver a la app y publicar el torneo
          cuando quieras.
        </p>
        {tid ? (
          <a
            href={`tactium://torneos/${tid}`}
            style={{
              display: "inline-block",
              marginTop: 20,
              padding: "12px 22px",
              borderRadius: 999,
              border: "1px solid rgba(232,245,239,0.2)",
              color: "#E8F5EF",
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
