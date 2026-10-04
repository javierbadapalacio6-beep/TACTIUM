"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  claimCasualParticipant,
  getClaimableParticipants,
  type ClaimableParticipant,
} from "@/lib/account-queries";
import { guardedWrite } from "@/lib/writes";
import { Btn, Card, Field, Input, ListRow, Modal } from "@/components/ui";
import { Toast } from "@/components/states";

const TEAM_CODE_LEN = 8;
const NOT_FOUND = "Ese código no existe o ya está reclamado.";
const GENERIC = "No hemos podido comprobar el código. Revisa tu conexión e inténtalo otra vez.";

/**
 * Canjear un código en la propia pantalla (igual que en la app).
 *
 *  · `casual`: código de partido (6 caracteres) → eliges tu nombre en ese
 *    partido y pasa a tus números.
 *  · `any`: además acepta el código de un equipo (8) y lleva a `/i/CÓDIGO`,
 *    la vista previa de la invitación que ya existe.
 *
 * Los errores van en lenguaje normal: nunca el mensaje crudo del servidor.
 */
export function CodeRedeem({
  mode = "casual",
  onClaimed,
}: {
  mode?: "casual" | "any";
  onClaimed?: () => void;
}) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parts, setParts] = useState<ClaimableParticipant[] | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const clean = code.trim().toUpperCase();

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (clean.length < 4 || busy) return;
    setError(null);
    if (mode === "any" && clean.length === TEAM_CODE_LEN) {
      router.push(`/i/${clean}`);
      return;
    }
    setBusy(true);
    try {
      const list = await getClaimableParticipants(clean);
      if (list.length === 0) {
        setError(
          mode === "any" && clean.length !== 6
            ? "Ese código no existe. Los de partido tienen 6 caracteres y los de equipo, 8."
            : NOT_FOUND,
        );
      } else setParts(list);
    } catch {
      setError(GENERIC);
    } finally {
      setBusy(false);
    }
  }

  async function claim(p: ClaimableParticipant) {
    if (claiming) return;
    setClaiming(p.participant_id);
    const res = await guardedWrite("reclamar el partido", () =>
      claimCasualParticipant(clean, p.participant_id),
    );
    setClaiming(null);
    if (res.ok && res.data) {
      setParts(null);
      setCode("");
      setToast("Partido reclamado: ya cuenta en tus números");
      onClaimed?.();
    } else if (res.ok) {
      setToast(NOT_FOUND);
    } else {
      setToast(res.blocked ? res.reason : GENERIC);
    }
  }

  return (
    <Card>
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          {mode === "any" ? "¿Te han pasado un código?" : "¿Te han pasado un código de partido?"}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 180 }}>
            <Field
              label="Código"
              htmlFor={`codigo-${mode}`}
              hint={
                error
                  ? undefined
                  : mode === "any"
                    ? "Un partido pasa a tus números; un equipo te une a su plantilla."
                    : "Elige tu nombre en ese partido y contará en tus números."
              }
              error={error ?? undefined}
            >
              <Input
                id={`codigo-${mode}`}
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, TEAM_CODE_LEN).toUpperCase())
                }
                placeholder={mode === "any" ? "Código de partido o de equipo" : "K7M2XQ"}
                autoComplete="off"
                className="mono"
                style={{ letterSpacing: "0.12em" }}
              />
            </Field>
          </div>
          <Btn type="submit" variant="accent" disabled={clean.length < 4 || busy}>
            {busy ? "Comprobando…" : mode === "any" ? "Usar" : "Canjear"}
          </Btn>
        </div>
      </form>

      <Modal
        open={parts !== null}
        onClose={() => setParts(null)}
        labelledBy="quien-eres"
        title="¿Quién eres tú?"
        lede="Elige tu nombre en ese partido. A partir de ahí contará en tus números."
        footer={<Btn onClick={() => setParts(null)}>Cancelar</Btn>}
      >
        <div>
          {(parts ?? []).map((p) => (
            <ListRow
              key={p.participant_id}
              title={p.name}
              chevron={false}
              right={
                <Btn
                  size="sm"
                  variant="tint"
                  disabled={!!claiming}
                  onClick={() => void claim(p)}
                >
                  {claiming === p.participant_id ? "Guardando…" : "Soy yo"}
                </Btn>
              }
            />
          ))}
        </div>
      </Modal>

      {toast && <Toast title={toast} onClose={() => setToast(null)} />}
    </Card>
  );
}
