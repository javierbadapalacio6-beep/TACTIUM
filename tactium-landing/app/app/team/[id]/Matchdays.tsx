"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseApp } from "@/lib/supabase-app";
import { Reveal } from "@/app/app/ui/Reveal";

interface Season {
  id: string;
  name: string | null;
  active: boolean | null;
}

interface Matchday {
  id: string;
  jornada_number: number | null;
  match_date: string | null;
  opponent: string | null;
  is_home: boolean | null;
  status: "upcoming" | "in_progress" | "finished" | null;
  score_for: number | null;
  score_against: number | null;
}

const fmtDate = (d: string | null) => {
  if (!d) return "Sin fecha";
  const [, m, day] = d.split("-");
  return day && m ? `${day}/${m}` : d;
};

export function Matchdays({ teamId }: { teamId: string }) {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const [matchdays, setMatchdays] = useState<Matchday[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Temporadas del equipo → elegir la activa por defecto.
  useEffect(() => {
    getSupabaseApp()
      .from("seasons")
      .select("id, name, active")
      .eq("team_id", teamId)
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setError(error.message);
          return;
        }
        const list = (data ?? []) as Season[];
        setSeasons(list);
        setSeasonId(list.find((s) => s.active)?.id ?? list[0]?.id ?? null);
      });
  }, [teamId]);

  // Jornadas de la temporada seleccionada.
  useEffect(() => {
    if (!seasonId) {
      if (seasons) setMatchdays([]);
      return;
    }
    setMatchdays(null);
    getSupabaseApp()
      .from("matchdays")
      .select(
        "id, jornada_number, match_date, opponent, is_home, status, score_for, score_against",
      )
      .eq("season_id", seasonId)
      .order("match_date", { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setMatchdays((data ?? []) as Matchday[]);
      });
  }, [seasonId, seasons]);

  if (error)
    return (
      <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
        {error}
      </div>
    );

  if (!seasons)
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
          />
        ))}
      </div>
    );

  if (seasons.length === 0)
    return (
      <Reveal className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-10 text-center">
        <h2 className="text-lg font-bold">Sin temporadas</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Crea una temporada para empezar a planificar jornadas.
        </p>
        <Link
          href={`/app/team/${teamId}/seasons`}
          className="mt-4 inline-flex h-9 px-4 items-center rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-[13px] font-semibold hover:opacity-90 transition"
        >
          + Crear temporada
        </Link>
      </Reveal>
    );

  return (
    <div className="flex flex-col gap-4">
      {seasons.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {seasons.map((s) => (
            <button
              key={s.id}
              onClick={() => setSeasonId(s.id)}
              className={`font-mono text-[11px] tracking-wide px-3 h-8 rounded-full border transition ${
                s.id === seasonId
                  ? "border-[var(--color-accent)] text-[var(--color-accent)] bg-[var(--color-accent-10)]"
                  : "border-[var(--color-hair-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              }`}
            >
              {s.name ?? "Temporada"}
              {s.active ? " · ACTIVA" : ""}
            </button>
          ))}
        </div>
      )}

      {!matchdays && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-16 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
            />
          ))}
        </div>
      )}

      {matchdays && matchdays.length === 0 && (
        <Reveal className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-muted)]">
          Esta temporada aún no tiene jornadas.
        </Reveal>
      )}

      {matchdays && matchdays.length > 0 && (
        <div className="flex flex-col gap-2">
          {matchdays.map((m, i) => (
            <Reveal key={m.id} delay={Math.min(i * 40, 240)}>
              <MatchdayRow m={m} teamId={teamId} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchdayRow({ m, teamId }: { m: Matchday; teamId: string }) {
  const finished = m.status === "finished";
  let result: { label: string; cls: string } | null = null;
  if (finished && m.score_for != null && m.score_against != null) {
    const won = m.score_for > m.score_against;
    const draw = m.score_for === m.score_against;
    result = {
      label: `${m.score_for}–${m.score_against}`,
      cls: won
        ? "text-[var(--color-accent)] border-[var(--color-accent-40)]"
        : draw
          ? "text-[var(--color-text-muted)] border-[var(--color-hair-strong)]"
          : "text-[var(--color-error)] border-[var(--color-error)]/40",
    };
  }

  return (
    <Link
      href={`/app/team/${teamId}/matchday/${m.id}`}
      className="flex items-center gap-3 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3 transition hover:border-[var(--color-accent-40)] hover:bg-[var(--color-bg-card-2)]"
    >
      <div className="w-12 shrink-0 text-center">
        <div className="font-mono text-[10px] text-[var(--color-text-faint)] leading-none">
          J{m.jornada_number ?? "—"}
        </div>
        <div className="font-mono text-[13px] text-[var(--color-text)] mt-1 leading-none">
          {fmtDate(m.match_date)}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold tracking-tight truncate">
          {m.opponent || "Rival por definir"}
        </div>
        <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5">
          {m.is_home === false ? "Fuera" : "Casa"}
        </p>
      </div>
      {result ? (
        <span
          className={`shrink-0 font-mono text-[13px] font-semibold border rounded-lg px-2.5 py-1 ${result.cls}`}
        >
          {result.label}
        </span>
      ) : (
        <span
          className={`shrink-0 font-mono text-[10px] tracking-[0.1em] px-2 py-1 rounded-full border ${
            m.status === "in_progress"
              ? "text-[var(--color-warning)] border-[var(--color-warning)]/40"
              : "text-[var(--color-text-faint)] border-[var(--color-hair-strong)]"
          }`}
        >
          {m.status === "in_progress" ? "EN JUEGO" : "PENDIENTE"}
        </span>
      )}
    </Link>
  );
}
