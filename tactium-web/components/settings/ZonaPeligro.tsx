"use client";

import { useState } from "react";

import { useSession } from "@/lib/session";
import { deleteMyAccount } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { IconAlert } from "@/components/Icon";

/**
 * Zona de peligro. Eliminar la cuenta pide DOBLE confirmación, igual que en la
 * app: primero "¿Estás seguro?" y después el correo tecleado a mano. El botón
 * final no se habilita hasta que el texto coincide exactamente.
 */
export function ZonaPeligro() {
  const { signOut, user } = useSession();
  const accountEmail = user?.email ?? "";
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailOk =
    !!accountEmail &&
    typed.trim().toLowerCase() === accountEmail.toLowerCase();
  const canAdvance = step === 1 || emailOk;

  function openDialog() {
    setStep(1);
    setTyped("");
    setError(null);
    setOpen(true);
  }

  async function advance() {
    if (step === 1) {
      setStep(2);
      return;
    }
    if (!emailOk || busy) return;

    setBusy(true);
    setError(null);
    const res = await guardedWrite("eliminar la cuenta", deleteMyAccount);
    setBusy(false);

    if (!res.ok) {
      // El diálogo se queda abierto: si falla, la cuenta sigue viva y el
      // usuario tiene que saberlo. Cerrarlo aquí daría a entender lo contrario.
      setError(res.reason);
      return;
    }

    // La cuenta ya no existe, pero el JWT sigue en memoria apuntando a ella:
    // sin cerrar sesión, la siguiente petición falla de forma rara.
    setOpen(false);
    await signOut();
  }

  return (
    <>
      <Card danger>
        <Eyebrow tone="error">ZONA DE PELIGRO</Eyebrow>

        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            paddingBottom: 20,
            borderBottom: "1px solid var(--hair)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              Cerrar sesión
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: 13,
                color: "var(--text-muted)",
              }}
            >
              Se cierra solo en este navegador.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: "11px 20px", fontSize: 13.5 }}
            onClick={() => void signOut()}
          >
            Cerrar sesión
          </button>
        </div>

        <div
          style={{
            marginTop: 20,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "-0.01em",
              }}
            >
              Eliminar mi cuenta
            </div>
            <div
              style={{
                marginTop: 5,
                fontSize: 13,
                color: "var(--text-muted)",
                maxWidth: "56ch",
                textWrap: "pretty",
              }}
            >
              Se borran tus equipos, tus actas y tus estadísticas. No se puede
              deshacer.
            </div>
          </div>
          <button
            type="button"
            className="btn btn-danger"
            onClick={openDialog}
            style={{ padding: "11px 20px", fontSize: 13.5 }}
          >
            Eliminar mi cuenta
          </button>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="borrar-cuenta-titulo"
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: "var(--error-soft)",
            color: "var(--error)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
          }}
        >
          <IconAlert size={20} />
        </div>

        <h2 id="borrar-cuenta-titulo" style={{ fontSize: 24 }}>
          {step === 1 ? "¿Estás seguro?" : "¿Seguro al 100%?"}
        </h2>
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13.5,
            color: "var(--text-muted)",
            textWrap: "pretty",
          }}
        >
          {step === 1
            ? "Vas a eliminar tu cuenta de TACTIUM y todo lo que has creado con ella."
            : "Escribe tu correo para confirmar. Después no habrá vuelta atrás."}
        </p>

        {step === 2 && (
          <div style={{ marginTop: 20 }}>
            <label
              htmlFor="confirmar-email"
              className="mono"
              style={{
                display: "block",
                fontSize: 10,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--text-faint)",
                marginBottom: 8,
              }}
            >
              Escribe tu email
            </label>
            <input
              id="confirmar-email"
              type="text"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={accountEmail}
              style={{
                width: "100%",
                padding: "13px 15px",
                borderRadius: 12,
                border: `1px solid ${
                  emailOk ? "var(--error)" : "var(--hair-strong)"
                }`,
                background: "var(--bg-card)",
                color: "var(--text)",
                fontSize: 14.5,
                outline: "none",
              }}
            />
          </div>
        )}

        {error && (
          <p
            role="alert"
            style={{
              margin: "18px 0 0",
              padding: "12px 14px",
              borderRadius: 12,
              background: "color-mix(in srgb, var(--error) 12%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 40%, transparent)",
              color: "var(--text)",
              fontSize: 13.5,
            }}
          >
            No se ha podido eliminar la cuenta: {error}
          </p>
        )}

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
            onClick={() => setOpen(false)}
            disabled={busy}
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => void advance()}
            disabled={!canAdvance || busy}
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            {busy
              ? "Eliminando…"
              : step === 1
                ? "Sí, continuar"
                : "Eliminar cuenta"}
          </button>
        </div>
      </Modal>
    </>
  );
}
