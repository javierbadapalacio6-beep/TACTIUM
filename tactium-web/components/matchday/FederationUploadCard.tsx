"use client";

import { useState } from "react";

import { Btn, Card } from "@/components/ui";
import { Toast } from "@/components/states";
import { IconCheck, IconClock } from "@/components/Icon";
import { fetchFcpUpload, setFcpUploaded } from "@/lib/club-ops";
import { guardedWrite } from "@/lib/writes";
import { useAsync } from "@/lib/use-async";

const pad = (n: number) => String(n).padStart(2, "0");
const whenLabel = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)} a las ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * «Subido a la Federación». La hora de los partidos de local la sube a la web de la Federación el capitán, antes del
 * lunes a las 20:00. Aquí se marca: queda anotado, deja de salir en los recordatorios del lunes y se avisa al club.
 * Solo se pinta en partidos de local de la Federación Cántabra por jugar. Espejo de la tarjeta de la app.
 */
export function FederationUploadCard({ matchdayId, canManage }: { matchdayId: string; canManage: boolean }) {
  const [nonce, setNonce] = useState(0);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const { data } = useAsync(() => fetchFcpUpload(matchdayId), [matchdayId, nonce]);

  if (!data || !data.applies) return null;
  const done = !!data.uploadedAt;
  if (!done && !canManage) return null;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("marcar como subido a la Federación", () => setFcpUploaded([matchdayId], !done));
    setBusy(false);
    if (!res.ok) {
      setToast(res.reason);
      return;
    }
    setNonce((n) => n + 1);
    if (!done) setToast("Marcado como subido. Hemos avisado al club y a los capitanes.");
  }

  return (
    <Card>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <span
          aria-hidden="true"
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            flex: "none",
            display: "grid",
            placeItems: "center",
            background: done ? "var(--accent)" : "var(--accent-10)",
            color: done ? "var(--text-inverse)" : "var(--accent)",
          }}
        >
          {done ? <IconCheck size={13} /> : <IconClock size={14} />}
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{done ? "Subido a la Federación" : "¿Ya está en la Federación?"}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 2 }}>
            {done
              ? `Marcado el ${whenLabel(data.uploadedAt!)}.`
              : "La hora de los partidos de local se sube a la web de la Federación antes del lunes a las 20:00. Cuando la subas, márcalo y avisamos al club."}
          </div>
        </div>
        {canManage && (
          <Btn variant={done ? "ghost" : "accent"} size="sm" disabled={busy} onClick={() => void toggle()}>
            {done ? "Quitar la marca" : "Marcar como subido"}
          </Btn>
        )}
      </div>
      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </Card>
  );
}
