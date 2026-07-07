"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseApp } from "@/lib/supabase-app";
import { Reveal } from "@/app/app/ui/Reveal";

interface Player {
  id: string;
  name: string;
  alias: string | null;
  pts: number | null;
  position: string | null;
  photo_url: string | null;
  available: boolean | null;
  user_id: string | null;
}

const displayName = (p: Player) =>
  p.alias && p.alias.trim() ? p.alias.trim() : p.name;

const initials = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

export function Roster({ teamId }: { teamId: string }) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getSupabaseApp()
      .from("players")
      .select("id, name, alias, pts, position, photo_url, available, user_id")
      .eq("team_id", teamId)
      .order("pts", { ascending: false, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setPlayers((data ?? []) as Player[]);
      });
  }, [teamId]);

  // KPIs de plantilla (igual que la app móvil): total, suma y media de puntos.
  const stats = useMemo(() => {
    if (!players) return null;
    const totalPts = players.reduce((a, p) => a + (p.pts ?? 0), 0);
    return {
      count: players.length,
      totalPts,
      avg: players.length ? Math.round(totalPts / players.length) : 0,
    };
  }, [players]);

  const shown = useMemo(() => {
    if (!players) return [];
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.alias?.toLowerCase().includes(q) ?? false),
    );
  }, [players, search]);

  if (error)
    return (
      <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
        {error}
      </div>
    );

  if (!players)
    return (
      <div className="flex flex-col gap-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-16 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
          />
        ))}
      </div>
    );

  if (players.length === 0)
    return (
      <Reveal className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-10 text-center">
        <h2 className="text-lg font-bold">Sin jugadores todavía</h2>
        <p className="mt-2 text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
          Añade tu plantilla manualmente o escaneando el ranking FEP desde las
          acciones de arriba.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link
            href={`/app/team/${teamId}/players/new`}
            className="inline-flex h-9 px-4 items-center rounded-full bg-[var(--color-accent)] text-[var(--color-text-inverse)] text-[13px] font-semibold hover:opacity-90 transition"
          >
            + Jugador
          </Link>
          <Link
            href={`/app/team/${teamId}/scan`}
            className="inline-flex h-9 px-4 items-center rounded-full border border-[var(--color-hair-strong)] text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent-40)] transition"
          >
            Escanear ranking
          </Link>
        </div>
      </Reveal>
    );

  return (
    <div className="flex flex-col gap-4">
      {/* KPIs de plantilla */}
      {stats && (
        <Reveal className="flex items-center gap-6 rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-5 py-4">
          <Kpi label="Jugadores" value={String(stats.count)} />
          <span className="w-px self-stretch bg-[var(--color-hair)]" />
          <Kpi label="Σ pts" value={String(stats.totalPts)} highlight />
          <span className="w-px self-stretch bg-[var(--color-hair)]" />
          <Kpi label="Media" value={String(stats.avg)} />
        </Reveal>
      )}

      {/* Búsqueda */}
      <Reveal delay={40}>
        <div className="flex h-10 items-center gap-2 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] px-3">
          <span className="text-[var(--color-text-faint)] text-sm">⌕</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar jugador"
            className="flex-1 bg-transparent text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-faint)] outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition text-sm"
              aria-label="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>
      </Reveal>

      {shown.length === 0 ? (
        <Reveal
          delay={80}
          className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-8 text-center text-sm text-[var(--color-text-muted)]"
        >
          Ningún jugador coincide con &ldquo;{search}&rdquo;.
        </Reveal>
      ) : (
        <div className="flex flex-col gap-2">
          {shown.map((p, idx) => {
            const name = displayName(p);
            const isBaja = p.available === false;
            return (
              <Reveal key={p.id} delay={Math.min(idx * 40, 240)}>
                <Link
                  href={`/app/team/${teamId}/players/${p.id}/edit`}
                  className={`flex items-center gap-3 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3 transition hover:border-[var(--color-accent-40)] hover:bg-[var(--color-bg-card-2)] ${
                    isBaja ? "opacity-55" : ""
                  }`}
                >
                  <span className="w-7 shrink-0 font-mono text-[12px] text-[var(--color-text-faint)] text-right">
                    #{String(idx + 1).padStart(2, "0")}
                  </span>
                  <Avatar name={name} photo={p.photo_url} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold tracking-tight truncate">
                        {name}
                      </span>
                      {isBaja && (
                        <span className="shrink-0 font-mono text-[9px] tracking-[0.1em] text-[var(--color-warning)] border border-[var(--color-warning)]/40 rounded px-1.5 py-0.5">
                          BAJA
                        </span>
                      )}
                    </div>
                    <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                      {[p.position, p.pts != null ? `${p.pts} pts` : null]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  {p.user_id && (
                    <span
                      title="Cuenta vinculada"
                      className="shrink-0 w-2 h-2 rounded-full bg-[var(--color-accent)]"
                    />
                  )}
                </Link>
              </Reveal>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        className={`font-mono text-[22px] font-bold leading-none tracking-tight ${
          highlight ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
        }`}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] tracking-[0.15em] text-[var(--color-text-faint)] uppercase mt-1.5">
        {label}
      </div>
    </div>
  );
}

function Avatar({ name, photo }: { name: string; photo: string | null }) {
  if (photo) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={photo}
        alt=""
        className="w-9 h-9 rounded-full object-cover shrink-0 border border-[var(--color-hair-strong)]"
      />
    );
  }
  return (
    <div className="w-9 h-9 rounded-full shrink-0 grid place-items-center bg-[var(--color-bg-raised)] border border-[var(--color-hair-strong)] font-mono text-[11px] text-[var(--color-text-muted)]">
      {initials(name)}
    </div>
  );
}
