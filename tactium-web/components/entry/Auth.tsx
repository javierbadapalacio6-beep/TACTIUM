"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { EntryFrame, Field, Input } from "./EntryFrame";
import { Modal } from "@/components/ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { WRITES_ENABLED } from "@/lib/writes";
import { IconCheckCircle } from "@/components/Icon";

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
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [recoverOpen, setRecoverOpen] = useState(false);
  const [recoverSent, setRecoverSent] = useState(false);
  const [recoverEmail, setRecoverEmail] = useState("");

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
      router.replace("/");
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
      <div className="eyebrow">{signup ? "CREAR CUENTA" : "INICIAR SESIÓN"}</div>
      <h1
        style={{
          margin: "16px 0 0",
          fontSize: 26,
          lineHeight: 1.15,
          textWrap: "pretty",
        }}
      >
        {signup
          ? "Configura tu cuenta y empieza a gestionar tu equipo."
          : "Accede a tu equipo y planifica la próxima jornada."}
      </h1>

      <form
        onSubmit={submit}
        noValidate
        style={{
          marginTop: 28,
          display: "flex",
          flexDirection: "column",
          gap: 18,
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
                style={{
                  border: "none",
                  background: "transparent",
                  color: "var(--accent)",
                  fontSize: 12,
                  cursor: "pointer",
                  padding: 0,
                  fontFamily: "'Satoshi', sans-serif",
                }}
              >
                ¿Olvidaste?
              </button>
            ) : undefined
          }
        >
          <Input
            type="password"
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder="••••••••"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            style={passBad ? { borderColor: "var(--error)" } : undefined}
          />
        </Field>

        {serverError && (
          <p
            role="alert"
            style={{
              margin: 0,
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--error-soft)",
              border: "1px solid var(--error)",
              color: "var(--error)",
              fontSize: 13,
            }}
          >
            {serverError}
          </p>
        )}

        <button
          type="submit"
          className="btn btn-accent"
          disabled={busy}
          style={{ padding: 15, fontSize: 15, marginTop: 4 }}
        >
          {busy ? "Entrando…" : signup ? "Crear cuenta" : "Iniciar sesión"}
        </button>
      </form>

      <div
        style={{
          margin: "26px 0",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--hair)" }} />
        <span
          className="mono"
          style={{
            fontSize: 9.5,
            letterSpacing: "0.2em",
            color: "var(--text-faint)",
          }}
        >
          O CONTINÚA CON
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--hair)" }} />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {(["google", "apple"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => void oauth(p)}
            className="btn btn-ghost"
            style={{ flex: 1, minWidth: 130, padding: "13px 18px", fontSize: 13.5 }}
          >
            Continuar con {p === "google" ? "Google" : "Apple"}
          </button>
        ))}
      </div>

      <p
        style={{
          margin: "26px 0 0",
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
          style={{
            border: "none",
            background: "transparent",
            color: "var(--accent)",
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            padding: 0,
            fontFamily: "'Satoshi', sans-serif",
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
                borderRadius: 12,
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
            <h2 id="recuperar-titulo" style={{ fontSize: 22 }}>
              Email enviado
            </h2>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 13.5,
                color: "var(--text-muted)",
                textWrap: "pretty",
              }}
            >
              Revisa tu bandeja de entrada · el enlace caduca en 30 minutos.
            </p>
            <div
              style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRecoverOpen(false)}
                style={{ padding: "12px 20px", fontSize: 13.5 }}
              >
                Volver
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="recuperar-titulo" style={{ fontSize: 22 }}>
              Recuperar contraseña
            </h2>
            <p
              style={{
                margin: "10px 0 20px",
                fontSize: 13.5,
                color: "var(--text-muted)",
                textWrap: "pretty",
              }}
            >
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
            <div
              style={{
                marginTop: 24,
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setRecoverOpen(false)}
                style={{ padding: "12px 20px", fontSize: 13.5 }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-accent"
                disabled={!EMAIL_RE.test(recoverEmail)}
                onClick={() => setRecoverSent(true)}
                style={{ padding: "12px 22px", fontSize: 13.5 }}
              >
                Enviar
              </button>
            </div>
          </>
        )}
      </Modal>
    </EntryFrame>
  );
}
