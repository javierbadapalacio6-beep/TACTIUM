import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con SERVICE ROLE — bypassa RLS. ÚNICAMENTE para el webhook
 * de Stripe (confirmar pagos sin sesión de usuario). Nunca lo importes desde
 * componentes ni rutas con sesión: para eso está `supabaseServer()`.
 *
 * Requiere `SUPABASE_SERVICE_ROLE_KEY` (secreto de servidor, NO NEXT_PUBLIC_).
 */
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY (webhook)",
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
