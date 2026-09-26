import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { cache } from "react";

/**
 * Cliente Supabase para Server Components y Route Handlers.
 *
 * Lee la sesión de las cookies, así que las consultas corren con el rol
 * `authenticated` del usuario y la RLS se aplica igual que en el móvil. Sin
 * sesión cae a `anon`, que sólo puede ejecutar las RPC `public_*`.
 *
 * Nunca usa la service role key: aquí no hay nada que deba saltarse la RLS.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
    );
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Los Server Components no pueden escribir cookies. El refresco de
          // sesión lo hace el middleware, así que aquí se puede ignorar.
        }
      },
    },
  });
}

/**
 * Usuario de la petición actual, resuelto en servidor y compartido entre el
 * layout y la página (React `cache` dedupe dentro de la misma petición).
 *
 * Sin cookies de sesión no hay llamada de red: `getUser` devuelve null al
 * instante, que es el caso del visitante que llega a la portada.
 */
export const serverUser = cache(async (): Promise<User | null> => {
  try {
    const sb = await supabaseServer();
    const { data } = await sb.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
});
