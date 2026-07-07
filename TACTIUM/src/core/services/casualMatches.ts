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
