"use client";

import { useEffect, useState } from "react";

// Vuelta a la app tras pagar un torneo iniciado DESDE el móvil. Se usa el
// esquema propio `tactium://…` a propósito, NO un Universal Link: en iOS un
// Universal Link al mismo dominio de la página (tactium.io) no abre la app, se
// queda en Safari. El esquema sí salta a la app (la app ya sabe enrutar
// `tactium://tournament/{id}?paid=1` a la ficha del torneo).
//
// El botón (gesto del usuario) es el camino FIABLE; el contador es el "por si
// acaso" y hace el intento automático al llegar a cero. Algunos navegadores
// embebidos bloquean la redirección por JS, de ahí que el botón mande.
const SECONDS = 15;

export function ReturnToApp({ tid }: { tid: string }) {
  const deepLink = `tactium://tournament/${tid}?paid=1`;
  const [left, setLeft] = useState(SECONDS);

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (left === 0) window.location.href = deepLink;
  }, [left, deepLink]);

  return (
    <div style={{ marginTop: 20 }}>
      <a
        href={deepLink}
        style={{
          display: "inline-block",
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
      <p style={{ color: "rgba(232,245,239,0.55)", fontSize: 14, marginTop: 12 }}>
        {left > 0
          ? `Te llevamos de vuelta en ${left} s…`
          : "Abriendo la app… ¿No ha vuelto? Toca «Volver a la app»."}
      </p>
    </div>
  );
}
