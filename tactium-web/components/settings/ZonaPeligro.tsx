"use client";

import { useState } from "react";

import { useSession } from "@/lib/session";
import { deleteMyAccount } from "@/lib/queries";
import { fetchMyStoreSubscription } from "@/lib/account-queries";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import { Btn, Card, CardHead, Modal, Note } from "@/components/ui";
import { IconAlert, IconX } from "@/components/Icon";

/**
 * Salir y eliminar la cuenta. Borrar va en UNA ventana que explica qué se
 * pierde según el rol (como en la app), en vez de dos confirmaciones
 * seguidas. Si hay una suscripción de tienda viva, se avisa de que borrar la
 * cuenta no la cancela.
 */
export function ZonaPeligro() {
  const { signOut, teams, clubs } = useSession();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: storeSub } = useAsync(() => fetchMyStoreSubscription(), [open], open);

  const ownedTeams = teams.filter(
    (t) => (t.role === "captain" || t.role === "admin") && !t.clubId,
  );
  const losses = [
    "Tu perfil, tu foto y tus amistosos",
    ...clubs.map((c) => `${c.name}, con sus equipos`),
    ...ownedTeams.map((t) => `${t.name}, con sus jornadas y alineaciones`),
    "Tus invitaciones pendientes",
  ];

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await guardedWrite("eliminar la cuenta", deleteMyAccount);
    setBusy(false);
    if (!res.ok) {
      // El diálogo se queda abierto: si falla, la cuenta sigue viva.
      setError(
        res.blocked
          ? res.reason
          : "Tu cuenta sigue activa. Inténtalo de nuevo o escríbenos a hola@tactium.io.",
      );
      return;
    }
    // La cuenta ya no existe, pero el JWT sigue en memoria: se cierra sesión.
    setOpen(false);
    await signOut();
  }

  return (
    <>
      <Card flush>
        <CardHead title="Salir" />
        <div className="list-row" style={{ flexWrap: "wrap" }}>
          <span className="list-row-main" style={{ minWidth: 200 }}>
            <span className="list-row-title">Cerrar sesión</span>
            <span className="list-row-sub">Se cierra solo en este navegador.</span>
          </span>
          <Btn onClick={() => void signOut()}>Cerrar sesión</Btn>
        </div>
        <div className="list-row" id="eliminar" style={{ flexWrap: "wrap" }}>
          <span className="list-row-main" style={{ minWidth: 200 }}>
            <span className="list-row-title" style={{ color: "var(--error)" }}>
              Eliminar cuenta
            </span>
            <span className="list-row-sub">Se borra para siempre. Antes te contamos qué se pierde.</span>
          </span>
          <Btn
            variant="danger-ghost"
            onClick={() => {
              setError(null);
              setOpen(true);
            }}
          >
            Eliminar cuenta
          </Btn>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => (busy ? undefined : setOpen(false))}
        labelledBy="borrar-cuenta-titulo"
        title="¿Eliminar tu cuenta?"
        lede="Se borra para siempre y no se puede deshacer:"
        footer={
          <>
            <Btn onClick={() => setOpen(false)} disabled={busy}>
              Volver
            </Btn>
            <Btn variant="danger" onClick={() => void confirm()} disabled={busy}>
              {busy ? "Eliminando…" : "Eliminar mi cuenta"}
            </Btn>
          </>
        }
      >
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {losses.map((l) => (
            <li key={l} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13.5 }}>
              <span style={{ color: "var(--error)", display: "flex", marginTop: 2 }}>
                <IconX size={14} />
              </span>
              {l}
            </li>
          ))}
        </ul>

        {storeSub && (
          <div style={{ marginTop: 14 }}>
            <Note tone="warning" icon={<IconAlert size={16} />}>
              <span style={{ display: "block", fontWeight: 700, color: "var(--text)" }}>
                Tu suscripción no se cancela sola
              </span>
              La pagas en {storeSub === "ios" ? "App Store" : "Google Play"}: cancélala allí desde
              el móvil. Borrar la cuenta no la cancela.
            </Note>
          </div>
        )}

        {error && (
          <div role="alert" style={{ marginTop: 14 }}>
            <Note tone="error" icon={<IconAlert size={16} />}>
              No se ha podido eliminar la cuenta. {error}
            </Note>
          </div>
        )}
      </Modal>
    </>
  );
}
