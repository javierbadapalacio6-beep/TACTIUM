"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { TactiumMark } from "@/components/TactiumMark";
import { Reveal } from "@/app/app/ui/Reveal";

interface RedeemedInvitation {
  team_id: string | null;
}

// Unirse a un equipo con código de invitación (espejo de
// RedeemInvitationSheet móvil). Canjea vía RPC `redeem_team_invitation`,
// que añade al usuario a team_members y devuelve la invitación canjeada.
export default function JoinTeamPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = code.trim().toUpperCase();
  const valid = useMemo(() => trimmed.length === 8, [trimmed]);

  const handleRedeem = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const { data, error: rpcErr } = await getSupabaseApp().rpc(
      "redeem_team_invitation",
      { invitation_code: trimmed },
    );
    if (rpcErr) {
      setError(rpcErr.message);
      setSubmitting(false);
      return;
    }
    const inv = data as RedeemedInvitation | null;
    if (inv?.team_id) {
      router.push(`/app/team/${inv.team_id}`);
    } else {
      // Fallback: si el RPC no devolviera team_id, vuelve al panel.
      router.push("/app");
    }
  };

  return (
    <>
      <Reveal>
        <Link
          href="/app"
          className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
        >
          <span>←</span> EQUIPOS
        </Link>

        <div className="mb-7">
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
            INVITACIÓN DE EQUIPO
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Únete a tu equipo
          </h1>
          <p className="text-[14px] text-[var(--color-text-muted)] mt-2 max-w-md">
            El gestor de tu club o tu capitán ha creado el equipo y te ha
            enviado una invitación de 8 caracteres para unirte.
          </p>
        </div>
      </Reveal>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          Código inválido: {error}
        </div>
      )}

      <Reveal
        delay={80}
        className="max-w-md rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-6"
      >
        <div className="grid place-items-center mb-5">
          <TactiumMark size={40} className="opacity-80" />
        </div>

        <p className="font-mono text-[11px] tracking-[0.18em] text-[var(--color-text-faint)] uppercase mb-2">
          Código de invitación
        </p>
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card-2)] px-3.5 py-4">
          <input
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 8))
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRedeem();
            }}
            placeholder="XK8R9P3M"
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent outline-none font-mono text-[22px] font-bold tracking-[0.3em] uppercase placeholder:text-[var(--color-text-faint)] placeholder:tracking-[0.3em]"
          />
          <span className="shrink-0 font-mono text-[11px] tracking-wide text-[var(--color-text-faint)]">
            {trimmed.length}/8
          </span>
        </div>

        <button
          onClick={handleRedeem}
          disabled={!valid || submitting}
          className="mt-5 w-full h-12 rounded-xl bg-[var(--color-accent)] text-black text-[15px] font-bold transition hover:opacity-90 disabled:opacity-40"
        >
          {submitting ? "Uniéndote…" : "Unirme al equipo"}
        </button>
      </Reveal>
    </>
  );
}
