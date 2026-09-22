/**
 * SEED DEL CLUB DEMO "Pádel Center Demo" (2026-09-04)
 *
 * Crea un club completo para probar la app con datos reales de forma:
 *   - 4 cuentas (club, capitán, jugador, capitán de equipo invitado)
 *   - 3 equipos propios + 2 equipos invitados (juegan en nuestras pistas)
 *   - temporada activa por equipo, jornadas con fecha, alineaciones,
 *     resultados set a set, disponibilidad de la próxima jornada
 *   - 4 torneos: abierto con inscripciones, borrador, terminado y en juego
 *     (cuadros, horario y resultados generados con el MOTOR REAL de la app)
 *
 * Ejecutar desde TACTIUM/:
 *   npx -y tsx@4.23.13 --tsconfig scripts/demo-club/tsconfig.json scripts/demo-club/seed.ts
 *   ... --reset   → borra todo lo del demo y lo vuelve a crear
 *
 * Idempotente: ids fijos (prefijo de400000-…). Si el club ya existe, avisa y
 * no hace nada salvo con --reset. Usa la service_role de tactium-web/.env.local.
 */
import { supabase } from '@core/supabase/client';
import * as T from '../../src/core/services/tournaments';

const RESET = process.argv.includes('--reset');
const PASSWORD = 'TactiumDemo2026!';

