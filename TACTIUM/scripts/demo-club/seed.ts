/**
 * SEED DEL CLUB DEMO "Pádel Center Demo" — FECHAS RELATIVAS AL DÍA DE EJECUCIÓN
 * (creado 2026-09-04; rehecho 2026-10-05 para la demo de la 1.5.0 en Smash).
 *
 * Todo cuelga de HOY (fecha de Madrid) y del SÁBADO QUE VIENE (próxima jornada):
 *   - 7 cuentas demo.*@tactium.io (club, capitán, jugador, invitado,
 *     organizador «solo torneos», capitán en prueba sin tarjeta, cuenta nueva)
 *   - 3 equipos propios + 2 invitados, temporada con 7 jornadas jugadas (actas
 *     set a set, W.O.), próxima jornada con convocatoria Voy/Duda/No y
 *     alineación en borrador con 2 variantes
 *   - social: seguidores cruzados, amistosos con cara a cara, kudos, avisos
 *   - torneos con el MOTOR REAL: en juego HOY (con consolación), inscripción
 *     abierta, terminado con campeones, borrador; y 3 del organizador
 *
 * Ejecutar desde TACTIUM/:
 *   npx -y tsx@4.23.13 --tsconfig scripts/demo-club/tsconfig.json scripts/demo-club/seed.ts --reset
 *
 * Solo toca ids con prefijo de400000-… y cuentas demo.*@tactium.io.
 * Usa la service_role de tactium-web/.env.local.
 */
process.env.TZ = 'Europe/Madrid'; // el motor de horarios trabaja en hora local
import { supabase } from '@core/supabase/client';
import * as T from '../../src/core/services/tournaments';

const RESET = process.argv.includes('--reset');
const PASSWORD = 'TactiumDemo2026!';

