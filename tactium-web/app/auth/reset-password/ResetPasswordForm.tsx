"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { EntryFrame, Field, Input } from "@/components/entry/EntryFrame";
import { Btn, BtnLink, Card, Note } from "@/components/ui";
import { IconCheckCircle } from "@/components/Icon";
import { supabaseBrowser } from "@/lib/supabase/client";

type Status = "verifying" | "ready" | "submitting" | "success" | "invalid" | "error";

const MIN_PASSWORD = 6;

/**
 * Nueva contraseña desde el enlace del email. Llegan dos tipos de enlace:
 *
 *  · El que pide la APP MÓVIL (`resetPasswordForEmail` con redirect a esta
 *    página): flujo implícito, el token viene en el hash (`#access_token`).
 *    El cliente PKCE de `@supabase/ssr` rechaza ese hash, así que se lee con
 *    un cliente plano y sin persistencia, como hacía la landing.
 *  · El que pide la WEB (modal «Recuperar contraseña» de /entrar): PKCE, pasa
 *    por `/auth/callback`, que canjea el código y deja la sesión en cookies;
 *    aquí basta con leerla.
 */
export function ResetPasswordForm() {
  const [status, setStatus] = useState<Status>("verifying");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const clientRef = useRef<SupabaseClient | null>(null);

  useEffect(() => {
    const implicit = /(^#|&)access_token=/.test(window.location.hash.replace(/^#/, "#"));
    let cleanup = () => {};

    if (implicit) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) {
        setStatus("invalid");
        return;
      }
      const sb = createClient(url, key, {
        auth: {
          flowType: "implicit",
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: true,
        },
      });
      clientRef.current = sb;
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        if (event === "PASSWORD_RECOVERY" || (event === "INITIAL_SESSION" && session)) {
          setStatus((prev) => (prev === "verifying" ? "ready" : prev));
        }
      });
      cleanup = () => data.subscription.unsubscribe();
    } else {
      const sb = supabaseBrowser();
      clientRef.current = sb;
      sb.auth.getSession().then(({ data }) => {
        if (data.session) setStatus((prev) => (prev === "verifying" ? "ready" : prev));
      });
    }

    // Si a los 3 s no hay sesión, el enlace caducó o está manipulado.
    const timeout = window.setTimeout(async () => {
      const { data } = (await clientRef.current?.auth.getSession()) ?? { data: { session: null } };
      if (!data.session) setStatus((prev) => (prev === "verifying" ? "invalid" : prev));
    }, 3000);

    return () => {
      cleanup();
      window.clearTimeout(timeout);
    };
  }, []);

  const longEnough = password.length >= MIN_PASSWORD;
  const match = password === confirm;
  const valid = longEnough && match;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = clientRef.current;
    if (!valid || !sb) return;
    setStatus("submitting");
    setErrorMsg(null);
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    // La sesión del enlace es efímera: se cierra y el usuario entra con la
    // contraseña nueva donde quiera (app o web).
    await sb.auth.signOut();
    setStatus("success");
  }

  return (
    <EntryFrame>
      <Card>
        {status === "verifying" && (
          <>
            <h1 style={{ fontSize: 22 }}>Comprobando el enlace</h1>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
              Un momento mientras verificamos tu enlace de recuperación.
            </p>
            <div className="progress" style={{ marginTop: 18 }}>
              <div className="progress-bar" style={{ width: "33%" }} />
            </div>
          </>
        )}

        {status === "invalid" && (
          <>
            <h1 style={{ fontSize: 22 }}>Enlace caducado o no válido</h1>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
              Por seguridad, los enlaces de recuperación caducan pronto. Vuelve
              a pedir uno desde la app (¿Olvidaste?) o desde la web, y usa el
              último email que recibas.
            </p>
            <div style={{ marginTop: 22, display: "flex", gap: 8 }}>
              <BtnLink href="/entrar" variant="accent">
                Ir a iniciar sesión
              </BtnLink>
              <BtnLink href="/">Inicio</BtnLink>
            </div>
          </>
        )}

        {status === "success" && (
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
            <h1 style={{ fontSize: 22 }}>Contraseña actualizada</h1>
            <p style={{ margin: "8px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
              Abre la app TACTIUM o entra en la web con tu email y tu nueva
              contraseña.
            </p>
            <div style={{ marginTop: 22 }}>
              <BtnLink href="/entrar" variant="accent">
                Iniciar sesión
              </BtnLink>
            </div>
          </>
        )}

        {(status === "ready" || status === "submitting" || status === "error") && (
          <form onSubmit={submit} noValidate>
            <h1 style={{ fontSize: 22 }}>Nueva contraseña</h1>
            <p style={{ margin: "8px 0 20px", fontSize: 13.5, color: "var(--text-muted)" }}>
              Elige una contraseña nueva para tu cuenta. La usarás la próxima
              vez que entres en TACTIUM.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <Field label="Nueva contraseña" hint={`Mínimo ${MIN_PASSWORD} caracteres`}>
                <Input
                  type="password"
                  autoComplete="new-password"
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
              <Field
                label="Repite la contraseña"
                error={confirm.length > 0 && !match ? "Las contraseñas no coinciden" : undefined}
              >
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </Field>
              {status === "error" && errorMsg && <Note tone="error">{errorMsg}</Note>}
              <Btn type="submit" variant="accent" size="lg" block disabled={!valid || status === "submitting"}>
                {status === "submitting" ? "Guardando…" : "Guardar contraseña"}
              </Btn>
            </div>
          </form>
        )}
      </Card>
      <p style={{ margin: "16px 0 0", textAlign: "center", fontSize: 12.5 }}>
        <Link href="/" style={{ color: "var(--text-muted)" }}>
          Volver a tactium.io
        </Link>
      </p>
    </EntryFrame>
  );
}
