"use client";

import { useEffect, useState } from "react";

import { Toast } from "@/components/states";

/**
 * Aviso "Sesión cerrada". Como `signOut` recarga la página (a `/?signedout=1`),
 * el toast se muestra en el destino leyendo ese parámetro, y luego lo limpia de
 * la URL. Montado en el layout para que salga sea cual sea la pantalla.
 */
export function SignedOutToast() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("signedout") !== "1") return;

    setShow(true);
    // Quita el parámetro de la URL sin recargar (para que no reaparezca).
    params.delete("signedout");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : ""),
    );

    const t = window.setTimeout(() => setShow(false), 4000);
    return () => window.clearTimeout(t);
  }, []);

  if (!show) return null;
  return (
    <Toast
      tone="success"
      title="Sesión cerrada"
      body="Has cerrado sesión correctamente."
      onClose={() => setShow(false)}
    />
  );
}
