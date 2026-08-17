import Link from "next/link";

/**
 * 404. Se renderiza dentro del marco que toque (público o de app) según haya
 * sesión: `AppShell` deja pasar las rutas desconocidas hasta aquí en vez de
 * mostrar el aviso de "sesión necesaria".
 */
export default function NotFound() {
  return (
    <div
      style={{
        maxWidth: 520,
        margin: "0 auto",
        padding: "60px 0",
        textAlign: "center",
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 56, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}
      >
        404
      </div>
      <h1 style={{ marginTop: 14, fontSize: 24 }}>Esta página no existe</h1>
      <p
        style={{
          marginTop: 10,
          color: "var(--text-muted)",
          fontSize: 14,
          textWrap: "pretty",
        }}
      >
        El enlace puede estar roto o la página se ha movido.
      </p>
      <div
        style={{
          marginTop: 26,
          display: "flex",
          gap: 10,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/torneos"
          className="btn btn-accent"
          style={{ padding: "12px 22px", fontSize: 14 }}
        >
          Ir a torneos
        </Link>
        <Link
          href="/"
          className="btn btn-ghost"
          style={{ padding: "12px 22px", fontSize: 14 }}
        >
          Inicio
        </Link>
      </div>
    </div>
  );
}
