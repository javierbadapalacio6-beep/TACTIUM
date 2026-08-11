import { supabase } from '@core/supabase/client';

// Torneos del club (Fase 1: KO). Las tablas aún no están en los tipos
// generados → casts puntuales (mismo patrón que social.ts / clubSchedule.ts).

export type TournamentFormat =
  | 'ko'
  | 'ko_consolation'
  | 'groups_ko'
  | 'round_robin'
  | 'americano'
  | 'mexicano';

// Siembra del cuadro: 'points' = orden estricto por puntos (determinista);
// 'federative' = fija cabezas 1 y 2 y sortea las bandas (3-4, 5-8…) + resto,
// con seed guardada para reproducir el sorteo.
export type SeedingMode = 'points' | 'federative';

/** Cuota de inscripción legible: "20 €", "12,50 €" o "Gratis". */
export const formatFee = (
  amount: number | null | undefined,
  currency = 'EUR',
): string => {
  if (amount == null || amount <= 0) return 'Gratis';
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : currency;
  const n = Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace('.', ',');
  return currency === 'EUR' ? `${n} ${sym}` : `${sym}${n}`;
};
export const isSocialFormat = (f: string) => f === 'americano' || f === 'mexicano';
// Formato del PARTIDO (sets). Ver formatConfig.
export type MatchFormat = 'bo3_stb' | 'bo3_full' | 'bo1';

export const formatConfig = (
  f: string,
): { maxSets: number; setsToWin: number; thirdSuperTb: boolean; label: string } => {
  switch (f) {
    case 'bo3_full':
      return { maxSets: 3, setsToWin: 2, thirdSuperTb: false, label: 'Mejor de 3 sets' };
    case 'bo1':
      return { maxSets: 1, setsToWin: 1, thirdSuperTb: false, label: '1 set' };
    case 'bo3_stb':
    default:
      return {
        maxSets: 3,
        setsToWin: 2,
        thirdSuperTb: true,
        label: 'Mejor de 3 · super tie-break',
      };
  }
};

// Cuadros a efectos de FORMATO por fase (feedback Smash). Mapea el `bracket`
// interno de un partido a uno de los 3 cuadros que el club configura:
//  - 'consol'  → consolación
//  - 'groups'  → fase de grupos / liga
//  - 'main'    → cuadro principal (incl. oro/plata/bronce de grupos+KO)
// Los cuadros sociales (americano/mexicano) no puntúan por sets.
export type PhaseFormatGroup = 'main' | 'consol' | 'groups';
export const phaseFormatGroup = (bracket: string): PhaseFormatGroup => {
  if (bracket === 'consol') return 'consol';
  if (bracket === 'grp' || bracket === 'rr') return 'groups';
  return 'main';
};

/** Formato de partido efectivo de un partido: override por cuadro
 * (`phase_formats`) si existe, si no el `match_format` global del torneo. */
export const resolveMatchFormat = (
  t: { match_format?: string | null; phase_formats?: Record<string, string> | null } | null,
  bracket: string,
): MatchFormat => {
  const override = t?.phase_formats?.[phaseFormatGroup(bracket)];
  return (override ?? t?.match_format ?? 'bo3_stb') as MatchFormat;
};

export type TournamentStatus =
  | 'draft'
  | 'open'
  | 'in_progress'
  | 'finished'
  | 'canceled';

const localTodayIso = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** ¿Ya ha llegado la fecha de inicio? (sin fecha = se considera empezado). */
export const tournamentStarted = (startsOn: string | null): boolean =>
  !startsOn || startsOn <= localTodayIso();

/** Grupo/calendario según estado + fecha: un torneo con cuadro generado pero
 * fecha futura es "próximamente", no "en juego". */
export const tournamentBucket = (
  status: string,
  startsOn: string | null,
): 'live' | 'upcoming' | 'finished' => {
  if (status === 'finished' || status === 'canceled') return 'finished';
  if (status === 'in_progress' && tournamentStarted(startsOn)) return 'live';
  return 'upcoming';
};

/** Etiqueta de estado para el pill (según fecha). */
export const tournamentStatusLabel = (
  status: string,
  startsOn: string | null,
): string => {
  switch (status) {
    case 'finished': return 'COMPLETADO';
    case 'canceled': return 'CANCELADO';
    case 'in_progress': return tournamentStarted(startsOn) ? 'EN JUEGO' : 'PRÓXIMAMENTE';
    case 'open': return 'ABIERTO';
    case 'draft': return 'BORRADOR';
    default: return status.toUpperCase();
  }
};

// Premios estructurados: cada posición (1º/2º/…) con uno o varios conceptos.
export type PrizeItemType = 'metalico' | 'material' | 'otros';
export interface PrizeItem {
  type: PrizeItemType;
  amount?: number | null; // solo 'metalico'
  desc?: string | null; // 'material' / 'otros'
}
export interface PrizeEntry {
  place: string; // "1º", "2º", "Consolación"…
  items: PrizeItem[];
}
// Info adicional estructurada: filas título → detalle.
export interface InfoRow {
  label: string;
  value: string;
}

// Reglas de elegibilidad por categoría (nivel/puntos). Cada categoría tiene un
// tope de PUNTOS (suma de la pareja ≤) y/o un mínimo de NIVEL de liga (suma ≥).
// `mode` decide qué se valida. Categoría ausente o `null` = LIBRE (sin límite).
export type CategoryRuleMode = 'points' | 'nivel' | 'both';
export interface CategoryThreshold {
  puntos: number | null; // máximo de puntos de la pareja (suma) — null = sin tope
  nivel: number | null; // mínimo de nivel de liga de la pareja (suma) — null = sin mínimo
}
export interface CategoryRules {
  mode: CategoryRuleMode;
  // Clave: `${categoría}` (todos los géneros) o `${género}|${categoría}` cuando
  // el club fija umbrales distintos por género. Se resuelve con fallback.
  byCategory: Record<string, CategoryThreshold | null>;
}

/** Umbral de una categoría según el género (fallback: género|cat → cat). */
export function resolveCategoryThreshold(
  rules: CategoryRules | null | undefined,
  category: string | null,
  gender: string | null,
): CategoryThreshold | null {
  if (!rules || !category) return null;
  const bc = rules.byCategory ?? {};
  const byGender = gender ? bc[`${gender}|${category}`] : undefined;
  return (byGender !== undefined ? byGender : bc[category]) ?? null;
}

/**
 * Valida si una pareja puede jugar una categoría. Devuelve `null` si es apta,
 * o un mensaje de error (para bloquear la inscripción) si no cumple. Refleja la
 * misma lógica que la RPC `tournament_signup` (validación en servidor).
 */
export function checkCategoryEligibility(
  rules: CategoryRules | null | undefined,
  category: string | null,
  gender: string | null,
  pairPoints: number | null,
  pairNivel: number | null,
): string | null {
  if (!rules || !category) return null;
  const t = resolveCategoryThreshold(rules, category, gender);
  if (!t) return null; // LIBRE / sin regla
  const checkPts = rules.mode === 'points' || rules.mode === 'both';
  const checkNiv = rules.mode === 'nivel' || rules.mode === 'both';
  if (checkPts && t.puntos != null) {
    if (pairPoints == null)
      return `Indica los puntos de la pareja para la categoría ${category}.`;
    if (pairPoints > t.puntos)
      return `Superáis el máximo de ${t.puntos} puntos de ${category} (sumáis ${pairPoints}).`;
  }
  if (checkNiv && t.nivel != null) {
    if (pairNivel == null)
      return `Indica el nivel de liga de cada jugador para la categoría ${category}.`;
    if (pairNivel < t.nivel)
      return `Necesitáis nivel de liga ≥ ${t.nivel} en ${category} (sumáis ${pairNivel}).`;
  }
  return null;
}

export interface Tournament {
  id: string;
  club_id: string;
  name: string;
  format: TournamentFormat;
  status: TournamentStatus;
  starts_on: string | null;
  ends_on: string | null;
  location: string | null;
  prizes: string | null;
  extra_info: string | null;
  prizes_json: PrizeEntry[] | null;
  info_rows: InfoRow[] | null;
  observations: string | null;
  cover_url: string | null;
  entry_fee: number | null;
  // Cuota total si el jugador se inscribe en 2 categorías (null = sin precio especial).
  entry_fee_2: number | null;
  fee_currency: string;
  payment_mode: string;
  courts: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  rest_minutes: number;
  max_removable_hours: number | null;
  seeding_mode: SeedingMode;
  draw_seed: number | null;
  signup_code: string | null;
  max_pairs: number | null;
  // Mínimo de parejas recomendado por categoría (aviso al generar). NULL = sin mínimo.
  min_pairs: number | null;
  pair_based: boolean;
  match_format: string;
  // Formato de partido por CUADRO (override de match_format). Claves:
  // 'main' | 'consol' | 'groups'. Vacío = todos usan match_format.
  phase_formats: Record<string, string> | null;
  gender: string | null;
  genders: string[];
  category: string | null;
  categories: string[];
  category_rules: CategoryRules | null;
  created_at: string;
}

export type TournamentGender = 'masculino' | 'femenino' | 'mixto';

export interface TournamentRegistration {
  id: string;
  tournament_id: string;
  gender: string | null;
  category: string | null;
  group_no: number | null;
  pair_label: string | null;
  p1_name: string;
  p1_email: string | null;
  p1_phone: string | null;
  p1_user_id: string | null;
  p2_name: string | null;
  p2_email: string | null;
  p2_phone: string | null;
  p2_user_id: string | null;
  availability: string[];
  seed: number | null;
  seed_points: number | null;
  league_sum: number | null; // suma de nivel de liga de la pareja (para categorías por nivel)
  status: string;
  created_at: string;
  partner_code?: string | null; // código para vincular al compañero (jugador 2)
  // Enriquecidos en listRegistrations desde profiles (foto del jugador si la puso).
  p1_avatar?: string | null;
  p2_avatar?: string | null;
}

