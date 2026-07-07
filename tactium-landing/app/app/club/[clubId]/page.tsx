"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { TactiumMark } from "@/components/TactiumMark";
import { TiltCard } from "@/app/app/TiltCard";
import { Reveal } from "@/app/app/ui/Reveal";
import { FEDERATIONS } from "@/app/app/create/federations";
import { TeamMembersPanel } from "./TeamMembersPanel";
import { CreateTeamDialog } from "./CreateTeamDialog";
import { DeleteClubDialog } from "./DeleteClubDialog";

// clubs.federation guarda el CÓDIGO; resolvemos su nombre legible (fallback al
// propio código si no está en el listado).
function fedName(code: string | null): string {
  if (!code) return "Sin federación";
  return FEDERATIONS.find((f) => f.code === code)?.name ?? code;
}

interface Club {
  id: string;
  owner_id: string;
  name: string;
  federation: string | null;
}

interface Team {
  id: string;
  name: string;
  category: string | null;
  league: string | null;
  gender: string | null;
  group_name: string | null;
  covered: boolean;
}

export default function ClubDetailPage() {
  const params = useParams<{ clubId: string }>();
  const clubId = params.clubId;
  const session = useSession();
  const router = useRouter();

  const [club, setClub] = useState<Club | null>(null);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [members, setMembers] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadTeams = useCallback(async () => {
    const { data, error: tErr } = await getSupabaseApp()
      .from("teams")
      .select("id, name, category, league, gender, group_name, covered")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true });
    if (tErr) {
      setError(tErr.message);
      return;
    }
    setTeams((data ?? []) as Team[]);
  }, [clubId]);

  useEffect(() => {
    if (!clubId) return;
    const sb = getSupabaseApp();
    let cancelled = false;
    (async () => {
      const { data: clubData, error: cErr } = await sb
        .from("clubs")
        .select("id, owner_id, name, federation")
        .eq("id", clubId)
        .single();
      if (cancelled) return;
      if (cErr) {
        setError(cErr.message);
        return;
      }
      setClub(clubData as Club);
      await loadTeams();
    })();
    return () => {
      cancelled = true;
    };
  }, [clubId, loadTeams]);

  const isOwner = club ? club.owner_id === session.user.id : false;

  return (
    <>
      <Link
        href="/app/club"
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
      >
        <span>←</span> CLUBES
      </Link>

      {error && (
        <div className="mb-5 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* Cabecera del club */}
      <Reveal className="flex items-start gap-3.5 mb-6">
        <TactiumMark size={36} className="mt-1 shrink-0" />
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)]">
            CLUB · {isOwner ? "PROPIETARIO" : "ADMIN"}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight truncate mt-1">
            {club ? club.name : "…"}
          </h1>
          {club && (
            <p className="font-mono text-[12px] text-[var(--color-text-muted)] mt-1.5">
              {fedName(club.federation)}
            </p>
          )}
        </div>
      </Reveal>

      <p className="text-[13px] leading-relaxed text-[var(--color-text-muted)] mb-7 max-w-2xl">
        Vista global del club. Las jornadas y los resultados los gestiona el
        capitán de cada equipo — desde aquí administras la estructura: crea
        equipos y consulta sus miembros.
      </p>

      {/* Sección equipos */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <h2 className="font-mono text-[12px] tracking-[0.2em] font-semibold">
            EQUIPOS
          </h2>
          {teams && (
            <span className="font-mono text-[11px] text-[var(--color-text-faint)]">
              {String(teams.length).padStart(2, "0")}
            </span>
          )}
        </div>
        {isOwner && club && (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-[var(--color-accent-40)] bg-[var(--color-accent-10)] text-[13px] font-semibold text-[var(--color-accent)] transition hover:bg-[var(--color-accent-25)]"
          >
            <span className="text-base leading-none">+</span> Crear equipo
          </button>
        )}
      </div>

      {!teams && !error && (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
            />
          ))}
        </div>
      )}

      {teams && teams.length === 0 && (
        <div className="rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] p-10 text-center">
          <h3 className="text-lg font-bold">Aún no hay equipos</h3>
          <p className="mt-2 text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
            {isOwner
              ? "Crea el primer equipo del club para empezar."
              : "El propietario del club todavía no ha creado equipos."}
          </p>
        </div>
      )}

      {teams && teams.length > 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          {teams.map((t, i) => {
            const meta =
              [
                t.category,
                t.gender,
                t.group_name && `Grupo ${t.group_name}`,
                t.league,
              ]
                .filter(Boolean)
                .join(" · ") || "Sin configurar";
            const badge = (t.category ?? t.name).slice(0, 3).toUpperCase();
            return (
              <Reveal key={t.id} delay={Math.min(i * 40, 240)}>
              <TiltCard
                className="group rounded-2xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] hover:border-[var(--color-accent-40)] transition-colors"
              >
                <div className="flex items-center gap-3.5 p-4">
                  <div className="w-11 h-11 shrink-0 grid place-items-center rounded-xl bg-[var(--color-bg-raised)] border border-[var(--color-hair-strong)] font-mono text-[12px] font-bold text-[var(--color-accent)]">
                    {badge}
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/app/team/${t.id}`}
                      className="font-bold tracking-tight truncate block hover:text-[var(--color-accent)] transition"
                    >
                      {t.name}
                    </Link>
                    <p className="font-mono text-[11px] text-[var(--color-text-muted)] mt-0.5 truncate">
                      {meta}
                    </p>
                    {club &&
                      club.owner_id === session.user.id &&
                      t.covered === false && (
                        <p className="font-mono text-[10px] tracking-[0.05em] font-bold text-[var(--color-warning)] mt-1">
                          NO CUBIERTO · cúbrelo desde la app móvil
                        </p>
                      )}
                  </div>
                  <button
                    onClick={() => setMembers({ id: t.id, name: t.name })}
                    className="shrink-0 h-9 px-3 rounded-lg border border-[var(--color-hair-strong)] text-[12px] font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:border-[var(--color-accent-40)] transition"
                  >
                    Miembros
                  </button>
                </div>
              </TiltCard>
              </Reveal>
            );
          })}
        </div>
      )}

      {/* Zona de peligro: borrar club (solo owner) */}
      {isOwner && club && (
        <div className="mt-12 flex flex-col items-center text-center">
          <p className="font-mono text-[11px] tracking-[0.2em] text-[var(--color-error)] mb-3">
            ZONA DE PELIGRO
          </p>
          <button
            onClick={() => setDeleting(true)}
            className="w-full max-w-sm h-12 rounded-xl border border-[var(--color-error)]/50 bg-[var(--color-error)]/10 text-[15px] font-bold text-[var(--color-error)] transition hover:bg-[var(--color-error)]/20"
          >
            Borrar club
          </button>
          <p className="text-[12px] text-[var(--color-text-faint)] mt-2.5 max-w-sm">
            Elimina el club y todo su contenido. No se puede deshacer.
          </p>
        </div>
      )}

      {/* Overlays */}
      {members && (
        <TeamMembersPanel
          teamId={members.id}
          teamName={members.name}
          onClose={() => setMembers(null)}
        />
      )}
      {creating && club && (
        <CreateTeamDialog
          clubId={club.id}
          clubName={club.name}
          clubFederation={club.federation}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            setTeams(null);
            void loadTeams();
          }}
        />
      )}
      {deleting && club && (
        <DeleteClubDialog
          clubId={club.id}
          clubName={club.name}
          onCancel={() => setDeleting(false)}
          onDeleted={() => router.push("/app/club")}
        />
      )}
    </>
  );
}
