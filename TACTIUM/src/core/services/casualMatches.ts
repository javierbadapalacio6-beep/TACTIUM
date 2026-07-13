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
  // .bind: sin él la función pierde su this interno (this.rest) →
  // "Cannot read property 'rest' of undefined".
  const from = supabase.from.bind(supabase) as unknown as AnyFrom;

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

/**
 * ¿La cuenta actual tiene alguna participación vinculada en amistosos?
 * Lo usa el arranque para reactivar el modo jugador suelto al volver a
 * iniciar sesión (la elección local se borra en el logout).
 */
export async function hasCasualHistory(): Promise<boolean> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth?.user?.id;
    if (!uid) return false;
    const from = supabase.from.bind(supabase) as unknown as AnyFrom;
    const { data, error } = await from('casual_match_participants')
      .select('match_id')
      .eq('user_id', uid);
    if (error) return false;
    return ((data ?? []) as unknown[]).length > 0;
  } catch {
    return false;
  }
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
  // .bind: sin él la función pierde su this interno (this.rest) →
  // "Cannot read property 'rest' of undefined".
  const from = supabase.from.bind(supabase) as unknown as AnyFrom;

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
    // .bind: sin él la función pierde su this interno (this.rest) →
  // "Cannot read property 'rest' of undefined".
  const from = supabase.from.bind(supabase) as unknown as AnyFrom;
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
  const rpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;
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
  const rpc = supabase.rpc.bind(supabase) as unknown as AnyRpc;
  const { data, error } = await rpc('claim_casual_participant', {
    p_code: code.trim(),
    p_participant_id: participantId,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

// ── Resultados de mis amistosos ───────────────────────────────────

export interface CasualMatchSummary {
  id: string;
  playedOn: string | null;
  type: string;
  won: boolean;
  /** Marcador desde MI perspectiva, p. ej. "6-4 6-3". */
  sets: string;
  /** Mi compañero en ese partido (si consta). */
  partner: string | null;
  /** Pareja rival, p. ej. "Ruiz / Sanz". */
  rivals: string;
  /** Foto portada del partido (si la hay). */
  photoUrl: string | null;
}

/** Mis amistosos con resultado, del más reciente al más antiguo. */
export async function fetchMyCasualMatches(
  userId: string,
): Promise<CasualMatchSummary[]> {
  const from = supabase.from.bind(supabase) as unknown as AnyFrom;

  const { data: mineRaw, error: e1 } = await from('casual_match_participants')
    .select('match_id, side')
    .eq('user_id', userId);
  if (e1) throw new Error(e1.message);
  const mine = (mineRaw ?? []) as { match_id: string; side: number }[];
  if (mine.length === 0) return [];
  const sideByMatch = new Map(mine.map((r) => [r.match_id, r.side]));
  const ids = [...sideByMatch.keys()];

  const [mRes, pRes] = await Promise.all([
    from('casual_matches')
      .select('id, played_on, type, sets, winner_side, photo_url')
      .in('id', ids),
    from('casual_match_participants')
      .select('match_id, side, name, user_id')
      .in('match_id', ids),
  ]);
  if (mRes.error) throw new Error(mRes.error.message);
  if (pRes.error) throw new Error(pRes.error.message);

  type PartRow = {
    match_id: string;
    side: number;
    name: string | null;
    user_id: string | null;
  };
  const partsByMatch = new Map<string, PartRow[]>();
  for (const r of (pRes.data ?? []) as PartRow[]) {
    const list = partsByMatch.get(r.match_id) ?? [];
    list.push(r);
    partsByMatch.set(r.match_id, list);
  }

  const out: CasualMatchSummary[] = [];
  for (const m of (mRes.data ?? []) as {
    id: string;
    played_on: string | null;
    type: string | null;
    sets: [number, number][] | null;
    winner_side: number | null;
    photo_url: string | null;
  }[]) {
    if (m.winner_side == null) continue;
    const side = sideByMatch.get(m.id) ?? 0;
    const parts = partsByMatch.get(m.id) ?? [];
    const partner =
      parts.find((pt) => pt.side === side && pt.user_id !== userId)?.name ??
      null;
    const rivals = parts
      .filter((pt) => pt.side !== side)
      .map((pt) => pt.name)
      .filter(Boolean)
      .join(' / ');
    // Los sets se guardan en perspectiva del lado 0 → volteamos si soy el 1.
    const sets = (m.sets ?? [])
      .map(([a, b]) => (side === 0 ? `${a}-${b}` : `${b}-${a}`))
      .join(' ');
    out.push({
      id: m.id,
      playedOn: m.played_on,
      type: m.type ?? 'amistoso',
      won: m.winner_side === side,
      sets,
      partner,
      rivals,
      photoUrl: m.photo_url,
    });
  }
  return out
    .sort((a, b) => (b.playedOn ?? '').localeCompare(a.playedOn ?? ''))
    .slice(0, 20);
}

export async function createCasualMatch(
  input: CreateCasualMatchInput,
): Promise<string> {
  const { data, error } = await (supabase.rpc.bind(supabase) as unknown as (
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

// ── Foto del amistoso ──────────────────────────────────────────────
// Reutiliza el bucket público match-photos. Path 'casual/{uid}/{id}.jpg'
// (RLS: escribe solo el creador → foldername[2] = auth.uid()).
const CASUAL_PHOTO_BUCKET = 'match-photos';

type AnyUpdate = (table: string) => {
  update: (values: Record<string, unknown>) => {
    eq: (
      col: string,
      val: string,
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
};

/** Sube (o reemplaza) la foto del amistoso y guarda casual_matches.photo_url. */
export async function uploadCasualPhoto(
  userId: string,
  matchId: string,
  uri: string,
): Promise<string> {
  const path = `casual/${userId}/${matchId}.jpg`;
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from(CASUAL_PHOTO_BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw upErr;
  const {
    data: { publicUrl },
  } = supabase.storage.from(CASUAL_PHOTO_BUCKET).getPublicUrl(path);
  const url = `${publicUrl}?v=${Date.now()}`;
  const fromUpd = supabase.from.bind(supabase) as unknown as AnyUpdate;
  const { error: updErr } = await fromUpd('casual_matches')
    .update({ photo_url: url })
    .eq('id', matchId);
  if (updErr) throw new Error(updErr.message);
  return url;
}

/** Quita la foto del amistoso (borra el objeto y limpia photo_url). */
export async function removeCasualPhoto(
  userId: string,
  matchId: string,
): Promise<void> {
  try {
    await supabase.storage
      .from(CASUAL_PHOTO_BUCKET)
      .remove([`casual/${userId}/${matchId}.jpg`]);
  } catch (e) {
    console.warn('casual photo remove failed', e);
  }
  const fromUpd = supabase.from.bind(supabase) as unknown as AnyUpdate;
  const { error } = await fromUpd('casual_matches')
    .update({ photo_url: null })
    .eq('id', matchId);
  if (error) throw new Error(error.message);
}

// ── Detalle de un amistoso ─────────────────────────────────────────

export interface CasualParticipantRow {
  side: number;
  slot: number;
  name: string;
  user_id: string | null;
}

export interface CasualMatchDetail {
  id: string;
  type: string;
  playedOn: string | null;
  photoUrl: string | null;
  createdBy: string;
  winnerSide: number | null;
  /** Sets en perspectiva del lado 0, tal cual se guardan. */
  sets: [number, number][];
  /** Lado del usuario que consulta (donde participa); 0 por defecto. */
  mySide: 0 | 1;
  participants: CasualParticipantRow[];
}

/** Detalle completo de un amistoso: participantes por lado, sets y foto. */
export async function fetchCasualMatchDetail(
  matchId: string,
  userId: string,
): Promise<CasualMatchDetail | null> {
  const from = supabase.from.bind(supabase) as unknown as AnyFrom;
  const { data: mRaw, error: e1 } = await from('casual_matches')
    .select('id, type, played_on, photo_url, created_by, winner_side, sets')
    .eq('id', matchId);
  if (e1) throw new Error(e1.message);
  const m = (
    (mRaw ?? []) as {
      id: string;
      type: string | null;
      played_on: string | null;
      photo_url: string | null;
      created_by: string;
      winner_side: number | null;
      sets: [number, number][] | null;
    }[]
  )[0];
  if (!m) return null;

  const { data: pRaw, error: e2 } = await from('casual_match_participants')
    .select('side, slot, name, user_id')
    .eq('match_id', matchId);
  if (e2) throw new Error(e2.message);
  const participants = ((pRaw ?? []) as CasualParticipantRow[])
    .slice()
    .sort((a, b) => a.side - b.side || a.slot - b.slot);
  const mine = participants.find((p) => p.user_id === userId);
  const mySide = ((mine?.side ?? 0) === 1 ? 1 : 0) as 0 | 1;

  return {
    id: m.id,
    type: m.type ?? 'amistoso',
    playedOn: m.played_on,
    photoUrl: m.photo_url,
    createdBy: m.created_by,
    winnerSide: m.winner_side,
    sets: m.sets ?? [],
    mySide,
    participants,
  };
}

// ── Head-to-head ───────────────────────────────────────────────────
// Historial ENTRE encuentros anteriores a este partido. La identidad de un
// jugador es su user_id si está vinculado, o su nombre normalizado si es
// texto libre; una pareja = el conjunto (sin orden) de sus dos miembros.

export interface H2HPairResult {
  usNames: string[];
  themNames: string[];
  wins: number;
  losses: number;
  total: number;
}
export interface H2HIndividual {
  name: string;
  user_id: string | null;
  wins: number;
  losses: number;
  total: number;
}
export interface CasualH2H {
  /** Duelo de TU pareja vs esa pareja rival (encuentros previos). */
  pair: H2HPairResult | null;
  /** Tu H2H contra cada rival por separado (encuentros previos). */
  individuals: H2HIndividual[];
}

/**
 * H2H del usuario para un partido concreto: cuenta SOLO encuentros previos
 * (excluye el propio partido) entre las mismas parejas y contra cada rival.
 */
export async function fetchCasualH2H(
  userId: string,
  matchId: string,
): Promise<CasualH2H> {
  const from = supabase.from.bind(supabase) as unknown as AnyFrom;

  const { data: mineRaw, error: e1 } = await from('casual_match_participants')
    .select('match_id')
    .eq('user_id', userId);
  if (e1) throw new Error(e1.message);
  const ids = [
    ...new Set(
      ((mineRaw ?? []) as { match_id: string }[]).map((r) => r.match_id),
    ),
  ];
  if (ids.length === 0) return { pair: null, individuals: [] };

  const [pRes, mRes] = await Promise.all([
    from('casual_match_participants')
      .select('match_id, side, slot, name, user_id')
      .in('match_id', ids),
    from('casual_matches').select('id, winner_side').in('id', ids),
  ]);
  if (pRes.error) throw new Error(pRes.error.message);
  if (mRes.error) throw new Error(mRes.error.message);

  const winnerById = new Map(
    ((mRes.data ?? []) as { id: string; winner_side: number | null }[]).map(
      (m) => [m.id, m.winner_side],
    ),
  );
  type P = {
    match_id: string;
    side: number;
    slot: number;
    name: string | null;
    user_id: string | null;
  };
  const byMatch = new Map<string, P[]>();
  for (const r of (pRes.data ?? []) as P[]) {
    const l = byMatch.get(r.match_id) ?? [];
    l.push(r);
    byMatch.set(r.match_id, l);
  }

  const norm = (s: string | null) => (s ?? '').trim().toLowerCase();
  const keyOf = (p: P) => p.user_id ?? `n:${norm(p.name)}`;
  const pairKeyOf = (arr: P[]) => arr.map(keyOf).sort().join('|');

  const target = byMatch.get(matchId);
  if (!target) return { pair: null, individuals: [] };
  const myTarget = target.find((p) => p.user_id === userId);
  const mySide = myTarget?.side ?? 0;
  const otherSide = mySide === 0 ? 1 : 0;
  const ourMembers = target.filter((p) => p.side === mySide);
  const rivalMembers = target.filter((p) => p.side === otherSide);
  const ourPairKey = pairKeyOf(ourMembers);
  const rivalPairKey = pairKeyOf(rivalMembers);

  let pWins = 0;
  let pLoss = 0;
  let pTotal = 0;
  const indiv = new Map<string, H2HIndividual>();
  for (const rm of rivalMembers) {
    if (!norm(rm.name) && !rm.user_id) continue;
    indiv.set(keyOf(rm), {
      name: rm.name ?? '',
      user_id: rm.user_id,
      wins: 0,
      losses: 0,
      total: 0,
    });
  }

  for (const mid of ids) {
    if (mid === matchId) continue; // solo encuentros ANTERIORES a este
    const parts = byMatch.get(mid);
    if (!parts) continue;
    const w = winnerById.get(mid);
    if (w == null) continue;
    const meHere = parts.find((p) => p.user_id === userId);
    const side = meHere?.side ?? 0;
    const opp = side === 0 ? 1 : 0;
    const ourArr = parts.filter((p) => p.side === side);
    const oppArr = parts.filter((p) => p.side === opp);
    const iWon = w === side;

    if (pairKeyOf(ourArr) === ourPairKey && pairKeyOf(oppArr) === rivalPairKey) {
      pTotal++;
      if (iWon) pWins++;
      else pLoss++;
    }
    const oppKeys = new Set(oppArr.map(keyOf));
    for (const [k, v] of indiv) {
      if (oppKeys.has(k)) {
        v.total++;
        if (iWon) v.wins++;
        else v.losses++;
      }
    }
  }

  const pair: H2HPairResult | null =
    pTotal > 0
      ? {
          usNames: ourMembers.map((p) => p.name ?? '').filter(Boolean),
          themNames: rivalMembers.map((p) => p.name ?? '').filter(Boolean),
          wins: pWins,
          losses: pLoss,
          total: pTotal,
        }
      : null;
  const individuals = [...indiv.values()]
    .filter((v) => v.total > 0)
    .sort((a, b) => b.total - a.total);
  return { pair, individuals };
}
