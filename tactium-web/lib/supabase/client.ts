"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase para el navegador.
 *
 * A diferencia del de la landing, esta SÍ es una app autenticada: la sesión se
 * persiste y se refresca sola, y `@supabase/ssr` la guarda en cookies para que
 * el servidor pueda leerla en el mismo request.
 *
 * La publishable key es pública por diseño. Lo que protege los datos es la RLS,
 * que está activa en las 40 tablas.
 */
let cached: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY · copia .env.example a .env.local"
    );
  }

  cached = createBrowserClient(url, key);
  return cached;
}
