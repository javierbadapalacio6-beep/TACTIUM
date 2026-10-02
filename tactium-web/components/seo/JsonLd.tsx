/**
 * Bloque JSON-LD (schema.org) para una página concreta. Los esquemas globales
 * (organización, app, FAQ) van en el layout; este es para lo que cambia por
 * URL: un grupo, un equipo, un torneo.
 *
 * Se escapa `<` para que un nombre con HTML dentro no pueda cerrar el script.
 */
export function JsonLd({ data }: { data: object | object[] }) {
  const list = Array.isArray(data) ? data : [data];
  return (
    <>
      {list.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(schema).replace(/</g, "\\u003c"),
          }}
        />
      ))}
    </>
  );
}
