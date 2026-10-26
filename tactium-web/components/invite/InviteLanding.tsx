"use client";

import { useEffect, useState, type ReactNode } from "react";

import {
  INVITE_APP_STORE_URL,
  INVITE_PLAY_STORE_URL,
  inviteDeepLink,
  normalizeInviteCode,
} from "@/lib/invite";
import { useSession } from "@/lib/session";
import { Btn, Card, Note } from "@/components/ui";
import { Skeleton } from "@/components/states";
import { previewClubInvitation, redeemClubInvitation, type ClubInvitationPreview } from "@/lib/club-managers";
import { IconCheck, IconSmartphone } from "@/components/Icon";
import {
  InvalidInvite,
  InvitePreviewCard,
  JoinInvite,
  useInvitePreview,
} from "@/components/invite/InviteJoin";

const ACTIVE_TEAM_KEY = "tactium-active-team";

/** Contenido de `/i/[code]`: vista previa + abrir la app + unirse por web. */
export function InviteLanding({ code: rawCode }: { code: string }) {
  const code = normalizeInviteCode(rawCode);
  const state = useInvitePreview(code, 1, 0);
  const { user, teams } = useSession();
  const [joining, setJoining] = useState(false);
  // Código de GESTOR de club: si no es de equipo, se prueba como de club.
  const [club, setClub] = useState<Extract<ClubInvitationPreview, { valid: true }> | null>(null);
  const [clubBusy, setClubBusy] = useState(false);
  const [clubErr, setClubErr] = useState<string | null>(null);
  useEffect(() => {
    if (state.status !== "ready" || state.preview.valid || state.preview.reason !== "not_found") return;
    let alive = true;
    previewClubInvitation(code)
      .then((p) => alive && p.valid && setClub(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [state, code]);

  async function aceptarClub() {
    setClubBusy(true);
    setClubErr(null);
    try {
      await redeemClubInvitation(code);
      window.location.href = "/club";
    } catch (e) {
      setClubErr(e instanceof Error ? e.message : "No se pudo aceptar");
      setClubBusy(false);
    }
  }

  function goLogin() {
    const next = `/i/${encodeURIComponent(code)}`;
    // El login con Google vuelve por /auth/callback, que lee el destino de
    // esta cookie; el de email/contraseña, del `?next=`.
    document.cookie = `tactium_next=${encodeURIComponent(next)}; path=/; max-age=1800; samesite=lax`;
    window.location.href = `/entrar?next=${encodeURIComponent(next)}`;
  }

  let body: ReactNode;
  if (state.status === "idle" || state.status === "loading") {
    body = (
      <div aria-busy="true" style={{ display: "grid", gap: 12 }}>
        <Skeleton h={11} w={140} />
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Skeleton h={64} w={64} r={18} />
          <div style={{ flex: 1, display: "grid", gap: 8 }}>
            <Skeleton h={22} w="60%" />
            <Skeleton h={12} w="80%" />
          </div>
        </div>
        <Skeleton h={70} />
      </div>
    );
  } else if (state.status === "error") {
    body = <Note tone="error">No se pudo cargar la invitación: {state.message}</Note>;
  } else if (!state.preview.valid && club) {
    body = (
      <div style={{ display: "grid", gap: 16, textAlign: "center" }}>
        <div className="mono" style={{ fontSize: 11, letterSpacing: 2, fontWeight: 700, color: "var(--accent)" }}>
          INVITACIÓN DE GESTOR
        </div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>{club.club.name}</div>
        <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 14 }}>
          {club.invited_by ? `${club.invited_by} te invita` : "Te invitan"} a gestionar el club contigo
          {club.teams_count > 0 ? ` (${club.teams_count} equipos)` : ""}: horarios de local, torneos y todo lo que puede
          hacer el dueño, salvo borrar el club.
        </p>
        <Btn size="lg" block disabled={clubBusy} onClick={() => (user ? void aceptarClub() : goLogin())}>
          {user ? (clubBusy ? "Aceptando…" : "Aceptar y gestionar el club") : "Entrar para aceptar"}
        </Btn>
        {clubErr && <Note tone="error">{clubErr}</Note>}
      </div>
    );
  } else if (!state.preview.valid) {
    body = <InvalidInvite reason={state.preview.reason} />;
  } else {
    const p = state.preview;
    const member = !!user && teams.some((t) => t.id === p.team.id);
    body = (
      <div style={{ display: "grid", gap: 20 }}>
        <InvitePreviewCard preview={p} />

        {member ? (
          <Note tone="accent" icon={<IconCheck size={16} />}>
            <span style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 180 }}>Ya estás en este equipo</span>
              <Btn
                variant="accent"
                size="sm"
                onClick={() => {
                  try {
                    localStorage.setItem(ACTIVE_TEAM_KEY, p.team.id);
                  } catch {
                    /* sin persistencia */
                  }
                  window.location.href = "/equipo";
                }}
              >
                Ir a mi equipo
              </Btn>
            </span>
          </Note>
        ) : (
          <>
            <div style={{ display: "grid", gap: 10 }}>
              <a href={inviteDeepLink(code)} className="btn btn-accent btn-lg btn-block">
                <IconSmartphone size={16} />
                Abrir en la app
              </a>
              <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 8 }}>
                <a
                  href={INVITE_APP_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                >
                  App Store
                </a>
                <a
                  href={INVITE_PLAY_STORE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost"
                >
                  Google Play
                </a>
              </div>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>
                ¿Aún no tienes la app? Descárgala y abre de nuevo este enlace, o
                entra con el código <span className="mono">{code}</span>.
              </p>
            </div>

            <div style={{ borderTop: "1px solid var(--line)", paddingTop: 18 }}>
              {!joining ? (
                <Btn
                  size="lg"
                  block
                  onClick={() => (user ? setJoining(true) : goLogin())}
                >
                  {user ? "Unirme desde la web" : "Entrar para unirme"}
                </Btn>
              ) : (
                <JoinInvite code={code} preview={p} />
              )}
              {!user && (
                <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-faint)", textAlign: "center" }}>
                  Entra o crea tu cuenta y te llevamos de vuelta aquí.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="tw-page-narrow">
      <Card>{body}</Card>
    </div>
  );
}
