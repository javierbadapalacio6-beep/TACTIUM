import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { Auth } from "@/components/entry/Auth";
import { serverUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Entrar" };

/** Solo rutas internas: nunca se redirige a otro dominio desde un `?next=`. */
function safeNext(raw: string | string[] | undefined): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || !v.startsWith("/") || v.startsWith("//")) return null;
  return v;
}

/**
 * `/entrar` abre en Iniciar sesión salvo con `?modo=alta`, que es como llegan
 * todos los «Crear cuenta» de la web. Quien ya tiene sesión y viene a darse de
 * alta va directo a su destino (el onboarding, por defecto).
 */
export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const modo = Array.isArray(sp.modo) ? sp.modo[0] : sp.modo;
  const signup = modo === "alta";

  if (signup) {
    const user = await serverUser();
    if (user) redirect(safeNext(sp.next) ?? "/empezar");
  }

  return <Auth initialMode={signup ? "signup" : "login"} />;
}
