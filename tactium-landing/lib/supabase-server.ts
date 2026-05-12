import { createClient } from "@supabase/supabase-js";

// Cliente Supabase para Route Handlers. Usa la **anon key** (pública, segura
// de exponer) porque el único INSERT que hacemos al waitlist ya está
// permitido por RLS para el rol `anon`. La protección extra (rate-limit,
// validación estricta, honeypot) vive en el propio Route Handler.
//
// Si más adelante necesitamos LEER el waitlist desde server (ej. endpoint
// admin con contador en tiempo real), añadir un cliente separado con
// SUPABASE_SERVICE_ROLE_KEY — y mantener este en anon para inserts.
export function createServerSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