// ─── ids deterministas ────────────────────────────────────────────────────────
const uid = (n: number) => `de400000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const U = { club: uid(1), capitan: uid(2), jugador: uid(3), invitado: uid(4) };
const CLUB_ID = uid(100);
const TEAM = { a: uid(101), b: uid(102), fem: uid(103), g1: uid(104), g2: uid(105) };
const SEASON = { a: uid(201), b: uid(202), fem: uid(203), g1: uid(204), g2: uid(205) };
const TOUR = { open: uid(301), draft: uid(302), done: uid(303), live: uid(304) };
const SUB_ID = uid(400);

const CLUB_NAME = 'Pádel Center Demo';
const TODAY = '2026-09-04';

// ─── utilidades ──────────────────────────────────────────────────────────────
type Res<T> = { data: T; error: { message: string } | null };
async function must<T>(p: PromiseLike<Res<T>>, what: string): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}
const db = supabase.from.bind(supabase) as unknown as (t: string) => any;
const log = (s: string) => console.log(s);

// RNG determinista para que el seed sea reproducible.
let seedRng = 20260904;
const rnd = () => {
  seedRng = (seedRng * 1103515245 + 12345) & 0x7fffffff;
  return seedRng / 0x7fffffff;
};
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const shuffle = <T,>(arr: T[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Un set con ganador decidido: 6-x o 7-5/7-6.
function makeSet(winnerIsHome: boolean): [number, number] {
  const r = rnd();
  const loserGames = r < 0.6 ? Math.floor(rnd() * 5) : r < 0.85 ? 5 : 6;
  const winnerGames = loserGames >= 5 ? 7 : 6;
  return winnerIsHome ? [winnerGames, loserGames] : [loserGames, winnerGames];
}
// Partido al mejor de 3 (devuelve sets [us, them]).
function makeMatch(weWin: boolean): [number, number][] {
  const sets: [number, number][] = [];
  const threeSets = rnd() < 0.35;
  if (threeSets) {
    sets.push(makeSet(!weWin), makeSet(weWin), makeSet(weWin));
  } else {
    sets.push(makeSet(weWin), makeSet(weWin));
  }
  return sets;
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
const POS = ['Drive', 'Revés', 'Ambos'] as const;

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

// Sábados de la temporada (J1..J14): junio-julio, parón, y de finales de agosto a octubre.
const FECHAS_14 = [
  '2026-06-13', '2026-06-20', '2026-06-27', '2026-07-04', '2026-07-11', '2026-07-18',
  '2026-08-29', '2026-09-05', '2026-09-12', '2026-09-19', '2026-09-26', '2026-10-03',
  '2026-10-10', '2026-10-17',
];

// ─── RESET ───────────────────────────────────────────────────────────────────
async function reset() {
  log('— reset: borrando el demo anterior…');
  const teamIds = Object.values(TEAM);
  const seasonIds = Object.values(SEASON);
  const tourIds = Object.values(TOUR);
  const userIds = Object.values(U);

  const mds = (await must(db('matchdays').select('id').in('season_id', seasonIds), 'matchdays')) as { id: string }[];
  const mdIds = mds.map((m) => m.id);
  if (mdIds.length) {
    for (const t of ['match_results', 'lineups', 'lineup_variants', 'availability'])
      await must(db(t).delete().in('matchday_id', mdIds), `del ${t}`);
    await must(db('posts').delete().in('matchday_id', mdIds), 'del posts');
    await must(db('matchdays').delete().in('id', mdIds), 'del matchdays');
  }
  await must(db('seasons').delete().in('id', seasonIds), 'del seasons');
  await must(db('players').delete().in('team_id', teamIds), 'del players');
  await must(db('team_members').delete().in('team_id', teamIds), 'del team_members');
  await must(db('team_invitations').delete().in('team_id', teamIds), 'del invitations');
  await must(db('teams').delete().in('id', teamIds), 'del teams');

  for (const t of ['tournament_matches', 'tournament_phase_days', 'tournament_registrations', 'tournament_payments'])
    await must(db(t).delete().in('tournament_id', tourIds), `del ${t}`);
  await must(db('tournaments').delete().in('id', tourIds), 'del tournaments');

  await must(db('subscription_events').delete().eq('subscription_id', SUB_ID), 'del sub events');
  await must(db('subscriptions').delete().eq('id', SUB_ID), 'del subscription');
  await must(db('club_members').delete().eq('club_id', CLUB_ID), 'del club_members');
  await must(db('clubs').delete().eq('id', CLUB_ID), 'del club');

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
  const { error } = await supabase.auth.admin.createUser({
    id,
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
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
  await createUser(U.jugador, 'demo.jugador@tactium.io', 'Iván Setién', 'ivansetien', { preferred_side: 'reves' });
  await createUser(U.invitado, 'demo.invitado@tactium.io', 'Nacho Bolado', 'nachobolado', { preferred_side: 'ambos', home_club: 'Club Tenis Liencres' });
}

// ─── CLUB + SUSCRIPCIÓN ──────────────────────────────────────────────────────
async function seedClub() {
  log('— club');
  await must(db('clubs').insert({ id: CLUB_ID, owner_id: U.club, name: CLUB_NAME, federation: 'FCantP' }), 'club');
  // El trigger de producción mete al owner en club_members; si no lo hizo, lo hacemos.
  const cm = (await must(db('club_members').select('id').eq('club_id', CLUB_ID).eq('user_id', U.club), 'cm')) as unknown[];
  if (cm.length === 0) await must(db('club_members').insert({ club_id: CLUB_ID, user_id: U.club, role: 'admin' }), 'club_members');
  const start = new Date(Date.now() - 20 * 864e5).toISOString();
  const end = new Date(Date.now() + 345 * 864e5).toISOString();
  await must(
    db('subscriptions').insert({
      id: SUB_ID, subject_type: 'club', subject_id: CLUB_ID, payer_user_id: U.club,
      plan_tier: 'club_pro', billing_period: 'yearly', status: 'active',
      current_period_start: start, current_period_end: end, trial_end: null,
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
  { id: TEAM.a, name: 'PÁDEL CENTER DEMO A', gender: 'masculino', category: '2ª', owner: U.club, own: true, slots: ['6|10:00', '6|12:00'], roster: 13, ptsRange: [1700, 3300] },
  { id: TEAM.b, name: 'PÁDEL CENTER DEMO B', gender: 'masculino', category: '4ª', owner: U.club, own: true, slots: ['0|10:00'], roster: 11, ptsRange: [500, 1200] },
  { id: TEAM.fem, name: 'PÁDEL CENTER DEMO A - FISIO HERRERA', gender: 'femenino', category: '3ª', owner: U.club, own: true, slots: ['6|16:00', '6|18:00'], roster: 11, ptsRange: [900, 2100] },
  { id: TEAM.g1, name: 'LOS CORRALES PÁDEL B', gender: 'masculino', category: '3ª', owner: U.club, own: false, slots: ['6|18:00'], roster: 10, ptsRange: [1000, 2300] },
  { id: TEAM.g2, name: 'CLUB TENIS LIENCRES C', gender: 'femenino', category: '4ª', owner: U.invitado, own: false, slots: ['0|12:00'], roster: 10, ptsRange: [400, 1200] },
];
const PLAYERS: Record<string, { id: string; name: string; pts: number; user_id: string | null }[]> = {};

async function seedTeams() {
  log('— equipos y plantillas');
  let im = 0, iF = 0;
  for (const t of TEAMS) {
    await must(
      db('teams').insert({
        id: t.id, owner_id: t.owner, name: t.name, federation: 'FCantP', league: 'Liga Cántabra de Pádel',
        category: t.category, gender: t.gender, club_id: t.own ? CLUB_ID : null,
        venue_club_id: t.own ? null : CLUB_ID, covered: t.own, preferred_home_slots: t.slots,
      }),
      `team ${t.name}`,
    );
    // El trigger de producción mete al owner como capitán; si no, lo hacemos nosotros.
    const tm = (await must(db('team_members').select('user_id').eq('team_id', t.id), 'tm')) as { user_id: string }[];
    if (!tm.some((m) => m.user_id === t.owner))
      await must(db('team_members').insert({ team_id: t.id, user_id: t.owner, role: 'captain' }), 'tm owner');

    const names: string[] = [];
    if (t.id === TEAM.a) names.push('Rubén Cobo', 'Iván Setién');
    while (names.length < t.roster) {
      const n = t.gender === 'masculino' ? NOMBRES_M[im++ % NOMBRES_M.length] : NOMBRES_F[iF++ % NOMBRES_F.length];
      if (!names.includes(n)) names.push(n);
    }
    const [lo, hi] = t.ptsRange;
    const rows = names.map((name, i) => ({
      team_id: t.id, name,
      pts: Math.round(hi - ((hi - lo) * i) / (names.length - 1) + (rnd() * 120 - 60)),
      position: i % 3 === 2 ? 'Ambos' : i % 2 === 0 ? 'Drive' : 'Revés',
      user_id: t.id === TEAM.a && name === 'Rubén Cobo' ? U.capitan : t.id === TEAM.a && name === 'Iván Setién' ? U.jugador : null,
      active: true, available: true,
    }));
    const inserted = (await must(db('players').insert(rows).select('id,name,pts,user_id'), `players ${t.name}`)) as { id: string; name: string; pts: number; user_id: string | null }[];
    PLAYERS[t.id] = inserted.sort((a, b) => b.pts - a.pts);
    log(`  ✓ ${t.name} (${inserted.length} jugadores)${t.own ? '' : ' · INVITADO'}`);
  }
  // Capitán y jugador de carne y hueso en el A.
  await must(
    db('team_members').insert([
      { team_id: TEAM.a, user_id: U.capitan, role: 'captain' },
      { team_id: TEAM.a, user_id: U.jugador, role: 'player' },
    ]),
    'team_members A',
  );
}

// ─── TEMPORADAS Y JORNADAS ───────────────────────────────────────────────────
interface MdSpec {
  jornada: number; date: string; opponent: string; home: boolean;
  time?: string | null; location?: string | null; unconfirmed?: boolean;
}
function buildCalendar(rivales: string[], dates: string[], homeFirst: boolean, homeTime: string): MdSpec[] {
  return dates.map((date, i) => {
    const home = homeFirst ? i % 2 === 0 : i % 2 === 1;
    const opp = rivales[i % rivales.length];
    return { jornada: i + 1, date, opponent: opp, home, time: home ? homeTime : pick(['10:00', '11:30', '16:00', '17:30']), location: home ? CLUB_NAME : SEDES[opp] ?? null };
  });
}

/** La BD crea sola una "Variante 1" al insertar la jornada: la reutilizamos
 *  (y la activamos) en vez de duplicarla. */
async function ensureVariant(mdId: string, label: string, active: boolean): Promise<{ id: string }> {
  const existing = (await must(db('lineup_variants').select('id').eq('matchday_id', mdId).eq('label', label), 'variant lookup')) as { id: string }[];
  if (existing.length) {
    await must(db('lineup_variants').update({ is_active: active }).eq('id', existing[0].id), 'variant activate');
    return existing[0];
  }
  return (await must(db('lineup_variants').insert({ matchday_id: mdId, label, is_active: active }).select().single(), 'variant')) as { id: string };
}

interface FinishedResult { outcome: 'win' | 'draw' | 'loss'; score_for: number; score_against: number }

/** Alineación (5 pistas por puntos) + resultados set a set + cierre. */
async function playMatchday(mdId: string, teamId: string, weWinTarget: boolean, withWo = false): Promise<FinishedResult> {
  const roster = PLAYERS[teamId];
  const ten = shuffle(roster.slice(0, Math.min(roster.length, 11))).slice(0, 10).sort((a, b) => b.pts - a.pts);
  const variant = await ensureVariant(mdId, 'Variante 1', true);
  const lineups = [];
  for (let c = 0; c < 5; c++)
    lineups.push({ matchday_id: mdId, variant_id: variant.id, court_number: c + 1, player_a_id: ten[2 * c].id, player_b_id: ten[2 * c + 1].id });
  await must(db('lineups').insert(lineups), 'lineups');

  // 5 pistas: decidimos ganadores para que el resultado global salga como queremos.
  const wins = weWinTarget ? pick([3, 3, 4, 5]) : pick([0, 1, 2, 2]);
  const courtWin = shuffle([...Array(5)].map((_, i) => i < wins));
  const rows: Record<string, unknown>[] = [];
  let scoreFor = 0, scoreAgainst = 0;
  for (let c = 0; c < 5; c++) {
    if (withWo && c === 4) {
      // El rival no se presenta en la pista 5: cuenta como punto nuestro.
      for (let s = 1; s <= 2; s++) rows.push({ matchday_id: mdId, court_number: 5, set_number: s, us: null, them: null, forfeit: true, forfeit_us: false });
      scoreFor++;
      continue;
    }
    const sets = makeMatch(courtWin[c]);
    sets.forEach(([us, them], i) => rows.push({ matchday_id: mdId, court_number: c + 1, set_number: i + 1, us, them, forfeit: false, forfeit_us: false }));
    if (courtWin[c]) scoreFor++; else scoreAgainst++;
  }
  await must(db('match_results').insert(rows), 'match_results');
  const outcome: FinishedResult['outcome'] = scoreFor > scoreAgainst ? 'win' : scoreFor < scoreAgainst ? 'loss' : 'draw';
  return { outcome, score_for: scoreFor, score_against: scoreAgainst };
}

async function seedSeasons() {
  log('— temporadas y jornadas');
  const specs: { team: TeamSpec; season: string; cal: MdSpec[]; finishedUntil: number; detailed: boolean }[] = [
    { team: TEAMS[0], season: SEASON.a, cal: buildCalendar(RIVALES_M, FECHAS_14, true, '10:00'), finishedUntil: 7, detailed: true },
    { team: TEAMS[1], season: SEASON.b, cal: buildCalendar(shuffle(RIVALES_M), FECHAS_14, false, '10:00'), finishedUntil: 7, detailed: false },
    { team: TEAMS[2], season: SEASON.fem, cal: buildCalendar(RIVALES_F, FECHAS_14, true, '16:00'), finishedUntil: 7, detailed: false },
    { team: TEAMS[3], season: SEASON.g1, cal: buildCalendar(shuffle(RIVALES_M).slice(0, 10), FECHAS_14.slice(2, 12), false, '18:00'), finishedUntil: 5, detailed: false },
    { team: TEAMS[4], season: SEASON.g2, cal: buildCalendar(shuffle(RIVALES_F).slice(0, 10), FECHAS_14.slice(2, 12), true, '12:00'), finishedUntil: 5, detailed: false },
  ];
  for (const s of specs) {
    await must(
      db('seasons').insert({
        id: s.season, team_id: s.team.id, name: 'Liga Cántabra de Pádel 2026', category: s.team.category,
        phase: 'liga', total_matchdays: s.cal.length, active: true, start_date: s.cal[0].date, end_date: null,
      }),
      `season ${s.team.name}`,
    );
    // Equipos invitados: los partidos de local futuros llegan SIN hora/pista
    // (es justo lo que el club tiene que poner), y uno con sede sin confirmar.
    if (!s.team.own) {
      for (const md of s.cal) {
        if (md.jornada > s.finishedUntil && md.home) { md.time = null; md.location = null; }
      }
      const firstFutureHome = s.cal.find((m) => m.jornada > s.finishedUntil && m.home);
      if (firstFutureHome) firstFutureHome.unconfirmed = true;
    }
    const rows = s.cal.map((m) => ({
      season_id: s.season, jornada_number: m.jornada, match_date: m.date,
      match_time: m.time ? `${m.time}:00` : null, opponent: m.opponent, is_home: m.home,
      location: m.location ?? null, tandas: m.home ? '3-2' : '2-3',
      status: 'upcoming', home_unconfirmed: !!m.unconfirmed,
    }));
    const mds = (await must(db('matchdays').insert(rows).select('id,jornada_number,is_home,opponent'), `matchdays ${s.team.name}`)) as { id: string; jornada_number: number; is_home: boolean; opponent: string }[];
    mds.sort((a, b) => a.jornada_number - b.jornada_number);

    let w = 0, l = 0, d = 0;
    for (const md of mds) {
      if (md.jornada_number > s.finishedUntil) continue;
      const PATRON_A = [true, true, false, true, true, true, false];
      const weWin = s.detailed ? PATRON_A[md.jornada_number - 1] : rnd() < 0.5;
      let res: FinishedResult;
      if (s.detailed || md.jornada_number <= 2) {
        res = await playMatchday(md.id, s.team.id, weWin, s.detailed && md.jornada_number === 4);
      } else {
        const sf = weWin ? pick([3, 4]) : pick([1, 2]);
        res = { outcome: weWin ? 'win' : 'loss', score_for: sf, score_against: 5 - sf };
      }
      if (res.outcome === 'win') w++; else if (res.outcome === 'loss') l++; else d++;
      await must(db('matchdays').update({ status: 'finished', ...res }).eq('id', md.id), 'close md');
    }
    // Próxima jornada del A: disponibilidad + dos variantes de alineación.
    if (s.detailed) {
      const next = mds.find((m) => m.jornada_number === s.finishedUntil + 1)!;
      const roster = PLAYERS[s.team.id];
      const avail = roster.map((p, i) => ({
        matchday_id: next.id, player_id: p.id,
        available: i !== 3 && i !== 9,
        note: i === 3 ? 'Lesión de hombro, baja 2 semanas' : i === 9 ? 'Boda, no llego' : null,
        updated_by: p.user_id ?? U.capitan,
      })).filter((_, i) => i !== 7); // uno sin contestar
      await must(db('availability').insert(avail), 'availability');
      const ok = roster.filter((_, i) => i !== 3 && i !== 9 && i !== 7).slice(0, 10);
      const v1 = await ensureVariant(next.id, 'Variante 1', true);
      const v2 = await ensureVariant(next.id, 'Variante 2', false);
      const pairs = (vid: string, order: typeof ok) => order.slice(0, 10).map((_, i) => i).filter((i) => i % 2 === 0).map((i) => ({
        matchday_id: next.id, variant_id: vid, court_number: i / 2 + 1, player_a_id: order[i].id, player_b_id: order[i + 1].id,
      }));
      await must(db('lineups').insert(pairs(v1.id, ok)), 'lineups v1');
      const alt = [ok[0], ok[2], ok[1], ok[3], ...ok.slice(4)];
      await must(db('lineups').insert(pairs(v2.id, alt).slice(0, 4)), 'lineups v2');
      // Jornada de mañana: publicada (aviso a la plantilla).
      await must(
        db('notifications').insert([
          { user_id: U.jugador, type: 'lineup_published', title: 'Alineación publicada', body: `Ya está la alineación para la J${next.jornada_number} vs ${next.opponent}. Juegas en pista 1.`, data: { matchdayId: next.id } },
          { user_id: U.jugador, type: 'availability_reminder', title: 'Confirma tu disponibilidad ⏳', body: `Aún no has confirmado para la jornada J${next.jornada_number + 1}.`, data: { type: 'availability_reminder', matchdayId: mds[s.finishedUntil + 1].id } },
          { user_id: U.capitan, type: 'lineup_reminder', title: 'Alineación pendiente', body: `La J${next.jornada_number + 1} vs ${mds[s.finishedUntil + 1].opponent} es en 8 días y aún no tiene alineación.`, data: { matchdayId: mds[s.finishedUntil + 1].id } },
        ]),
        'notifications',
      );
      // Un par de publicaciones sociales sobre las últimas jornadas.
      const last = mds[s.finishedUntil - 1];
      const nextFull = (await must(db('matchdays').select('is_home,location,match_time,opponent').eq('id', next.id).single(), 'next md')) as { is_home: boolean; location: string | null; match_time: string | null; opponent: string };
      await must(
        db('posts').insert([
          { author_id: U.capitan, kind: 'match_result', body: `Vuelta de vacaciones con victoria contra ${last.opponent}. ¡Seguimos arriba! 💪`, matchday_id: last.id, visibility: 'public' },
          { author_id: U.jugador, kind: 'text', body: `Mañana toca ${nextFull.is_home ? 'en casa' : 'fuera, en ' + nextFull.location} a las ${(nextFull.match_time ?? '10:00').slice(0, 5)} contra ${nextFull.opponent}. ¡Vamos! 🎾`, visibility: 'public' },
        ]),
        'posts',
      );
    }
    log(`  ✓ ${s.team.name}: ${s.cal.length} jornadas · ${s.finishedUntil} jugadas (${w}V ${d}E ${l}D)`);
  }
  await must(
    db('notifications').insert([
      { user_id: U.club, type: 'joined_team', title: 'Rubén Cobo se ha unido a PÁDEL CENTER DEMO A', body: 'Ha entrado con el código de capitán. Ya puede gestionar el equipo.', data: { team_id: TEAM.a } },
      { user_id: U.club, type: 'joined_team', title: 'Iván Setién se ha unido a PÁDEL CENTER DEMO A', body: 'Ha entrado con el código de jugador.', data: { team_id: TEAM.a } },
    ]),
    'notifications club',
  );
}

// ─── TORNEOS ─────────────────────────────────────────────────────────────────
const PAREJAS_M: [string, string][] = [
  ['Álvaro Ruiz-Capillas', 'Diego San Emeterio'], ['Carlos Agüero', 'Miguel Lavín'], ['Pablo Cobo', 'Jaime Sañudo'],
  ['Adrián Pila', 'Jesús Saseta'], ['Marcos Bustillo', 'Sergio Riancho'], ['Iñaki Gándara', 'Nacho Lastra'],
  ['Héctor Pelayo', 'Rodrigo Cuesta'], ['Óscar Mier', 'Dani Villegas'], ['Luis Escalante', 'Fer Mazón'],
  ['Javi Toca', 'Borja Quintanal'], ['Gonzalo Diestro', 'Mario Argumosa'], ['Andrés Portilla', 'Raúl Herrán'],
  ['Hugo Cagigas', 'Víctor Liaño'], ['Tomás Revuelta', 'Julián Bolado'], ['Enrique Solana', 'Pedro Trueba'],
  ['Aitor Ceballos', 'Samuel Cano'],
];
const PAREJAS_F: [string, string][] = [
  ['Marta Cobo', 'Andrea Solana'], ['Paula Gómez', 'Sara Quintana'], ['Elena Bustillo', 'Nerea Lastra'],
  ['Claudia Ruiz', 'Irene Mazón'], ['Alba Sañudo', 'Carmen Villegas'], ['Laura Pelayo', 'Cristina Ceballos'],
  ['Ana Portilla', 'Noelia Vega'], ['Beatriz Trueba', 'Silvia Gándara'], ['Raquel Diestro', 'Inés Bolado'],
  ['Patricia Toca', 'Rocío Herrán'], ['Eva Argumosa', 'Julia Mier'], ['Sofía Cuesta', 'Marina Liaño'],
];
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '');

function regRows(tid: string, pairs: [string, string][], gender: string, category: string, ptsBase: number, opts: { paidRatio?: number; terms?: string | null } = {}) {
  return pairs.map(([a, b], i) => {
    const seedPoints = Math.round(ptsBase - i * (ptsBase / 25) + rnd() * 80);
    const paid = rnd() < (opts.paidRatio ?? 1);
    return {
      tournament_id: tid, gender, category,
      pair_label: `${a.split(' ')[0]} / ${b.split(' ')[0]}`,
      p1_name: a, p1_email: `${slug(a)}@example.com`, p1_phone: `6001${String(100 + i).padStart(3, '0')}${gender === 'femenino' ? '5' : '1'}`,
      p2_name: b, p2_email: `${slug(b)}@example.com`, p2_phone: `6002${String(100 + i).padStart(3, '0')}${gender === 'femenino' ? '5' : '1'}`,
      seed_points: seedPoints, league_sum: 2 + Math.floor(i / 3),
      availability: rnd() < 0.3 ? [pick(['Sáb 09:00–12:00', 'Dom 16:00–19:00', 'Sáb 19:00–21:00'])] : [],
      status: 'confirmed', payment_status: paid ? 'paid' : 'pending_club', payment_method: 'offline',
      terms_accepted_at: opts.terms ? new Date(Date.now() - (10 - i) * 864e5).toISOString() : null,
      terms_snapshot: opts.terms ?? null,
    };
  });
}

async function seedTournaments() {
  log('— torneos');
  const terms = (await must((supabase as unknown as { rpc: (fn: string) => PromiseLike<Res<unknown>> }).rpc('tournament_default_terms'), 'terms')) as string;
  const base = {
    club_id: CLUB_ID, created_by: U.club, location: CLUB_NAME, seeding_mode: 'points', payment_mode: 'offline',
    fee_currency: 'EUR', billing_status: 'included', terms, // covered_pairs por torneo: el trigger de cobro exige plazas cubiertas ≥ inscritas para generar cuadros
    info_rows: [{ label: 'Bolas', value: 'Head Pro' }, { label: 'Vestuarios', value: 'Con duchas y taquillas' }],
  };

  // 1) ABIERTO con inscripciones (aún sin cuadro)
  await must(
    db('tournaments').insert({
      ...base, id: TOUR.open, name: 'I Open Pádel Center Demo', format: 'ko_consolation', match_format: 'bo3_stb',
      phase_formats: { main: 'bo3_stb', consol: 'bo1' }, genders: ['masculino'], categories: ['3ª', '4ª'],
      starts_on: '2026-09-26', ends_on: '2026-09-27', max_pairs: 16, min_pairs: 8, covered_pairs: 16, courts: 4,
      start_time: '09:00', end_time: '21:00', slot_minutes: 90, rest_minutes: 30, max_removable_hours: 4,
      entry_fee: 25, entry_fee_2: 35, payment_deadline_days: 3, status: 'open', signup_code: 'DEMO16', pair_based: true,
      category_rules: { mode: 'points', byCategory: { '3ª': { puntos: 4000, nivel: null }, '4ª': { puntos: 2600, nivel: null } } },
      prizes_json: [{ place: '1º', items: [{ type: 'material', desc: 'Pala Bullpadel' }, { type: 'metalico', amount: 50 }] }, { place: '2º', items: [{ type: 'material', desc: 'Paletero + bote de bolas' }] }, { place: 'Consolación', items: [{ type: 'otros', desc: 'Camiseta del torneo' }] }],
      extra_info: 'Sorteo de regalos entre los inscritos. Bar abierto todo el fin de semana.',
      observations: 'La organización se reserva el derecho a reordenar parejas entre categorías según nivel.',
    }),
    'torneo abierto',
  );
  await must(db('tournament_registrations').insert([
    ...regRows(TOUR.open, PAREJAS_M.slice(0, 5), 'masculino', '3ª', 3700, { paidRatio: 0.6, terms }),
    ...regRows(TOUR.open, PAREJAS_M.slice(5, 9), 'masculino', '4ª', 2400, { paidRatio: 0.6, terms }),
  ]), 'regs abierto');
  log('  ✓ I Open Pádel Center Demo · ABIERTO · código DEMO16 · 9 parejas');

  // 2) BORRADOR (para publicar)
  await must(
    db('tournaments').insert({
      ...base, id: TOUR.draft, name: 'Torneo de Otoño · Grupos + KO', format: 'groups_ko', match_format: 'bo3_stb',
      phase_formats: { groups: 'bo1', main: 'bo3_stb', consol: 'bo1' }, genders: ['masculino', 'femenino'], categories: ['4ª', '5ª'],
      starts_on: '2026-10-17', ends_on: '2026-10-18', max_pairs: 24, min_pairs: 12, covered_pairs: 24, courts: 4,
      start_time: '09:00', end_time: '22:00', slot_minutes: 60, rest_minutes: 30,
      entry_fee: 20, payment_deadline_days: 5, status: 'draft', signup_code: 'OTONO24', pair_based: true,
      prizes: 'Trofeos para campeones y finalistas de cada categoría.',
    }),
    'torneo borrador',
  );
  log('  ✓ Torneo de Otoño · BORRADOR · código OTONO24');

  // 3) TERMINADO (KO 8 parejas, todo jugado con el motor real)
  await must(
    db('tournaments').insert({
      ...base, id: TOUR.done, name: 'Torneo Social de Verano', format: 'ko', match_format: 'bo3_stb',
      phase_formats: { main: 'bo3_stb' }, genders: ['masculino'], categories: ['4ª'],
      starts_on: '2026-08-22', ends_on: '2026-08-23', max_pairs: 8, covered_pairs: 8, courts: 3,
      start_time: '10:00', end_time: '21:00', slot_minutes: 90, rest_minutes: 0,
      entry_fee: 15, status: 'open', signup_code: 'VERANO8', pair_based: true,
    }),
    'torneo terminado',
  );
  await must(db('tournament_registrations').insert(regRows(TOUR.done, PAREJAS_M.slice(8, 16), 'masculino', '4ª', 2500)), 'regs verano');
  await buildAndPlay(TOUR.done, 'masculino', '4ª', { ko: { 2: ['2026-08-22'], 1: ['2026-08-22'], 0: ['2026-08-23'] }, playRounds: 3 });
  log('  ✓ Torneo Social de Verano · TERMINADO · cuadro de 8 completo');

  // 4) EN JUEGO (KO + consolación, 12 parejas, 1ª ronda jugada hoy)
  await must(
    db('tournaments').insert({
      ...base, id: TOUR.live, name: 'Open Femenino Pádel Center', format: 'ko_consolation', match_format: 'bo3_stb',
      phase_formats: { main: 'bo3_stb', consol: 'bo1' }, genders: ['femenino'], categories: ['3ª'],
      starts_on: TODAY, ends_on: '2026-09-06', max_pairs: 16, min_pairs: 8, covered_pairs: 16, courts: 4,
      start_time: '16:00', end_time: '23:00', slot_minutes: 90, rest_minutes: 30, max_removable_hours: 6,
      entry_fee: 25, status: 'open', signup_code: 'FEM12', pair_based: true,
      category_rules: { mode: 'points', byCategory: { 'femenino|3ª': { puntos: 3600, nivel: null } } },
    }),
    'torneo en juego',
  );
  await must(db('tournament_registrations').insert(regRows(TOUR.live, PAREJAS_F.slice(0, 12), 'femenino', '3ª', 3400, { terms })), 'regs fem');
  await buildAndPlay(TOUR.live, 'femenino', '3ª', { ko: { 3: [TODAY], 2: ['2026-09-05'], 1: ['2026-09-06'], 0: ['2026-09-06'] }, playRounds: 1 });
  log('  ✓ Open Femenino · EN JUEGO · octavos jugados, cuartos y consolación con horario');
}

/** Genera el cuadro con el motor de la app, fija días por fase, hace el horario
 *  automático y juega `playRounds` rondas del cuadro principal. */
async function buildAndPlay(tid: string, gender: string, category: string, cfg: { ko: Record<number, string[]>; playRounds: number }) {
  const t = (await must(db('tournaments').select('*').eq('id', tid).single(), 'get t')) as T.Tournament;
  const regs = (await must(db('tournament_registrations').select('*').eq('tournament_id', tid), 'regs')) as T.TournamentRegistration[];
  await T.generateKoBracket(t, regs, gender, category);
  await must(db('tournaments').update({ status: 'in_progress' }).eq('id', tid), 'status in_progress');
  for (const [fromEnd, dates] of Object.entries(cfg.ko))
    for (const d of dates) await T.togglePhaseDay(tid, 'ko', Number(fromEnd), d, true);
  const matchesOf = async () => (await must(db('tournament_matches').select('*').eq('tournament_id', tid), 'matches')) as T.TournamentMatch[];
  await T.autoScheduleTournament(t, regs, await matchesOf(), await T.getPhaseDays(tid));
  const setsToWin = (t.phase_formats as Record<string, string> | null)?.main === 'bo1' ? 1 : 2;
  for (let round = 1; round <= cfg.playRounds; round++) {
    const ms = (await matchesOf()).filter((m) => m.bracket === 'main' && m.round === round && m.status === 'pending' && m.home_reg && m.away_reg);
    ms.sort((a, b) => a.slot - b.slot);
    for (const m of ms) {
      const homeWins = rnd() < 0.62; // los cabezas de serie suelen ganar
      const sets = makeMatch(homeWins).map(([h, a]) => [h, a]);
      await T.setMatchResult(m, sets, setsToWin);
    }
  }
  // Tras avanzar el cuadro (y alimentar la consolación) se recoloca lo pendiente.
  await T.autoScheduleTournament(t, regs, await matchesOf(), await T.getPhaseDays(tid));
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
(async () => {
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
  await seedTournaments();
  console.log(`
════════════════════════════════════════════════════════
 CLUB DEMO LISTO · contraseña común: ${PASSWORD}
   demo.club@tactium.io      → Lucía Herrera · admin del club (club_pro)
   demo.capitan@tactium.io   → Rubén Cobo · capitán de PÁDEL CENTER DEMO A
   demo.jugador@tactium.io   → Iván Setién · jugador del A
   demo.invitado@tactium.io  → Nacho Bolado · capitán de CLUB TENIS LIENCRES C (invitado)
 Torneos: DEMO16 (abierto) · OTONO24 (borrador) · VERANO8 (terminado) · FEM12 (en juego)
════════════════════════════════════════════════════════`);
})().catch((e) => {
  console.error('ERROR:', e.message ?? e);
  process.exit(1);
});
