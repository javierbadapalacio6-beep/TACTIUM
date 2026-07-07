"use client";

import { useEffect, useState } from "react";
import { getSupabaseApp } from "@/lib/supabase-app";

function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setM(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return m;
}

type TeamRole = "captain" | "admin" | "player";

interface Member {
  id: string;
  user_id: string;
  role: TeamRole;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

type MemberWithProfile = Member & { profile: Profile | null };

const ROLE_LABEL: Record<TeamRole, string> = {
  captain: "Capitán",
  admin: "Admin",
  player: "Jugador",
};

const initials = (s: string) =>
  s
    .split(/[\s@.]+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

// Panel de miembros de un equipo del club. Read-only / gestión ligera: muestra
// quién pertenece al equipo y su rol. La gestión de invitaciones (generar
// códigos) vive en la app móvil; aquí solo se consultan los miembros.
export function TeamMembersPanel({
  teamId,
  teamName,
  onClose,
}: {
  teamId: string;
  teamName: string;
  onClose: () => void;
}) {
  const [members, setMembers] = useState<MemberWithProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useMounted();

  useEffect(() => {
    const sb = getSupabaseApp();
    let cancelled = false;
    (async () => {
      const { data: rows, error: mErr } = await sb
        .from("team_members")
        .select("id, user_id, role")
        .eq("team_id", teamId)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (mErr) {
        setError(mErr.message);
        return;
      }
      const list = (rows ?? []) as Member[];
      if (list.length === 0) {
        setMembers([]);
        return;
      }
      // profiles.id no está expresado como FK en PostgREST → 2 queries.
      const userIds = Array.from(new Set(list.map((m) => m.user_id)));
      const { data: profs } = await sb
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);
      if (cancelled) return;
      const byId = new Map<string, Profile>(
        ((profs ?? []) as Profile[]).map((p) => [p.id, p]),
      );
      setMembers(
        list.map((m) => ({ ...m, profile: byId.get(m.user_id) ?? null })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div
        className={`relative w-full sm:max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-raised)] p-6 transition-all duration-200 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-accent)]">
              EQUIPO
            </p>
            <h2 className="text-xl font-bold tracking-tight truncate mt-1">
              {teamName}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 grid place-items-center rounded-lg border border-[var(--color-hair-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
        <p className="text-[13px] text-[var(--color-text-muted)] mb-4">
          Miembros del equipo. Para invitar capitanes o jugadores usa la app
          móvil de TACTIUM.
        </p>

        {error && (
          <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
            {error}
          </div>
        )}

        {!members && !error && (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-14 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
              />
            ))}
          </div>
        )}

        {members && members.length === 0 && (
          <div className="rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] py-8 text-center text-[13px] text-[var(--color-text-muted)]">
            Aún no hay miembros en este equipo.
          </div>
        )}

        {members && members.length > 0 && (
          <ul className="flex flex-col gap-2">
            {members.map((m) => {
              const name =
                m.profile?.full_name?.trim() ||
                m.profile?.email ||
                "Sin nombre";
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] px-4 py-3"
                >
                  {m.profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.profile.avatar_url}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover shrink-0 border border-[var(--color-hair-strong)]"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full shrink-0 grid place-items-center bg-[var(--color-accent-10)] border border-[var(--color-accent-40)] font-mono text-[11px] text-[var(--color-accent)]">
                      {initials(name)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold tracking-tight truncate">
                      {name}
                    </p>
                    {m.profile?.email && m.profile.full_name && (
                      <p className="font-mono text-[11px] text-[var(--color-text-faint)] truncate">
                        {m.profile.email}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-[10px] tracking-[0.1em] text-[var(--color-text-muted)] border border-[var(--color-hair-strong)] rounded-full px-2.5 py-1">
                    {ROLE_LABEL[m.role]}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
