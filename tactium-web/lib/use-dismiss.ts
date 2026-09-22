"use client";

import { useEffect, useRef } from "react";

/**
 * Cierra un popover al pulsar fuera o con Escape.
 *
 * Devuelve la `ref` que hay que colgar del contenedor: todo lo que esté
 * dentro (el botón que abre y el propio panel) cuenta como «dentro», así
 * que abrir no se cierra a sí mismo.
 *
 * Vivía dentro de `AppShell`; se sacó aquí cuando los filtros de la
 * Federación dejaron el `select` nativo por un desplegable propio.
 */
export function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  // La función de cierre se guarda en una ref para no re-suscribir los
  // escuchadores en cada render de quien nos llama.
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return ref;
}
