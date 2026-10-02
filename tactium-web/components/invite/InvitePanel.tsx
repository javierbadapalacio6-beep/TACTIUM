"use client";

import { useEffect, useRef, useState } from "react";

import {
  createInvitation,
  fetchPlayers,
  fetchTeamInvitations,
  invitationActive,
  rotatePlayerCode,
  type DbInvitation,
  type DbPlayer,
} from "@/lib/queries";
import {
  canNativeShare,
  copyText,
  inviteMessage,
  inviteUrl,
  shareInvite,
  whatsappShareUrl,
} from "@/lib/invite";
import { guardedWrite } from "@/lib/writes";
import { Btn, Chip, Note } from "@/components/ui";
import { Skeleton } from "@/components/states";
import { IconCopy, IconShare, IconUserPlus } from "@/components/Icon";

/**
 * Invitar con enlace: el enlace primero (copiar y compartir), el código como
 * alternativa y, aparte, el código de capitán de un solo uso.
 *
 * Invitar es gratis: aquí no hay muro premium (decisión de producto).
 */
export function InvitePanel({
  teamId,
  teamName,
  players,
  onToast,
  onboarding = false,
  onShared,
  onRosterCount,
}: {
  teamId: string;
  teamName: string;
  /** Plantilla ya cargada (si no, se pide). */
  players?: DbPlayer[] | null;
  onToast?: (msg: string) => void;
  /** Paso final del alta: código grande arriba, sin el bloque de capitán, y
   *  si el equipo aún no tiene enlace de jugador se crea solo. */
  onboarding?: boolean;
  /** Se llama cuando copia o comparte el enlace o el código. */
  onShared?: () => void;
  /** Jugadores activos en la plantilla, cuando se conocen. */
  onRosterCount?: (n: number) => void;
}) {
  const [invites, setInvites] = useState<DbInvitation[] | null>(null);
  const [roster, setRoster] = useState<DbPlayer[] | null>(players ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<"link" | "code" | string | null>(null);
  const [nativeShare, setNativeShare] = useState(false);
  /** Confirmación en línea de «Cambiar código» (el panel suele vivir ya en un
   *  modal: otro diálogo encima cerraría los dos con Escape). */
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const linkRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLSpanElement>(null);

  // La hoja nativa solo se conoce en el navegador: tras montar, sin desajuste
  // de hidratación.
  useEffect(() => setNativeShare(canNativeShare()), []);

  useEffect(() => {
    let alive = true;
    setInvites(null);
    fetchTeamInvitations(teamId)
      .then((r) => alive && setInvites(r))
      .catch(() => alive && setInvites([]));
    return () => {
      alive = false;
    };
  }, [teamId]);

  useEffect(() => {
    if (players) {
      setRoster(players);
      return;
    }
    let alive = true;
    fetchPlayers(teamId)
      .then((r) => alive && setRoster(r))
      .catch(() => alive && setRoster([]));
    return () => {
      alive = false;
    };
  }, [teamId, players]);

  const active = (invites ?? []).filter(invitationActive);
  const playerInvite = active.find((i) => i.role !== "captain") ?? null;
  const captainInvites = active.filter((i) => i.role === "captain");

  const activeRoster = (roster ?? []).filter((p) => p.active);
  const inRoster = activeRoster.length;
  const inApp = activeRoster.filter((p) => !!p.userId).length;

  useEffect(() => {
    if (roster !== null) onRosterCount?.(inRoster);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster, inRoster]);

  function flash(what: string) {
    onShared?.();
    setCopied(what);
    setTimeout(() => setCopied((c) => (c === what ? null : c)), 1800);
  }

  async function generate(role: "player" | "captain") {
    if (busy) return;
    setBusy(true);
    setErr(null);
    const res = await guardedWrite("crear la invitación", () => createInvitation(teamId, role));
    setBusy(false);
    if (res.ok) {
      setInvites((prev) => [res.data, ...(prev ?? []).filter((i) => i.id !== res.data.id)]);
      if (role === "captain") onToast?.(`Código de capitán creado: ${res.data.code}`);
    } else setErr(res.reason);
  }

  // Código nuevo: el anterior deja de valer; quien ya entró, sigue dentro.
  async function rotate() {
    if (rotating || busy) return;
    setRotating(true);
    setErr(null);
    const res = await guardedWrite("cambiar el código", () => rotatePlayerCode(teamId));
    setRotating(false);
    setConfirmRotate(false);
    if (res.ok) {
      setInvites((prev) => [res.data, ...(prev ?? []).filter((i) => i.role === "captain")]);
      setCopied(null);
      onToast?.(`Código nuevo: ${res.data.code}`);
    } else setErr(res.reason);
  }

  // Recién creado el equipo, el enlace tiene que estar ya: se pide una vez.
  const [autoTried, setAutoTried] = useState(false);
  useEffect(() => {
    if (!onboarding || autoTried || invites === null || playerInvite) return;
    setAutoTried(true);
    void generate("player");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onboarding, autoTried, invites, playerInvite]);

  if (invites === null) {
    return (
      <div aria-busy="true" style={{ display: "grid", gap: 10 }}>
        <Skeleton h={14} w="40%" />
        <Skeleton h={40} />
        <Skeleton h={12} w="70%" />
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {playerInvite ? (
        <>
          {onboarding && (
            <div
              style={{
                textAlign: "center",
                padding: "18px 14px",
                borderRadius: 10,
                background: "var(--bg-card-2)",
                border: "1px solid var(--line)",
              }}
            >
              <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Código del equipo</div>
              <span
                ref={codeRef}
                className="mono"
                style={{ display: "block", marginTop: 6, fontSize: 34, fontWeight: 700, letterSpacing: "0.14em" }}
              >
                {playerInvite.code}
              </span>
            </div>
          )}

          {/* El enlace, primero. */}
          <div>
            <label
              htmlFor={`invite-link-${teamId}`}
              style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 }}
            >
              Enlace de invitación
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                ref={linkRef}
                id={`invite-link-${teamId}`}
                className="input mono"
                readOnly
                value={inviteUrl(playerInvite.code)}
                onFocus={(e) => e.currentTarget.select()}
                style={{ flex: 1, minWidth: 0, fontSize: 13 }}
              />
              <Btn
                icon={<IconCopy size={15} />}
                onClick={async () => {
                  const ok = await copyText(inviteUrl(playerInvite.code), linkRef.current);
                  if (ok) flash("link");
                  else onToast?.("Selecciona el enlace y cópialo a mano");
                }}
                aria-label="Copiar enlace"
              >
                {copied === "link" ? "Copiado" : "Copiar"}
              </Btn>
            </div>
          </div>

          {nativeShare ? (
            <Btn
              variant="accent"
              size="lg"
              block
              icon={<IconShare size={16} />}
              onClick={() => {
                onShared?.();
                void shareInvite(teamName, playerInvite.code);
              }}
            >
              Compartir
            </Btn>
          ) : (
            <a
              href={whatsappShareUrl(inviteMessage(teamName, playerInvite.code))}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onShared?.()}
              className="btn btn-accent btn-lg btn-block"
            >
              <IconShare size={16} />
              Enviar por WhatsApp
            </a>
          )}

          {!(onboarding && inRoster === 0) && (
          <div style={{ fontSize: 12.5, color: "var(--text-muted)", textAlign: "center" }}>
            {roster === null ? (
              "Contando la plantilla…"
            ) : (
              <>
                <span className="mono">{inRoster}</span> en la plantilla ·{" "}
                <span className="mono">{inApp}</span> ya en TACTIUM
              </>
            )}
          </div>
          )}

          {/* El código, como alternativa (para quien ya tiene la app). */}
          {!onboarding && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 14px",
              borderRadius: 10,
              background: "var(--bg-card-2)",
              border: "1px solid var(--line)",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)" }}>
                O con el código en la app
              </span>
              <span
                ref={codeRef}
                className="mono"
                style={{ display: "block", marginTop: 2, fontSize: 20, fontWeight: 700, letterSpacing: "0.12em" }}
              >
                {playerInvite.code}
              </span>
            </span>
            <Btn
              size="sm"
              variant="quiet"
              icon={<IconCopy size={14} />}
              onClick={async () => {
                const ok = await copyText(playerInvite.code, codeRef.current);
                if (ok) flash("code");
              }}
              aria-label={`Copiar código ${playerInvite.code}`}
            >
              {copied === "code" ? "Copiado" : "Copiar"}
            </Btn>
          </div>
          )}

          {/* Cambiar código: solo llega aquí un admin del equipo (la RLS de
              team_invitations no enseña el código a nadie más) y la BD lo
              vuelve a comprobar en el RPC. */}
          {!onboarding &&
            (confirmRotate ? (
              <div
                role="group"
                aria-label="Confirmar cambio de código"
                style={{
                  display: "grid",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: 10,
                  border: "1px solid var(--line)",
                }}
              >
                <span style={{ fontSize: 13 }}>
                  El código anterior dejará de funcionar. Quien ya se unió sigue en el equipo.
                </span>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <Btn size="sm" variant="quiet" disabled={rotating} onClick={() => setConfirmRotate(false)}>
                    Cancelar
                  </Btn>
                  <Btn size="sm" variant="danger" disabled={rotating} onClick={() => void rotate()}>
                    {rotating ? "Cambiando…" : "Cambiar código"}
                  </Btn>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <Btn size="sm" variant="quiet" disabled={busy} onClick={() => setConfirmRotate(true)}>
                  Cambiar código
                </Btn>
              </div>
            ))}
        </>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <Note>Aún no hay enlace de invitación para este equipo.</Note>
          <Btn
            variant="accent"
            size="lg"
            block
            disabled={busy}
            icon={<IconUserPlus size={16} />}
            onClick={() => void generate("player")}
          >
            {busy ? "Creando…" : "Crear enlace"}
          </Btn>
        </div>
      )}

      {err && <Note tone="error">{err}</Note>}

      {!onboarding && (
        <div style={{ borderTop: "1px solid var(--line)", paddingTop: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ flex: 1, minWidth: 180 }}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>
                Invitar a otro capitán
              </span>
              <span style={{ display: "block", marginTop: 2, fontSize: 12.5, color: "var(--text-muted)" }}>
                Código de un solo uso para quien te ayude a gestionar.
              </span>
            </span>
            <Btn size="sm" disabled={busy} onClick={() => void generate("captain")}>
              Generar código
            </Btn>
          </div>
          {captainInvites.map((inv) => (
            <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="mono" style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.12em" }}>
                {inv.code}
              </span>
              <Chip tone="mute" plain>
                Capitán
              </Chip>
              <span style={{ flex: 1 }} />
              <Btn
                size="sm"
                variant="quiet"
                icon={<IconCopy size={14} />}
                onClick={async () => {
                  const ok = await copyText(inviteUrl(inv.code));
                  if (ok) flash(inv.id);
                }}
                aria-label={`Copiar enlace de capitán ${inv.code}`}
              >
                {copied === inv.id ? "Copiado" : "Copiar enlace"}
              </Btn>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
