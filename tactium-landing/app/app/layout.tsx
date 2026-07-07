"use client";

import { createContext, useContext, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseApp } from "@/lib/supabase-app";
import { TactiumMark } from "@/components/TactiumMark";
import { Login } from "./Login";

// Sesión compartida con todas las páginas de /app.
const SessionContext = createContext<Session | null>(null);
export const useSession = (): Session => {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession fuera del layout autenticado");
  return s;
};

// Layout autenticado: resuelve sesión una vez, muestra login si no hay, y
// envuelve las páginas con la barra superior ("shell"). Sin SSR de auth (MVP).
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sb = getSupabaseApp();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <main className="min-h-screen grid place-items-center bg-[var(--color-bg)]">
        <div className="flex flex-col items-center gap-4">
          <TactiumMark size={48} className="animate-pulse" />
          <span className="font-mono text-[11px] tracking-[0.3em] text-[var(--color-text-faint)]">
            CARGANDO
          </span>
        </div>
      </main>
    );
  }

  if (!session) return <Login />;

  const userName =
    (session.user.user_metadata?.full_name as string | undefined) ??
    session.user.email ??
    "Capitán";

  return (
    <SessionContext.Provider value={session}>
      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
        {/* Glow superior tenue */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-x-0 top-0 h-64 opacity-60"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 0%, var(--color-accent-10), transparent 70%)",
          }}
        />
        <header className="sticky top-0 z-20 backdrop-blur-md bg-[color-mix(in_srgb,var(--color-bg)_80%,transparent)] border-b border-[var(--color-hair)]">
          <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Link href="/app" className="flex items-center gap-2.5 group">
                <TactiumMark size={30} />
                <span className="font-bold tracking-tight">TACTIUM</span>
              </Link>
              <nav className="hidden md:flex items-center gap-5 text-[13px]">
                {[
                  ["/app", "Equipos"],
                  ["/app/club", "Clubs"],
                  ["/app/subscription", "Suscripción"],
                  ["/app/profile", "Perfil"],
                ].map(([href, label]) => (
                  <Link
                    key={href}
                    href={href}
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <span className="hidden sm:block text-[13px] text-[var(--color-text-muted)] max-w-[200px] truncate">
                {userName}
              </span>
              <button
                onClick={() => getSupabaseApp().auth.signOut()}
                className="text-[13px] font-medium px-3 h-9 rounded-full border border-[var(--color-hair-strong)] text-[var(--color-text-muted)] transition hover:text-[var(--color-text)] hover:border-[var(--color-text)]"
              >
                Salir
              </button>
            </div>
          </div>
        </header>
        <main className="relative max-w-5xl mx-auto px-5 py-10">{children}</main>
      </div>
    </SessionContext.Provider>
  );
}