// ─── ids deterministas ────────────────────────────────────────────────────────
const uid = (n: number) => `de400000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const U = {
  club: uid(1), capitan: uid(2), jugador: uid(3), invitado: uid(4),
  organizador: uid(5), prueba: uid(6), nuevo: uid(7),
};
const CLUB_ID = uid(100);
const ORG_CLUB_ID = uid(110);
const TEAM = { a: uid(101), b: uid(102), fem: uid(103), g1: uid(104), g2: uid(105), prueba: uid(106) };
const SEASON = { a: uid(201), b: uid(202), fem: uid(203), g1: uid(204), g2: uid(205), prueba: uid(206) };
const TOUR = {
  open: uid(301), draft: uid(302), done: uid(303), live: uid(304),
  orgOpen: uid(311), orgPay: uid(312), orgLive: uid(313),
};
const SUB_ID = uid(400);
const SUB_PRUEBA = uid(401);
const CASUAL = [uid(501), uid(502), uid(503), uid(504)];
const INVITE_ID = uid(600);
const INVITE_CODE = 'DEMPCA26'; // alfabeto real del generador (sin I, O, 0, 1)

const CLUB_NAME = 'Pádel Center Demo';
const ORG_CLUB_NAME = 'Torneos Costa Norte DEMO';

// ─── fechas relativas (Madrid) ───────────────────────────────────────────────
const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();
const NEXT_SAT = (() => { let d = addDays(TODAY, 1); while (weekday(d) !== 6) d = addDays(d, 1); return d; })();
/** Instante ISO con el desfase real de Madrid ese día (CEST/CET). */
function madrid(date: string, hhmm: string): string {
  const probe = new Date(`${date}T12:00:00Z`);
  const off = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', timeZoneName: 'longOffset' })
    .formatToParts(probe).find((p) => p.type === 'timeZoneName')!.value.replace('GMT', '') || '+00:00';
  return new Date(`${date}T${hhmm}:00${off}`).toISOString();
}
const hoursAgo = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();

// ─── utilidades ──────────────────────────────────────────────────────────────
type Res<X> = { data: X; error: { message: string } | null };
async function must<X>(p: PromiseLike<Res<X>>, what: string): Promise<X> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}
const db = supabase.from.bind(supabase) as unknown as (t: string) => any;
const log = (s: string) => console.log(s);

let seedRng = 20261005;
const rnd = () => {
  seedRng = (seedRng * 1103515245 + 12345) & 0x7fffffff;
  return seedRng / 0x7fffffff;
};
const pick = <X,>(arr: X[]) => arr[Math.floor(rnd() * arr.length)];
const shuffle = <X,>(arr: X[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
function makeSet(winnerIsHome: boolean): [number, number] {
  const r = rnd();
  const loserGames = r < 0.6 ? Math.floor(rnd() * 5) : r < 0.85 ? 5 : 6;
  const winnerGames = loserGames >= 5 ? 7 : 6;
  return winnerIsHome ? [winnerGames, loserGames] : [loserGames, winnerGames];
}
function makeMatch(weWin: boolean): [number, number][] {
  if (rnd() < 0.35) return [makeSet(!weWin), makeSet(weWin), makeSet(weWin)];
  return [makeSet(weWin), makeSet(weWin)];
}

// ─── datos ───────────────────────────────────────────────────────────────────
const NOMBRES_M = [
  'Rubén Cobo', 'Iván Setién', 'Pablo Gutiérrez', 'Adrián Lavín', 'Sergio Cagigas',
  'Jorge Palacio', 'Marcos Bustamante', 'Diego Herrán', 'Álvaro Toca', 'Carlos Ceballos',
  'Nacho Pardo', 'Mario Quintanal', 'Javier Solana', 'Luis Argumosa', 'Andrés Cuesta',
  'Raúl Bolado', 'Dani Escalante', 'Héctor Liaño', 'Gonzalo Mier', 'Óscar Peña',
  'Fernando Trueba', 'Miguel Ortiz', 'Alberto Sainz', 'Víctor Portilla', 'Guillermo Ruiz',
  'Samuel Vega', 'Enrique Cano', 'Roberto Diestro', 'Tomás Fernández', 'Pedro Mazón',
  'Hugo Revuelta', 'Aitor Gándara', 'Borja Cobo', 'Julián Setién', 'Ignacio Bada',
];
const NOMBRES_F = [
  'Lucía Herrera', 'Marta Cobo', 'Andrea Solana', 'Paula Gómez', 'Sara Quintana',
  'Elena Bustillo', 'Nerea Lastra', 'Claudia Ruiz', 'Irene Mazón', 'Alba Sañudo',
  'Carmen Villegas', 'Laura Pelayo', 'Cristina Ceballos', 'Ana Portilla', 'Noelia Vega',
  'Beatriz Trueba', 'Silvia Gándara', 'Raquel Diestro', 'Inés Bolado', 'Patricia Toca',
  'Rocío Herrán', 'Eva Argumosa', 'Julia Mier', 'Sofía Cuesta', 'Marina Liaño',
];
const RIVALES_M = [
  'MEDIO CUDEYO B', 'CENTRAL PÁDEL C', 'ZINK PÁDEL D', 'CÍRCULO DE RECREO A',
  'RACKET SPORT C', 'OLÍMPICO DE GAMA B', 'MARISMA DUIN E', 'PÁDEL CAYÓN A',
  'HOVELO B', 'BAHÍA ASÓN A', 'PÁDEL X5 B', 'TORRELAVEGA PÁDEL A',
  'SMASH PÁDEL C', 'PUERTOCHICO A',
];
const RIVALES_F = [
  'ATENEA B', 'MARISMA DUIN C', 'CENTRAL PÁDEL B', 'MEDIO CUDEYO A',
  'ZINK PÁDEL B', 'PÁDEL CAYÓN A', 'RACKET SPORT A', 'HOVELO A',
  'BAHÍA ASÓN B', 'CÍRCULO DE RECREO B', 'TORRELAVEGA PÁDEL B', 'OLÍMPICO DE GAMA A',
  'SMASH PÁDEL A', 'PUERTOCHICO B',
];
const SEDES: Record<string, string> = {
  'MEDIO CUDEYO B': 'Pádel Medio Cudeyo', 'CENTRAL PÁDEL C': 'Central Pádel Club',
  'ZINK PÁDEL D': 'Zink Pádel', 'CÍRCULO DE RECREO A': 'Círculo de Recreo de Torrelavega',
  'RACKET SPORT C': 'Racket Sport Santander', 'OLÍMPICO DE GAMA B': 'Olímpico de Gama',
  'MARISMA DUIN E': 'Marisma Duin', 'PÁDEL CAYÓN A': 'Pádel Cayón', 'HOVELO B': 'Hovelo Pádel',
  'BAHÍA ASÓN A': 'Pádel X5 Bahía Asón', 'PÁDEL X5 B': 'Pádel X5 Bahía Asón',
  'TORRELAVEGA PÁDEL A': 'Torrelavega Pádel', 'SMASH PÁDEL C': 'Smash Pádel Club',
  'PUERTOCHICO A': 'Pádel Puertochico', 'ATENEA B': 'Atenea Pádel', 'MARISMA DUIN C': 'Marisma Duin',
  'CENTRAL PÁDEL B': 'Central Pádel Club', 'MEDIO CUDEYO A': 'Pádel Medio Cudeyo',
  'ZINK PÁDEL B': 'Zink Pádel', 'RACKET SPORT A': 'Racket Sport Santander', 'HOVELO A': 'Hovelo Pádel',
  'BAHÍA ASÓN B': 'Pádel X5 Bahía Asón', 'CÍRCULO DE RECREO B': 'Círculo de Recreo de Torrelavega',
  'TORRELAVEGA PÁDEL B': 'Torrelavega Pádel', 'OLÍMPICO DE GAMA A': 'Olímpico de Gama',
  'SMASH PÁDEL A': 'Smash Pádel Club', 'PUERTOCHICO B': 'Pádel Puertochico',
};

// 14 sábados: J8 = el sábado que viene, J1..J7 ya jugadas.
const NEXT_J = 8;
const FECHAS_14 = Array.from({ length: 14 }, (_, i) => addDays(NEXT_SAT, 7 * (i + 1 - NEXT_J)));

// ─── RESET (solo ids de400000-… y cuentas demo.*) ────────────────────────────
async function reset() {
  log('— reset: borrando el demo anterior…');
  const teamIds = Object.values(TEAM);
  const seasonIds = Object.values(SEASON);
  const userIds = Object.values(U);
  const orgTours = (await must(db('tournaments').select('id').in('club_id', [CLUB_ID, ORG_CLUB_ID]), 'tours')) as { id: string }[];
  const tourIds = [...new Set([...Object.values(TOUR), ...orgTours.map((t) => t.id)])];
  for (const id of tourIds) if (!id.startsWith('de400000-')) throw new Error(`torneo ajeno en un club demo: ${id}`);

  const mds = (await must(db('matchdays').select('id').in('season_id', seasonIds), 'matchdays')) as { id: string }[];
  const mdIds = mds.map((m) => m.id);
  if (mdIds.length) {
    await must(db('activity_kudos').delete().eq('target_kind', 'league').in('target_id', mdIds), 'del kudos league');
    for (const t of ['match_results', 'lineups', 'lineup_variants', 'availability'])
      await must(db(t).delete().in('matchday_id', mdIds), `del ${t}`);
    await must(db('posts').delete().in('matchday_id', mdIds), 'del posts');
    await must(db('matchdays').delete().in('id', mdIds), 'del matchdays');
  }
  await must(db('activity_kudos').delete().eq('target_kind', 'casual').in('target_id', CASUAL), 'del kudos casual');
  await must(db('casual_match_participants').delete().in('match_id', CASUAL), 'del casual parts');
  await must(db('casual_matches').delete().in('id', CASUAL), 'del casual');
  await must(db('seasons').delete().in('id', seasonIds), 'del seasons');
  await must(db('players').delete().in('team_id', teamIds), 'del players');
  await must(db('team_members').delete().in('team_id', teamIds), 'del team_members');
  await must(db('team_invitations').delete().in('team_id', teamIds), 'del invitations');
  await must(db('teams').delete().in('id', teamIds), 'del teams');

  for (const t of ['tournament_matches', 'tournament_phase_days', 'tournament_registrations', 'tournament_payments'])
    await must(db(t).delete().in('tournament_id', tourIds), `del ${t}`);
  await must(db('tournaments').delete().in('id', tourIds), 'del tournaments');

  for (const sid of [SUB_ID, SUB_PRUEBA]) {
    await must(db('subscription_events').delete().eq('subscription_id', sid), 'del sub events');
    await must(db('subscriptions').delete().eq('id', sid), 'del subscription');
  }
  for (const cid of [CLUB_ID, ORG_CLUB_ID]) {
    await must(db('follows').delete().eq('target_type', 'club').eq('target_id', cid).in('follower_id', userIds), 'del follows club');
    await must(db('club_members').delete().eq('club_id', cid), 'del club_members');
    await must(db('clubs').delete().eq('id', cid), 'del club');
  }
  await must(db('follows').delete().in('follower_id', userIds), 'del follows');
  await must(db('notifications').delete().in('user_id', userIds), 'del notifications');
  await must(db('posts').delete().in('author_id', userIds), 'del posts');
  await must(db('favorites').delete().in('user_id', userIds), 'del favorites');
  await must(db('push_tokens').delete().in('user_id', userIds), 'del push_tokens');
  for (const id of userIds) {
    const { error } = await supabase.auth.admin.deleteUser(id);
    if (error && !/not found/i.test(error.message)) throw new Error(`deleteUser ${id}: ${error.message}`);
  }
  await must(db('profiles').delete().in('id', userIds), 'del profiles');
  log('— reset hecho');
}

// ─── CUENTAS ─────────────────────────────────────────────────────────────────
async function createUser(id: string, email: string, fullName: string, username: string, extra: Record<string, unknown> = {}) {
  if (!/^demo\.[a-z]+@tactium\.io$/.test(email)) throw new Error(`email no demo: ${email}`);
  const { error } = await supabase.auth.admin.createUser({
    id, email, password: PASSWORD, email_confirm: true, user_metadata: { full_name: fullName },
  } as never);
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  await must(
    db('profiles').upsert({ id, email, full_name: fullName, username, onboarded: true, home_club: CLUB_NAME, ...extra }),
    `profile ${email}`,
  );
  log(`  ✓ ${email}`);
}

async function seedAccounts() {
  log('— cuentas');
  await createUser(U.club, 'demo.club@tactium.io', 'Lucía Herrera', 'luciaherrera', { bio: 'Gestora de Pádel Center Demo' });
  await createUser(U.capitan, 'demo.capitan@tactium.io', 'Rubén Cobo', 'rubencobo', { preferred_side: 'drive', bio: 'Capitán del A. Drive de toda la vida.' });
  await createUser(U.jugador, 'demo.jugador@tactium.io', 'Iván Setién', 'ivansetien', { preferred_side: 'reves', bio: 'Revés del A. Si hay amistoso, me apunto.' });
  await createUser(U.invitado, 'demo.invitado@tactium.io', 'Nacho Bolado', 'nachobolado', { preferred_side: 'ambos', home_club: 'Club Tenis Liencres' });
  await createUser(U.organizador, 'demo.organizador@tactium.io', 'Elena Pereda', 'elenapereda', { home_club: ORG_CLUB_NAME, bio: 'Organizo torneos en la costa de Cantabria.' });
  await createUser(U.prueba, 'demo.prueba@tactium.io', 'Daniel Arce', 'danielarce', { preferred_side: 'drive', home_club: null });
  await createUser(U.nuevo, 'demo.nuevo@tactium.io', 'Laura Sáinz', 'laurasainz', { home_club: null, onboarded: false });
}

// ─── CLUB + SUSCRIPCIÓN ──────────────────────────────────────────────────────
async function seedClub() {
  log('— club');
  await must(db('clubs').insert({ id: CLUB_ID, owner_id: U.club, name: CLUB_NAME, federation: 'FCantP', is_demo: true }), 'club');
  const cm = (await must(db('club_members').select('id').eq('club_id', CLUB_ID).eq('user_id', U.club), 'cm')) as unknown[];
  if (cm.length === 0) await must(db('club_members').insert({ club_id: CLUB_ID, user_id: U.club, role: 'admin' }), 'club_members');
  await must(
    db('subscriptions').insert({
      id: SUB_ID, subject_type: 'club', subject_id: CLUB_ID, payer_user_id: U.club,
      plan_tier: 'club_pro', billing_period: 'yearly', status: 'active',
      current_period_start: new Date(Date.now() - 50 * 864e5).toISOString(),
      current_period_end: new Date(Date.now() + 315 * 864e5).toISOString(), trial_end: null,
      cancel_at_period_end: false, revenuecat_customer_id: U.club,
      original_transaction_id: 'purchase_tactium_club_pro_yearly_demo_padelcenter',
      product_id: 'tactium_club_pro_yearly', platform: 'android',
    }),
    'subscription',
  );
  await must(
    db('favorites').insert([
      { user_id: U.club, kind: 'federation', ref_id: 'FCantP', label: 'Federación Cántabra de Pádel', meta: 'Cantabria' },
      { user_id: U.capitan, kind: 'federation', ref_id: 'FCantP', label: 'Federación Cántabra de Pádel', meta: 'Cantabria' },
    ]),
    'favorites',
  );
  log('  ✓ Pádel Center Demo (club_pro activo)');
}

// ─── EQUIPOS + PLANTILLAS ────────────────────────────────────────────────────
interface TeamSpec {
  id: string; name: string; gender: 'masculino' | 'femenino'; category: string;
  owner: string; own: boolean; slots: string[]; roster: number; ptsRange: [number, number];
}
const TEAMS: TeamSpec[] = [
  { id: TEAM.a, name: 'PÁDEL CENTER DEMO A', gender: 'masculino', category: '2ª', owner: U.club, own: true, slots: ['6|10:00', '6|12:00'], roster: 13, ptsRange: [1400, 2450] },
  { id: TEAM.b, name: 'PÁDEL CENTER DEMO B', gender: 'masculino', category: '4ª', owner: U.club, own: true, slots: ['0|10:00'], roster: 11, ptsRange: [320, 900] },
  { id: TEAM.fem, name: 'PÁDEL CENTER DEMO A - FISIO HERRERA', gender: 'femenino', category: '3ª', owner: U.club, own: true, slots: ['6|16:00', '6|18:00'], roster: 10, ptsRange: [700, 1600] },
  { id: TEAM.g1, name: 'LOS CORRALES PÁDEL B', gender: 'masculino', category: '3ª', owner: U.club, own: false, slots: ['6|18:00'], roster: 11, ptsRange: [800, 1700] },
  { id: TEAM.g2, name: 'CLUB TENIS LIENCRES C', gender: 'femenino', category: '4ª', owner: U.invitado, own: false, slots: ['0|12:00'], roster: 9, ptsRange: [300, 900] },
];
const COURTS: Record<string, number> = { masculino: 5, femenino: 4 };
const PLAYERS: Record<string, { id: string; name: string; pts: number; user_id: string | null }[]> = {};

async function insertRoster(teamId: string, names: string[], range: [number, number], userOf: (n: string) => string | null) {
  const [lo, hi] = range;
  const rows = names.map((name, i) => ({
    team_id: teamId, name,
    pts: Math.round(hi - ((hi - lo) * i) / Math.max(1, names.length - 1) + (rnd() * 80 - 40)),
    position: i % 3 === 2 ? 'Ambos' : i % 2 === 0 ? 'Drive' : 'Revés',
    user_id: userOf(name), active: true, available: true,
  }));
  const inserted = (await must(db('players').insert(rows).select('id,name,pts,user_id'), `players ${teamId}`)) as { id: string; name: string; pts: number; user_id: string | null }[];
  return inserted.sort((a, b) => b.pts - a.pts);
}

async function seedTeams() {
  log('— equipos y plantillas');
  let im = 2, iF = 1; // saltamos Rubén/Iván y Lucía (ya usados)
  for (const t of TEAMS) {
    await must(
      db('teams').insert({
        id: t.id, owner_id: t.owner, name: t.name, federation: 'FCantP', league: 'Liga Cántabra de Pádel',
        category: t.category, gender: t.gender, club_id: t.own ? CLUB_ID : null,
        venue_club_id: t.own ? null : CLUB_ID, covered: t.own, preferred_home_slots: t.slots,
      }),
      `team ${t.name}`,
    );
    const tm = (await must(db('team_members').select('user_id').eq('team_id', t.id), 'tm')) as { user_id: string }[];
    if (!tm.some((m) => m.user_id === t.owner))
      await must(db('team_members').insert({ team_id: t.id, user_id: t.owner, role: 'captain' }), 'tm owner');
    const names: string[] = t.id === TEAM.a ? ['Rubén Cobo', 'Iván Setién'] : [];
    while (names.length < t.roster) {
      const n = t.gender === 'masculino' ? NOMBRES_M[im++ % NOMBRES_M.length] : NOMBRES_F[iF++ % NOMBRES_F.length];
      if (!names.includes(n) && n !== 'Rubén Cobo' && n !== 'Iván Setién') names.push(n);
    }
    PLAYERS[t.id] = await insertRoster(t.id, names, t.ptsRange, (n) =>
      t.id === TEAM.a && n === 'Rubén Cobo' ? U.capitan : t.id === TEAM.a && n === 'Iván Setién' ? U.jugador : null);
    log(`  ✓ ${t.name} (${names.length} jugadores)${t.own ? '' : ' · INVITADO'}`);
  }
  await must(
    db('team_members').insert([
      { team_id: TEAM.a, user_id: U.capitan, role: 'captain' },
      { team_id: TEAM.a, user_id: U.jugador, role: 'player' },
    ]),
    'team_members A',
  );
  // Código de jugador del A, reutilizable y legible (tactium.io/i/CÓDIGO).
  await must(
    db('team_invitations').insert({
      id: INVITE_ID, code: INVITE_CODE, team_id: TEAM.a, role: 'player', created_by: U.capitan,
      multi_use: true, uses: 2, expires_at: new Date(Date.now() + 100 * 365 * 864e5).toISOString(),
    }),
    'invitation',
  );
  log(`  ✓ código de jugador del A: ${INVITE_CODE}`);
}

// ─── TEMPORADAS Y JORNADAS ───────────────────────────────────────────────────
interface MdSpec { jornada: number; date: string; opponent: string; home: boolean; time?: string | null; location?: string | null; unconfirmed?: boolean }
function buildCalendar(rivales: string[], dates: string[], homeFirst: boolean, homeTime: string): MdSpec[] {
  return dates.map((date, i) => {
    const home = homeFirst ? i % 2 === 0 : i % 2 === 1;
    const opp = rivales[i % rivales.length];
    return { jornada: i + 1, date, opponent: opp, home, time: home ? homeTime : pick(['10:00', '11:30', '16:00', '17:30']), location: home ? CLUB_NAME : SEDES[opp] ?? null };
  });
}
async function ensureVariant(mdId: string, label: string, active: boolean): Promise<{ id: string }> {
  const existing = (await must(db('lineup_variants').select('id').eq('matchday_id', mdId).eq('label', label), 'variant lookup')) as { id: string }[];
  if (existing.length) {
    await must(db('lineup_variants').update({ is_active: active }).eq('id', existing[0].id), 'variant activate');
    return existing[0];
  }
  return (await must(db('lineup_variants').insert({ matchday_id: mdId, label, is_active: active }).select().single(), 'variant')) as { id: string };
}
interface FinishedResult { outcome: 'win' | 'draw' | 'loss'; score_for: number; score_against: number }

/** Alineación (5 pistas masc / 4 fem) + actas set a set. */
async function playMatchday(mdId: string, teamId: string, courts: number, wins: number, woCourt = 0): Promise<FinishedResult> {
  const roster = PLAYERS[teamId];
  const pool = shuffle(roster.slice(0, Math.min(roster.length, courts * 2 + 1))).slice(0, courts * 2).sort((a, b) => b.pts - a.pts);
  const variant = await ensureVariant(mdId, 'Variante 1', true);
  const lineups = [];
  for (let c = 0; c < courts; c++)
    lineups.push({ matchday_id: mdId, variant_id: variant.id, court_number: c + 1, player_a_id: pool[2 * c].id, player_b_id: pool[2 * c + 1].id });
  await must(db('lineups').insert(lineups), 'lineups');
  const courtWin = shuffle([...Array(courts)].map((_, i) => i < wins));
  if (woCourt) { // la pista del W.O. cuenta como ganada
    const idx = woCourt - 1;
    if (!courtWin[idx]) { const j = courtWin.findIndex((w, k) => w && k !== idx); courtWin[idx] = true; if (j >= 0) courtWin[j] = false; }
  }
  const rows: Record<string, unknown>[] = [];
  let f = 0, a = 0;
  for (let c = 0; c < courts; c++) {
    if (woCourt === c + 1) {
      for (let s = 1; s <= 2; s++) rows.push({ matchday_id: mdId, court_number: c + 1, set_number: s, us: null, them: null, forfeit: true, forfeit_us: false });
      f++;
      continue;
    }
    makeMatch(courtWin[c]).forEach(([us, them], i) => rows.push({ matchday_id: mdId, court_number: c + 1, set_number: i + 1, us, them, forfeit: false, forfeit_us: false }));
    if (courtWin[c]) f++; else a++;
  }
  await must(db('match_results').insert(rows), 'match_results');
  return { outcome: f > a ? 'win' : f < a ? 'loss' : 'draw', score_for: f, score_against: a };
}

const MD: Record<string, { id: string; jornada_number: number; opponent: string; match_date: string; is_home: boolean }[]> = {};

async function seedSeasons() {
  log('— temporadas y jornadas');
  // Victorias por pista de cada jornada jugada (J1..J7) → clasificación coherente.
  const WINS_A = [4, 3, 2, 3, 4, 5, 2]; // 5V 2D: líder con 23-12 en pistas
  const specs: { team: TeamSpec; season: string; cal: MdSpec[]; finishedUntil: number; wins?: number[]; detailed: boolean }[] = [
    { team: TEAMS[0], season: SEASON.a, cal: buildCalendar(RIVALES_M, FECHAS_14, true, '10:00'), finishedUntil: 7, wins: WINS_A, detailed: true },
    { team: TEAMS[1], season: SEASON.b, cal: buildCalendar(shuffle(RIVALES_M), FECHAS_14, false, '10:00'), finishedUntil: 7, wins: [2, 3, 1, 3, 2, 4, 3], detailed: false },
    { team: TEAMS[2], season: SEASON.fem, cal: buildCalendar(RIVALES_F, FECHAS_14, true, '16:00'), finishedUntil: 7, wins: [3, 2, 4, 1, 3, 2, 3], detailed: false },
    { team: TEAMS[3], season: SEASON.g1, cal: buildCalendar(shuffle(RIVALES_M).slice(0, 10), FECHAS_14.slice(2, 12), false, '18:00'), finishedUntil: 5, detailed: false },
    { team: TEAMS[4], season: SEASON.g2, cal: buildCalendar(shuffle(RIVALES_F).slice(0, 10), FECHAS_14.slice(2, 12), false, '12:00'), finishedUntil: 5, detailed: false },
  ];
  for (const s of specs) {
    const courts = COURTS[s.team.gender];
    await must(
      db('seasons').insert({
        id: s.season, team_id: s.team.id, name: 'Liga Cántabra de Pádel 2026', category: s.team.category,
        phase: 'liga', total_matchdays: s.cal.length, active: true, start_date: s.cal[0].date, end_date: null,
      }),
      `season ${s.team.name}`,
    );
    // Invitados: los partidos de local futuros llegan SIN hora (lo pone el club);
    // la segunda jornada de local futura de LOS CORRALES, con sede por confirmar.
    if (!s.team.own) {
      const futureHome = s.cal.filter((m) => m.jornada > s.finishedUntil && m.home);
      for (const md of futureHome) { md.time = null; md.location = null; }
      if (s.team.id === TEAM.g1 && futureHome[1]) futureHome[1].unconfirmed = true;
    }
    const rows = s.cal.map((m) => ({
      season_id: s.season, jornada_number: m.jornada, match_date: m.date,
      match_time: m.time ? `${m.time}:00` : null, opponent: m.opponent, is_home: m.home,
      location: m.location ?? null, tandas: m.home ? '3-2' : '2-3', status: 'upcoming', home_unconfirmed: !!m.unconfirmed,
    }));
    const mds = (await must(db('matchdays').insert(rows).select('id,jornada_number,is_home,opponent,match_date'), `matchdays ${s.team.name}`)) as typeof MD[string];
    mds.sort((a, b) => a.jornada_number - b.jornada_number);
    MD[s.team.id] = mds;

    let w = 0, l = 0, d = 0;
    for (const md of mds) {
      if (md.jornada_number > s.finishedUntil) continue;
      const wins = s.wins ? s.wins[md.jornada_number - 1] : pick([1, 2, 3, 4]);
      let res: FinishedResult;
      if (s.detailed || md.jornada_number >= s.finishedUntil - 1) {
        res = await playMatchday(md.id, s.team.id, courts, wins, s.detailed && md.jornada_number === 4 ? 5 : 0);
      } else {
        res = { outcome: wins * 2 > courts ? 'win' : wins * 2 < courts ? 'loss' : 'draw', score_for: wins, score_against: courts - wins };
      }
      if (res.outcome === 'win') w++; else if (res.outcome === 'loss') l++; else d++;
      await must(db('matchdays').update({ status: 'finished', ...res }).eq('id', md.id), 'close md');
    }
    log(`  ✓ ${s.team.name}: ${s.cal.length} jornadas · ${s.finishedUntil} jugadas (${w}V ${d}E ${l}D)`);
  }
  await seedConvocatoria();
}

/** Próxima jornada del A (sábado): convocatoria Voy/Duda/No + borrador con 2 variantes. */
async function seedConvocatoria() {
  const next = MD[TEAM.a].find((m) => m.jornada_number === NEXT_J)!;
  const roster = PLAYERS[TEAM.a];
  const ivan = roster.find((p) => p.user_id === U.jugador)!;
  const others = roster.filter((p) => p.id !== ivan.id); // 12
  // 7 Voy (incl. el capitán), 2 Duda con motivo, 1 No, resto sin contestar (incl. Iván).
  const ruben = others.find((p) => p.user_id === U.capitan)!;
  const rest = others.filter((p) => p.id !== ruben.id);
  const yes = [ruben, ...rest.slice(0, 6)];
  const maybe = [rest[6], rest[7]];
  const no = [rest[8]];
  const ago = (h: number) => hoursAgo(h);
  const avail = [
    ...yes.map((p, i) => ({ matchday_id: next.id, player_id: p.id, status: 'yes', updated_by: p.user_id ?? U.capitan, updated_at: ago(30 - i * 3) })),
    { matchday_id: next.id, player_id: maybe[0].id, status: 'maybe', reason: 'trabajo', updated_by: U.capitan, updated_at: ago(20) },
    { matchday_id: next.id, player_id: maybe[1].id, status: 'maybe', reason: 'molestias', updated_by: U.capitan, updated_at: ago(9) },
    { matchday_id: next.id, player_id: no[0].id, status: 'no', note: 'Boda familiar', updated_by: U.capitan, updated_at: ago(26) },
  ];
  await must(db('availability').insert(avail), 'availability');
  // Borrador: 4 de 5 pistas (7 Voy + 1 en Duda), dos variantes.
  const pool = [...yes, maybe[1]].sort((a, b) => b.pts - a.pts);
  const v1 = await ensureVariant(next.id, 'Variante 1', true);
  const v2 = await ensureVariant(next.id, 'Variante 2', false);
  const pairsOf = (vid: string, order: typeof pool) => [0, 1, 2, 3].map((c) => ({
    matchday_id: next.id, variant_id: vid, court_number: c + 1, player_a_id: order[2 * c].id, player_b_id: order[2 * c + 1].id,
  }));
  await must(db('lineups').insert(pairsOf(v1.id, pool)), 'lineups v1');
  const alt = [pool[0], pool[2], pool[1], pool[3], pool[4], pool[6], pool[5], pool[7]];
  await must(db('lineups').insert(pairsOf(v2.id, alt)), 'lineups v2');
  log(`  ✓ J${NEXT_J} (${next.match_date}) vs ${next.opponent}: 7 Voy · 2 Duda · 1 No · 3 sin contestar · borrador 4/5 con 2 variantes`);
  await seedTimePoll(next, roster, ivan.id, ruben.id);
}

/**
 * Encuesta de hora abierta en la próxima jornada del A. Es de fuera y el
 * rival aún no ha dicho la hora: la jornada queda SIN hora (un equipo de club
 * solo puede abrir encuesta en una jornada sin hora). Votan el capitán y
 * unos cuantos; Iván (demo.jugador) queda sin votar para probar el voto.
 * Se borra sola con el reset (ON DELETE CASCADE desde matchdays).
 */
async function seedTimePoll(
  next: { id: string; match_date: string },
  roster: { id: string; user_id: string | null }[],
  ivanId: string,
  rubenId: string,
) {
  await must(db('matchdays').update({ match_time: null }).eq('id', next.id), 'md sin hora');
  const sunday = addDays(next.match_date, 1);
  // Cierra el viernes a las 21:00; si el seed corre más tarde, sin límite.
  const dl = new Date(`${addDays(next.match_date, -1)}T21:00:00+02:00`);
  const poll = (await must(
    db('matchday_time_polls')
      .insert({
        matchday_id: next.id, team_id: TEAM.a, created_by: U.capitan,
        message: 'El rival nos deja elegir. ¿Cuál os va mejor?',
        deadline: dl.getTime() > Date.now() + 3600e3 ? dl.toISOString() : null,
        created_at: hoursAgo(20),
      })
      .select('id')
      .single(),
    'time poll',
  )) as { id: string };
  const opts = (await must(
    db('matchday_time_poll_options')
      .insert([
        { poll_id: poll.id, match_date: next.match_date, match_time: '10:00:00', position: 0 },
        { poll_id: poll.id, match_date: next.match_date, match_time: '17:30:00', position: 1 },
        { poll_id: poll.id, match_date: sunday, match_time: '11:00:00', position: 2 },
      ])
      .select('id, position'),
    'time poll options',
  )) as { id: string; position: number }[];
  const o = opts.sort((a, b) => a.position - b.position).map((x) => x.id);
  const voters = roster.filter((p) => p.id !== ivanId && p.id !== rubenId).slice(0, 6);
  const votes = [
    { poll_id: poll.id, player_id: rubenId, user_id: U.capitan, option_ids: [o[0], o[2]], updated_at: hoursAgo(20) },
    { poll_id: poll.id, player_id: voters[0].id, option_ids: [o[0]], updated_at: hoursAgo(18) },
    { poll_id: poll.id, player_id: voters[1].id, option_ids: [o[0], o[1]], updated_at: hoursAgo(16) },
    { poll_id: poll.id, player_id: voters[2].id, option_ids: [o[2]], updated_at: hoursAgo(12) },
    { poll_id: poll.id, player_id: voters[3].id, option_ids: [o[0], o[2]], updated_at: hoursAgo(8) },
    { poll_id: poll.id, player_id: voters[4].id, option_ids: [], updated_at: hoursAgo(5) },
    { poll_id: poll.id, player_id: voters[5].id, option_ids: [o[1], o[2]], updated_at: hoursAgo(3) },
  ];
  await must(db('matchday_time_poll_votes').insert(votes), 'time poll votes');
  log(`  ✓ encuesta de hora abierta en J${NEXT_J}: 3 opciones · 7 votos · Iván sin votar`);
}

// ─── SOCIAL ──────────────────────────────────────────────────────────────────
async function seedSocial() {
  log('— social');
  // Seguidores cruzados + todos siguen al club (feed de jornadas).
  const people = [U.club, U.capitan, U.jugador, U.invitado];
  const follows: Record<string, unknown>[] = [];
  for (const a of people) for (const b of people) if (a !== b) follows.push({ follower_id: a, target_type: 'user', target_id: b, created_at: hoursAgo(24 * 20) });
  for (const a of [U.capitan, U.jugador, U.invitado, U.prueba]) follows.push({ follower_id: a, target_type: 'club', target_id: CLUB_ID, created_at: hoursAgo(24 * 20) });
  follows.push({ follower_id: U.prueba, target_type: 'user', target_id: U.capitan, created_at: hoursAgo(24 * 4) });
  await must(db('follows').insert(follows), 'follows');

  // Amistosos de Iván: tres contra Rubén (cara a cara 2-1) y uno juntos.
  const C = [
    { id: CASUAL[0], by: U.jugador, on: addDays(TODAY, -2), sets: [[6, 4], [3, 6], [6, 3]], win: 0,
      s0: [['Iván Setién', U.jugador], ['Pablo Gutiérrez', null]], s1: [['Rubén Cobo', U.capitan], ['Adrián Lavín', null]] },
    { id: CASUAL[1], by: U.capitan, on: addDays(TODAY, -9), sets: [[4, 6], [6, 7]], win: 1,
      s0: [['Iván Setién', U.jugador], ['Pablo Gutiérrez', null]], s1: [['Rubén Cobo', U.capitan], ['Adrián Lavín', null]] },
    { id: CASUAL[2], by: U.jugador, on: addDays(TODAY, -16), sets: [[6, 2], [6, 4]], win: 0,
      s0: [['Iván Setién', U.jugador], ['Pablo Gutiérrez', null]], s1: [['Rubén Cobo', U.capitan], ['Adrián Lavín', null]] },
    { id: CASUAL[3], by: U.capitan, on: addDays(TODAY, -5), sets: [[7, 5], [6, 4]], win: 0,
      s0: [['Rubén Cobo', U.capitan], ['Iván Setién', U.jugador]], s1: [['Nacho Bolado', U.invitado], ['Hugo Revuelta', null]] },
  ];
  for (const c of C) {
    await must(db('casual_matches').insert({
      id: c.id, created_by: c.by, type: 'amistoso', played_on: c.on, sets: c.sets, winner_side: c.win,
      visibility: 'public', rated: false, created_at: madrid(c.on, '21:30'),
    }), 'casual');
    const parts = [
      ...c.s0.map(([name, user], slot) => ({ match_id: c.id, side: 0, slot, name, user_id: user })),
      ...c.s1.map(([name, user], slot) => ({ match_id: c.id, side: 1, slot, name, user_id: user })),
    ];
    await must(db('casual_match_participants').insert(parts), 'casual parts');
  }

  // Kudos en jornadas (league) y amistosos (casual). El trigger avisa al receptor.
  const a = MD[TEAM.a];
  const last = a.find((m) => m.jornada_number === NEXT_J - 1)!;
  const prev = a.find((m) => m.jornada_number === NEXT_J - 2)!;
  const femLast = MD[TEAM.fem].find((m) => m.jornada_number === NEXT_J - 1)!;
  const kudos = [
    ...[U.capitan, U.jugador, U.invitado, U.prueba].map((u) => ({ user_id: u, target_kind: 'league', target_id: last.id })),
    ...[U.capitan, U.jugador, U.invitado].map((u) => ({ user_id: u, target_kind: 'league', target_id: prev.id })),
    { user_id: U.capitan, target_kind: 'league', target_id: femLast.id },
    { user_id: U.jugador, target_kind: 'league', target_id: femLast.id },
    { user_id: U.capitan, target_kind: 'casual', target_id: CASUAL[0], target_user_id: U.jugador },
    { user_id: U.club, target_kind: 'casual', target_id: CASUAL[0], target_user_id: U.jugador },
    { user_id: U.invitado, target_kind: 'casual', target_id: CASUAL[0], target_user_id: U.jugador },
    { user_id: U.jugador, target_kind: 'casual', target_id: CASUAL[3], target_user_id: U.capitan },
    { user_id: U.invitado, target_kind: 'casual', target_id: CASUAL[3], target_user_id: U.capitan },
    { user_id: U.club, target_kind: 'casual', target_id: CASUAL[1], target_user_id: U.capitan },
  ];
  await must(db('activity_kudos').insert(kudos), 'kudos');
  log(`  ✓ ${follows.length} follows · ${C.length} amistosos · ${kudos.length} kudos`);
}

// ─── TORNEOS ─────────────────────────────────────────────────────────────────
const PAREJAS_M: [string, string][] = [
  ['Álvaro Ruiz-Capillas', 'Diego San Emeterio'], ['Carlos Agüero', 'Miguel Lavín'], ['Pablo Cobo', 'Jaime Sañudo'],
  ['Adrián Pila', 'Jesús Saseta'], ['Marcos Bustillo', 'Sergio Riancho'], ['Iñaki Gándara', 'Nacho Lastra'],
  ['Héctor Pelayo', 'Rodrigo Cuesta'], ['Óscar Mier', 'Dani Villegas'], ['Luis Escalante', 'Fer Mazón'],
  ['Javi Toca', 'Borja Quintanal'], ['Gonzalo Diestro', 'Mario Argumosa'], ['Andrés Portilla', 'Raúl Herrán'],
  ['Hugo Cagigas', 'Víctor Liaño'], ['Tomás Revuelta', 'Julián Bolado'], ['Enrique Solana', 'Pedro Trueba'],
  ['Aitor Ceballos', 'Samuel Cano'], ['Jaime Ortiz', 'Rafa Sainz'], ['David Abascal', 'Íñigo Peña'],
  ['Germán Fuentes', 'Alberto Gutiérrez'], ['Lucas Bárcena', 'Martín Ruiz'],
];
const PAREJAS_F: [string, string][] = [
  ['Marta Cobo', 'Andrea Solana'], ['Paula Gómez', 'Sara Quintana'], ['Elena Bustillo', 'Nerea Lastra'],
  ['Claudia Ruiz', 'Irene Mazón'], ['Alba Sañudo', 'Carmen Villegas'], ['Laura Pelayo', 'Cristina Ceballos'],
  ['Ana Portilla', 'Noelia Vega'], ['Beatriz Trueba', 'Silvia Gándara'], ['Raquel Diestro', 'Inés Bolado'],
  ['Patricia Toca', 'Rocío Herrán'],
];
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

interface RegOpts { paidRatio?: number; terms?: string | null; users?: Record<number, { p1?: string; p2?: string; email1?: string; email2?: string; pending?: boolean }> }
function regRows(tid: string, pairs: [string, string][], gender: string, category: string, ptsBase: number, opts: RegOpts = {}) {
  return pairs.map(([a, b], i) => {
    const u = opts.users?.[i];
    const seedPoints = Math.max(300, Math.round(ptsBase - i * (ptsBase / 22) + rnd() * 60));
    const paid = u?.pending ? false : rnd() < (opts.paidRatio ?? 1);
    return {
      tournament_id: tid, gender, category,
      pair_label: `${a.split(' ')[0]} / ${b.split(' ')[0]}`,
      p1_name: a, p1_email: u?.email1 ?? `${slug(a)}@example.com`, p1_phone: `6001${String(100 + i).padStart(3, '0')}${gender === 'femenino' ? '5' : '1'}`,
      p2_name: b, p2_email: u?.email2 ?? `${slug(b)}@example.com`, p2_phone: `6002${String(100 + i).padStart(3, '0')}${gender === 'femenino' ? '5' : '1'}`,
      p1_user_id: u?.p1 ?? null, p2_user_id: u?.p2 ?? null,
      seed_points: seedPoints, league_sum: 2 + Math.floor(i / 3), availability: [],
      status: 'confirmed', payment_status: paid ? 'paid' : 'pending_club', payment_method: 'offline',
      terms_accepted_at: opts.terms ? new Date(Date.now() - (12 - (i % 10)) * 864e5).toISOString() : null,
      terms_snapshot: opts.terms ?? null,
    };
  });
}

type M = T.TournamentMatch;
const matchesOf = async (tid: string) => (await must(db('tournament_matches').select('*').eq('tournament_id', tid), 'matches')) as M[];
const setsToWinOf = (t: T.Tournament, bracket: string) =>
  ((t.phase_formats as Record<string, string> | null)?.[bracket] ?? t.match_format) === 'bo1' ? 1 : 2;
const scoreFor = (homeWins: boolean, bo1: boolean): number[][] => (bo1 ? [makeSet(homeWins)] : makeMatch(homeWins));

/** Juega los partidos de un cuadro/ronda. `favor` = inscripciones que deben ganar. */
async function playRound(t: T.Tournament, bracket: string, round: number, favor: string[] = [], only?: (m: M) => boolean) {
  const ms = (await matchesOf(t.id)).filter((m) => m.bracket === bracket && m.round === round && m.status === 'pending' && m.home_reg && m.away_reg && (!only || only(m)));
  ms.sort((a, b) => a.slot - b.slot);
  const stw = setsToWinOf(t, bracket);
  for (const m of ms) {
    const homeWins = favor.includes(m.home_reg!) ? true : favor.includes(m.away_reg!) ? false : rnd() < 0.62;
    await T.setMatchResult(m, scoreFor(homeWins, stw === 1), stw);
  }
}

async function generate(tid: string, gender: string, category: string, phaseDays: Record<number, string[]>) {
  const t = (await must(db('tournaments').select('*').eq('id', tid).single(), 'get t')) as T.Tournament;
  const regs = (await must(db('tournament_registrations').select('*').eq('tournament_id', tid), 'regs')) as T.TournamentRegistration[];
  await T.generateKoBracket(t, regs, gender, category);
  for (const [fromEnd, dates] of Object.entries(phaseDays))
    for (const d of dates) await T.togglePhaseDay(tid, 'ko', Number(fromEnd), d, true);
  await T.autoScheduleTournament(t, regs, await matchesOf(tid), await T.getPhaseDays(tid));
  return { t, regs };
}
const slotUpd = (id: string, date: string, hhmm: string, court: number) =>
  must(db('tournament_matches').update({ scheduled_at: madrid(date, hhmm), court: `Pista ${court}` }).eq('id', id), 'slot');

let TERMS = '';
const baseTour = () => ({
  club_id: CLUB_ID, created_by: U.club, location: CLUB_NAME, seeding_mode: 'points', payment_mode: 'offline',
  fee_currency: 'EUR', billing_status: 'included', terms: TERMS, pair_based: true,
  info_rows: [{ label: 'Bolas', value: 'Head Pro' }, { label: 'Vestuarios', value: 'Con duchas y taquillas' }],
});

async function seedTournaments() {
  log('— torneos del club');
  TERMS = (await must((supabase as unknown as { rpc: (fn: string) => PromiseLike<Res<unknown>> }).rpc('tournament_default_terms'), 'terms')) as string;

  // (a) EN JUEGO HOY: KO + consolación, 16 parejas. Octavos 16:00 (jugados) y
  //     17:30; cuartos y consolación 19:00 y 20:30. Iván juega cuartos a las 19:00.
  await must(db('tournaments').insert({
    ...baseTour(), id: TOUR.live, name: 'Torneo Nocturno de Otoño', format: 'ko_consolation', match_format: 'bo3_stb',
    phase_formats: { main: 'bo3_stb', consol: 'bo1' }, genders: ['masculino'], categories: ['3ª'],
    starts_on: TODAY, ends_on: addDays(TODAY, 2), max_pairs: 16, min_pairs: 8, covered_pairs: 16, courts: 4,
    start_time: '16:00', end_time: '22:00', slot_minutes: 90, rest_minutes: 0, max_removable_hours: 3,
    entry_fee: 20, status: 'open', signup_code: 'NOCHE16',
    category_rules: { mode: 'points', byCategory: { '3ª': { puntos: 2500, nivel: null } } },
    prizes_json: [{ place: '1º', items: [{ type: 'material', desc: 'Palas Bullpadel' }] }, { place: '2º', items: [{ type: 'material', desc: 'Paleteros' }] }, { place: 'Consolación', items: [{ type: 'otros', desc: 'Cena para dos' }] }],
    extra_info: 'Partidos entre semana por la tarde-noche: semifinales el martes y finales el miércoles.',
  }), 'torneo en juego');
  const liveRegs = regRows(TOUR.live, [['Iván Setién', 'Adrián Lavín'], ...PAREJAS_M.slice(0, 15)], 'masculino', '3ª', 2400, {
    terms: TERMS, users: { 0: { p1: U.jugador, email1: 'demo.jugador@tactium.io' } },
  });
  liveRegs[0].seed_points = 2150; // cabeza de serie n.º 3 aprox.
  await must(db('tournament_registrations').insert(liveRegs), 'regs live');
  const { t: tLive } = await generate(TOUR.live, 'masculino', '3ª', { 3: [TODAY], 2: [TODAY], 1: [addDays(TODAY, 1)], 0: [addDays(TODAY, 2)] });
  const ivanReg = ((await must(db('tournament_registrations').select('id').eq('tournament_id', TOUR.live).eq('p1_user_id', U.jugador), 'ivan reg')) as { id: string }[])[0].id;
  let ms = await matchesOf(TOUR.live);
  const r1 = ms.filter((m) => m.bracket === 'main' && m.round === 1).sort((a, b) => a.slot - b.slot);
  const ivanSlot = r1.find((m) => m.home_reg === ivanReg || m.away_reg === ivanReg)!.slot;
  const early = ivanSlot < 4 ? [0, 1, 2, 3] : [4, 5, 6, 7];
  const late = early[0] === 0 ? [4, 5, 6, 7] : [0, 1, 2, 3];
  for (const [i, s] of early.entries()) await slotUpd(r1[s].id, TODAY, '16:00', i + 1);
  for (const [i, s] of late.entries()) await slotUpd(r1[s].id, TODAY, '17:30', i + 1);
  await playRound(tLive, 'main', 1, [ivanReg], (m) => early.includes(m.slot));
  ms = await matchesOf(TOUR.live);
  const r2 = ms.filter((m) => m.bracket === 'main' && m.round === 2).sort((a, b) => a.slot - b.slot);
  const c1 = ms.filter((m) => m.bracket === 'consol' && m.round === 1).sort((a, b) => a.slot - b.slot);
  const earlyR2 = early.filter((s) => s % 2 === 0).map((s) => s / 2);
  const lateR2 = late.filter((s) => s % 2 === 0).map((s) => s / 2);
  await slotUpd(r2[earlyR2[0]].id, TODAY, '19:00', 1);
  await slotUpd(r2[earlyR2[1]].id, TODAY, '19:00', 2);
  await slotUpd(c1[earlyR2[0]].id, TODAY, '19:00', 3);
  await slotUpd(c1[earlyR2[1]].id, TODAY, '19:00', 4);
  await slotUpd(r2[lateR2[0]].id, TODAY, '20:30', 1);
  await slotUpd(r2[lateR2[1]].id, TODAY, '20:30', 2);
  await slotUpd(c1[lateR2[0]].id, TODAY, '20:30', 3);
  await slotUpd(c1[lateR2[1]].id, TODAY, '20:30', 4);
  log('  ✓ Torneo Nocturno de Otoño · EN JUEGO HOY · NOCHE16 · Iván en cuartos a las 19:00');

  // (b) INSCRIPCIÓN ABIERTA el finde que viene; Rubén inscrito con pago pendiente.
  await must(db('tournaments').insert({
    ...baseTour(), id: TOUR.open, name: 'II Open Pádel Center Demo', format: 'ko_consolation', match_format: 'bo3_stb',
    phase_formats: { main: 'bo3_stb', consol: 'bo1' }, genders: ['masculino'], categories: ['3ª', '4ª'],
    starts_on: NEXT_SAT, ends_on: addDays(NEXT_SAT, 1), max_pairs: 16, min_pairs: 8, covered_pairs: 16, courts: 4,
    start_time: '09:00', end_time: '21:00', slot_minutes: 90, rest_minutes: 30, max_removable_hours: 4,
    entry_fee: 25, entry_fee_2: 35, payment_deadline_days: 3, status: 'open', signup_code: 'DEMO16',
    category_rules: { mode: 'points', byCategory: { '3ª': { puntos: 2500, nivel: null }, '4ª': { puntos: 1200, nivel: null } } },
    prizes_json: [{ place: '1º', items: [{ type: 'material', desc: 'Pala Bullpadel' }, { type: 'metalico', amount: 50 }] }, { place: '2º', items: [{ type: 'material', desc: 'Paletero + bote de bolas' }] }, { place: 'Consolación', items: [{ type: 'otros', desc: 'Camiseta del torneo' }] }],
    extra_info: 'Sorteo de regalos entre los inscritos. Bar abierto todo el fin de semana.',
    observations: 'La organización se reserva el derecho a reordenar parejas entre categorías según nivel.',
  }), 'torneo abierto');
  await must(db('tournament_registrations').insert([
    ...regRows(TOUR.open, [['Rubén Cobo', 'Sergio Cagigas'], ...PAREJAS_M.slice(15, 20)], 'masculino', '3ª', 2300, {
      paidRatio: 0.6, terms: TERMS, users: { 0: { p1: U.capitan, email1: 'demo.capitan@tactium.io', pending: true } },
    }),
    ...regRows(TOUR.open, PAREJAS_M.slice(5, 9), 'masculino', '4ª', 1150, { paidRatio: 0.5, terms: TERMS }),
  ]), 'regs abierto');
  log('  ✓ II Open Pádel Center Demo · INSCRIPCIÓN ABIERTA · DEMO16 · 10 parejas (Rubén con pago pendiente)');

  // (c) TERMINADO hace dos semanas: campeones Rubén / Iván, con consolación.
  const doneSat = addDays(NEXT_SAT, -14);
  await must(db('tournaments').insert({
    ...baseTour(), id: TOUR.done, name: 'Torneo Social de Septiembre', format: 'ko_consolation', match_format: 'bo3_stb',
    phase_formats: { main: 'bo3_stb', consol: 'bo1' }, genders: ['masculino'], categories: ['3ª'],
    starts_on: doneSat, ends_on: addDays(doneSat, 1), max_pairs: 8, covered_pairs: 8, courts: 3,
    start_time: '10:00', end_time: '21:00', slot_minutes: 90, rest_minutes: 0,
    entry_fee: 15, status: 'open', signup_code: 'SEPT8',
  }), 'torneo terminado');
  await must(db('tournament_registrations').insert(regRows(TOUR.done, [['Rubén Cobo', 'Iván Setién'], ...PAREJAS_M.slice(9, 16)], 'masculino', '3ª', 2300, {
    users: { 0: { p1: U.capitan, p2: U.jugador, email1: 'demo.capitan@tactium.io', email2: 'demo.jugador@tactium.io' } },
  })), 'regs done');
  const { t: tDone } = await generate(TOUR.done, 'masculino', '3ª', { 2: [doneSat], 1: [doneSat], 0: [addDays(doneSat, 1)] });
  const champReg = ((await must(db('tournament_registrations').select('id').eq('tournament_id', TOUR.done).eq('p1_user_id', U.capitan), 'champ')) as { id: string }[])[0].id;
  for (let r = 1; r <= 3; r++) await playRound(tDone, 'main', r, [champReg]);
  for (let r = 1; r <= 2; r++) await playRound(tDone, 'consol', r);
  log('  ✓ Torneo Social de Septiembre · TERMINADO · campeones Rubén / Iván · SEPT8');

  // (d) BORRADOR
  await must(db('tournaments').insert({
    ...baseTour(), id: TOUR.draft, name: 'Torneo de Otoño · Grupos + KO', format: 'groups_ko', match_format: 'bo3_stb',
    phase_formats: { groups: 'bo1', main: 'bo3_stb', consol: 'bo1' }, genders: ['masculino', 'femenino'], categories: ['4ª', '5ª'],
    starts_on: addDays(NEXT_SAT, 21), ends_on: addDays(NEXT_SAT, 22), max_pairs: 24, min_pairs: 12, covered_pairs: 24, courts: 4,
    start_time: '09:00', end_time: '22:00', slot_minutes: 60, rest_minutes: 30,
    entry_fee: 20, payment_deadline_days: 5, status: 'draft', signup_code: 'OTONO24',
    prizes: 'Trofeos para campeones y finalistas de cada categoría.',
  }), 'torneo borrador');
  log('  ✓ Torneo de Otoño · BORRADOR · OTONO24');
}

// ─── ORGANIZADOR «SOLO TORNEOS» ──────────────────────────────────────────────
async function seedOrganizer() {
  log('— organizador (solo torneos)');
  await must(db('clubs').insert({ id: ORG_CLUB_ID, owner_id: U.organizador, name: ORG_CLUB_NAME, federation: 'FCantP', tournaments_only: true, is_demo: true }), 'org club');
  const cm = (await must(db('club_members').select('id').eq('club_id', ORG_CLUB_ID).eq('user_id', U.organizador), 'cm')) as unknown[];
  if (cm.length === 0) await must(db('club_members').insert({ club_id: ORG_CLUB_ID, user_id: U.organizador, role: 'admin' }), 'org cm');
  const base = { ...baseTour(), club_id: ORG_CLUB_ID, created_by: U.organizador, location: 'Pádel Costa Norte · Noja', format: 'ko', match_format: 'bo3_stb', phase_formats: { main: 'bo3_stb' }, courts: 3, slot_minutes: 90, rest_minutes: 0, start_time: '17:00', end_time: '22:00', payment_deadline_days: 3 };
  // Inscripción: abierto, sin cerrar el cobro, empieza dentro de 2 semanas.
  await must(db('tournaments').insert({ ...base, id: TOUR.orgOpen, name: 'Open Costa Norte · Otoño', genders: ['masculino', 'femenino'], categories: ['3ª', '4ª'], starts_on: addDays(NEXT_SAT, 14), ends_on: addDays(NEXT_SAT, 15), start_time: '09:00', end_time: '21:00', max_pairs: 24, min_pairs: 8, entry_fee: 22, status: 'open', billing_status: 'none', covered_pairs: null, signup_code: 'COSTA24' }), 'org open');
  await must(db('tournament_registrations').insert([
    ...regRows(TOUR.orgOpen, PAREJAS_M.slice(10, 15), 'masculino', '3ª', 2100, { paidRatio: 0.5, terms: TERMS }),
    ...regRows(TOUR.orgOpen, PAREJAS_F.slice(0, 4), 'femenino', '4ª', 900, { paidRatio: 0.5, terms: TERMS }),
  ]), 'regs org open');
  // Pago: inscripción cerrada, falta pagar el torneo para generar cuadros.
  await must(db('tournaments').insert({ ...base, id: TOUR.orgPay, name: 'Torneo Express Noja', genders: ['masculino'], categories: ['4ª'], starts_on: NEXT_SAT, ends_on: NEXT_SAT, start_time: '09:00', end_time: '21:00', max_pairs: 16, min_pairs: 8, entry_fee: 18, status: 'open', billing_status: 'pending_payment', covered_pairs: null, signup_code: 'NOJA16' }), 'org pay');
  await must(db('tournament_registrations').insert(regRows(TOUR.orgPay, PAREJAS_M.slice(0, 12), 'masculino', '4ª', 1150, { paidRatio: 0.8, terms: TERMS })), 'regs org pay');
  // En juego: KO de 8 (cuartos ayer, semis y final hoy).
  await must(db('tournaments').insert({ ...base, id: TOUR.orgLive, name: 'Relámpago Suances', genders: ['femenino'], categories: ['3ª'], starts_on: addDays(TODAY, -1), ends_on: TODAY, start_time: '18:00', max_pairs: 8, entry_fee: 15, status: 'open', billing_status: 'paid', covered_pairs: 8, signup_code: 'SUANCES8' }), 'org live');
  await must(db('tournament_registrations').insert(regRows(TOUR.orgLive, PAREJAS_F.slice(2, 10), 'femenino', '3ª', 1500, { terms: TERMS })), 'regs org live');
  const { t } = await generate(TOUR.orgLive, 'femenino', '3ª', { 2: [addDays(TODAY, -1)], 1: [TODAY], 0: [TODAY] });
  await playRound(t, 'main', 1);
  // El motor coloca la final (aún sin parejas) a la misma hora que las semis: la pasamos a las 20:00.
  const fin = (await matchesOf(TOUR.orgLive)).find((m) => m.bracket === 'main' && m.round === 3)!;
  await slotUpd(fin.id, TODAY, '20:00', 1);
  log('  ✓ Torneos Costa Norte DEMO: COSTA24 (inscripción) · NOJA16 (pago pendiente) · SUANCES8 (en juego)');
}

// ─── CAPITÁN EN PRUEBA SIN TARJETA (día 5 de 14) ─────────────────────────────
async function seedPrueba() {
  log('— capitán en prueba');
  await must(db('teams').insert({
    id: TEAM.prueba, owner_id: U.prueba, name: 'PRUEBA PÁDEL DEMO', federation: 'FCantP', league: 'Liga Cántabra de Pádel',
    category: '4ª', gender: 'masculino', club_id: null, venue_club_id: null, preferred_home_slots: ['0|11:00'],
  }), 'team prueba');
  const tm = (await must(db('team_members').select('user_id').eq('team_id', TEAM.prueba), 'tm')) as { user_id: string }[];
  if (!tm.some((m) => m.user_id === U.prueba)) await must(db('team_members').insert({ team_id: TEAM.prueba, user_id: U.prueba, role: 'captain' }), 'tm prueba');
  PLAYERS[TEAM.prueba] = await insertRoster(TEAM.prueba,
    ['Daniel Arce', 'Rafa Calderón', 'Íñigo Laso', 'Mikel Obregón', 'Pelayo Ruiz', 'Asier Bedia', 'Chema Fontecha', 'Toño Cuevas', 'Kike Saiz', 'Fran Ibáñez'],
    [600, 1100], (n) => (n === 'Daniel Arce' ? U.prueba : null));
  await must(db('seasons').insert({ id: SEASON.prueba, team_id: TEAM.prueba, name: 'Liga Cántabra de Pádel 2026', category: '4ª', phase: 'liga', total_matchdays: 3, active: true, start_date: addDays(NEXT_SAT, 1) }), 'season prueba');
  await must(db('matchdays').insert([0, 7, 14].map((d, i) => ({
    season_id: SEASON.prueba, jornada_number: i + 1, match_date: addDays(NEXT_SAT, 1 + d), match_time: i % 2 === 0 ? '11:00:00' : '17:30:00',
    opponent: ['ZINK PÁDEL E', 'HOVELO C', 'MARISMA DUIN F'][i], is_home: i % 2 === 0, location: i % 2 === 0 ? 'Pádel Indoor Camargo' : ['Zink Pádel', 'Hovelo Pádel', 'Marisma Duin'][i],
    tandas: i % 2 === 0 ? '3-2' : '2-3', status: 'upcoming',
  }))), 'matchdays prueba');
  const start = new Date(Date.now() - (4 * 24 + 3) * 3600e3); // día 5 de 14
  const end = new Date(start.getTime() + 14 * 864e5);
  await must(db('subscriptions').insert({
    id: SUB_PRUEBA, subject_type: 'user', subject_id: U.prueba, payer_user_id: U.prueba,
    plan_tier: 'captain', billing_period: 'monthly', status: 'trialing',
    current_period_start: start.toISOString(), current_period_end: end.toISOString(), trial_end: end.toISOString(),
    cancel_at_period_end: false, revenuecat_customer_id: U.prueba,
    original_transaction_id: `trial_user_${U.prueba}_${Math.floor(start.getTime() / 1000)}`,
    product_id: 'trial_captain_monthly', platform: 'web', created_at: start.toISOString(),
  }), 'sub prueba');
  await must(db('subscription_events').insert({ subscription_id: SUB_PRUEBA, event_type: 'TRIAL_AUTO_STARTED', payload: { reason: 'first_entity_created', subject_type: 'user', subject_id: U.prueba, plan_tier: 'captain' }, processed_at: start.toISOString(), received_at: start.toISOString() }), 'sub event prueba');
  log(`  ✓ PRUEBA PÁDEL DEMO · prueba sin tarjeta hasta ${end.toISOString().slice(0, 10)}`);
}

// ─── AVISOS Y FAVORITOS ──────────────────────────────────────────────────────
async function seedNotifications() {
  log('— avisos y favoritos');
  // Lo que generaron los triggers al montar (altas, seguidores): leído y de hace días.
  await must(db('notifications').update({ read_at: hoursAgo(70), created_at: hoursAgo(24 * 19) })
    .in('user_id', Object.values(U)).in('type', ['member_joined', 'joined_team', 'new_follower', 'player_claimed']), 'old notifs');
  // Kudos: recientes y sin leer.
  await must(db('notifications').update({ created_at: hoursAgo(5) }).in('user_id', Object.values(U)).eq('type', 'kudos'), 'kudos notifs');
  const a = MD[TEAM.a];
  const next = a.find((m) => m.jornada_number === NEXT_J)!;
  const last = a.find((m) => m.jornada_number === NEXT_J - 1)!;
  await must(db('favorites').insert({ user_id: U.jugador, kind: 'tournament', ref_id: TOUR.open, label: 'II Open Pádel Center Demo', meta: `${NEXT_SAT} · ${CLUB_NAME}` }), 'fav tour');
  await must(db('notifications').insert([
    { user_id: U.jugador, type: 'availability_reminder', title: 'Convocatoria J8 · ¿vas el sábado? ⏳', body: `J${NEXT_J} vs ${next.opponent}. Contesta Voy, Duda o No en un toque.`, data: { type: 'availability_reminder', matchdayId: next.id, status: 'pending' }, created_at: hoursAgo(2) },
    { user_id: U.jugador, type: 'lineup_published', title: 'Alineación publicada', body: `Ya está la alineación de la J${NEXT_J - 1} vs ${last.opponent}. Juegas en pista 1.`, data: { type: 'lineup_published', matchdayId: last.id }, created_at: hoursAgo(24 * 3 + 4), read_at: null },
    { user_id: U.jugador, type: 'tournament_schedule', title: 'Horario publicado 🕒', body: 'Torneo Nocturno de Otoño: hoy juegas los cuartos a las 19:00.', data: { type: 'tournament_schedule', tournamentId: TOUR.live, name: 'Torneo Nocturno de Otoño' }, created_at: hoursAgo(1) },
    { user_id: U.capitan, type: 'availability_reminder', title: 'Convocatoria J8 en marcha', body: `7 van, 2 en duda, 1 no y 3 sin contestar para la J${NEXT_J} vs ${next.opponent}.`, data: { type: 'availability_reminder', matchdayId: next.id }, created_at: hoursAgo(3) },
    { user_id: U.capitan, type: 'lineup_reminder', title: 'Alineación en borrador 📋', body: `Tienes 4 de 5 pistas puestas para la J${NEXT_J}. Publícala cuando esté.`, data: { type: 'lineup_reminder', matchdayId: next.id }, created_at: hoursAgo(6) },
    { user_id: U.capitan, type: 'lineup_published', title: 'Alineación publicada', body: `Publicaste la alineación de la J${NEXT_J - 1} vs ${last.opponent}.`, data: { type: 'lineup_published', matchdayId: last.id }, created_at: hoursAgo(24 * 3 + 4), read_at: hoursAgo(24 * 3) },
    { user_id: U.club, type: 'tournament_signup', title: 'Nueva inscripción 🎾', body: 'Rubén Cobo / Sergio Cagigas se han apuntado al II Open Pádel Center Demo (pago en el club).', data: { tournament_id: TOUR.open }, created_at: hoursAgo(20) },
  ]), 'notifications');
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
(async () => {
  log(`HOY = ${TODAY} · próxima jornada (J${NEXT_J}) = ${NEXT_SAT}`);
  const existing = (await must(db('clubs').select('id').eq('id', CLUB_ID), 'check club')) as unknown[];
  if (existing.length > 0 && !RESET) {
    console.log('El club demo ya existe. Usa --reset para borrarlo y recrearlo.');
    return;
  }
  if (RESET) await reset();
  await seedAccounts();
  await seedClub();
  await seedTeams();
  await seedSeasons();
  await seedSocial();
  await seedTournaments();
  await seedOrganizer();
  await seedPrueba();
  await seedNotifications();
  console.log(`
════════════════════════════════════════════════════════
 DEMO LISTO (${TODAY}) · contraseña común: ${PASSWORD}
   demo.club · demo.capitan · demo.jugador · demo.invitado
   demo.organizador · demo.prueba · demo.nuevo   (@tactium.io)
 Código de jugador del A: ${INVITE_CODE}
 Torneos: NOCHE16 (en juego hoy) · DEMO16 (abierto) · SEPT8 (terminado) · OTONO24 (borrador)
 Organizador: COSTA24 · NOJA16 · SUANCES8
════════════════════════════════════════════════════════`);
})().catch((e) => {
  console.error('ERROR:', e.message ?? e);
  process.exit(1);
});
