"use client";

import { useEffect, useState } from "react";

import { Btn, Field, Input, Modal } from "@/components/ui";
import { Toast } from "@/components/states";
import { LogoField } from "@/components/LogoField";
import { FederationSelect } from "@/components/entry/start";
import { updateClub } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";
import { FEDERATIONS, type Federation } from "@/lib/federations";

/**
 * Editar club — nombre y federación. La federación usa el mismo selector por
 * botones que el alta (paridad con la app).
 */
export function EditClubModal({
  open,
  onClose,
  clubId,
  initialName,
  initialFederation,
  initialLogo = null,
}: {
  open: boolean;
  onClose: () => void;
  clubId: string;
  initialName: string;
  initialFederation: string | null;
  initialLogo?: string | null;
}) {
  const fedOf = (code: string | null): Federation | null =>
    FEDERATIONS.find((f) => f.code === code) ?? null;

  const [name, setName] = useState(initialName);
  const [federation, setFederation] = useState<Federation | null>(
    fedOf(initialFederation),
  );
  const [logo, setLogo] = useState<string | null>(initialLogo);
  const [logoDirty, setLogoDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Rehidrata al abrir para no arrastrar estado entre aperturas.
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setFederation(fedOf(initialFederation));
    setLogo(initialLogo);
    setLogoDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName, initialFederation, initialLogo]);

  // El escudo se guarda al elegirlo; si cambió, cerrar tiene que recargar.
  const close = () => (logoDirty ? window.location.reload() : onClose());

  const valid = name.trim().length >= 2;

  async function save() {
    if (busy || !valid) return;
    setBusy(true);
    const res = await guardedWrite("guardar el club", () =>
      updateClub(clubId, {
        name: name.trim(),
        federation: federation?.code ?? null,
      }),
    );
    setBusy(false);
    if (res.ok) window.location.reload();
    else setToast(res.reason);
  }

  return (
    <Modal
      open={open}
      onClose={close}
      labelledBy="edit-club"
      width={520}
      title={initialName || "Club"}
      lede="Escudo, nombre y federación del club."
      footer={
        <>
          <Btn onClick={close}>{logoDirty ? "Cerrar" : "Cancelar"}</Btn>
          <Btn variant="accent" disabled={busy || !valid} onClick={save}>
            {busy ? "Guardando…" : "Guardar"}
          </Btn>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Field label="Escudo">
          <LogoField
            kind="club"
            id={clubId}
            value={logo}
            onChange={(url) => {
              setLogo(url);
              setLogoDirty(true);
            }}
            onError={setToast}
          />
        </Field>

        <Field label="Nombre del club" htmlFor="edit-club-name">
          <Input
            id="edit-club-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Club Halcones"
          />
        </Field>

        <Field label="Federación">
          <FederationSelect value={federation} onChange={setFederation} />
        </Field>
      </div>

      {toast && (
        <Toast tone="error" title={toast} onClose={() => setToast(null)} />
      )}
    </Modal>
  );
}
