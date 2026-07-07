import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Cliente Supabase para la APP autenticada (/app). A diferencia del de
// marketing (`supabase-browser`, efímero), este PERSISTE la sesión: el capitán
// o club inicia sesión una vez y sigue dentro. La anon key es segura en cliente
// — la RLS de Supabase hace el control de acceso real.
let cached: SupabaseClient | null = null;

export function getSupabaseApp(): SupabaseClient {
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
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cached;
}
