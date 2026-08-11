import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refresca el token de Supabase en cada navegación y reescribe las cookies.
 *
 * Sin esto la sesión caduca en mitad de la sesión del usuario y los Server
 * Components empiezan a ver `anon` — con lo que la RLS deja de devolver datos
 * y las pantallas se vacían sin error visible.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  // Sin credenciales la web sigue funcionando con los datos de ejemplo.
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(toSet) {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // `getUser` es lo que dispara el refresco. No borrar.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    // Todo menos estáticos e imágenes.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
