"use client";

import { useState } from "react";

import { ACCOUNT_EMAIL } from "@/lib/account-data";
import { Card, Eyebrow, Modal } from "@/components/ui";
import { IconAlert } from "@/components/Icon";

/**
 * Zona de peligro. Eliminar la cuenta pide DOBLE confirmación, igual que en la
 * app: primero "¿Estás seguro?" y después el correo tecleado a mano. El botón
 * final no se habilita hasta que el texto coincide exactamente.
 */
export function ZonaPeligro() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");

  const emailOk = typed.trim().toLowerCase() === ACCOUNT_EMAIL.toLowerCase();
  const canAdvance = step === 1 || emailOk;

  function openDialog() {
    setStep(1);
    setTyped("");
    setOpen(true);
  }

  function advance() {
    if (step === 1) {
      setStep(2);
      return;
    }
    if (!emailOk) return;
    // Aquí irá la llamada al RPC `delete_my_account`.
    setOpen(false);
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
              placeholder={ACCOUNT_EMAIL}
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
            style={{ padding: "12px 20px", fontSize: 13.5 }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={advance}
            disabled={!canAdvance}
            style={{ padding: "12px 22px", fontSize: 13.5 }}
          >
            {step === 1 ? "Sí, continuar" : "Eliminar cuenta"}
          </button>
        </div>
      </Modal>
    </>
  );
}
