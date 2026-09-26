"use client";

import { useState } from "react";

import { useSession } from "@/lib/session";
import { updateClub } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import type { Federation } from "@/lib/federations";
import { FederationSelect } from "@/components/entry/start";
import { Btn, Card, Field, IconTile, Modal, Note } from "@/components/ui";
import { IconUsers } from "@/components/Icon";

/**
 * Espacio de organizador («solo torneos»): la puerta para activar también la
 * gestión de equipos, como en la app. Se desbloquea gratis (montar la
 * estructura es libre); el paywall llega después como empujón. De paso se
 * elige la federación del club, opcional: los equipos la heredan.
 */
export function ActivateTeamsCard() {
  const { clubId, clubs } = useSession();
  const club = clubs.find((c) => c.id === clubId);
  const [open, setOpen] = useState(false);
  const [fed, setFed] = useState<Federation | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!club?.tournamentsOnly) return null;

  async function activate() {
    if (busy || !club) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("activar la gestión de equipos", () =>
      updateClub(club.id, {
        tournaments_only: false,
        federation: fed?.code ?? null,
      }),
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.reason);
      return;
    }
    // Recarga completa: la sesión relee el club y el menú pasa al completo.
    window.location.href = "/club";
  }

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <IconTile>
            <IconUsers size={16} />
          </IconTile>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>¿También gestionas equipos?</div>
            <div style={{ marginTop: 3, fontSize: 13, color: "var(--text-muted)" }}>
              Actívalo y tendrás alineaciones, jornadas y plantillas, sin perder
              tus torneos.
            </div>
          </div>
          <Btn onClick={() => setOpen(true)}>Activar</Btn>
        </div>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        labelledBy="activar-equipos"
        width={520}
        title="Gestiona también tus equipos"
        lede="Si tus equipos juegan liga federada, elige la federación; si no, la dejas en blanco y usarás ligas privadas."
        footer={
          <>
            <Btn onClick={() => setOpen(false)}>Cancelar</Btn>
            <Btn variant="accent" disabled={busy} onClick={activate}>
              {busy ? "Activando…" : "Activar gestión de equipos"}
            </Btn>
          </>
        }
      >
        <Field label="Federación · opcional">
          <FederationSelect value={fed} onChange={setFed} />
        </Field>
        {fed && (
          <Note tone="accent" style={{ marginTop: 12 }}>
            Los equipos heredan la federación; si es la Cántabra, podrás
            importarlos de la Federación con su plantilla.
          </Note>
        )}
        {err && (
          <Note tone="error" style={{ marginTop: 12 }}>
            {err}
          </Note>
        )}
      </Modal>
    </>
  );
}
