"use client";

import { useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Carga asíncrona con estados explícitos.
 *
 * No hay fallback silencioso a datos de ejemplo: si la consulta falla o
 * devuelve vacío, la pantalla lo dice. Mezclar datos reales con inventados sin
 * avisar es la forma más rápida de tomar una decisión sobre información falsa.
 *
 * `initial`: dato ya resuelto en servidor (fichas públicas renderizadas para
 * el buscador). Con él la pantalla arranca pintada, sin esqueleto, y la
 * primera carga en el navegador se salta: sólo se vuelve a consultar cuando
 * cambian las dependencias (por ejemplo, al aparecer la sesión), y entonces
 * se refresca por detrás sin volver al esqueleto. `null` cuenta como dato
 * inicial válido; `undefined` significa «no hay».
 */
export function useAsync<T>(
  run: () => Promise<T>,
  deps: unknown[],
  enabled = true,
  initial?: T
): AsyncState<T> {
  const seeded = initial !== undefined;
  const [state, setState] = useState<AsyncState<T>>({
    data: seeded ? (initial as T) : null,
    loading: enabled && !seeded,
    error: null,
  });
  // La primera ejecución del efecto se salta si venimos sembrados.
  const skipNext = useRef(seeded);
  // Si el servidor entrega un `initial` distinto (misma vista, otra URL),
  // se adopta tal cual y se vuelve a saltar la carga.
  const lastInitial = useRef(initial);
  if (seeded && initial !== lastInitial.current) {
    lastInitial.current = initial;
    skipNext.current = true;
    setState({ data: initial as T, loading: false, error: null });
  }

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }

    let alive = true;
    // Sembrado ⇒ refresco silencioso: no se vuelve al esqueleto.
    setState((s) => ({ ...s, loading: !seeded, error: null }));

    run()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (alive)
          setState((s) => ({
            // Con dato sembrado, un fallo del refresco no borra lo que ya se ve.
            data: seeded ? s.data : null,
            loading: false,
            error:
              e instanceof Error ? e.message : "No se pudieron cargar los datos",
          }));
      });

    return () => {
      alive = false;
    };
    // `run` se recrea en cada render; las dependencias reales las pasa quien llama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  return state;
}
