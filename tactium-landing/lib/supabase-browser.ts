import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase para componentes "use client". Singleton para reutilizar
// la misma instancia entre renders y evitar listeners duplicados.
//
// Configuración pensada para flows transitorios (reset password, magic link
// landing): `detectSessionInUrl` parsea el hash `#access_token=...` que
// Supabase añade tras /verify y establece sesión en memoria. NO persistimos
// en localStorage — esta web no es una app autenticada; sólo necesitamos la
// sesión efímera para llamar a `updateUser` o similares.

let cached: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  cached = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  });
  return cached;
}
