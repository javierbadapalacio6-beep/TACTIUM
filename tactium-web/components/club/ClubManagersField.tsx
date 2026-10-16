"use client";

import { useCallback, useEffect, useState } from "react";

import { Btn, Field, Note } from "@/components/ui";
import { canNativeShare, copyText, whatsappShareUrl } from "@/lib/invite";
import {
  clubInviteMessage,
  createClubInvitation,
  listClubManagers,
  removeClubManager,
  type ClubManager,
} from "@/lib/club-managers";
import { guardedWrite } from "@/lib/writes";

/**
 * Gestores del club (en «Editar club»). Se invita con un código de un solo uso (7 días) por WhatsApp o copiando el
 * enlace. Puede hacer lo mismo que el dueño, salvo borrar el club; el dueño no se puede quitar.
 */
export function ClubManagersField({
  clubId,
  clubName,
  myUserId,
  onLoaded,
}: {
  clubId: string;
  clubName: string;
  myUserId: string | null;
  onLoaded?: (list: ClubManager[]) => void;
}) {
  const [list, setList] = useState<ClubManager[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ code: string; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const l = await listClubManagers(clubId);
      setList(l);
      onLoaded?.(l);
    } catch {
      setList(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);
  useEffect(() => {
    void load();
  }, [load]);

  async function crear() {
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const res = await guardedWrite("invitar a un gestor", () => createClubInvitation(clubId));
    setBusy(false);
    if (!res.ok) {
      setMsg(res.reason);
      return;
    }
    setInvite({ code: res.data.code, text: clubInviteMessage(clubName, res.data.code) });
  }

  async function compartir() {
    if (!invite) return;
    if (canNativeShare()) {
      try {
        await navigator.share({ text: invite.text });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    window.open(whatsappShareUrl(invite.text), "_blank", "noopener,noreferrer");
  }

  async function quitar(m: ClubManager) {
    if (!window.confirm(`¿Quitar a ${m.full_name ?? "este gestor"}? Dejará de gestionar el club y de ser capitán de sus equipos.`))
      return;
    const res = await guardedWrite("quitar al gestor", () => removeClubManager(clubId, m.user_id));
    if (!res.ok) setMsg(res.reason);
    else void load();
  }

  return (
    <Field label="Gestores del club">
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          Invita a otra persona a gestionar el club contigo. Puede hacer lo mismo que tú, salvo borrar el club.
        </div>
        {list && (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, border: "1px solid var(--line)", borderRadius: 10 }}>
            {list.map((m, i) => (
              <li
                key={m.user_id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderTop: i ? "1px solid var(--line)" : undefined,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>
                    {m.full_name ?? m.email ?? "Gestor"}
                    {m.user_id === myUserId ? " (tú)" : ""}
                  </div>
                  {m.email && m.full_name && <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{m.email}</div>}
                </div>
                {m.is_owner ? (
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: 1 }}>
                    DUEÑO
                  </span>
                ) : (
                  <Btn variant="quiet" size="sm" onClick={() => void quitar(m)}>
                    {m.user_id === myUserId ? "Salir" : "Quitar"}
                  </Btn>
                )}
              </li>
            ))}
          </ul>
        )}
        {invite ? (
          <Note tone="accent">
            <div style={{ display: "grid", gap: 8 }}>
              <div>
                Código <span className="mono" style={{ fontWeight: 700 }}>{invite.code}</span> · vale 7 días y para una persona.
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Btn variant="accent" size="sm" onClick={() => void compartir()}>
                  Enviar por WhatsApp
                </Btn>
                <Btn size="sm" onClick={() => void copyText(invite.text)}>
                  Copiar mensaje
                </Btn>
              </div>
            </div>
          </Note>
        ) : (
          <Btn size="sm" disabled={busy} onClick={() => void crear()}>
            {busy ? "Creando…" : "Invitar a un gestor"}
          </Btn>
        )}
        {msg && <Note tone="error">{msg}</Note>}
      </div>
    </Field>
  );
}
