"use client";

import { fetchTeam } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useAsync } from "@/lib/use-async";

export interface MatchdayTeam {
  /** Equipo de la jornada; `null` mientras carga o si no hay ninguno. */
  teamId: string | null;
  /** Nombre y categoría de ese equipo (para cabeceras y avatares). */
  teamName: string | null;
  teamCategory: string | null;
  /**
   * Capitán (o admin) de ESE equipo según `team_members`, no del activo. Un
   * club que abre la jornada de uno de sus equipos sin estar en él da `false`.
   */
  isTeamCaptain: boolean;
  loading: boolean;
}

/**
 * El equipo de una jornada, no el activo: el club entra desde su panel en
 * jornadas de cualquiera de sus equipos, y las pantallas de la jornada
 * (alineación, resultados, disponibilidad) tienen que trabajar con el equipo
 * de la propia jornada. Si no se puede leer, el activo, como antes.
 *
 * Los permisos de equipo salen de aquí (`isTeamCaptain`); el rol elegido
 * (`role`) sigue mandando por encima: un capitán que mira como jugador no
 * edita.
 */
export function useMatchdayTeam(matchdayId: string): MatchdayTeam {
  const { activeTeam, teams, user } = useSession();
  const owner = useAsync(
    async () => {
      const { data: row } = await supabaseBrowser()
        .from("matchdays")
        .select("seasons(team_id)")
        .eq("id", matchdayId)
        .maybeSingle();
      const s = (row as { seasons?: { team_id?: string } | { team_id?: string }[] } | null)?.seasons;
      const teamId = (Array.isArray(s) ? s[0]?.team_id : s?.team_id) ?? null;
      if (!teamId) return null;
      // Nombre: si es uno de mis equipos ya lo tengo; si no (club), se lee.
      const mine = teams.find((t) => t.id === teamId);
      if (mine) return { teamId, name: mine.name, category: mine.category };
      const t = await fetchTeam(teamId).catch(() => null);
      return { teamId, name: t?.name ?? null, category: t?.category ?? null };
    },
    // `teams` por id: si cambia la lista no hace falta volver a leer.
    [matchdayId, user?.id],
    !!user,
  );

  if (owner.loading) {
    return { teamId: null, teamName: null, teamCategory: null, isTeamCaptain: false, loading: true };
  }
  const teamId = owner.data?.teamId ?? activeTeam?.id ?? null;
  const ref = teams.find((t) => t.id === teamId) ?? null;
  return {
    teamId,
    teamName: owner.data?.name ?? ref?.name ?? null,
    teamCategory: owner.data?.category ?? ref?.category ?? null,
    isTeamCaptain: !!ref && (ref.role === "captain" || ref.role === "admin"),
    loading: false,
  };
}
