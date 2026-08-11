"use client";

import { useEffect, useState } from "react";

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
 */
export function useAsync<T>(
  run: () => Promise<T>,
  deps: unknown[],
  enabled = true
): AsyncState<T> {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: enabled,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return;
    }

    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null }));

    run()
      .then((data) => {
        if (alive) setState({ data, loading: false, error: null });
      })
      .catch((e: unknown) => {
        if (alive)
          setState({
            data: null,
            loading: false,
            error:
              e instanceof Error ? e.message : "No se pudieron cargar los datos",
          });
      });

    return () => {
      alive = false;
    };
    // `run` se recrea en cada render; las dependencias reales las pasa quien llama.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  return state;
}
