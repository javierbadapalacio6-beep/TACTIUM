"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseApp } from "@/lib/supabase-app";
import { TactiumMark } from "@/components/TactiumMark";
import { TiltCard } from "./TiltCard";
import { Reveal } from "./ui/Reveal";

interface Team {
  id: string;
  name: string;
  federation: string | null;
  league: string | null;
  category: string | null;
  club_id: string | null;
}

export default function DashboardPage() {
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseApp()
      .from("teams")
      .select("id, name, federation, league, category, club_id")
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setTeams((data ?? []) as Team[]);
      });
  }, []);

  return (
    <>
      <Reveal className="flex flex-wrap items-end justify-between gap-4 mb-7">
        <div>
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
            TUS EQUIPOS
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Centro de mando
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/app/join"
            className="h-9 px-3 inline-flex items-center rounded-full border border-[var(--color-hair-strong)] text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text)] transition"
          >
            Unirme con código
          </Link>
          <Link
            href="/app/club/new"
            className="h-9 px-3 inline-flex items-center rounded-full border border-[var(--color-hair-strong)] text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-text)] transition"
          >
            Crear club
          </Link>
          <Link
            href="/app/team/new"
            className="h-9 px-4 inline-flex items-center rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-[13px] font-semibold hover:opacity-90 transition"
          >
            + Crear equipo
          </Link>
        </div>
      </Reveal>

      {error && (
        <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          No se pudieron cargar tus equipos: {error}
        </div>
      )}

      {!teams && !error && (
        <div className="grid sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
            />
          ))}
        </div>
      )}

      {teams && teams.length === 0 && (
        <Reveal className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-10 text-center">
          <TactiumMark size={44} className="mx-auto opacity-70" />
          <h2 className="mt-4 text-lg font-bold">Aún no tienes equipos</h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
            Crea tu primer equipo desde la app móvil de TACTIUM y aparecerá aquí
            para gestionarlo en grande.
          </p>
        </Reveal>
      )}

      {teams && teams.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {teams.map((t, i) => {
            const meta = [t.federation, t.league, t.category]
              .filter(Boolean)
              .join(" · ");
            return (
              <Reveal key={t.id} delay={Math.min(i * 40, 240)}>
              <TiltCard
                className="group rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] hover:border-[var(--color-accent-40)] transition-colors"
              >
                <Link href={`/app/team/${t.id}`} className="block p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-bold text-[17px] tracking-tight truncate">
                      {t.name}
                    </h3>
                    {meta && (
                      <p className="font-mono text-[11px] tracking-wide text-[var(--color-text-muted)] mt-1.5 truncate">
                        {meta}
                      </p>
                    )}
                  </div>
                  {t.club_id && (
                    <span className="shrink-0 font-mono text-[9px] tracking-[0.15em] text-[var(--color-accent)] border border-[var(--color-accent-40)] rounded-full px-2 py-0.5">
                      CLUB
                    </span>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-[12px] text-[var(--color-text-faint)] group-hover:text-[var(--color-accent)] transition">
                  <span>Gestionar</span>
                  <span className="transition group-hover:translate-x-0.5">
                    →
                  </span>
                </div>
                </Link>
              </TiltCard>
              </Reveal>
            );
          })}
        </div>
      )}
    </>
  );
}
