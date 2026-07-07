"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { TactiumMark } from "@/components/TactiumMark";
import { TiltCard } from "@/app/app/TiltCard";
import { Reveal } from "@/app/app/ui/Reveal";
import { FEDERATIONS } from "@/app/app/create/federations";

// La columna clubs.federation guarda el CÓDIGO (p.ej. "FMP"); para mostrarlo
// resolvemos su nombre corto legible, con fallback al propio código.
function fedShort(code: string | null): string {
  if (!code) return "Sin federación";
  return FEDERATIONS.find((f) => f.code === code)?.shortName ?? code;
}

interface Club {
  id: string;
  owner_id: string;
  name: string;
  federation: string | null;
}

interface Team {
  id: string;
  club_id: string | null;
}

export default function ClubsPage() {
  const session = useSession();
  const [clubs, setClubs] = useState<Club[] | null>(null);
  const [teamCounts, setTeamCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = getSupabaseApp();
    let cancelled = false;
    (async () => {
      // RLS: solo devuelve clubes donde el usuario es owner o club_admin.
      const { data: clubData, error: clubErr } = await sb
        .from("clubs")
        .select("id, owner_id, name, federation")
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (clubErr) {
        setError(clubErr.message);
        return;
      }
      const list = (clubData ?? []) as Club[];
      setClubs(list);

      if (list.length > 0) {
        const ids = list.map((c) => c.id);
        const { data: teamData } = await sb
          .from("teams")
          .select("id, club_id")
          .in("club_id", ids);
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const t of (teamData ?? []) as Team[]) {
          if (t.club_id) counts[t.club_id] = (counts[t.club_id] ?? 0) + 1;
        }
        setTeamCounts(counts);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totalTeams = Object.values(teamCounts).reduce((a, b) => a + b, 0);

  return (
    <>
      <Reveal className="flex items-end justify-between gap-4 mb-7">
        <div>
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
            CLUB · ADMIN
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">Tus clubes</h1>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {clubs && clubs.length > 0 && (
            <span className="font-mono text-[13px] text-[var(--color-text-muted)]">
              {clubs.length} {clubs.length === 1 ? "club" : "clubes"}
            </span>
          )}
          <Link
            href="/app/club/new"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--color-accent-40)] bg-[var(--color-accent-10)] text-[13px] font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent-25)]"
          >
            <span className="text-base leading-none">+</span> Crear club
          </Link>
        </div>
      </Reveal>

      {error && (
        <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          No se pudieron cargar tus clubes: {error}
        </div>
      )}

      {/* Resumen global */}
      {clubs && clubs.length > 0 && (
        <Reveal
          delay={40}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-7"
        >
          <Stat label="CLUBES" value={String(clubs.length)} />
          <Stat label="EQUIPOS" value={String(totalTeams)} />
          <Stat
            label="FEDERACIONES"
            value={String(
              new Set(clubs.map((c) => c.federation).filter(Boolean)).size,
            )}
          />
        </Reveal>
      )}

      {!clubs && !error && (
        <div className="grid sm:grid-cols-2 gap-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
            />
          ))}
        </div>
      )}

      {clubs && clubs.length === 0 && (
        <Reveal className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-10 text-center">
          <TactiumMark size={44} className="mx-auto opacity-70" />
          <h2 className="mt-4 text-lg font-bold">No administras ningún club</h2>
          <p className="mt-2 text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
            Crea un club para gestionar varios equipos bajo una misma
            federación. Tú serás su propietario.
          </p>
          <Link
            href="/app/club/new"
            className="mt-5 inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border border-[var(--color-accent-40)] bg-[var(--color-accent-10)] text-[13px] font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent-25)]"
          >
            <span className="text-base leading-none">+</span> Crear club
          </Link>
        </Reveal>
      )}

      {clubs && clubs.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {clubs.map((c, i) => {
            const isOwner = c.owner_id === session.user.id;
            const count = teamCounts[c.id] ?? 0;
            return (
              <Reveal key={c.id} delay={Math.min(i * 40, 240)}>
              <TiltCard
                className="group rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] hover:border-[var(--color-accent-40)] transition-colors"
              >
                <Link href={`/app/club/${c.id}`} className="block p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-bold text-[17px] tracking-tight truncate">
                        {c.name}
                      </h3>
                      <p className="font-mono text-[11px] tracking-wide text-[var(--color-text-muted)] mt-1.5 truncate">
                        {fedShort(c.federation)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-mono text-[9px] tracking-[0.15em] rounded-full px-2 py-0.5 border ${
                        isOwner
                          ? "text-[var(--color-accent)] border-[var(--color-accent-40)]"
                          : "text-[var(--color-text-faint)] border-[var(--color-hair-strong)]"
                      }`}
                    >
                      {isOwner ? "PROPIETARIO" : "ADMIN"}
                    </span>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <span className="font-mono text-[12px] text-[var(--color-text-faint)]">
                      {count} {count === 1 ? "equipo" : "equipos"}
                    </span>
                    <span className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-faint)] group-hover:text-[var(--color-accent)] transition">
                      <span>Gestionar</span>
                      <span className="transition group-hover:translate-x-0.5">
                        →
                      </span>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] px-4 py-3.5">
      <p className="font-mono text-[10px] tracking-[0.15em] text-[var(--color-text-faint)]">
        {label}
      </p>
      <p className="text-2xl font-extrabold tracking-tight mt-1">{value}</p>
    </div>
  );
}
