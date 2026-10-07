"use client";

import { useState } from "react";

import { createInvitation } from "@/lib/queries";
import { shareInvite } from "@/lib/invite";
import { useAsync } from "@/lib/use-async";
import { guardedWrite } from "@/lib/writes";
import {
  CAPTAIN_SEATS,
  demoteTeamCaptain,
  fetchTeamCaptainCoverage,
  formatCoverDate,
  type TeamCaptain,
} from "@/lib/team-captains";
import { Avatar, Btn, BtnLink, Card, CardHead, Chip, ListRow, Modal, Note } from "@/components/ui";
import { IconPlus } from "@/components/Icon";

function initials(name: string | null): string {
  return (
    (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "·"
  );
}

/**
 * Bloque «Capitanes · 2 de 3» (equipos independientes). Misma lógica que la
 * app (`CaptainSeatsCard`): el plan Capitán cubre a TODOS los capitanes del
 * equipo, hasta 3 (un plan, un solo equipo).
 *
 * Patrones (Mobbin): cabecera con plazas usadas — Featurebase «Team members»
 * y Tolan «Family · 5 seats left»; huecos libres como fila con «+» — Tolan
 * «Add a member»; rol bajo el nombre — Instacart «Your family»; quitar con
 * confirmación nombrando a la persona — Mesh «Are you sure you want to
 * remove…»; estado sin plan con el límite explicado — CLEAR «Manage Family».
 */
export function CaptainSeats({
  teamId,
  teamName,
  userId,
  onChanged,
  onToast,
}: {
  teamId: string;
  teamName: string;
  userId: string | null;
  onChanged?: () => void;
  onToast: (msg: string) => void;
}) {
  const [reload, setReload] = useState(0);
  const { data: cov } = useAsync(() => fetchTeamCaptainCoverage(teamId), [teamId, reload], !!teamId);
  const [confirm, setConfirm] = useState<TeamCaptain | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!cov) return null;

  const count = cov.captain_count;
  const free = Math.max(0, CAPTAIN_SEATS - count);
  const ownerId = cov.captains.find((c) => c.is_owner)?.user_id ?? null;
  const canRemove = !!userId && (userId === ownerId || userId === cov.payer_user_id);
  const until = formatCoverDate(cov.period_end);

  async function addCaptain() {
    if (sharing) return;
    setSharing(true);
    const res = await guardedWrite("crear el código de capitán", () => createInvitation(teamId, "captain"));
    setSharing(false);
    if (!res.ok) {
      onToast(res.reason);
      return;
    }
    await shareInvite(teamName, res.data.code, "captain");
  }

  async function remove() {
    if (!confirm || busy) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("quitar al capitán", () => demoteTeamCaptain(teamId, confirm.user_id));
    setBusy(false);
    if (!res.ok) {
      setErr(res.reason);
      return;
    }
    onToast(`${confirm.name ?? "El capitán"} ya es jugador. Su plaza queda libre.`);
    setConfirm(null);
    setReload((k) => k + 1);
    onChanged?.();
  }

  function sub(c: TeamCaptain): string {
    if (c.is_payer) return until ? `Cubre a todos hasta ${until}` : "Cubre a todos";
    if (c.is_owner) return "Dueño del equipo";
    return cov!.covered ? "Capitán · con Pro" : "Capitán";
  }

  return (
    <section style={{ marginBottom: 16 }}>
      <Card flush>
        <CardHead
          title="Capitanes"
          count={`${count} de ${CAPTAIN_SEATS}`}
          sub={cov.covered ? "Un solo plan Capitán cubre a todos" : "Hasta 3 por equipo"}
        >
          {cov.covered && <Chip tone="accent">Pro</Chip>}
        </CardHead>

        {cov.captains.map((c) => {
          const isMe = c.user_id === userId;
          return (
            <ListRow
              key={c.user_id}
              icon={<Avatar initials={initials(c.name)} src={c.avatar_url} size={34} />}
              title={
                <>
                  {c.name ?? "Sin nombre"}
                  {isMe && <span style={{ color: "var(--text-faint)", fontWeight: 500 }}> (tú)</span>}
                </>
              }
              sub={sub(c)}
              right={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  {c.is_payer && <Chip tone="accent" plain>Paga el plan</Chip>}
                  {canRemove && !c.is_owner && !isMe && (
                    <Btn size="sm" variant="quiet" onClick={() => setConfirm(c)}>
                      Quitar
                    </Btn>
                  )}
                </span>
              }
            />
          );
        })}

        {Array.from({ length: free }).map((_, i) => (
          <ListRow
            key={`free-${i}`}
            onClick={addCaptain}
            icon={
              <span
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  border: "1.5px dashed var(--accent-40)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                  flex: "none",
                }}
              >
                <IconPlus size={15} />
              </span>
            }
            title={<span style={{ color: "var(--accent)" }}>{sharing && i === 0 ? "Creando el código…" : "Añadir capitán"}</span>}
            sub={cov.covered ? "Entra con Pro, sin pagar nada" : "Código de un solo uso · 7 días"}
          />
        ))}

        {count > CAPTAIN_SEATS && (
          <div className="card-body">
            <Note tone="warning">
              Sois {count}: no se pueden añadir más hasta bajar de {CAPTAIN_SEATS}.
            </Note>
          </div>
        )}

        {!cov.covered && (
          <div className="card-body" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 220, fontSize: 13.5, color: "var(--text-muted)" }}>
              Con el plan Capitán, los {CAPTAIN_SEATS} capitanes tienen todas las funciones.
            </span>
            <BtnLink href="/pro?para=capitan" size="sm">
              Ver el plan
            </BtnLink>
          </div>
        )}
      </Card>

      <Modal
        open={!!confirm}
        onClose={() => !busy && setConfirm(null)}
        labelledBy="quitar-capitan"
        width={420}
        title={`¿Quitar a ${confirm?.name ?? "este capitán"} como capitán?`}
        lede="Pasa a jugador: sigue en el equipo, pero ya no gestiona jornadas ni alineaciones. Su plaza queda libre."
        footer={
          <>
            <Btn onClick={() => setConfirm(null)} disabled={busy}>
              Cancelar
            </Btn>
            <Btn variant="danger" onClick={remove} disabled={busy}>
              {busy ? "Quitando…" : "Quitar"}
            </Btn>
          </>
        }
      >
        {err ? <Note tone="error">{err}</Note> : null}
      </Modal>
    </section>
  );
}
