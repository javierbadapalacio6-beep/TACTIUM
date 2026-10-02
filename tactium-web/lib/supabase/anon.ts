import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase ANÓNIMO para el servidor, sin cookies.
 *
 * Sirve para lo que se puede leer sin sesión —las tablas `fcp_*` y las RPC
 * `public_*`— cuando se renderiza en servidor para un visitante o para
 * Googlebot. Al no tocar `cookies()` no fuerza el render dinámico, así que
 * el sitemap y las fichas federativas pueden cachearse.
 *
 * Nunca usa la service role key: corre como `anon`, con la misma RLS que
 * un visitante en el navegador.
 */
let cached: SupabaseClient | null = null;

export function supabaseAnon(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
