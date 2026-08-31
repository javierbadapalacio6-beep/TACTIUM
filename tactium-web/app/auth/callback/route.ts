import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Vuelta del OAuth (Google / Apple). Supabase manda aquí con un `code` que hay
 * que canjear por sesión; el cliente de `@supabase/ssr` escribe las cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Destino tras el login. Va por COOKIE (no por `?next=` en el redirectTo): un
  // query en el redirectTo rompe el match de la allowlist de Supabase tras
  // Google y cae al Site URL (tactium.io). El redirectTo queda limpio, como en
  // /entrar. Fallback al query por compatibilidad. Solo rutas internas.
  const cookieNext = request.cookies.get("tactium_next")?.value;
  const raw = cookieNext
    ? decodeURIComponent(cookieNext)
    : (searchParams.get("next") ?? "/");
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  if (code) {
    const sb = await supabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(`${origin}${next}`);
      res.cookies.set("tactium_next", "", { path: "/", maxAge: 0 });
      return res;
    }
  }

  return NextResponse.redirect(`${origin}/entrar?error=oauth`);
}
