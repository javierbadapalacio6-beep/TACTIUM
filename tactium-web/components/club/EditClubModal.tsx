"use client";

import { useEffect, useState } from "react";

import { Btn, Field, Input, Modal, Note } from "@/components/ui";
import { Toast } from "@/components/states";
import { LogoField } from "@/components/LogoField";
import { FederationSelect } from "@/components/entry/start";
import { deleteClub, updateClub } from "@/lib/queries";
import { READ_ONLY_MESSAGE, WRITES_ENABLED, guardedWrite } from "@/lib/writes";
import { FEDERATIONS, type Federation } from "@/lib/federations";

/**
 * Editar club — escudo, nombre y federación, y «Borrar club» (que antes
 * estaba en la portada del panel: es irreversible y no pinta nada en Inicio). La federación usa el mismo selector por
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
  // Borrar club: confirmación fuerte escribiendo el nombre exacto.
  const [deleting, setDeleting] = useState(false);
  const [typed, setTyped] = useState("");
  const nameOk = typed.trim() === initialName;

  async function doDelete() {
    if (busy || !nameOk) return;
    setBusy(true);
    const res = await guardedWrite("borrar el club", () => deleteClub(clubId));
    setBusy(false);
    if (res.ok) window.location.href = "/";
    else setToast(res.reason);
  }

  // Rehidrata al abrir para no arrastrar estado entre aperturas.
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setFederation(fedOf(initialFederation));
    setLogo(initialLogo);
    setLogoDirty(false);
    setDeleting(false);
    setTyped("");
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
        deleting ? (
          <>
            <Btn onClick={() => setDeleting(false)}>Cancelar</Btn>
            <Btn variant="danger" disabled={!nameOk || !WRITES_ENABLED || busy} onClick={() => void doDelete()}>
              {busy ? "Borrando…" : "Borrar club"}
            </Btn>
          </>
        ) : (
          <>
            <Btn onClick={close}>{logoDirty ? "Cerrar" : "Cancelar"}</Btn>
            <Btn variant="accent" disabled={busy || !valid} onClick={save}>
              {busy ? "Guardando…" : "Guardar"}
            </Btn>
          </>
        )
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

        {/* Zona de peligro */}
        <div className="divider" style={{ margin: "4px 0" }} />
        {!deleting ? (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Borrar club</div>
              <div style={{ marginTop: 3, fontSize: 12.5, color: "var(--text-muted)" }}>
                Se eliminan el club, sus equipos, sus jornadas y sus actas. No se puede deshacer.
              </div>
            </div>
            <Btn variant="danger-ghost" onClick={() => setDeleting(true)}>
              Borrar club
            </Btn>
          </div>
        ) : (
          <Field label={`Escribe «${initialName}» para confirmar`} htmlFor="edit-club-delete">
            <Input
              id="edit-club-delete"
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={initialName}
              style={{ borderColor: nameOk ? "var(--error)" : undefined }}
            />
            {!WRITES_ENABLED && (
              <Note tone="warning" style={{ marginTop: 10 }}>
                {READ_ONLY_MESSAGE}
              </Note>
            )}
          </Field>
        )}
      </div>

      {toast && (
        <Toast tone="error" title={toast} onClose={() => setToast(null)} />
      )}
    </Modal>
  );
}
