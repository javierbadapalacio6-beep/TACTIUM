"use client";

import { useEffect, useState } from "react";

// Página de retorno del alta de Stripe Connect cuando el flujo lo inició la APP.
// El navegador no tiene sesión de TACTIUM (el alta se pidió con el token de la
// app), así que en vez de mostrar una página que exigiría login, rebotamos de
// vuelta a la app por deep link. `?retry=1` = el alta caducó / falta algo.
const APP_DEEP_LINK = "tactium://";

export default function ConnectReturnPage() {
  const [retry, setRetry] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRetry(params.get("retry") === "1");
    // Intento automático de volver a la app.
    const t = setTimeout(() => {
      window.location.href = APP_DEEP_LINK;
    }, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        minHeight: "70vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        className="card"
        style={{ maxWidth: 440, width: "100%", textAlign: "center", padding: 32 }}
      >
        <h1>{retry ? "Alta sin terminar" : "Cobros conectados"}</h1>
        <p
          style={{
            margin: "14px 0 0",
            fontSize: 14,
            color: "var(--text-muted)",
            lineHeight: 1.5,
            textWrap: "pretty",
          }}
        >
          {retry
            ? "El enlace de alta caducó o faltan datos. Vuelve a la app y toca de nuevo “Cobros online de torneos”."
            : "Tu club ya puede cobrar inscripciones online. Vuelve a la app para continuar."}
        </p>
        <a href={APP_DEEP_LINK} className="btn btn-accent btn-lg" style={{ marginTop: 24 }}>
          Volver a la app
        </a>
      </div>
    </div>
  );
}
