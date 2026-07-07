"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getSupabaseApp } from "@/lib/supabase-app";
import { useSession } from "@/app/app/layout";
import { getCourtsForCompetition, type TeamGender } from "@/lib/courts";
import { Reveal } from "@/app/app/ui/Reveal";
import { LineupEditor, type EditorPlayer, type Slot } from "./LineupEditor";

interface Data {
  jornada: number | null;
  date: string | null;
  opponent: string | null;
  isHome: boolean | null;
  courts: number;
  players: EditorPlayer[];
  slots: Slot[];
  variantId: string | null;
  canEdit: boolean;
  seasonActive: boolean;
}

const fmtDate = (d: string | null) => {
  if (!d) return "Sin fecha";
  const [, m, day] = d.split("-");
  return day && m ? `${day}/${m}` : d;
};

export default function MatchdayLineupPage() {
  const params = useParams<{ id: string; mid: string }>();
  const { id: teamId, mid } = params;
  const session = useSession();

  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!teamId || !mid) return;
    const sb = getSupabaseApp();
    (async () => {
      try {
        const md = await sb
          .from("matchdays")
          .select("jornada_number, match_date, opponent, is_home, season_id")
          .eq("id", mid)
          .single();
        if (md.error) throw md.error;

        const season = await sb
          .from("seasons")
          .select("team_id, active")
          .eq("id", md.data.season_id)
          .single();
        if (season.error) throw season.error;

        const team = await sb
          .from("teams")
          .select("owner_id, federation, league, gender")
          .eq("id", season.data.team_id)
          .single();
        if (team.error) throw team.error;

        const courts = getCourtsForCompetition(
          team.data.federation as string | null,
          team.data.league as string | null,
          team.data.gender as TeamGender | null,
        );

        const variant = await sb
          .from("lineup_variants")
          .select("id")
          .eq("matchday_id", mid)
          .eq("is_active", true)
          .maybeSingle();
        const variantId = (variant.data?.id as string | undefined) ?? null;

        let linData: {
          court_number: number;
          player_a_id: string | null;
          player_b_id: string | null;
        }[] = [];
        if (variantId) {
          const r = await sb
            .from("lineups")
            .select("court_number, player_a_id, player_b_id")
            .eq("variant_id", variantId);
          if (r.error) throw r.error;
          linData = (r.data ?? []) as typeof linData;
        }
        const plRes = await sb
          .from("players")
          .select("id, name, alias, pts, position, photo_url, active, available")
          .eq("team_id", teamId)
          .eq("active", true);

        const existing = new Map<
          number,
          { aId: string | null; bId: string | null }
        >();
        linData.forEach((r) =>
          existing.set(r.court_number, {
            aId: r.player_a_id,
            bId: r.player_b_id,
          }),
        );
        const slots: Slot[] = Array.from({ length: courts }, (_, i) => {
          const c = i + 1;
          const e = existing.get(c);
          return { court: c, aId: e?.aId ?? null, bId: e?.bId ?? null };
        });

        const seasonActive = season.data.active !== false;
        const isOwner = team.data.owner_id === session.user.id;

        setData({
          jornada: md.data.jornada_number,
          date: md.data.match_date,
          opponent: md.data.opponent,
          isHome: md.data.is_home,
          courts,
          players: (plRes.data ?? []) as EditorPlayer[],
          slots,
          variantId,
          canEdit: seasonActive && isOwner,
          seasonActive,
        });
      } catch (e) {
        setError((e as { message?: string })?.message ?? "Error al cargar.");
      }
    })();
  }, [teamId, mid, session.user.id]);

  return (
    <>
      <Link
        href={`/app/team/${teamId}`}
        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition mb-6"
      >
        <span>←</span> EQUIPO
      </Link>

      {error && (
        <div className="rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-4 py-3 text-[13px] text-[var(--color-error)]">
          {error}
        </div>
      )}

      <Reveal>
        <div className="mb-7">
          <p className="font-mono text-[11px] tracking-[0.25em] text-[var(--color-accent)] mb-2">
            ALINEACIÓN {data?.jornada ? `· J${data.jornada}` : ""}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {data ? data.opponent || "Rival por definir" : "…"}
          </h1>
          {data && (
            <p className="font-mono text-[12px] text-[var(--color-text-muted)] mt-2">
              {fmtDate(data.date)} · {data.isHome === false ? "Fuera" : "Casa"}
            </p>
          )}
        </div>
      </Reveal>

      {/* Sub-navegación de la jornada */}
      <div className="flex flex-wrap gap-2 mb-6">
        <span className="h-9 px-4 inline-flex items-center rounded-full bg-[var(--color-bg-raised)] border border-[var(--color-accent-40)] text-[13px] font-semibold text-[var(--color-accent)]">
          Alineación
        </span>
        <Link
          href={`/app/team/${teamId}/matchday/${mid}/availability`}
          className="h-9 px-4 inline-flex items-center rounded-full border border-[var(--color-hair-strong)] text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent-40)] transition"
        >
          Disponibilidad
        </Link>
        <Link
          href={`/app/team/${teamId}/matchday/${mid}/results`}
          className="h-9 px-4 inline-flex items-center rounded-full border border-[var(--color-hair-strong)] text-[13px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent-40)] transition"
        >
          Resultados / Acta
        </Link>
      </div>

      {data && !data.canEdit && (
        <Reveal>
          <div className="mb-5 rounded-xl border border-[var(--color-hair-strong)] bg-[var(--color-bg-card)] px-4 py-3 text-[13px] text-[var(--color-text-muted)]">
            {!data.seasonActive
              ? "Temporada archivada — solo lectura."
              : "Solo el capitán del equipo puede editar la alineación."}
          </div>
        </Reveal>
      )}

      {!data && !error && (
        <div className="grid sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 rounded-2xl border border-[var(--color-hair)] bg-[var(--color-bg-card)] animate-pulse"
            />
          ))}
        </div>
      )}

      {data && (
        <LineupEditor
          matchdayId={mid}
          courts={data.courts}
          players={data.players}
          initialSlots={data.slots}
          variantId={data.variantId}
          canEdit={data.canEdit}
        />
      )}
    </>
  );
}
