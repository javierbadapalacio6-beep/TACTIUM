import { BtnLink } from "@/components/ui";

/**
 * 404. Se renderiza dentro del marco que toque (público o de app) según haya
 * sesión: `AppShell` deja pasar las rutas desconocidas hasta aquí en vez de
 * mostrar el aviso de "sesión necesaria".
 */
export default function NotFound() {
  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: "56px 0",
        textAlign: "center",
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 48, fontWeight: 700, color: "var(--accent)", lineHeight: 1 }}
      >
        404
      </div>
      <h1 style={{ marginTop: 16 }}>Esta página no existe</h1>
      <p style={{ marginTop: 8, color: "var(--text-muted)", fontSize: 13.5 }}>
        El enlace puede estar roto o la página se ha movido.
      </p>
      <div
        style={{
          marginTop: 24,
          display: "flex",
          gap: 8,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <BtnLink href="/torneos" variant="accent">
          Ir a torneos
        </BtnLink>
        <BtnLink href="/">Inicio</BtnLink>
      </div>
    </div>
  );
}
