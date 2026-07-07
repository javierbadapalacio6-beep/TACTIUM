"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { Reveal } from "@/app/app/ui/Reveal";
import { Roster } from "./Roster";
import { Matchdays } from "./Matchdays";

interface Team {
  id: string;
  name: string;
  federation: string | null;
  league: string | null;
  category: string | null;
  gender: string | null;
  club_id: string | null;
}

type Tab = "roster" | "matchdays";

export default function TeamDetailPage() {
  const params = useParams<{ id: string }>();
  const teamId = params.id;
  const [team, setTeam] = useState<Team | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("roster");

  useEffect(() => {
    if (!teamId) return;
    getSupabaseApp()
      .from("teams")
      .select("id, name, federation, league, category, gender, club_id")
      .eq("id", teamId)
      .single()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setTeam(data as Team);
      });
  }, [teamId]);

  const meta = team
    ? [team.federation, team.league, team.category].filter(Boolean).join(" · ")
    : "";

  return (
    <>
      <Link
        href="/app"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
      >
        <span>←</span> EQUIPOS
      </Link>

      {error && (
        <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* Cabecera */}
      <Reveal className="mb-6">
        {team?.club_id && (
          <span className="inline-block mb-2 font-mono text-[9px] tracking-[0.15em] text-[var(--color-accent)] border border-[var(--color-accent-40)] rounded-full px-2 py-0.5">
            CLUB
          </span>
        )}
        <h1 className="text-3xl font-extrabold tracking-tight">
          {team ? team.name : "…"}
        </h1>
        {meta && (
          <p className="font-mono text-[12px] text-[var(--color-text-muted)] mt-2">
            {meta}
          </p>
        )}
      </Reveal>

      {/* Acciones del equipo */}
      <Reveal delay={40} className="flex flex-wrap gap-2 mb-6">
        {(
          [
            [`/app/team/${teamId}/seasons`, "Temporadas"],
            [`/app/team/${teamId}/players/new`, "+ Jugador"],
            [`/app/team/${teamId}/scan`, "Escanear ranking"],
            [`/app/team/${teamId}/invite`, "Invitar"],
          ] as const
        ).map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="h-9 px-3 inline-flex items-center rounded-full border border-[var(--color-hair-strong)] text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent-40)] transition"
          >
            {label}
          </Link>
        ))}
      </Reveal>

      {/* Pestañas */}
      <Reveal
        delay={80}
        className="flex gap-1 p-1 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-hair)] mb-6 w-fit"
      >
        {(
          [
            ["roster", "Plantilla"],
            ["matchdays", "Jornadas"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-4 h-9 rounded-lg text-[13px] font-semibold transition ${
              tab === k
                ? "bg-[var(--color-bg-raised)] text-[var(--color-text)]"
                : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            }`}
          >
            {label}
          </button>
        ))}
      </Reveal>

      {teamId &&
        (tab === "roster" ? (
          <Roster teamId={teamId} />
        ) : (
          <Matchdays teamId={teamId} />
        ))}
    </>
  );
}
