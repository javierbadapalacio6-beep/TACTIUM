"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { EntryFrame, Field, Input } from "./EntryFrame";
import { Btn, Modal, Note } from "@/components/ui";
import { canonicalOrigin } from "@/lib/site";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WRITES_ENABLED } from "@/lib/writes";
import { IconCheckCircle, IconEye, IconEyeOff } from "@/components/Icon";
import { GoogleLogo } from "@/components/GoogleLogo";

type Mode = "login" | "signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Los errores de GoTrue vienen en inglés; aquí los pocos que ve el usuario. */
function traducirError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o contraseña incorrectos";
  if (m.includes("email not confirmed")) return "Confirma tu email antes de entrar";
  if (m.includes("user already registered")) return "Ya existe una cuenta con ese email";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Demasiados intentos · espera un momento";
  return msg;
}

export function Auth({ initialMode = "login" }: { initialMode?: Mode }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverSent, setRecoverSent] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");
  const [recoverBusy, setRecoverBusy] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);

  /** Tras entrar se vuelve a donde estaba el visitante (`?next=`), nunca a
   *  una URL externa. */
  function afterLogin(): string {
    const raw = new URLSearchParams(window.location.search).get("next") ?? "/";
    return raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  }

  async function sendRecovery() {
    if (!EMAIL_RE.test(recoverEmail) || recoverBusy) return;
    setRecoverBusy(true);
    setRecoverError(null);
    try {
      // El enlace del email vuelve por /auth/callback (canjea el código y deja
      // la sesión) y de ahí a la pantalla de nueva contraseña. El destino va
      // por cookie y, por si el email se abre en otro navegador, también en
      // el propio redirect.
      const base = canonicalOrigin();
      document.cookie = `tactium_next=${encodeURIComponent("/auth/reset-password")}; path=/; max-age=1800; samesite=lax`;
      const { error } = await supabaseBrowser().auth.resetPasswordForEmail(recoverEmail, {
        redirectTo: `${base}/auth/callback?next=/auth/reset-password`,
      });
      if (error) throw error;
      setRecoverSent(true);
    } catch (err) {
      setRecoverError(
        err instanceof Error ? traducirError(err.message) : "No se pudo enviar el email"
      );
    } finally {
      setRecoverBusy(false);
    }
  }

  const signup = mode === "signup";
  // Tras un intento de envío (touched) se marcan también los campos VACÍOS, para
  // que enviar en blanco dé feedback (antes se ignoraba sin avisar de nada).
  const emailBad = touched && !EMAIL_RE.test(email);
  const passBad = touched && (signup ? pass.length < 6 : pass.length === 0);
  const nameBad = touched && signup && name.trim().length <= 1;
  const canSubmit =
    EMAIL_RE.test(email) &&
    // En login basta con que haya contraseña; el mínimo de 6 es regla de alta.
    (signup ? pass.length >= 6 : pass.length >= 1) &&
    (!signup || name.trim().length > 1);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    setServerError(null);
    if (!canSubmit || busy) return;

    setBusy(true);
    try {
      const sb = supabaseBrowser();

      if (signup) {
        // Dar de alta crea un usuario REAL en producción, así que respeta el
        // interruptor de escrituras igual que cualquier otra mutación.
        if (!WRITES_ENABLED) {
          setServerError(
            "Modo solo lectura · no se crean cuentas nuevas. Entra con una que ya exista."
          );
          return;
        }
        const { error } = await sb.auth.signUp({
          email,
          password: pass,
          options: { data: { full_name: name.trim() } },
        });
        if (error) throw error;
        router.push("/empezar");
        return;
      }

      const { error } = await sb.auth.signInWithPassword({
        email,
        password: pass,
      });
      if (error) throw error;
      router.replace(afterLogin());
      router.refresh();
    } catch (err) {
      setServerError(
        err instanceof Error
          ? traducirError(err.message)
          : "No se pudo iniciar sesión"
      );
    } finally {
      setBusy(false);
    }
  }

  async function oauth(provider: "google" | "apple") {
    setServerError(null);
    try {
      const { error } = await supabaseBrowser().auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err) {
      setServerError(
        err instanceof Error ? traducirError(err.message) : "No se pudo continuar"
      );
    }
  }

  return (
    <EntryFrame>
      <h1>{signup ? "Crear cuenta" : "Iniciar sesión"}</h1>
      <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
        {signup
          ? "Configura tu cuenta y empieza a gestionar tu equipo."
          : "Accede a tu equipo y planifica la próxima jornada."}
      </p>

      <form
        onSubmit={submit}
        noValidate
        style={{
          marginTop: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {signup && (
          <Field label="Nombre" error={nameBad ? "Escribe tu nombre" : undefined}>
            <Input
              type="text"
              autoComplete="name"
              placeholder="Carlos Pérez"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={nameBad ? { borderColor: "var(--error)" } : undefined}
            />
          </Field>
        )}

        <Field
          label="Email"
          error={
            emailBad
              ? email.length === 0
                ? "Introduce tu email"
                : "Email inválido"
              : undefined
          }
        >
          <Input
            type="email"
            autoComplete="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={emailBad ? { borderColor: "var(--error)" } : undefined}
          />
        </Field>

        <Field
          label="Contraseña"
          hint={signup ? "Mínimo 6 caracteres" : undefined}
          error={
            passBad
              ? signup
                ? "Mínimo 6 caracteres"
                : "Introduce tu contraseña"
              : undefined
          }
          action={
            !signup ? (
              <button
                type="button"
                onClick={() => {
                  setRecoverEmail(email);
                  setRecoverSent(false);
                  setRecoverOpen(true);
                }}
                className="link-action"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            ) : undefined
          }
        >
          <div style={{ position: "relative" }}>
            <Input
              type={showPass ? "text" : "password"}
              autoComplete={signup ? "new-password" : "current-password"}
              placeholder="••••••••"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              style={{
                paddingRight: 44,
                ...(passBad ? { borderColor: "var(--error)" } : null),
              }}
            />
            <button
              type="button"
              onClick={() => setShowPass((s) => !s)}
              aria-label={showPass ? "Ocultar contraseña" : "Ver contraseña"}
              aria-pressed={showPass}
              tabIndex={-1}
              className="btn btn-icon"
              style={{
                position: "absolute",
                right: 4,
                top: "50%",
                transform: "translateY(-50%)",
                width: 34,
                minHeight: 34,
              }}
            >
              {showPass ? <IconEyeOff size={17} /> : <IconEye size={17} />}
            </button>
          </div>
        </Field>

        {serverError && (
          <Note tone="error" style={{ margin: 0 }}>
            <span role="alert">{serverError}</span>
          </Note>
        )}

        <Btn
          type="submit"
          variant="accent"
          size="lg"
          block
          disabled={busy}
          style={{ marginTop: 4 }}
        >
          {busy ? "Entrando…" : signup ? "Crear cuenta" : "Iniciar sesión"}
        </Btn>
      </form>

      <div
        style={{
          margin: "24px 0",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
        <span style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          o continúa con
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      </div>

      <Btn
        size="lg"
        block
        onClick={() => void oauth("google")}
        icon={<GoogleLogo />}
      >
        Continuar con Google
      </Btn>

      <p
        style={{
          margin: "24px 0 0",
          textAlign: "center",
          fontSize: 13.5,
          color: "var(--text-muted)",
        }}
      >
        {signup ? "¿Ya tienes cuenta? " : "¿Nuevo aquí? "}
        <button
          type="button"
          onClick={() => {
            setMode(signup ? "login" : "signup");
            setTouched(false);
          }}
          className="link-action"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            fontSize: 13.5,
          }}
        >
          {signup ? "Inicia sesión" : "Crea una cuenta"}
        </button>
      </p>

      <Modal
        open={recoverOpen}
        onClose={() => setRecoverOpen(false)}
        labelledBy="recuperar-titulo"
      >
        {recoverSent ? (
          <>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--r-md)",
                background: "var(--accent-10)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <IconCheckCircle size={20} />
            </div>
            <h2 id="recuperar-titulo" style={{ fontSize: 19 }}>
              Email enviado
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
              Revisa tu bandeja de entrada · el enlace caduca en 30 minutos.
            </p>
            <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end" }}>
              <Btn onClick={() => setRecoverOpen(false)}>Volver</Btn>
            </div>
          </>
        ) : (
          <>
            <h2 id="recuperar-titulo" style={{ fontSize: 19 }}>
              Recuperar contraseña
            </h2>
            <p style={{ margin: "8px 0 18px", fontSize: 13.5, color: "var(--text-muted)" }}>
              Te enviamos un enlace para crear una contraseña nueva.
            </p>
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                placeholder="tu@email.com"
                value={recoverEmail}
                onChange={(e) => setRecoverEmail(e.target.value)}
              />
            </Field>
            {recoverError && (
              <div style={{ marginTop: 12 }}>
                <Note tone="error">{recoverError}</Note>
              </div>
            )}
            <div
              style={{
                marginTop: 22,
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <Btn onClick={() => setRecoverOpen(false)}>Cancelar</Btn>
              <Btn
                variant="accent"
                disabled={!EMAIL_RE.test(recoverEmail) || recoverBusy}
                onClick={sendRecovery}
              >
                {recoverBusy ? "Enviando…" : "Enviar"}
              </Btn>
            </div>
          </>
        )}
      </Modal>
    </EntryFrame>
  );
}
