"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import type { SupabaseClient } from "@supabase/supabase-js";

type Status =
  | "verifying"
  | "ready"
  | "submitting"
  | "success"
  | "invalid"
  | "error";

const MIN_PASSWORD = 6;

export function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const supabaseRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabaseRef.current = supabase;

    // El cliente con detectSessionInUrl:true ya parsea el hash al cargar.
    // Esperamos al evento PASSWORD_RECOVERY o a una INITIAL_SESSION válida
    // — ambos indican que el token del email se procesó correctamente.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "PASSWORD_RECOVERY" ||
        (event === "INITIAL_SESSION" && session)
      ) {
        setStatus((prev) => (prev === "verifying" ? "ready" : prev));
      }
    });

    // Fallback: si tras 3s no aparece sesión, asumimos enlace caducado o
    // manipulado. El usuario debe pedir uno nuevo desde la app.
    const timeoutId = window.setTimeout(async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setStatus((prev) => (prev === "verifying" ? "invalid" : prev));
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      window.clearTimeout(timeoutId);
    };
  }, []);

  const passwordsMatch = password === confirm;
  const longEnough = password.length >= MIN_PASSWORD;
  const valid = longEnough && passwordsMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || !supabaseRef.current) return;
    setStatus("submitting");
    setErrorMsg(null);
    const { error } = await supabaseRef.current.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    // Limpiamos la sesión efímera — el usuario debe volver a la app y
    // entrar allí con sus credenciales nuevas, no quedarse logueado aquí.
    await supabaseRef.current.auth.signOut();
    setStatus("success");
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition"
        >
          ← VOLVER A TACTIUM
        </Link>

        <div className="mt-6 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] p-8">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--color-accent)]">
            Recuperar contraseña
          </p>

          {status === "verifying" && (
            <StateVerifying />
          )}

          {status === "invalid" && (
            <StateInvalid />
          )}

          {status === "success" && (
            <StateSuccess />
          )}

          {(status === "ready" ||
            status === "submitting" ||
            status === "error") && (
            <form onSubmit={handleSubmit} className="mt-4">
              <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
                Nueva contraseña
              </h1>
              <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
                Elige una contraseña nueva para tu cuenta. La usarás la próxima
                vez que abras la app TACTIUM.
              </p>

              <PasswordField
                label="Nueva contraseña"
                value={password}
                onChange={setPassword}
                show={showPass}
                onToggleShow={() => setShowPass((v) => !v)}
                placeholder={`Mínimo ${MIN_PASSWORD} caracteres`}
                autoFocus
              />

              <PasswordField
                label="Confirma la contraseña"
                value={confirm}
                onChange={setConfirm}
                show={showPass}
                onToggleShow={() => setShowPass((v) => !v)}
                placeholder="Repite la contraseña"
              />

              {confirm.length > 0 && !passwordsMatch && (
                <p className="mt-2 text-[13px] text-[var(--color-error)]">
                  Las contraseñas no coinciden.
                </p>
              )}

              {status === "error" && errorMsg && (
                <p className="mt-4 rounded-lg border border-[var(--color-error)]/30 bg-[var(--color-error)]/10 px-4 py-3 text-[14px] text-[var(--color-error)]">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={!valid || status === "submitting"}
                className="mt-6 w-full rounded-xl bg-[var(--color-accent)] py-3 text-[15px] font-bold tracking-tight text-[var(--color-text-inverse)] transition hover:bg-[var(--color-accent-dim)] disabled:opacity-40 disabled:hover:bg-[var(--color-accent)]"
              >
                {status === "submitting"
                  ? "Guardando..."
                  : "Guardar contraseña"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-faint)]">
          tactium.io
        </p>
      </div>
    </main>
  );
}

function StateVerifying() {
  return (
    <div className="mt-4">
      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
        Verificando enlace...
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
        Un momento mientras comprobamos tu enlace de recuperación.
      </p>
      <div className="mt-6 h-1 w-full overflow-hidden rounded-full bg-[var(--color-hair)]">
        <div className="h-full w-1/3 animate-pulse bg-[var(--color-accent)]" />
      </div>
    </div>
  );
}

function StateInvalid() {
  return (
    <div className="mt-4">
      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
        Enlace caducado o inválido.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
        Por seguridad, los enlaces de recuperación expiran al cabo de un rato.
        Vuelve a la app TACTIUM, pulsa{" "}
        <span className="text-[var(--color-text)]">¿Olvidaste?</span> de nuevo y
        usa el último email que recibas.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-xl border border-[var(--color-hair-strong)] px-4 py-2 text-[14px] font-semibold text-[var(--color-text)] transition hover:border-[var(--color-text)]"
      >
        Volver a la home
      </Link>
    </div>
  );
}

function StateSuccess() {
  return (
    <div className="mt-4">
      <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-text)]">
        Contraseña actualizada.
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-[var(--color-text-muted)]">
        Abre la app TACTIUM y entra con tu email y tu nueva contraseña.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-[14px] font-bold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-accent-dim)]"
      >
        Volver a tactium.io
      </Link>
    </div>
  );
}

interface PasswordFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggleShow: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggleShow,
  placeholder,
  autoFocus,
}: PasswordFieldProps) {
  return (
    <label className="mt-5 block">
      <span className="block text-[12px] font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-raised)] px-4 focus-within:border-[var(--color-accent)]">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="new-password"
          className="flex-1 bg-transparent py-3 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="text-[12px] font-mono uppercase tracking-[0.1em] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        >
          {show ? "Ocultar" : "Ver"}
        </button>
      </div>
    </label>
  );
}
