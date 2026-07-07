"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { Reveal } from "@/app/app/ui/Reveal";

// Códigos de invitación de jugadores. Réplica de InvitePlayersSheet +
// invitations.ts:
//   - createInvitation → RPC create_team_invitation(target_team, target_role:'player')
//   - revokeInvitation → delete en team_invitations
//   - fetchTeamInvitations + merge de profiles (redeemer) por used_by
// La BD genera el code y valida is_team_admin. Adaptación web: compartir
// por Web Share API si existe, si no copiar al portapapeles.

interface Invitation {
  id: string;
  code: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
}
interface Redeemer {
  id: string;
  full_name: string | null;
  email: string | null;
}

const isActive = (i: Invitation) =>
  i.used_at === null && new Date(i.expires_at) > new Date();

const fmtExpiry = (iso: string) => {
  const d = new Date(iso);
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days <= 0) return "hoy";
  if (days === 1) return "mañana";
  if (days < 30) return `en ${days} días`;
  return `el ${d.getDate()}/${d.getMonth() + 1}`;
};
const fmtRedeemed = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return "unido hoy";
  if (days === 1) return "unido ayer";
  if (days < 30) return `unido hace ${days} días`;
  return `unido el ${d.getDate()}/${d.getMonth() + 1}`;
};

