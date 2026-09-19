"use client";

import { useEffect, useState } from "react";

import { Eyebrow, Modal } from "@/components/ui";
import { Toast } from "@/components/states";
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
}: {
  open: boolean;
  onClose: () => void;
  clubId: string;
  initialName: string;
  initialFederation: string | null;
}) {
  const fedOf = (code: string | null): Federation | null =>
    FEDERATIONS.find((f) => f.code === code) ?? null;

  const [name, setName] = useState(initialName);
  const [federation, setFederation] = useState<Federation | null>(
    fedOf(initialFederation),
  );
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Rehidrata al abrir para no arrastrar estado entre aperturas.
  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setFederation(fedOf(initialFederation));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialName, initialFederation]);

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
    <Modal open={open} onClose={onClose} labelledBy="edit-club" width={520}>
      <Eyebrow>EDITAR CLUB</Eyebrow>
      <h2 id="edit-club" style={{ margin: "10px 0 6px", fontSize: 23 }}>
        {initialName || "Club"}
      </h2>
      <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "var(--text-muted)" }}>
        Cambia el nombre del club o su federación.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <label>
          <span
            className="mono"
            style={{
              display: "block",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "var(--text-faint)",
              marginBottom: 7,
            }}
          >
            NOMBRE DEL CLUB
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Club Halcones"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: "1px solid var(--hair-strong)",
              background: "var(--bg-card)",
              color: "var(--text)",
              fontSize: 14,
              outline: "none",
              fontFamily: "'Satoshi', sans-serif",
            }}
          />
        </label>

        <div>
          <span
            className="mono"
            style={{
              display: "block",
              fontSize: 10,
              letterSpacing: "0.2em",
              color: "var(--text-faint)",
              marginBottom: 7,
            }}
          >
            FEDERACIÓN
          </span>
          <FederationSelect value={federation} onChange={setFederation} />
        </div>
      </div>

      <div
        style={{
          marginTop: 24,
          display: "flex",
          justifyContent: "flex-end",
          gap: 10,
        }}
      >
        <button
          className="btn btn-ghost"
          onClick={onClose}
          style={{ padding: "12px 20px", fontSize: 13.5 }}
        >
          Cancelar
        </button>
        <button
          className="btn btn-accent"
          disabled={busy || !valid}
          onClick={save}
          style={{ padding: "12px 22px", fontSize: 13.5 }}
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>

      {toast && (
        <Toast tone="error" title={toast} onClose={() => setToast(null)} />
      )}
    </Modal>
  );
}
