import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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