export default function InvitePage() {
  const params = useParams<{ id: string }>();
  const teamId = params.id;
  const session = useSession();

  const [teamName, setTeamName] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [redeemers, setRedeemers] = useState<Record<string, Redeemer>>({});
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const sb = getSupabaseApp();
    const invs = await sb
      .from("team_invitations")
      .select("id, code, expires_at, used_at, used_by, created_at")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false });
    if (invs.error) throw invs.error;
    const list = (invs.data ?? []) as Invitation[];
    setInvitations(list);

    const ids = Array.from(
      new Set(list.map((i) => i.used_by).filter((u): u is string => !!u)),
    );
    if (ids.length) {
      const prof = await sb
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      const map: Record<string, Redeemer> = {};
      (prof.data ?? []).forEach((p) => {
        map[(p as Redeemer).id] = p as Redeemer;
      });
      setRedeemers(map);
    }
  };

  useEffect(() => {
    if (!teamId) return;
    const sb = getSupabaseApp();
    (async () => {
      try {
        const team = await sb
          .from("teams")
          .select("name, owner_id")
          .eq("id", teamId)
          .single();
        if (team.error) throw team.error;
        const t = team.data as { name: string; owner_id: string };
        setTeamName(t.name);
        setCanEdit(t.owner_id === session.user.id);
        await load();
      } catch (e) {
        setError((e as { message?: string })?.message ?? "No se pudo cargar.");
        setInvitations([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, session.user.id]);

  const shareMessage = (code: string) =>
    `Únete como jugador a "${teamName ?? "el equipo"}" en TACTIUM con este código: ${code}`;

  const handleShare = async (code: string) => {
    const text = shareMessage(code);
    const nav = navigator as Navigator & {
      share?: (d: { text: string }) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ text });
        return;
      } catch {
        /* cancelado */
      }
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((c) => (c === code ? null : c)), 1800);
    } catch {
      /* sin clipboard */
    }
  };

  const handleCreate = async () => {
    if (!teamId || generating || !canEdit) return;
    setGenerating(true);
    setError(null);
    try {
      const { data, error: e } = await getSupabaseApp().rpc(
        "create_team_invitation",
        { target_team: teamId, target_role: "player" },
      );
      if (e) throw e;
      const inv = data as unknown as Invitation;
      setInvitations((list) => [inv, ...(list ?? [])]);
      void handleShare(inv.code);
    } catch (e) {
      setError(
        (e as { message?: string })?.message ?? "No se pudo generar el código.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (inv: Invitation) => {
    if (!canEdit) return;
    try {
      const { error: e } = await getSupabaseApp()
        .from("team_invitations")
        .delete()
        .eq("id", inv.id);
      if (e) throw e;
      setInvitations((list) => (list ?? []).filter((i) => i.id !== inv.id));
    } catch (e) {
      setError((e as { message?: string })?.message ?? "No se pudo revocar.");
    }
  };

  const active = (invitations ?? []).filter(isActive);
  const redeemed = (invitations ?? [])
    .filter((i) => i.used_at !== null)
    .sort((a, b) => (b.used_at ?? "").localeCompare(a.used_at ?? ""));

  return (
    <>
      <Link
        href={`/app/team/${teamId}`}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
      >
        <span>←</span> EQUIPO
      </Link>

      <Reveal className="mb-7">
        <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
          INVITAR JUGADORES{teamName ? ` · ${teamName.toUpperCase()}` : ""}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Códigos de invitación
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-2 max-w-lg">
          Cada código permite a un jugador unirse al equipo desde la app móvil.
          Compártelo por WhatsApp, mensaje o como prefieras.
        </p>
      </Reveal>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}

      {canEdit && (
        <button
          onClick={handleCreate}
          disabled={generating}
          className="mb-7 h-12 px-6 rounded-xl bg-[var(--color-accent)] text-[var(--color-text-inverse)] font-semibold text-[15px] shadow-[0_10px_30px_-12px_var(--color-accent-55)] transition hover:opacity-90 disabled:opacity-40"
        >
          {generating ? "Generando…" : "+ Generar código nuevo"}
        </button>
      )}

      <div className="max-w-2xl">
        <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-text-faint)] mb-3">
          ACTIVOS
        </p>

        {!invitations ? (
          <div className="flex flex-col gap-2">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-16 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
              />
            ))}
          </div>
        ) : active.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--color-hair-strong)] px-4 py-6 text-center text-[13px] text-[var(--color-text-muted)]">
            {canEdit
              ? "No hay códigos activos. Genera uno arriba."
              : "No hay códigos activos."}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {active.map((inv, i) => (
              <Reveal
                as="li"
                key={inv.id}
                delay={Math.min(i * 40, 240)}
                className="flex items-center gap-3 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3 transition hover:border-[var(--color-accent-40)] hover:bg-[var(--color-bg-card-2)]"
              >
                <div className="min-w-0 flex-1">
                  <span className="font-mono text-[16px] font-bold tracking-[0.12em]">
                    {inv.code}
                  </span>
                  <p className="font-mono text-[10px] text-[var(--color-text-faint)] mt-0.5">
                    {copied === inv.code
                      ? "Copiado al portapapeles"
                      : `Expira ${fmtExpiry(inv.expires_at)}`}
                  </p>
                </div>
                <button
                  onClick={() => handleShare(inv.code)}
                  className="h-9 px-4 rounded-full border border-[var(--color-accent-40)] text-[13px] font-medium text-[var(--color-accent)] transition hover:bg-[var(--color-accent-10)]"
                >
                  Compartir
                </button>
                {canEdit && (
                  <button
                    onClick={() => handleRevoke(inv)}
                    aria-label="Revocar"
                    className="w-9 h-9 grid place-items-center rounded-full text-[var(--color-text-faint)] transition hover:text-[var(--color-error)] hover:bg-[var(--color-error)]/10"
                  >
                    ×
                  </button>
                )}
              </Reveal>
            ))}
          </ul>
        )}

        {redeemed.length > 0 && (
          <>
            <p className="font-mono text-[10px] tracking-[0.18em] text-[var(--color-text-faint)] mt-7 mb-3">
              CANJEADOS
            </p>
            <ul className="flex flex-col gap-2">
              {redeemed.map((inv, i) => {
                const r = inv.used_by ? redeemers[inv.used_by] : null;
                const who = r?.full_name?.trim() || r?.email || "Jugador";
                return (
                  <Reveal
                    as="li"
                    key={inv.id}
                    delay={Math.min(i * 40, 240)}
                    className="flex items-center gap-3 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-raised)] px-4 py-3 opacity-70"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-[15px] font-bold tracking-[0.12em] line-through text-[var(--color-text-muted)]">
                        {inv.code}
                      </span>
                      <p className="font-mono text-[10px] text-[var(--color-text-faint)] mt-0.5 truncate">
                        {who} · {fmtRedeemed(inv.used_at!)}
                      </p>
                    </div>
                  </Reveal>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
