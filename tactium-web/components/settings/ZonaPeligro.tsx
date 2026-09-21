"use client";

import { useState } from "react";

import { useSession } from "@/lib/session";
import { deleteMyAccount } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { Btn, Card, CardHead, Field, Input, Modal, Note } from "@/components/ui";
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
      <Card danger flush>
        <CardHead title="Zona de peligro" sub="Acciones que afectan a tu sesión o a tu cuenta." />

        <div className="list-row" style={{ flexWrap: "wrap" }}>
          <span className="list-row-main" style={{ minWidth: 200 }}>
            <span className="list-row-title">Cerrar sesión</span>
            <span className="list-row-sub">Se cierra solo en este navegador.</span>
          </span>
          <Btn onClick={() => void signOut()}>Cerrar sesión</Btn>
        </div>

        <div className="list-row" style={{ flexWrap: "wrap" }}>
          <span className="list-row-main" style={{ minWidth: 200 }}>
            <span className="list-row-title">Eliminar mi cuenta</span>
            <span className="list-row-sub" style={{ maxWidth: "56ch" }}>
              Se borran tus equipos, tus actas y tus estadísticas. No se puede
              deshacer.
            </span>
          </span>
          <Btn variant="danger-ghost" onClick={openDialog}>
            Eliminar mi cuenta
          </Btn>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="borrar-cuenta-titulo"
        title={step === 1 ? "¿Estás seguro?" : "¿Seguro al 100%?"}
        lede={
          step === 1
            ? "Vas a eliminar tu cuenta de TACTIUM y todo lo que has creado con ella."
            : "Escribe tu correo para confirmar. Después no habrá vuelta atrás."
        }
        footer={
          <>
            <Btn onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Btn>
            <Btn
              variant="danger"
              onClick={() => void advance()}
              disabled={!canAdvance || busy}
            >
              {busy
                ? "Eliminando…"
                : step === 1
                  ? "Sí, continuar"
                  : "Eliminar cuenta"}
            </Btn>
          </>
        }
      >
        {step === 2 && (
          <Field label="Escribe tu email" htmlFor="confirmar-email">
            <Input
              id="confirmar-email"
              type="text"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={accountEmail}
              large
              style={{ borderColor: emailOk ? "var(--error)" : undefined }}
            />
          </Field>
        )}

        {error && (
          <div role="alert" style={{ marginTop: step === 2 ? 14 : 0 }}>
            <Note tone="error" icon={<IconAlert size={16} />}>
              No se ha podido eliminar la cuenta: {error}
            </Note>
          </div>
        )}
      </Modal>
    </>
  );
}
