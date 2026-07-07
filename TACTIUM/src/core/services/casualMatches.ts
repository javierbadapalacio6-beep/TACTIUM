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
  amistosos: number;
  entrenos: number;
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
  if (parts.length === 0)
    return {
      played: 0,
      won: 0,
      lost: 0,
      winRate: null,
      amistosos: 0,
      entrenos: 0,
    };

  const ids = [...new Set(parts.map((p) => p.match_id))];
  const { data: matchesRaw, error: e2 } = await from('casual_matches')
    .select('id, winner_side, type')
    .in('id', ids);
  if (e2) throw new Error(e2.message);
  const matchById = new Map(
    (
      (matchesRaw ?? []) as {
        id: string;
        winner_side: number | null;
        type: string | null;
      }[]
    ).map((m) => [m.id, m]),
  );

  let played = 0;
  let won = 0;
  let amistosos = 0;
  let entrenos = 0;
  for (const p of parts) {
    const m = matchById.get(p.match_id);
    if (!m || m.winner_side == null) continue; // sin ganador no computa
    played++;
    if (m.winner_side === p.side) won++;
    if (m.type === 'entreno') entrenos++;
    else amistosos++;
  }
  return {
    played,
    won,
    lost: played - won,
    winRate: played > 0 ? Math.round((won / played) * 100) : null,
    amistosos,
    entrenos,
  };
}

// ── Colegas frecuentes ──────────────────────────────────────────────
// "Seguir" ligero SIN red social: la gente con la que YA has jugado
// amistosos, derivada de tu historial. Si un colega reclamó su cuenta
// (user_id), volver a elegirlo vincula sus nuevos partidos a sus stats.

export interface FrequentPartner {
  name: string;
  user_id: string | null;
  times: number;
}

export async function fetchMyFrequentPartners(
  userId: string,
): Promise<FrequentPartner[]> {
  const from = supabase.from as unknown as AnyFrom;

  const { data: mineRaw, error: e1 } = await from('casual_match_participants')
    .select('match_id')
    .eq('user_id', userId);
  if (e1) throw new Error(e1.message);
  const ids = [
    ...new Set(((mineRaw ?? []) as { match_id: string }[]).map((r) => r.match_id)),
  ];
  if (ids.length === 0) return [];

  const { data: allRaw, error: e2 } = await from('casual_match_participants')
    .select('name, user_id')
    .in('match_id', ids);
  if (e2) throw new Error(e2.message);

  const map = new Map<string, FrequentPartner>();
  for (const r of (allRaw ?? []) as { name: string | null; user_id: string | null }[]) {
    const name = (r.name ?? '').trim();
    if (!name || r.user_id === userId) continue;
    const key = name.toLowerCase();
    const cur = map.get(key);
    if (cur) {
      cur.times++;
      if (!cur.user_id && r.user_id) cur.user_id = r.user_id;
    } else {
      map.set(key, { name, user_id: r.user_id, times: 1 });
    }
  }
  return [...map.values()]
    .sort((a, b) => b.times - a.times)
    .slice(0, 12);
}

// ── Códigos de reclamo (migración 20260707_claim_codes.sql) ────────
// El invitado sin cuenta recibe el código del partido; al registrarse lo
// canjea en Stats y sus participaciones pasan a su cuenta.

type AnyRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>;

export interface ClaimableParticipant {
  participant_id: string;
  name: string;
  side: number;
  played_on: string | null;
}

/** Código de reclamo de un partido recién creado (null si la migración
 *  aún no está aplicada). */
export async function fetchClaimCode(matchId: string): Promise<string | null> {
  try {
    const from = supabase.from as unknown as AnyFrom;
    const { data, error } = await from('casual_matches')
      .select('claim_code')
      .eq('id', matchId);
    if (error) return null;
    const rows = (data ?? []) as { claim_code: string | null }[];
    return rows[0]?.claim_code ?? null;
  } catch {
    return null;
  }
}

/** Participaciones sin dueño de un código (para elegir "cuál soy yo"). */
export async function getClaimableParticipants(
  code: string,
): Promise<ClaimableParticipant[]> {
  const rpc = supabase.rpc as unknown as AnyRpc;
  const { data, error } = await rpc('get_claimable_participants', {
    p_code: code.trim(),
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as ClaimableParticipant[];
}

/** Vincula la participación elegida al usuario autenticado. */
export async function claimCasualParticipant(
  code: string,
  participantId: string,
): Promise<boolean> {
  const rpc = supabase.rpc as unknown as AnyRpc;
  const { data, error } = await rpc('claim_casual_participant', {
    p_code: code.trim(),
    p_participant_id: participantId,
  });
  if (error) throw new Error(error.message);
  return data === true;
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
