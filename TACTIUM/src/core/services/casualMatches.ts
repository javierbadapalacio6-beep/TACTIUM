import { supabase } from '@core/supabase/client';

// Servicio de partidos casuales (amistoso/entreno/torneo). Habla con el RPC
// `create_casual_match`. Los tipos generados aún no incluyen el RPC → cast
// puntual. Un registro = UN partido de dobles (4 participantes en 2 lados);
// un amistoso "equipo vs equipo" de N partidos se guarda como N registros.

export type CasualMatchType = 'amistoso' | 'entreno' | 'torneo';
export type MatchVisibility = 'public' | 'followers' | 'private';

export type CasualParticipant = {
  side: 0 | 1;
  slot: 0 | 1;
  name: string;
  user_id?: string | null; // null = no es usuario de la app
};

export type CreateCasualMatchInput = {
  type: CasualMatchType;
  playedOn?: string | null; // 'YYYY-MM-DD' — null = hoy
  sets: [number, number][]; // perspectiva del lado 0
  visibility?: MatchVisibility;
  participants: CasualParticipant[];
};

// ── Lectura: mis amistosos (F5b) ────────────────────────────────────
// Los tipos generados aún no incluyen estas tablas → cast puntual del
// query builder. RLS permite leer; filtramos por participación propia.

type AnyFrom = (table: string) => {
  select: (cols: string) => {
    eq: (
      col: string,
      val: string,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
    in: (
      col: string,
      vals: string[],
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
};

export interface MyCasualStats {
  played: number;
  won: number;
  lost: number;
  winRate: number | null;
}

/**
 * Estadísticas de amistosos del usuario: partidos donde figura como
 * participante VINCULADO (user_id). Los registrados como texto libre
 * no cuentan — por eso el picker de plantilla importa.
 */
export async function fetchMyCasualStats(
  userId: string,
): Promise<MyCasualStats> {
  const from = supabase.from as unknown as AnyFrom;

  const { data: partsRaw, error: e1 } = await from(
    'casual_match_participants',
  )
    .select('match_id, side')
    .eq('user_id', userId);
  if (e1) throw new Error(e1.message);
  const parts = (partsRaw ?? []) as { match_id: string; side: number }[];
  if (parts.length === 0) return { played: 0, won: 0, lost: 0, winRate: null };

  const ids = [...new Set(parts.map((p) => p.match_id))];
  const { data: matchesRaw, error: e2 } = await from('casual_matches')
    .select('id, winner_side')
    .in('id', ids);
  if (e2) throw new Error(e2.message);
  const winnerById = new Map(
    ((matchesRaw ?? []) as { id: string; winner_side: number | null }[]).map(
      (m) => [m.id, m.winner_side],
    ),
  );

  let played = 0;
  let won = 0;
  for (const p of parts) {
    const w = winnerById.get(p.match_id);
    if (w == null) continue; // sin ganador (empate/incompleto) no computa
    played++;
    if (w === p.side) won++;
  }
  return {
    played,
    won,
    lost: played - won,
    winRate: played > 0 ? Math.round((won / played) * 100) : null,
  };
}

export async function createCasualMatch(
  input: CreateCasualMatchInput,
): Promise<string> {
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: string | null; error: { message: string } | null }>)(
    'create_casual_match',
    {
      p_type: input.type,
      p_played_on: input.playedOn ?? null,
      p_sets: input.sets,
      p_visibility: input.visibility ?? 'public',
      p_participants: input.participants.map((p) => ({
        side: p.side,
        slot: p.slot,
        name: p.name,
        user_id: p.user_id ?? null,
      })),
    },
  );
  if (error) throw new Error(error.message);
  return data as string;
}
