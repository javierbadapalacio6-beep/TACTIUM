"use client";

import { useEffect, useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";
import { TactiumMark } from "@/components/TactiumMark";

type Tab = "signin" | "signup";

export function Login() {
  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<null | "email" | "google">(null);
  const [msg, setMsg] = useState<{ kind: "error" | "ok"; text: string } | null>(
    null,
  );
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isSignup = tab === "signup";
  const valid = isSignup
    ? email.includes("@") && pass.length >= 6 && name.trim().length >= 2
    : email.includes("@") && pass.length >= 6;

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy("email");
    setMsg(null);
    const sb = getSupabaseApp();
    try {
      if (isSignup) {
        const { error } = await sb.auth.signUp({
          email: email.trim(),
          password: pass,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        setMsg({
          kind: "ok",
          text: "Cuenta creada. Revisa tu email para confirmarla antes de entrar.",
        });
      } else {
        const { error } = await sb.auth.signInWithPassword({
          email: email.trim(),
          password: pass,
        });
        if (error) throw error;
        // onAuthStateChange en la página hará el resto.
      }
    } catch (err) {
      setMsg({
        kind: "error",
        text:
          (err as { message?: string })?.message ??
          "No se pudo completar. Inténtalo de nuevo.",
      });
    } finally {
      setBusy(null);
    }
  };

  const handleForgot = async () => {
    if (busy) return;
    const target = email.trim();
    if (!target.includes("@")) {
      setMsg({
        kind: "error",
        text: "Escribe primero tu email para enviarte el enlace de recuperación.",
      });
      return;
    }
    setBusy("email");
    setMsg(null);
    const sb = getSupabaseApp();
    const { error } = await sb.auth.resetPasswordForEmail(target, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });
    setBusy(null);
    if (error) {
      setMsg({ kind: "error", text: error.message });
    } else {
      setMsg({
        kind: "ok",
        text: `Si existe una cuenta con ${target}, recibirás un enlace para restablecer la contraseña.`,
      });
    }
  };

  const handleGoogle = async () => {
    if (busy) return;
    setBusy("google");
    setMsg(null);
    const sb = getSupabaseApp();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/app` },
    });
    if (error) {
      setMsg({ kind: "error", text: error.message });
      setBusy(null);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--color-bg)] grid place-items-center px-5 py-12">
      {/* Aurora ambiental (reutiliza el sistema de la landing). */}
      <div className="aurora" aria-hidden="true">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      <section
        className="relative w-full max-w-[400px] transition-all duration-700 ease-out"
        style={{
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
        }}
      >
        {/* Marca */}
        <div className="flex flex-col items-center text-center gap-3 mb-9">
          <TactiumMark size={64} />
          <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
            TACTIUM
          </h1>
          <p className="font-mono text-[10px] tracking-[0.35em] text-[var(--color-accent)]">
            CREATE · ANALYZE · ELEVATE
          </p>
          <p className="text-sm text-[var(--color-text-muted)] max-w-[300px] mt-1">
            El centro de mando de tu equipo. Entra para gestionar plantilla,
            jornadas y alineaciones.
          </p>
        </div>

        {/* Tarjeta */}
        <div className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)]/80 backdrop-blur-xl p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.6)]">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--color-bg)]/60 border border-[var(--color-hair)] mb-5">
            {(["signin", "signup"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setTab(k);
                  setMsg(null);
                }}
                className={`h-9 rounded-lg text-[13px] font-semibold transition ${
                  tab === k
                    ? "bg-[var(--color-bg-raised)] text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {k === "signin" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmail} className="flex flex-col gap-3" noValidate>
            {isSignup && (
              <Field
                label="Nombre"
                value={name}
                onChange={setName}
                placeholder="Carlos Pérez"
                autoComplete="name"
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="tu@email.com"
              autoComplete="email"
            />
            <Field
              label="Contraseña"
              type="password"
              value={pass}
              onChange={setPass}
              placeholder={isSignup ? "Mínimo 6 caracteres" : "••••••••"}
              autoComplete={isSignup ? "new-password" : "current-password"}
            />

            {!isSignup && (
              <button
                type="button"
                onClick={handleForgot}
                disabled={!!busy}
                className="-mt-1 self-end text-[12px] font-medium text-[var(--color-accent)] transition hover:opacity-80 disabled:opacity-50"
              >
                ¿Olvidaste tu contraseña?
              </button>
            )}

            <button
              type="submit"
              disabled={!valid || busy === "email"}
              className="mt-1 h-12 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[15px] tracking-tight shadow-[0_10px_30px_-10px_var(--color-accent-55)] transition hover:opacity-90 active:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy === "email"
                ? "Un momento…"
                : isSignup
                  ? "Crear cuenta"
                  : "Iniciar sesión"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <span className="h-px flex-1 bg-[var(--color-hair)]" />
            <span className="font-mono text-[10px] tracking-[0.2em] text-[var(--color-text-faint)]">
              O
            </span>
            <span className="h-px flex-1 bg-[var(--color-hair)]" />
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={!!busy}
            className="w-full h-12 rounded-xl border border-[var(--color-hair-strong)] bg-transparent text-[var(--color-text)] font-semibold text-[15px] flex items-center justify-center gap-2.5 transition hover:bg-[var(--color-bg-raised)] disabled:opacity-50"
          >
            <GoogleIcon />
            {busy === "google" ? "Conectando…" : "Continuar con Google"}
          </button>

          {msg && (
            <p
              role="alert"
              className={`mt-4 text-[13px] leading-snug ${
                msg.kind === "error"
                  ? "text-[var(--color-error)]"
                  : "text-[var(--color-accent)]"
              }`}
            >
              {msg.text}
            </p>
          )}
        </div>

        <p className="text-center text-[11px] text-[var(--color-text-faint)] mt-5 font-mono tracking-wide">
          14 DÍAS GRATIS · CANCELA CUANDO QUIERAS
        </p>
      </section>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-[var(--color-text-muted)]">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoCapitalize="none"
        className="h-12 px-4 rounded-xl bg-[var(--color-bg)]/60 border border-[var(--color-hair-strong)] text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none transition focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent-25)]"
      />
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571.001-.001 6.19 5.238 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
