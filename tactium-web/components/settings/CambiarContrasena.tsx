"use client";

import { useEffect, useState } from "react";

import { useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/client";
import { guardedWrite } from "@/lib/writes";
import { Btn, Card, CardHead, Field, Input, Note } from "@/components/ui";

const MIN_PASSWORD = 6;

/**
 * Cambiar la contraseña con la sesión abierta (antes solo había el enlace del correo).
 * Pide la actual para confirmar que eres tú, y solo sale en cuentas con email y contraseña:
 * quien entra solo con Google o Apple no tiene contraseña que cambiar.
 */
export function CambiarContrasena() {
  const { user } = useSession();
  const [hasPassword, setHasPassword] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;
    supabaseBrowser()
      .auth.getUser()
      .then(({ data }) => {
        if (!alive) return;
        setHasPassword((data.user?.identities ?? []).some((i) => i.provider === "email"));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (!hasPassword || !user?.email) return null;

  const longEnough = next.length >= MIN_PASSWORD;
  const match = next === again;
  const different = next !== current;
  const valid = current.length > 0 && longEnough && match && different;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy || !user?.email) return;
    const email = user.email;
    setBusy(true);
    setError(null);
    setDone(false);
    const res = await guardedWrite("cambiar la contraseña", async () => {
      const sb = supabaseBrowser();
      // Comprobar la actual: así nadie con la sesión abierta en un ordenador ajeno la cambia sin saberla.
      const { error: bad } = await sb.auth.signInWithPassword({ email, password: current });
      if (bad) throw new Error("La contraseña actual no es correcta.");
      const { error: upd } = await sb.auth.updateUser({ password: next });
      if (upd) throw new Error(upd.message);
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.reason);
      return;
    }
    setCurrent("");
    setNext("");
    setAgain("");
    setDone(true);
  }

  return (
    <Card flush>
      <CardHead title="Contraseña" />
      <form onSubmit={submit} className="card-body" style={{ display: "grid", gap: 14, maxWidth: 420 }}>
        <Field label="Contraseña actual">
          <Input
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field label="Contraseña nueva" hint={`Mínimo ${MIN_PASSWORD} caracteres`}>
          <Input
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </Field>
        <Field
          label="Repite la contraseña nueva"
          error={again.length > 0 && !match ? "Las contraseñas no coinciden" : undefined}
        >
          <Input
            type="password"
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
          />
        </Field>
        {next.length > 0 && current.length > 0 && !different && (
          <Note tone="warning">La nueva tiene que ser distinta de la actual.</Note>
        )}
        {error && <Note tone="error">{error}</Note>}
        {done && <Note tone="accent">Contraseña cambiada. Ya puedes entrar con la nueva.</Note>}
        <div>
          <Btn type="submit" variant="accent" disabled={!valid || busy}>
            {busy ? "Guardando…" : "Cambiar contraseña"}
          </Btn>
        </div>
      </form>
    </Card>
  );
}