type AnyFrom = (table: string) => any;
type RpcResult = { data: unknown; error: { message: string } | null };

const from = () => supabase.from.bind(supabase) as unknown as AnyFrom;

// Código de inscripción legible (sin caracteres ambiguos).
const genCode = (): string => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
};

// Descarta posiciones/ítems vacíos antes de guardar los premios estructurados.
function cleanPrizes(list?: PrizeEntry[] | null): PrizeEntry[] | null {
  if (!list) return null;
  const out = list
    .map((e) => ({
      place: (e.place ?? '').trim(),
      items: (e.items ?? [])
        .map((it) =>
          it.type === 'metalico'
            ? { type: 'metalico' as const, amount: it.amount ?? null }
            : { type: it.type, desc: (it.desc ?? '').trim() },
        )
        .filter((it) =>
          it.type === 'metalico'
            ? it.amount != null && !Number.isNaN(it.amount)
            : !!it.desc,
        ),
    }))
    .filter((e) => e.place && e.items.length > 0);
  return out.length ? out : null;
}

// Normaliza las reglas de categoría: descarta topes vacíos y categorías LIBRE
// (sin ningún límite). Devuelve null si al final no queda ninguna regla.
function cleanCategoryRules(rules?: CategoryRules | null): CategoryRules | null {
  if (!rules) return null;
  const num = (v: unknown): number | null => {
    const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  const byCategory: Record<string, CategoryThreshold | null> = {};
  for (const [cat, t] of Object.entries(rules.byCategory ?? {})) {
    const puntos = num(t?.puntos);
    const nivel = num(t?.nivel);
    byCategory[cat] = puntos == null && nivel == null ? null : { puntos, nivel };
  }
  const hasAny = Object.values(byCategory).some((t) => t != null);
  if (!hasAny) return null;
  const mode: CategoryRuleMode =
    rules.mode === 'points' || rules.mode === 'nivel' ? rules.mode : 'both';
  return { mode, byCategory };
}

// Descarta filas de info vacías.
function cleanInfoRows(list?: InfoRow[] | null): InfoRow[] | null {
  if (!list) return null;
  const out = list
    .map((r) => ({ label: (r.label ?? '').trim(), value: (r.value ?? '').trim() }))
    .filter((r) => r.label || r.value);
  return out.length ? out : null;
}

/** Etiqueta legible de un premio estructurado (para mostrar). */
export function prizeItemLabel(it: PrizeItem): string {
  if (it.type === 'metalico') return `${formatFee(it.amount ?? 0, 'EUR')} en metálico`;
  if (it.type === 'material') return it.desc || 'Material';
  return it.desc || 'Otros';
}

export async function listTournaments(clubId: string): Promise<Tournament[]> {
  const { data, error } = await from()('tournaments')
    .select('*')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Tournament[];
}

export async function createTournament(input: {
  clubId: string;
  name: string;
  format: TournamentFormat;
  matchFormat?: MatchFormat;
  // Override de formato por cuadro ('main' | 'consol' | 'groups' → MatchFormat).
  phaseFormats?: Record<string, MatchFormat> | null;
  genders?: TournamentGender[];
  categories?: string[];
  startsOn?: string | null;
  endsOn?: string | null;
  maxPairs?: number | null;
  minPairs?: number | null;
  location?: string | null;
  prizes?: string | null;
  extraInfo?: string | null;
  prizesJson?: PrizeEntry[] | null;
  infoRows?: InfoRow[] | null;
  observations?: string | null;
  coverUrl?: string | null;
  seedingMode?: SeedingMode;
  entryFee?: number | null;
  entryFee2?: number | null;
  categoryRules?: CategoryRules | null;
  endTime?: string | null;
  maxRemovableHours?: number | null;
}): Promise<Tournament> {
  const payload = {
    club_id: input.clubId,
    name: input.name,
    format: input.format,
    match_format: input.matchFormat ?? 'bo3_stb',
    phase_formats: input.phaseFormats ?? {},
    genders: input.genders ?? [],
    categories: input.categories ?? [],
    starts_on: input.startsOn ?? null,
    ends_on: input.endsOn ?? null,
    seeding_mode: input.seedingMode ?? 'points',
    entry_fee: input.entryFee ?? null,
    entry_fee_2: input.entryFee2 ?? null,
    category_rules: cleanCategoryRules(input.categoryRules),
    ...(input.endTime ? { end_time: input.endTime } : {}),
    max_removable_hours: input.maxRemovableHours ?? null,
    max_pairs: input.maxPairs ?? null,
    min_pairs: input.minPairs ?? null,
    location: input.location?.trim() || null,
    prizes: input.prizes?.trim() || null,
    extra_info: input.extraInfo?.trim() || null,
    prizes_json: cleanPrizes(input.prizesJson),
    info_rows: cleanInfoRows(input.infoRows),
    observations: input.observations?.trim() || null,
    cover_url: input.coverUrl ?? null,
    // La inscripción queda abierta al crear el torneo (código compartible).
    status: 'open',
    signup_code: genCode(),
    pair_based: !isSocialFormat(input.format),
  };
  const { data, error } = await from()('tournaments')
    .insert(payload)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Tournament;
}

/**
 * Sube la foto de portada del torneo al bucket público `tournament-photos`
 * (path `{club_id}/{file}.jpg`; RLS deja escribir solo al admin del club) y
 * devuelve la URL pública. Se llama ANTES de crear el torneo (aún sin id), por
 * eso el nombre de archivo es aleatorio. Patrón `fetch(uri).arrayBuffer()`.
 */
export async function uploadTournamentCover(
  clubId: string,
  uri: string,
): Promise<string> {
  const path = `${clubId}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.jpg`;
  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();
  const { error: upErr } = await supabase.storage
    .from('tournament-photos')
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw upErr;
  const {
    data: { publicUrl },
  } = supabase.storage.from('tournament-photos').getPublicUrl(path);
  return publicUrl;
}

/** Edita los datos del evento (no toca formato/categorías/géneros: rompería
 * las divisiones ya sembradas). Solo el admin del club (RLS). */
export async function updateTournament(
  id: string,
  fields: {
    name?: string;
    startsOn?: string | null;
    endsOn?: string | null;
    location?: string | null;
    maxPairs?: number | null;
    prizes?: string | null;
    extraInfo?: string | null;
    prizesJson?: PrizeEntry[] | null;
    infoRows?: InfoRow[] | null;
    observations?: string | null;
    coverUrl?: string | null;
    seedingMode?: SeedingMode;
    entryFee?: number | null;
    matchFormat?: MatchFormat;
    phaseFormats?: Record<string, MatchFormat> | null;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (fields.name !== undefined) payload.name = fields.name.trim();
  if (fields.matchFormat !== undefined) payload.match_format = fields.matchFormat;
  if (fields.phaseFormats !== undefined) payload.phase_formats = fields.phaseFormats ?? {};
  if (fields.startsOn !== undefined) payload.starts_on = fields.startsOn;
  if (fields.endsOn !== undefined) payload.ends_on = fields.endsOn;
  if (fields.seedingMode !== undefined) payload.seeding_mode = fields.seedingMode;
  if (fields.entryFee !== undefined) payload.entry_fee = fields.entryFee;
  if (fields.location !== undefined) payload.location = fields.location?.trim() || null;
  if (fields.maxPairs !== undefined) payload.max_pairs = fields.maxPairs;
  if (fields.prizes !== undefined) payload.prizes = fields.prizes?.trim() || null;
  if (fields.extraInfo !== undefined) payload.extra_info = fields.extraInfo?.trim() || null;
  if (fields.prizesJson !== undefined) payload.prizes_json = cleanPrizes(fields.prizesJson);
  if (fields.infoRows !== undefined) payload.info_rows = cleanInfoRows(fields.infoRows);
  if (fields.observations !== undefined) payload.observations = fields.observations?.trim() || null;
  if (fields.coverUrl !== undefined) payload.cover_url = fields.coverUrl;
  if (Object.keys(payload).length === 0) return;
  const { error } = await from()('tournaments').update(payload).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Borra el torneo (cascada: inscripciones + partidos). Solo admin del club. */
export async function deleteTournament(id: string): Promise<void> {
  const { error } = await from()('tournaments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await from()('tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Tournament) ?? null;
}

// Enriquece las inscripciones con la foto de perfil de los jugadores vinculados.
async function enrichRegAvatars(
  regs: TournamentRegistration[],
): Promise<TournamentRegistration[]> {
  const ids = Array.from(
    new Set(
      regs
        .flatMap((r) => [r.p1_user_id, r.p2_user_id])
        .filter((x): x is string => !!x),
    ),
  );
  if (ids.length) {
    const { data: profs } = await from()('profiles')
      .select('id, avatar_url')
      .in('id', ids);
    const byId = new Map<string, string | null>(
      ((profs ?? []) as { id: string; avatar_url: string | null }[]).map((p) => [
        p.id,
        p.avatar_url,
      ]),
    );
    for (const r of regs) {
      r.p1_avatar = r.p1_user_id ? byId.get(r.p1_user_id) ?? null : null;
      r.p2_avatar = r.p2_user_id ? byId.get(r.p2_user_id) ?? null : null;
    }
  }
  return regs;
}

export async function listRegistrations(
  tournamentId: string,
): Promise<TournamentRegistration[]> {
  const { data, error } = await from()('tournament_registrations')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return enrichRegAvatars((data ?? []) as TournamentRegistration[]);
}

const rpcCall = (fn: string, args: Record<string, unknown>) =>
  (
    supabase.rpc.bind(supabase) as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => PromiseLike<RpcResult>
  )(fn, args);

/** Torneo público (solo lectura) para el jugador que lo sigue. */
export async function publicGetTournament(id: string): Promise<Tournament | null> {
  const { data, error } = await rpcCall('public_get_tournament', { p_id: id });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Tournament[])[0] ?? null;
}

/** Inscripciones públicas (sin email/teléfono) + avatares. */
export async function publicListRegistrations(
  id: string,
): Promise<TournamentRegistration[]> {
  const { data, error } = await rpcCall('public_tournament_regs', { p_id: id });
  if (error) throw new Error(error.message);
  return enrichRegAvatars((data ?? []) as TournamentRegistration[]);
}

/** Partidos públicos (solo lectura). */
export async function publicListMatches(id: string): Promise<TournamentMatch[]> {
  const { data, error } = await rpcCall('public_tournament_matches', { p_id: id });
  if (error) throw new Error(error.message);
  return ((data ?? []) as TournamentMatch[])
    .slice()
    .sort((a, b) => a.round - b.round || a.slot - b.slot);
}

export interface TournamentMatch {
  id: string;
  tournament_id: string;
  gender: string | null;
  category: string | null;
  group_no: number | null;
  bracket: string;
  round: number;
  slot: number;
  group_id: string | null;
  home_reg: string | null;
  away_reg: string | null;
  home_reg2: string | null; // 2º jugador del equipo local (americano/mexicano)
  away_reg2: string | null;
  home_score: number | null;
  away_score: number | null;
  winner_reg: string | null;
  status: string;
  scheduled_at: string | null;
  court: string | null;
  sets: number[][];
}

/** Alta manual de una pareja (por el club). Puntos opcionales para la siembra. */
export async function addRegistration(input: {
  tournamentId: string;
  gender?: string | null;
  category?: string | null;
  p1Name: string;
  p2Name?: string;
  p1Email?: string;
  p1Phone?: string;
  seedPoints?: number | null;
  availability?: string[];
}): Promise<void> {
  const { error } = await from()('tournament_registrations').insert({
    tournament_id: input.tournamentId,
    gender: input.gender ?? null,
    category: input.category ?? null,
    p1_name: input.p1Name.trim(),
    p2_name: input.p2Name?.trim() || null,
    p1_email: input.p1Email?.trim() || null,
    p1_phone: input.p1Phone?.trim() || null,
    seed_points: input.seedPoints ?? null,
    availability: input.availability ?? [],
  });
  if (error) throw new Error(error.message);
}

export async function deleteRegistration(id: string): Promise<void> {
  const { error } = await from()('tournament_registrations').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listMatches(
  tournamentId: string,
): Promise<TournamentMatch[]> {
  const { data, error } = await from()('tournament_matches')
    .select('*')
    .eq('tournament_id', tournamentId)
    .order('round', { ascending: true })
    .order('slot', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as TournamentMatch[];
}

const nextPow2 = (n: number): number => {
  let p = 1;
  while (p < n) p *= 2;
  return p;
};

const nearestPow2 = (n: number): number => {
  if (n < 1) return 1;
  const lower = 2 ** Math.floor(Math.log2(n));
  const upper = 2 ** Math.ceil(Math.log2(n));
  return n - lower <= upper - n ? lower : upper; // empate → la menor (regla FEP)
};

/** Nº de cabezas de serie recomendado (regla federativa): parejas/4 a la
 * potencia de 2 más cercana, nunca más que la mitad del cuadro. */
export const recommendedSeeds = (n: number): number => {
  if (n < 4) return 0;
  return Math.min(nearestPow2(Math.round(n / 4)), nextPow2(n) / 2);
};

// PRNG determinista (mulberry32) para reproducir un sorteo a partir de su seed.
const seededRng = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const shuffleWith = <T>(arr: T[], rng: () => number): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/**
 * Orden de entrada al cuadro/grupos.
 *  - 'points': orden estricto por puntos (determinista, como hasta ahora).
 *  - 'federative': fija cabezas 1 y 2, sortea las bandas (3-4, 5-8…) y el resto,
 *    con el `rng` (seed guardada) para poder reproducir el sorteo.
 */
function orderEntrants(
  regs: TournamentRegistration[],
  mode: SeedingMode,
  rng: () => number,
): TournamentRegistration[] {
  const byRank = [...regs].sort(
    (a, b) =>
      (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
      (a.created_at < b.created_at ? -1 : 1),
  );
  if (mode !== 'federative') return byRank;
  const numSeeds = recommendedSeeds(byRank.length);
  if (numSeeds <= 2) {
    return byRank.slice(0, numSeeds).concat(shuffleWith(byRank.slice(numSeeds), rng));
  }
  const seeds = byRank.slice(0, numSeeds);
  const rest = byRank.slice(numSeeds);
  let ordered = [seeds[0], seeds[1]];
  let band = 2;
  while (band < numSeeds) {
    ordered = ordered.concat(shuffleWith(seeds.slice(band, band * 2), rng));
    band *= 2;
  }
  return ordered.concat(shuffleWith(rest, rng));
}

// Resuelve el orden de siembra según el modo del torneo, generando y
// guardando la seed del sorteo la primera vez (para reproducirlo).
async function seedEntrants(
  tournament: Tournament,
  active: TournamentRegistration[],
): Promise<TournamentRegistration[]> {
  const mode: SeedingMode = tournament.seeding_mode ?? 'points';
  if (mode !== 'federative') return orderEntrants(active, 'points', () => 0);
  let seed = tournament.draw_seed;
  if (seed == null) {
    seed = Math.floor(Math.random() * 2147483647) + 1;
    await from()('tournaments').update({ draw_seed: seed }).eq('id', tournament.id);
  }
  return orderEntrants(active, 'federative', seededRng(seed));
}

// Orden de siembra estándar para un cuadro de tamaño `size` (potencia de 2):
// devuelve el nº de cabeza de serie por posición del cuadro (1-indexado).
const seedPositions = (size: number): number[] => {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const total = seeds.length * 2 + 1;
    const next: number[] = [];
    for (const s of seeds) {
      next.push(s);
      next.push(total - s);
    }
    seeds = next;
  }
  return seeds;
};

// ¿Ya hay partidos generados en esta división? (guard anti-duplicado).
async function hasDivisionMatches(
  tournamentId: string,
  gender: string | null,
  category: string | null,
  onlyKo = false,
): Promise<boolean> {
  let q = from()('tournament_matches')
    .select('id')
    .eq('tournament_id', tournamentId);
  q = gender == null ? q.is('gender', null) : q.eq('gender', gender);
  q = category == null ? q.is('category', null) : q.eq('category', category);
  if (onlyKo) q = q.neq('bracket', 'grp');
  const { data } = await q.limit(1);
  return ((data ?? []) as unknown[]).length > 0;
}

// Filas de un cuadro KO a partir de parejas YA sembradas (orden = siembra).
function koMatchRows(
  tournamentId: string,
  seeded: TournamentRegistration[],
  bracket: string,
  gender: string | null,
  category: string | null,
): Record<string, unknown>[] {
  const N = seeded.length;
  const size = nextPow2(N);
  const positions = seedPositions(size);
  const posReg = positions.map((seed) => (seed <= N ? seeded[seed - 1] : null));
  const rounds = Math.round(Math.log2(size));
  type M = {
    round: number;
    slot: number;
    home_reg: string | null;
    away_reg: string | null;
    status: string;
    winner_reg: string | null;
  };
  const byRound: M[][] = [];
  const r1: M[] = [];
  for (let s = 0; s < size / 2; s++) {
    const home = posReg[2 * s];
    const away = posReg[2 * s + 1];
    const isBye = !home || !away;
    r1.push({
      round: 1,
      slot: s,
      home_reg: home?.id ?? null,
      away_reg: away?.id ?? null,
      status: isBye ? 'bye' : 'pending',
      winner_reg: isBye ? home?.id ?? away?.id ?? null : null,
    });
  }
  byRound.push(r1);
  for (let r = 2; r <= rounds; r++) {
    const arr: M[] = [];
    for (let s = 0; s < size / Math.pow(2, r); s++) {
      arr.push({ round: r, slot: s, home_reg: null, away_reg: null, status: 'pending', winner_reg: null });
    }
    byRound.push(arr);
  }
  if (rounds >= 2) {
    for (const m of r1) {
      if (m.status === 'bye' && m.winner_reg) {
        const nm = byRound[1][Math.floor(m.slot / 2)];
        if (m.slot % 2 === 0) nm.home_reg = m.winner_reg;
        else nm.away_reg = m.winner_reg;
      }
    }
  }
  return byRound.flat().map((m) => ({
    tournament_id: tournamentId,
    gender,
    category,
    bracket,
    round: m.round,
    slot: m.slot,
    home_reg: m.home_reg,
    away_reg: m.away_reg,
    status: m.status,
    winner_reg: m.winner_reg,
  }));
}

// Esqueleto vacío de un cuadro KO de `size` plazas (todo placeholder). Usado
// para el cuadro de CONSOLACIÓN: sus plazas se rellenan con los perdedores de
// la 1ª ronda del cuadro principal a medida que se juegan.
function emptyKoRows(
  tournamentId: string,
  size: number,
  bracket: string,
  gender: string | null,
  category: string | null,
): Record<string, unknown>[] {
  const rounds = Math.round(Math.log2(size));
  const rows: Record<string, unknown>[] = [];
  for (let r = 1; r <= rounds; r++) {
    for (let s = 0; s < size / Math.pow(2, r); s++) {
      rows.push({
        tournament_id: tournamentId,
        gender,
        category,
        bracket,
        round: r,
        slot: s,
        home_reg: null,
        away_reg: null,
        status: 'pending',
        winner_reg: null,
      });
    }
  }
  return rows;
}

/** Cierra la inscripción y genera el cuadro KO de una división (cabezas por puntos).
 * Si el formato es `ko_consolation`, crea además el cuadro de CONSOLACIÓN (una
 * plaza por partido de 1ª ronda del principal) donde caen los perdedores de R1. */
export async function generateKoBracket(
  tournament: Tournament,
  regs: TournamentRegistration[],
  gender: string | null = null,
  category: string | null = null,
): Promise<void> {
  if (await hasDivisionMatches(tournament.id, gender, category))
    throw new Error('Esta división ya está generada.');
  const active = regs.filter((r) => r.status !== 'withdrawn');
  if (active.length < 2) throw new Error('Hacen falta al menos 2 parejas para el cuadro.');
  const seeded = await seedEntrants(tournament, active);
  await Promise.all(
    seeded.map((r, i) =>
      from()('tournament_registrations').update({ seed: i + 1 }).eq('id', r.id),
    ),
  );
  const rows = koMatchRows(tournament.id, seeded, 'main', gender, category);
  if (tournament.format === 'ko_consolation') {
    // Nº de plazas de consolación = nº de partidos de 1ª ronda del principal.
    const consolSize = nextPow2(seeded.length) / 2;
    if (consolSize >= 2)
      rows.push(...emptyKoRows(tournament.id, consolSize, 'consol', gender, category));
  }
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

// Etiqueta de cuadro por posición de grupo (oro/plata/bronce…).
export const POS_BRACKETS = ['gold', 'silver', 'bronze'];
export const posBracket = (p: number): string => POS_BRACKETS[p - 1] ?? `pos${p}`;
export const BRACKET_LABEL: Record<string, string> = {
  main: 'Cuadro',
  gold: 'Oro',
  silver: 'Plata',
  bronze: 'Bronce',
  consol: 'Consolación',
};

/** Nombre bonito de un cuadro: Oro/Plata/Bronce y "Consolación" para el resto
 * (los cuadros por posición 4º en adelante). */
export const bracketLabel = (b: string): string => {
  if (BRACKET_LABEL[b]) return BRACKET_LABEL[b];
  if (b.startsWith('pos')) {
    const n = parseInt(b.slice(3), 10) || 0;
    return n <= 4 ? 'Consolación' : `Consolación ${n - 3}`;
  }
  return b;
};

/** Orden de los cuadros por posición: Oro → Plata → Bronce → 4º → 5º… */
export const bracketRank = (b: string): number => {
  const fixed: Record<string, number> = { main: -1, gold: 0, silver: 1, bronze: 2, consol: 5 };
  if (fixed[b] !== undefined) return fixed[b];
  if (b.startsWith('pos')) return 10 + (parseInt(b.slice(3), 10) || 0);
  return 99;
};
export const groupName = (n: number): string => String.fromCharCode(65 + n); // A, B, C…

/** Genera la fase de GRUPOS (liguillas) de una división. Reparto serpiente por siembra. */
export async function generateGroups(
  tournament: Tournament,
  regs: TournamentRegistration[],
  gender: string | null,
  category: string | null,
  groupSize: number,
): Promise<void> {
  if (await hasDivisionMatches(tournament.id, gender, category))
    throw new Error('Esta división ya está generada.');
  const active = regs.filter((r) => r.status !== 'withdrawn');
  const N = active.length;
  if (N < 4) throw new Error('Para grupos hacen falta al menos 4 parejas.');
  const seeded = await seedEntrants(tournament, active);
  const G = Math.max(2, Math.ceil(N / groupSize));

  // Reparto serpiente: distribuye las cabezas de serie entre los grupos.
  const groups: TournamentRegistration[][] = Array.from({ length: G }, () => []);
  seeded.forEach((r, i) => {
    const row = Math.floor(i / G);
    const pos = i % G;
    const g = row % 2 === 0 ? pos : G - 1 - pos;
    groups[g].push(r);
  });

  await Promise.all(
    seeded.map((r, i) =>
      from()('tournament_registrations').update({ seed: i + 1 }).eq('id', r.id),
    ),
  );
  await Promise.all(
    groups.flatMap((grp, gi) =>
      grp.map((r) =>
        from()('tournament_registrations').update({ group_no: gi }).eq('id', r.id),
      ),
    ),
  );

  const rows: Record<string, unknown>[] = [];
  let slot = 0;
  groups.forEach((grp, gi) => {
    for (let i = 0; i < grp.length; i++) {
      for (let j = i + 1; j < grp.length; j++) {
        rows.push({
          tournament_id: tournament.id,
          gender,
          category,
          bracket: 'grp',
          group_no: gi,
          round: 1,
          slot: slot++,
          home_reg: grp[i].id,
          away_reg: grp[j].id,
          status: 'pending',
        });
      }
    }
  });
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

/**
 * Con los grupos terminados, genera las ELIMINATORIAS por posición: el 1º de
 * cada grupo → cuadro ORO, el 2º → PLATA, el 3º → BRONCE, etc.
 */
export async function generateKnockoutFromGroups(
  tournament: Tournament,
  regs: TournamentRegistration[],
  matches: TournamentMatch[],
  gender: string | null,
  category: string | null,
): Promise<void> {
  if (await hasDivisionMatches(tournament.id, gender, category, true))
    throw new Error('Las eliminatorias ya están generadas.');
  const groupNos = Array.from(
    new Set(regs.filter((r) => r.group_no != null).map((r) => r.group_no as number)),
  ).sort((a, b) => a - b);
  if (groupNos.length === 0) throw new Error('No hay grupos.');

  const standingsByGroup = new Map<number, StandingRow[]>();
  let maxPos = 0;
  for (const gn of groupNos) {
    const gRegs = regs.filter((r) => r.group_no === gn);
    const gMatches = matches.filter((m) => m.bracket === 'grp' && m.group_no === gn);
    const st = computeStandings(gRegs, gMatches);
    standingsByGroup.set(gn, st);
    maxPos = Math.max(maxPos, st.length);
  }

  const regById = new Map(regs.map((r) => [r.id, r]));
  const rows: Record<string, unknown>[] = [];
  for (let p = 1; p <= maxPos; p++) {
    // Clasificados en la posición p de cada grupo, ordenados por su rendimiento.
    const quals = groupNos
      .map((gn) => standingsByGroup.get(gn)![p - 1])
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.points - a.points ||
          b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
          b.gamesFor - b.gamesAgainst - (a.gamesFor - a.gamesAgainst),
      )
      .map((s) => regById.get(s.regId))
      .filter((r): r is TournamentRegistration => !!r);
    if (quals.length >= 2) {
      rows.push(...koMatchRows(tournament.id, quals, posBracket(p), gender, category));
    }
  }
  if (rows.length === 0) throw new Error('No hay suficientes clasificados.');
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
}

/**
 * Genera una LIGA (todos contra todos) para una división: crea C(N,2) partidos.
 * No hay cuadro; la clasificación sale de los resultados (computeStandings).
 */
export async function generateRoundRobin(
  tournament: Tournament,
  regs: TournamentRegistration[],
  gender: string | null = null,
  category: string | null = null,
): Promise<void> {
  if (await hasDivisionMatches(tournament.id, gender, category))
    throw new Error('Esta división ya está generada.');
  const active = regs.filter((r) => r.status !== 'withdrawn');
  if (active.length < 2) throw new Error('Hacen falta al menos 2 parejas.');
  const seeded = [...active].sort(
    (a, b) =>
      (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
      (a.created_at < b.created_at ? -1 : 1),
  );
  await Promise.all(
    seeded.map((r, i) =>
      from()('tournament_registrations').update({ seed: i + 1 }).eq('id', r.id),
    ),
  );
  const rows: Record<string, unknown>[] = [];
  let slot = 0;
  for (let i = 0; i < seeded.length; i++) {
    for (let j = i + 1; j < seeded.length; j++) {
      rows.push({
        tournament_id: tournament.id,
        gender,
        category,
        bracket: 'rr',
        round: 1,
        slot: slot++,
        home_reg: seeded[i].id,
        away_reg: seeded[j].id,
        status: 'pending',
      });
    }
  }
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

export interface StandingRow {
  regId: string;
  name: string;
  seed: number | null;
  played: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  points: number;
  // true si está en un empate a puntos entre 2 resuelto por el directo (h2h).
  h2h: boolean;
}

/** Clasificación de una liga/grupo a partir de los partidos jugados. */
export function computeStandings(
  regs: TournamentRegistration[],
  matches: TournamentMatch[],
): StandingRow[] {
  const nameOf = (r: TournamentRegistration) =>
    `${r.p1_name}${r.p2_name ? ` / ${r.p2_name}` : ''}`;
  const byId = new Map<string, StandingRow>();
  for (const r of regs) {
    byId.set(r.id, {
      regId: r.id,
      name: nameOf(r),
      seed: r.seed,
      played: 0,
      won: 0,
      lost: 0,
      setsFor: 0,
      setsAgainst: 0,
      gamesFor: 0,
      gamesAgainst: 0,
      points: 0,
      h2h: false,
    });
  }
  for (const m of matches) {
    if (m.status !== 'finished' || !m.home_reg || !m.away_reg) continue;
    const H = byId.get(m.home_reg);
    const A = byId.get(m.away_reg);
    if (!H || !A) continue;
    H.played++;
    A.played++;
    H.setsFor += m.home_score ?? 0;
    H.setsAgainst += m.away_score ?? 0;
    A.setsFor += m.away_score ?? 0;
    A.setsAgainst += m.home_score ?? 0;
    for (const s of m.sets ?? []) {
      H.gamesFor += s[0] ?? 0;
      H.gamesAgainst += s[1] ?? 0;
      A.gamesFor += s[1] ?? 0;
      A.gamesAgainst += s[0] ?? 0;
    }
    if (m.winner_reg === m.home_reg) {
      H.won++;
      A.lost++;
      H.points += 2;
      A.points += 1;
    } else {
      A.won++;
      H.lost++;
      A.points += 2;
      H.points += 1;
    }
  }
  const rows = Array.from(byId.values());
  // Enfrentamiento directo (solo empates a 2): quién ganó el partido entre ambos.
  const h2h = new Set<string>();
  for (const m of matches) {
    if (m.status === 'finished' && m.winner_reg && m.home_reg && m.away_reg) {
      const loser = m.winner_reg === m.home_reg ? m.away_reg : m.home_reg;
      h2h.add(`${m.winner_reg}:${loser}`);
    }
  }
  const samePoints = new Map<number, number>();
  for (const r of rows) samePoints.set(r.points, (samePoints.get(r.points) ?? 0) + 1);

  const sorted = rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    // Empate exacto entre 2 parejas → decide el resultado directo.
    if (samePoints.get(a.points) === 2) {
      if (h2h.has(`${a.regId}:${b.regId}`)) return -1;
      if (h2h.has(`${b.regId}:${a.regId}`)) return 1;
    }
    return (
      b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
      b.gamesFor - b.gamesAgainst - (a.gamesFor - a.gamesAgainst) ||
      b.won - a.won
    );
  });
  // Marca las parejas cuyo empate a 2 se resolvió por el directo.
  for (const r of sorted) {
    if (samePoints.get(r.points) !== 2) continue;
    const other = sorted.find((x) => x.regId !== r.regId && x.points === r.points);
    if (
      other &&
      (h2h.has(`${r.regId}:${other.regId}`) || h2h.has(`${other.regId}:${r.regId}`))
    ) {
      r.h2h = true;
    }
  }
  return sorted;
}

// ── Americano / Mexicano (jugadores individuales, ranking por puntos) ────────

export interface PlayerStanding {
  regId: string;
  name: string;
  played: number;
  won: number;
  points: number;
}

/** Ranking individual: puntos = suma de lo que anota tu equipo en cada partido. */
export function computeIndividualStandings(
  regs: TournamentRegistration[],
  matches: TournamentMatch[],
): PlayerStanding[] {
  const byId = new Map<string, PlayerStanding>();
  for (const r of regs)
    byId.set(r.id, { regId: r.id, name: r.p1_name, played: 0, won: 0, points: 0 });
  const add = (id: string | null, pts: number, win: boolean) => {
    if (!id) return;
    const p = byId.get(id);
    if (!p) return;
    p.played++;
    p.points += pts;
    if (win) p.won++;
  };
  for (const m of matches) {
    if (m.status !== 'finished') continue;
    const hs = m.home_score ?? 0;
    const as = m.away_score ?? 0;
    const homeWin = hs > as;
    add(m.home_reg, hs, homeWin);
    add(m.home_reg2, hs, homeWin);
    add(m.away_reg, as, !homeWin);
    add(m.away_reg2, as, !homeWin);
  }
  return Array.from(byId.values()).sort(
    (a, b) => b.points - a.points || b.won - a.won,
  );
}

const rotateArr = <T,>(arr: T[], by: number): T[] => {
  const n = arr.length;
  if (n === 0) return arr;
  const k = ((by % n) + n) % n;
  return [...arr.slice(k), ...arr.slice(0, k)];
};

/** AMERICANO: rondas rotando compañeros (pistas de 4). Jugadores múltiplo de 4. */
export async function generateAmericano(
  tournament: Tournament,
  regs: TournamentRegistration[],
  gender: string | null,
  category: string | null,
): Promise<void> {
  if (await hasDivisionMatches(tournament.id, gender, category))
    throw new Error('Este americano ya está generado.');
  const players = regs
    .filter((r) => r.status !== 'withdrawn')
    .sort(
      (a, b) =>
        (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
        (a.created_at < b.created_at ? -1 : 1),
    )
    .map((r) => r.id);
  const N = players.length;
  if (N < 4 || N % 4 !== 0)
    throw new Error('Para el americano hacen falta jugadores múltiplo de 4 (4, 8, 12…).');
  await Promise.all(
    players.map((id, i) =>
      from()('tournament_registrations').update({ seed: i + 1 }).eq('id', id),
    ),
  );
  const rounds = N - 1;
  const courts = N / 4;
  const rows: Record<string, unknown>[] = [];
  let slot = 0;
  for (let r = 0; r < rounds; r++) {
    const arr = [players[0], ...rotateArr(players.slice(1), r)];
    for (let ct = 0; ct < courts; ct++) {
      const [a, b, cc, d] = arr.slice(ct * 4, ct * 4 + 4);
      const teams =
        r % 3 === 0 ? [[a, b], [cc, d]] : r % 3 === 1 ? [[a, cc], [b, d]] : [[a, d], [b, cc]];
      rows.push({
        tournament_id: tournament.id,
        gender,
        category,
        bracket: 'amer',
        round: r + 1,
        slot: slot++,
        home_reg: teams[0][0],
        home_reg2: teams[0][1],
        away_reg: teams[1][0],
        away_reg2: teams[1][1],
        status: 'pending',
      });
    }
  }
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

/** MEXICANO: genera la SIGUIENTE ronda emparejando por la clasificación actual. */
export async function generateMexicanoRound(
  tournament: Tournament,
  regs: TournamentRegistration[],
  matches: TournamentMatch[],
  gender: string | null,
  category: string | null,
): Promise<void> {
  const players = regs.filter((r) => r.status !== 'withdrawn');
  const N = players.length;
  if (N < 4 || N % 4 !== 0)
    throw new Error('Para el mexicano hacen falta jugadores múltiplo de 4 (4, 8, 12…).');

  const existingRounds = matches.reduce((mx, m) => Math.max(mx, m.round), 0);
  if (existingRounds > 0) {
    const lastRound = matches.filter((m) => m.round === existingRounds);
    if (!lastRound.every((m) => m.status === 'finished'))
      throw new Error('Termina la ronda actual antes de generar la siguiente.');
  }
  const nextRound = existingRounds + 1;

  let ordered: string[];
  if (existingRounds === 0) {
    ordered = [...players]
      .sort(
        (a, b) =>
          (b.seed_points ?? -1) - (a.seed_points ?? -1) ||
          (a.created_at < b.created_at ? -1 : 1),
      )
      .map((r) => r.id);
    await Promise.all(
      ordered.map((id, i) =>
        from()('tournament_registrations').update({ seed: i + 1 }).eq('id', id),
      ),
    );
  } else {
    ordered = computeIndividualStandings(players, matches).map((s) => s.regId);
  }

  const rows: Record<string, unknown>[] = [];
  const baseSlot = matches.length;
  for (let ct = 0; ct < N / 4; ct++) {
    const [a, b, cc, d] = ordered.slice(ct * 4, ct * 4 + 4);
    rows.push({
      tournament_id: tournament.id,
      gender,
      category,
      bracket: 'mex',
      round: nextRound,
      slot: baseSlot + ct,
      home_reg: a,
      home_reg2: d,
      away_reg: b,
      away_reg2: cc,
      status: 'pending',
    });
  }
  const { error } = await from()('tournament_matches').insert(rows);
  if (error) throw new Error(error.message);
  await from()('tournaments').update({ status: 'in_progress' }).eq('id', tournament.id);
}

/** Resultado social (puntos por equipo; sin sets, sin avance de cuadro). */
export async function setSocialResult(
  match: TournamentMatch,
  homePoints: number,
  awayPoints: number,
): Promise<void> {
  const winner = homePoints >= awayPoints ? match.home_reg : match.away_reg;
  const { error } = await from()('tournament_matches')
    .update({
      home_score: homePoints,
      away_score: awayPoints,
      winner_reg: winner,
      status: 'finished',
    })
    .eq('id', match.id);
  if (error) throw new Error(error.message);
}

/** Si el partido tiene hueco reservado (día/hora) pero alguna de sus parejas
 * —ya conocidas— NO puede jugar a esa hora, lo saca a "sin hora" para recolocar.
 * Se llama al rellenar una pareja en un hueco que se reservó cuando aún no se
 * sabía quién jugaría (rondas KO futuras / consolación): así la app respeta la
 * disponibilidad en cuanto conoce a los jugadores, sin dejarlo en conflicto. */
async function clearSlotIfUnavailable(matchId: string): Promise<void> {
  const { data } = await from()('tournament_matches')
    .select('scheduled_at, home_reg, home_reg2, away_reg, away_reg2')
    .eq('id', matchId)
    .maybeSingle();
  const m = data as {
    scheduled_at: string | null;
    home_reg: string | null;
    home_reg2: string | null;
    away_reg: string | null;
    away_reg2: string | null;
  } | null;
  if (!m?.scheduled_at) return;
  const ids = [m.home_reg, m.home_reg2, m.away_reg, m.away_reg2].filter(
    (x): x is string => !!x,
  );
  if (ids.length === 0) return;
  const { data: regsRaw } = await from()('tournament_registrations')
    .select('id, availability')
    .in('id', ids);
  const dt = new Date(m.scheduled_at);
  const weekday = dt.getDay();
  const minute = dt.getHours() * 60 + dt.getMinutes();
  const anyUnavailable = ((regsRaw ?? []) as { availability: string[] | null }[]).some(
    (r) => !regAvailableAt(r as TournamentRegistration, weekday, minute),
  );
  if (anyUnavailable) {
    await from()('tournament_matches')
      .update({ scheduled_at: null, court: null })
      .eq('id', matchId);
  }
}

/** Coloca a `winner` en el hueco de la ronda siguiente del MISMO cuadro.
 * Devuelve true si había ronda siguiente (false si `match` era la final). */
async function advanceInBracket(
  m: {
    tournament_id: string;
    bracket: string;
    round: number;
    slot: number;
    category: string | null;
    gender: string | null;
  },
  winner: string,
): Promise<boolean> {
  let q = from()('tournament_matches')
    .select('id')
    .eq('tournament_id', m.tournament_id)
    .eq('bracket', m.bracket)
    .eq('round', m.round + 1)
    .eq('slot', Math.floor(m.slot / 2));
  q = m.category == null ? q.is('category', null) : q.eq('category', m.category);
  q = m.gender == null ? q.is('gender', null) : q.eq('gender', m.gender);
  const { data: next } = await q.maybeSingle();
  if (!next?.id) return false;
  await from()('tournament_matches')
    .update(m.slot % 2 === 0 ? { home_reg: winner } : { away_reg: winner })
    .eq('id', next.id);
  // El hueco de la ronda siguiente se reservó sin conocer a esta pareja: si
  // ahora no le vale por disponibilidad, lo sacamos a "sin hora" para recolocar.
  await clearSlotIfUnavailable(next.id);
  return true;
}

/** Estado de un partido concreto (para detectar BYEs del principal al llenar
 * la consolación). Devuelve null si no existe. */
async function matchStatusAt(
  tournamentId: string,
  bracket: string,
  round: number,
  slot: number,
  category: string | null,
  gender: string | null,
): Promise<string | null> {
  let q = from()('tournament_matches')
    .select('status')
    .eq('tournament_id', tournamentId)
    .eq('bracket', bracket)
    .eq('round', round)
    .eq('slot', slot);
  q = category == null ? q.is('category', null) : q.eq('category', category);
  q = gender == null ? q.is('gender', null) : q.eq('gender', gender);
  const { data } = await q.maybeSingle();
  return ((data as { status?: string } | null)?.status) ?? null;
}

/**
 * Mete el resultado por SETS y hace avanzar al ganador. `sets` = array de
 * [gamesHome, gamesAway] por set jugado. La app cuenta sets ganados y decide el
 * ganador (primero en llegar a `setsToWin`). Guarda el detalle en `sets` y los
 * sets ganados en home_score/away_score. En `ko_consolation`, el perdedor de la
 * 1ª ronda del cuadro principal pasa al cuadro de consolación.
 */
export async function setMatchResult(
  match: TournamentMatch,
  sets: number[][],
  setsToWin: number,
  advance: boolean = true,
): Promise<void> {
  if (!match.home_reg || !match.away_reg) {
    throw new Error('Faltan las dos parejas en este partido.');
  }
  const clean = sets.filter(
    (s) => s.length === 2 && (s[0] !== 0 || s[1] !== 0),
  );
  let wonHome = 0;
  let wonAway = 0;
  for (const [h, a] of clean) {
    if (h === a) throw new Error('Un set no puede quedar empatado.');
    if (h > a) wonHome++;
    else wonAway++;
  }
  if (wonHome < setsToWin && wonAway < setsToWin) {
    throw new Error('Marcador incompleto: nadie ha ganado los sets necesarios.');
  }
  const winner = wonHome > wonAway ? match.home_reg : match.away_reg;
  const upd = await from()('tournament_matches')
    .update({
      sets: clean,
      home_score: wonHome,
      away_score: wonAway,
      winner_reg: winner,
      status: 'finished',
    })
    .eq('id', match.id);
  if (upd.error) throw new Error(upd.error.message);
  if (!advance) return; // liga/grupo: no hay avance de cuadro.

  const loser = winner === match.home_reg ? match.away_reg : match.home_reg;
  const hadNext = await advanceInBracket(match, winner);
  // Solo la final del cuadro PRINCIPAL cierra el torneo: 'main' en KO y 'gold'
  // en grupos+KO. Las finales de otros cuadros (plata/bronce/consolación/pos…)
  // pueden cerrarse antes que la de oro y NO deben marcar el torneo finalizado.
  if (!hadNext && (match.bracket === 'main' || match.bracket === 'gold')) {
    await from()('tournaments')
      .update({ status: 'finished' })
      .eq('id', match.tournament_id);
  }

  // CONSOLACIÓN: el perdedor de la 1ª ronda del cuadro principal pasa al cuadro
  // de consolación, si el torneo lo tiene.
  if (match.bracket === 'main' && match.round === 1 && loser) {
    const cs = Math.floor(match.slot / 2);
    const side = match.slot % 2; // 0 = home, 1 = away
    let cq = from()('tournament_matches')
      .select('id')
      .eq('tournament_id', match.tournament_id)
      .eq('bracket', 'consol')
      .eq('round', 1)
      .eq('slot', cs);
    cq = match.category == null ? cq.is('category', null) : cq.eq('category', match.category);
    cq = match.gender == null ? cq.is('gender', null) : cq.eq('gender', match.gender);
    const { data: cmatch } = await cq.maybeSingle();
    if (cmatch?.id) {
      await from()('tournament_matches')
        .update(side === 0 ? { home_reg: loser } : { away_reg: loser })
        .eq('id', cmatch.id);
      // El hueco de consolación se reservó sin saber quién bajaría: si a este
      // perdedor no le vale por disponibilidad, se saca a "sin hora".
      await clearSlotIfUnavailable(cmatch.id);
      // Si el rival en consolación sale de un BYE del principal (nunca habrá
      // perdedor), este pasa directo a la siguiente ronda de consolación.
      const siblingSlot = 2 * cs + (1 - side);
      const sibStatus = await matchStatusAt(
        match.tournament_id, 'main', 1, siblingSlot, match.category, match.gender,
      );
      if (sibStatus === null || sibStatus === 'bye') {
        await from()('tournament_matches')
          .update({ status: 'bye', winner_reg: loser })
          .eq('id', cmatch.id);
        await advanceInBracket(
          {
            tournament_id: match.tournament_id,
            bracket: 'consol',
            round: 1,
            slot: cs,
            category: match.category,
            gender: match.gender,
          },
          loser,
        );
      }
    }
  }
}

// ─── MOTOR DE HORARIOS ────────────────────────────────────────────────
// Asigna hora + pista a cada partido con jugadores conocidos, respetando la
// disponibilidad marcada por los jugadores y sin solapar parejas ni pistas.

/** Guarda la configuración de horario del torneo (pistas, inicio, duración). */
export async function updateTournamentSchedule(
  tournamentId: string,
  cfg: {
    courts: number;
    startTime: string;
    slotMinutes: number;
    restMinutes?: number;
    endTime?: string;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {
    courts: Math.max(1, cfg.courts),
    start_time: cfg.startTime,
    slot_minutes: Math.max(15, cfg.slotMinutes),
  };
  if (cfg.endTime) payload.end_time = cfg.endTime;
  if (cfg.restMinutes !== undefined) payload.rest_minutes = Math.max(0, cfg.restMinutes);
  const { error } = await from()('tournaments').update(payload).eq('id', tournamentId);
  if (error) throw new Error(error.message);
}

// ─── Fases del torneo → día (planificación multi-día) ──────────────────
export interface PhaseDayRow {
  bracket: string;
  round: number;
  play_date: string;
}

const phaseKey = (bracket: string, round: number) => `${bracket}:${round}`;

/** Días asignados a cada fase (mapa "bracket:round" → lista de fechas ISO).
 * Una fase puede repartirse en varios días (p.ej. grupos en 3 días). */
export async function getPhaseDays(
  tournamentId: string,
): Promise<Record<string, string[]>> {
  const { data, error } = await from()('tournament_phase_days')
    .select('bracket, round, play_date')
    .eq('tournament_id', tournamentId)
    .order('play_date', { ascending: true });
  if (error) throw new Error(error.message);
  const map: Record<string, string[]> = {};
  for (const r of (data ?? []) as PhaseDayRow[]) {
    const k = phaseKey(r.bracket, r.round);
    (map[k] ??= []).push(r.play_date);
  }
  return map;
}

/** Añade o quita un día de una fase (toggle). Una fase puede tener varios. */
export async function togglePhaseDay(
  tournamentId: string,
  bracket: string,
  round: number,
  playDate: string,
  on: boolean,
): Promise<void> {
  if (on) {
    const { error } = await from()('tournament_phase_days').upsert(
      { tournament_id: tournamentId, bracket, round, play_date: playDate },
      { onConflict: 'tournament_id,bracket,round,play_date' },
    );
    if (error) throw new Error(error.message);
  } else {
    const { error } = await from()('tournament_phase_days')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('bracket', bracket)
      .eq('round', round)
      .eq('play_date', playDate);
    if (error) throw new Error(error.message);
  }
}

const DOW_TOKENS: Record<string, number> = {
  lun: 1, mar: 2, mié: 3, mie: 3, jue: 4, vie: 5, sáb: 6, sab: 6, dom: 0,
};

// Extrae de una cadena de disponibilidad los rangos [minInicio, minFin) y un
// día opcional. Tolerante a los formatos mezclados ("Sáb 18:00–21:00",
// "9:00–12:00", "mañana", "tarde", "noche"). Devuelve [] si no entiende nada.
function parseAvailabilityEntry(
  raw: string,
): { dow: number | null; from: number; to: number }[] {
  const s = raw.trim().toLowerCase();
  let dow: number | null = null;
  const firstWord = s.split(/\s+/)[0];
  if (firstWord in DOW_TOKENS) dow = DOW_TOKENS[firstWord];
  const out: { dow: number | null; from: number; to: number }[] = [];
  const re = /(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    const from = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    let to = parseInt(m[3], 10) * 60 + parseInt(m[4], 10);
    if (to <= from) to = 24 * 60; // "21:00–00:00"
    out.push({ dow, from, to });
  }
  if (out.length === 0) {
    if (s.includes('mañana')) out.push({ dow, from: 9 * 60, to: 14 * 60 });
    else if (s.includes('tarde')) out.push({ dow, from: 16 * 60, to: 21 * 60 });
    else if (s.includes('noche')) out.push({ dow, from: 21 * 60, to: 24 * 60 });
  }
  return out;
}

// Franjas de 1 hora dentro de la ventana diaria [startTime, endTime) del
// torneo. Usadas por la inscripción para que el jugador marque las horas que NO
// puede (hasta el tope que fije el club).
export function hourlyFranjas(
  startTime: string | null | undefined,
  endTime: string | null | undefined,
): { from: number; to: number; label: string }[] {
  const [sh, sm] = (startTime || '09:00').split(':').map(Number);
  const [eh, em] = (endTime || '22:00').split(':').map(Number);
  const start = (sh || 9) * 60 + (sm || 0);
  const end = (eh || 22) * 60 + (em || 0);
  const hhmm = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const out: { from: number; to: number; label: string }[] = [];
  for (let t = start; t + 60 <= end; t += 60)
    out.push({ from: t, to: t + 60, label: `${hhmm(t)}–${hhmm(t + 60)}` });
  return out;
}

// ¿Está esta inscripción disponible a `minute` del día `weekday`?
// `availability` guarda las franjas que el jugador NO puede (las que marcó en
// rojo en la inscripción). Disponible = el minuto NO cae en ninguna franja
// no-disponible de ese día. Sin franjas → disponible siempre (puede a cualquier
// hora). Así, marcar TODO un día como no disponible sí lo excluye (antes, al
// guardar el complemento, un día entero sin franjas se leía como "disponible").
function regAvailableAt(
  reg: TournamentRegistration,
  weekday: number,
  minute: number,
): boolean {
  const ranges = (reg.availability ?? []).flatMap(parseAvailabilityEntry);
  const applicable = ranges.filter((r) => r.dow == null || r.dow === weekday);
  return !applicable.some((r) => minute >= r.from && minute < r.to);
}

/** Inscripciones que participan en un partido (2 parejas, o 4 en social). */
function matchRegIds(m: TournamentMatch): string[] {
  return [m.home_reg, m.home_reg2, m.away_reg, m.away_reg2].filter(
    (x): x is string => !!x,
  );
}

export interface ScheduleResult {
  scheduled: number;
  unplaced: number;
}

// Cuadros de UNA sola fase (todos sus partidos van juntos, ronda 0).
const SINGLE_PHASE_BRACKETS = new Set(['grp', 'rr', 'amer', 'mex']);
/** ¿Es un cuadro que se ordena por rondas (KO por posición incl. pos4/5…)? */
export const isRoundBracket = (b: string): boolean => !SINGLE_PHASE_BRACKETS.has(b);

/** Fase de un partido para el planificador: KO se ordena por ronda; grupos/
 * liga/americano/mexicano son una sola fase (ronda 0). */
export function matchPhaseKey(m: TournamentMatch): string {
  return isRoundBracket(m.bracket)
    ? phaseKey(m.bracket, m.round)
    : phaseKey(m.bracket, 0);
}

/** Nombre genérico de una ronda de KO por su distancia a la final
 * (0=Final, 1=Semifinales, 2=Cuartos, 3=Octavos, 4=Dieciseisavos…). */
export const koRoundNameFromEnd = (fromEnd: number): string => {
  switch (fromEnd) {
    case 0: return 'Final';
    case 1: return 'Semifinales';
    case 2: return 'Cuartos';
    case 3: return 'Octavos';
    case 4: return 'Dieciseisavos';
    case 5: return 'Treintaidosavos';
    default: return `Ronda de ${2 ** (fromEnd + 1)}`;
  }
};

/** Clave de fase GENÉRICA para asignar días: los cuadros por posición
 * (oro/plata/bronce/consolación) COMPARTEN día por ronda genérica → `ko:fromEnd`.
 * Grupos/liga/social son una fase única (`grp:0`, `rr:0`…). */
export function genericPhaseDayKey(m: TournamentMatch, maxRoundOfBracket: number): string {
  if (!isRoundBracket(m.bracket)) return phaseKey(m.bracket, 0);
  return `ko:${maxRoundOfBracket - m.round}`;
}

// Lista de fechas ISO del torneo (inicio → fin).
function tournamentDays(t: Tournament): string[] {
  if (!t.starts_on) return [];
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const start = parse(t.starts_on);
  const end = t.ends_on ? parse(t.ends_on) : start;
  const out: string[] = [];
  const d = new Date(start);
  let guard = 0;
  while (d.getTime() <= end.getTime() && guard < 60) {
    out.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out;
}

// Días permitidos para un partido: los de su fase (varios posibles), filtrados
// a días válidos del torneo. Si la fase no tiene días → todos los del torneo.
// Usa la clave GENÉRICA (los cuadros por posición comparten día por ronda).
function allowedDaysFor(
  m: TournamentMatch,
  phaseDays: Record<string, string[]>,
  allDays: string[],
  maxRoundByBracket: Record<string, number>,
): string[] {
  const key = genericPhaseDayKey(m, maxRoundByBracket[m.bracket] ?? m.round);
  const raw = phaseDays[key] ?? [];
  const valid = raw.filter((d) => allDays.includes(d));
  return valid.length ? valid : allDays;
}

const rotate = <T>(arr: T[], by: number): T[] => {
  if (arr.length === 0) return arr;
  const k = ((by % arr.length) + arr.length) % arr.length;
  return [...arr.slice(k), ...arr.slice(0, k)];
};

/**
 * Genera el horario MULTI-DÍA. Cada fase puede repartirse en VARIOS días (mapa
 * `phaseDays`: fase → lista de días); el motor distribuye sus partidos entre
 * esos días y, dentro de cada día, por hora × pista respetando la
 * disponibilidad de ESE día, sin solapar parejas ni pistas y con el descanso
 * mínimo. Nunca fuerza: lo que no cabe queda sin hora (el club lo pone a mano).
 * Los partidos ya jugados conservan su hueco. Requiere `starts_on`.
 */
export async function autoScheduleTournament(
  tournament: Tournament,
  regs: TournamentRegistration[],
  matches: TournamentMatch[],
  phaseDays: Record<string, string[]> = {},
): Promise<ScheduleResult> {
  if (!tournament.starts_on)
    throw new Error('Pon una fecha al torneo antes de generar el horario.');

  const [sh, sm] = tournament.start_time.split(':').map(Number);
  const startMin = (sh || 9) * 60 + (sm || 0);
  const step = Math.max(15, tournament.slot_minutes);
  const rest = Math.max(0, tournament.rest_minutes ?? 0);
  const minSep = step + rest; // separación mínima entre 2 partidos de una pareja
  const courts = Math.max(1, tournament.courts);
  const regById = new Map(regs.map((r) => [r.id, r]));

  const allDays = tournamentDays(tournament);
  const [eh, em] = (tournament.end_time ?? '23:00').split(':').map(Number);
  const endMin = Math.max(startMin + step, (eh || 23) * 60 + (em || 0));
  const slotCount = Math.min(48, Math.max(1, Math.floor((endMin - startMin) / step) + 1));
  const times = Array.from({ length: slotCount }, (_, i) => startMin + i * step);

  // Estado por día (pistas ocupadas + horas ocupadas por pareja).
  interface DayState {
    weekday: number;
    courtBusy: Set<string>; // `${ti}:${court}`
    regTimes: Map<string, number[]>; // regId → minutos ocupados
  }
  const dayState = new Map<string, DayState>();
  for (const iso of allDays) {
    const [y, mo, d] = iso.split('-').map(Number);
    dayState.set(iso, {
      weekday: new Date(y, mo - 1, d).getDay(),
      courtBusy: new Set(),
      regTimes: new Map(),
    });
  }
  const isoOf = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  const known = matches.filter(
    (m) => m.status !== 'bye' && !!m.home_reg && !!m.away_reg,
  );
  // Nº de rondas por cuadro (para calcular la fase genérica de cada partido).
  const maxRoundByBracket: Record<string, number> = {};
  for (const m of matches)
    if (isRoundBracket(m.bracket))
      maxRoundByBracket[m.bracket] = Math.max(maxRoundByBracket[m.bracket] ?? 0, m.round);
  // Pre-reserva de los ya jugados (conservan su hueco en su día).
  for (const m of known) {
    if (m.status !== 'finished' || !m.scheduled_at) continue;
    const dt = new Date(m.scheduled_at);
    const st = dayState.get(isoOf(dt));
    if (!st) continue;
    const min = dt.getHours() * 60 + dt.getMinutes();
    const ti = times.findIndex((t) => t === min);
    const court = parseInt((m.court ?? '').replace(/\D/g, ''), 10) || 1;
    if (ti >= 0) st.courtBusy.add(`${ti}:${court}`);
    for (const id of matchRegIds(m)) {
      if (!st.regTimes.has(id)) st.regTimes.set(id, []);
      st.regTimes.get(id)!.push(min);
    }
  }

  // A colocar: todo lo no-bye y no-jugado. Incluye las rondas KO FUTURAS aún
  // sin parejas (placeholders): les RESERVAMOS hueco por fase para que el
  // horario llegue hasta la final (cuartos/semis/final salen como desplegables).
  // Al avanzar el cuadro, esos partidos ya tienen día/hora/pista y sólo se
  // rellenan las parejas. Los cuadros de una sola fase (grupos/liga/social) sí
  // requieren ambas parejas conocidas.
  const pending = matches.filter(
    (m) =>
      m.status !== 'bye' &&
      m.status !== 'finished' &&
      ((!!m.home_reg && !!m.away_reg) || isRoundBracket(m.bracket)),
  );
  const availableAt = (m: TournamentMatch, weekday: number, min: number): boolean =>
    matchRegIds(m).every((id) => {
      const r = regById.get(id);
      return r ? regAvailableAt(r, weekday, min) : true;
    });

  // Cuántos huecos-hora le valen a un partido en un día (para ordenar por restricción).
  const availCountDay = (m: TournamentMatch, iso: string): number => {
    const st = dayState.get(iso);
    if (!st) return 0;
    return times.reduce((n, t) => (availableAt(m, st.weekday, t) ? n + 1 : n), 0);
  };

  const updates: { id: string; scheduled_at: string | null; court: string | null }[] = [];
  const placedIds = new Set<string>();

  // Intenta colocar un partido en un día concreto. Devuelve true si lo coloca.
  const placeInDay = (m: TournamentMatch, iso: string): boolean => {
    const st = dayState.get(iso);
    if (!st) return false;
    const ids = matchRegIds(m);
    const [y, mo, d] = iso.split('-').map(Number);
    for (let ti = 0; ti < times.length; ti++) {
      const min = times[ti];
      if (ids.some((id) => (st.regTimes.get(id) ?? []).some((b) => Math.abs(b - min) < minSep)))
        continue;
      if (!availableAt(m, st.weekday, min)) continue;
      for (let court = 1; court <= courts; court++) {
        if (st.courtBusy.has(`${ti}:${court}`)) continue;
        st.courtBusy.add(`${ti}:${court}`);
        ids.forEach((id) => {
          if (!st.regTimes.has(id)) st.regTimes.set(id, []);
          st.regTimes.get(id)!.push(min);
        });
        const dt = new Date(y, mo - 1, d);
        dt.setHours(Math.floor(min / 60), min % 60, 0, 0);
        placedIds.add(m.id);
        updates.push({ id: m.id, scheduled_at: dt.toISOString(), court: `Pista ${court}` });
        return true;
      }
    }
    return false;
  };

  // Procesa por FASE: primero no-KO (grupos/liga/social), luego KO por ronda asc.
  // La CONSOLACIÓN se nutre de los perdedores de la 1ª ronda del principal, así
  // que su ronda R no puede jugarse antes que la ronda R+1 del principal: le
  // damos una "ronda efectiva" con offset +1 para que nunca se programe antes.
  const effRound = (key: string): number => {
    const [b, r] = key.split(':');
    return Number(r) + (b === 'consol' ? 1 : 0);
  };
  const phaseKeysOrdered = Array.from(new Set(pending.map((m) => matchPhaseKey(m)))).sort(
    (a, b) => {
      const ako = isRoundBracket(a.split(':')[0]);
      const bko = isRoundBracket(b.split(':')[0]);
      if (ako !== bko) return ako ? 1 : -1;
      const er = effRound(a) - effRound(b);
      if (er !== 0) return er;
      // A igual ronda efectiva, el principal antes que la consolación.
      const ca = a.split(':')[0] === 'consol' ? 1 : 0;
      const cb = b.split(':')[0] === 'consol' ? 1 : 0;
      return ca - cb;
    },
  );

  for (const pk of phaseKeysOrdered) {
    const phaseMatches = pending.filter((m) => matchPhaseKey(m) === pk);
    const days = allowedDaysFor(phaseMatches[0], phaseDays, allDays, maxRoundByBracket);
    // Más restringidos primero (menos huecos disponibles en total).
    phaseMatches.sort(
      (a, b) =>
        days.reduce((n, dd) => n + availCountDay(a, dd), 0) -
        days.reduce((n, dd) => n + availCountDay(b, dd), 0),
    );
    // Reparte entre los días de la fase (rotando el día preferido) y, si no cabe,
    // prueba el resto de días de la fase.
    phaseMatches.forEach((m, i) => {
      const order = rotate(days, i);
      for (const iso of order) if (placeInDay(m, iso)) return;
    });
  }

  // Lo que no cupo en ningún día de su fase → sin hora (el club lo pone a mano).
  for (const m of pending) {
    if (!placedIds.has(m.id)) {
      updates.push({ id: m.id, scheduled_at: null, court: null });
    }
  }

  await Promise.all(
    updates.map((u) =>
      from()('tournament_matches')
        .update({ scheduled_at: u.scheduled_at, court: u.court })
        .eq('id', u.id),
    ),
  );

  return {
    scheduled: placedIds.size,
    unplaced: pending.length - placedIds.size,
  };
}

/** ¿El partido cae en una hora en la que NO todos están disponibles? (para avisar) */
export function matchScheduleConflict(
  match: TournamentMatch,
  regs: TournamentRegistration[],
  _tournament: Tournament,
): boolean {
  if (!match.scheduled_at) return false;
  const dt = new Date(match.scheduled_at);
  const weekday = dt.getDay();
  const minute = dt.getHours() * 60 + dt.getMinutes();
  const byId = new Map(regs.map((r) => [r.id, r]));
  return matchRegIds(match).some((id) => {
    const r = byId.get(id);
    return r ? !regAvailableAt(r, weekday, minute) : false;
  });
}

/** ¿Están TODAS las parejas del partido disponibles en esa fecha+minuto? (cliente) */
export function matchAvailableAtDate(
  match: TournamentMatch,
  regs: TournamentRegistration[],
  dateIso: string,
  minute: number,
): boolean {
  const [y, mo, d] = dateIso.split('-').map(Number);
  const weekday = new Date(y, mo - 1, d).getDay();
  const byId = new Map(regs.map((r) => [r.id, r]));
  return matchRegIds(match).every((id) => {
    const r = byId.get(id);
    return r ? regAvailableAt(r, weekday, minute) : true;
  });
}

/** Coloca (o mueve) un partido a mano en un día/hora/pista concretos. */
export async function setMatchSlot(
  matchId: string,
  scheduledAtIso: string,
  court: string,
): Promise<void> {
  const { error } = await from()('tournament_matches')
    .update({ scheduled_at: scheduledAtIso, court })
    .eq('id', matchId);
  if (error) throw new Error(error.message);
}

/** Quita del horario UN partido (deja su hueco libre) sin tocar el resto. */
export async function clearMatchSlot(matchId: string): Promise<void> {
  const { error } = await from()('tournament_matches')
    .update({ scheduled_at: null, court: null })
    .eq('id', matchId);
  if (error) throw new Error(error.message);
}

/** Borra el horario asignado (todas las horas y pistas) de un torneo. */
export async function clearSchedule(tournamentId: string): Promise<void> {
  const { error } = await from()('tournament_matches')
    .update({ scheduled_at: null, court: null })
    .eq('tournament_id', tournamentId);
  if (error) throw new Error(error.message);
}

export interface TournamentLookup {
  id: string;
  name: string;
  genders: string[];
  categories: string[];
  pair_based: boolean;
  starts_on: string | null;
  ends_on: string | null;
  entry_fee: number | null;
  entry_fee_2: number | null;
  fee_currency: string;
  category_rules: CategoryRules | null;
  start_time: string;
  end_time: string;
  max_removable_hours: number | null;
}

// Fila pública para explorar torneos (cualquier jugador, sin ser del club).
export interface ExploreTournament {
  id: string;
  name: string;
  club_name: string;
  cover_url: string | null;
  location: string | null;
  starts_on: string | null;
  status: string;
  format: string;
  genders: string[];
  categories: string[];
  signup_code: string | null;
  pair_based: boolean;
  players: number;
  entry_fee: number | null;
  fee_currency: string;
}

/** Explora torneos abiertos de cualquier club (búsqueda por nombre/club/lugar). */
export async function exploreTournaments(
  search?: string,
): Promise<ExploreTournament[]> {
  const { data, error } = await rpcCall('explore_tournaments', {
    p_search: search?.trim() || null,
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as ExploreTournament[]).map((r) => ({
    ...r,
    players: Number(r.players ?? 0),
    entry_fee: r.entry_fee == null ? null : Number(r.entry_fee),
  }));
}

/** Torneos en los que el jugador está inscrito (cualquier estado). */
export async function myTournaments(): Promise<ExploreTournament[]> {
  const { data, error } = await rpcCall('my_tournaments', {});
  if (error) throw new Error(error.message);
  return ((data ?? []) as ExploreTournament[]).map((r) => ({
    ...r,
    players: Number(r.players ?? 0),
    entry_fee: r.entry_fee == null ? null : Number(r.entry_fee),
  }));
}

/** Busca un torneo por código (para mostrar nombre + categorías al apuntarse). */
export async function lookupTournament(
  code: string,
): Promise<TournamentLookup | null> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { data, error } = await rpc('tournament_lookup', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as TournamentLookup[];
  return rows[0] ?? null;
}

/** Inscripción pública por código (el que llama es el jugador 1). */
export async function signupByCode(input: {
  code: string;
  gender?: string | null;
  category?: string | null;
  p1Name: string;
  p1Email?: string;
  p1Phone?: string;
  p2Name: string;
  p2Email?: string;
  p2Phone?: string;
  availability?: string[];
  seedPoints?: number | null;
  leagueSum?: number | null;
}): Promise<string> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<RpcResult>;
  const { data, error } = await rpc('tournament_signup', {
    p_code: input.code.trim().toUpperCase(),
    p1_name: input.p1Name.trim(),
    p1_email: input.p1Email ?? null,
    p1_phone: input.p1Phone ?? null,
    p2_name: input.p2Name.trim(),
    p2_email: input.p2Email ?? null,
    p2_phone: input.p2Phone ?? null,
    p_availability: input.availability ?? [],
    p_category: input.category ?? null,
    p_gender: input.gender ?? null,
    p_seed_points: input.seedPoints ?? null,
    p_league_sum: input.leagueSum ?? null,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/** Código de compañero de una inscripción (solo lo ve el jugador 1 / vinculado). */
export async function getRegistrationPartnerCode(
  regId: string,
): Promise<string | null> {
  const { data, error } = await rpcCall('registration_partner_code', {
    p_reg_id: regId,
  });
  if (error) throw new Error(error.message);
  const v = data as unknown;
  if (typeof v === 'string') return v;
  const rows = (v ?? []) as { registration_partner_code?: string }[];
  return rows[0]?.registration_partner_code ?? null;
}

/** El compañero mete el código → vincula su cuenta como jugador 2. Devuelve el id del torneo. */
export async function claimPartnerByCode(code: string): Promise<string> {
  const { data, error } = await rpcCall('claim_partner_by_code', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * Envía por email al compañero el código para vincularse (edge function
 * `send-email` con Resend). Silencioso: si falla no rompe la inscripción.
 */
export async function sendPartnerInviteEmail(input: {
  toEmail: string;
  toName?: string | null;
  fromName: string;
  tournamentName: string;
  code: string;
}): Promise<boolean> {
  try {
    const { error } = await (
      supabase.functions.invoke.bind(supabase.functions) as unknown as (
        name: string,
        opts: { body: Record<string, unknown> },
      ) => PromiseLike<{ error: { message: string } | null }>
    )('send-email', {
      body: {
        kind: 'partner_invite',
        to: input.toEmail,
        to_name: input.toName ?? null,
        from_name: input.fromName,
        tournament_name: input.tournamentName,
        code: input.code,
      },
    });
    return !error;
  } catch {
    return false;
  }
}
