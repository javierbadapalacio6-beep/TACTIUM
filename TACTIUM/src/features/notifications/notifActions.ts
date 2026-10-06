import { Linking } from 'react-native';

import { supabase } from '@core/supabase/client';
import { fetchAvailability, type AvailabilityStatus } from '@core/services/availability';
import { myPlayerForMatchday } from '@core/push/availabilityActions';
import { TACTIUM_WEB_BASE_URL } from '@core/entitlements/tournamentBilling';
import { navigationRef } from '@navigation/navigationRef';
import { currentNavRole } from '@navigation/navRole';
import type { AppNotification } from '@core/services/notifications';

/**
 * Lógica de la campana: a dónde lleva cada aviso, qué botón en línea lleva y
 * cómo se agrupan. OJO con las claves de `data`: los triggers escriben en
 * snake_case (`matchday_id`, `tournament_id`) y las edge/RPC de push en
 * camelCase (`matchdayId`, `tournamentId`). Se aceptan las dos (igual que la
 * web, `notifHref` en tactium-web/lib/queries.ts).
 */
export function dataStr(n: AppNotification, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = n.data?.[k];
    if (typeof v === 'string' && v) return v;
  }
  return null;
}

export const matchdayOf = (n: AppNotification) => dataStr(n, 'matchdayId', 'matchday_id');
export const tournamentOf = (n: AppNotification) => dataStr(n, 'tournamentId', 'tournament_id');
export const actorOf = (n: AppNotification) => dataStr(n, 'actor_id', 'actorId');

// ── Destinos ──────────────────────────────────────────────────────────────
export type NavTarget =
  | { kind: 'home'; screen: 'Availability' | 'Lineup' | 'Jornada'; matchdayId: string }
  | { kind: 'team'; fallbackHome: boolean }
  | { kind: 'profile'; id: string }
  | { kind: 'follow'; tournamentId: string; initialTab: 'main' | 'schedule' | 'players' }
  | { kind: 'clubDetail'; tournamentId: string }
  | { kind: 'casualMatch'; matchId: string }
  | { kind: 'leagueMatch'; matchdayId: string }
  | { kind: 'web'; url: string }
  | { kind: 'clubSchedule' };

export function targetOf(n: AppNotification): NavTarget | null {
  const md = matchdayOf(n);
  const tid = tournamentOf(n);
  switch (n.type) {
    case 'availability_reminder':
      return md ? { kind: 'home', screen: 'Availability', matchdayId: md } : null;
    case 'lineup_reminder':
      return md ? { kind: 'home', screen: 'Lineup', matchdayId: md } : null;
    case 'lineup_published':
    case 'matchday_created':
    case 'schedule_set':
      return md ? { kind: 'home', screen: 'Jornada', matchdayId: md } : null;
    // Encuesta de hora: el bloque vive en la jornada (Previa). Al gestor del
    // club que no es del equipo se le avisa de la hora fijada → Horarios.
    case 'time_poll_open':
    case 'time_poll_reminder':
      return md ? { kind: 'home', screen: 'Jornada', matchdayId: md } : null;
    case 'time_poll_fixed':
      if (n.data?.for_club) return { kind: 'clubSchedule' };
      return md ? { kind: 'home', screen: 'Jornada', matchdayId: md } : null;
    case 'joined_team':
      return { kind: 'team', fallbackHome: true };
    case 'member_joined':
    case 'player_claimed':
      return { kind: 'team', fallbackHome: false };
    case 'new_follower': {
      const a = actorOf(n);
      return a ? { kind: 'profile', id: a } : null;
    }
    // Kudos: al detalle de lo que ha recibido el aplauso.
    case 'kudos': {
      const id = dataStr(n, 'target_id', 'targetId');
      if (!id) return null;
      const k = dataStr(n, 'target_kind', 'targetKind');
      return k === 'league'
        ? { kind: 'leagueMatch', matchdayId: id }
        : { kind: 'casualMatch', matchId: id };
    }
    // Avisos al JUGADOR → su vista de seguimiento; al CLUB (inscripción) → su
    // detalle editable (Inicio del organizador / Competir › Torneos del club).
    case 'tournament_schedule':
      return tid ? { kind: 'follow', tournamentId: tid, initialTab: 'schedule' } : null;
    case 'tournament_bracket':
    case 'tournament_moved':
      return tid ? { kind: 'follow', tournamentId: tid, initialTab: 'main' } : null;
    case 'tournament_signup':
      return tid ? { kind: 'clubDetail', tournamentId: tid } : null;
    // El pago de torneos es web-first (ver TournamentSignupScreen).
    case 'tournament_payment_due':
      return tid ? { kind: 'web', url: `${TACTIUM_WEB_BASE_URL}/torneos/${tid}` } : null;
    default:
      return null;
  }
}

/** Pestañas montadas. La barra es la misma para todos los roles (Home ·
 *  Competir · Create · Team · Profile), pero antes de hidratar puede faltar. */
function tabNames(): string[] {
  try {
    const root = navigationRef.getRootState();
    const main = root?.routes.find((r) => r.name === 'MainTabs');
    return ((main?.state?.routeNames as string[] | undefined) ?? []).slice();
  } catch {
    return [];
  }
}

const navAny = (name: string, params?: object) =>
  (navigationRef.navigate as unknown as (n: string, p?: object) => void)(name, params);

/** Navega a una pantalla dentro de una pestaña. false si la pestaña no existe. */
function goTab(tab: string, screen?: string, params?: object): boolean {
  if (!tabNames().includes(tab)) return false;
  navAny('MainTabs', screen ? { screen: tab, params: { screen, params } } : { screen: tab });
  return true;
}

/** Lleva al destino del aviso. Si no existe para el rol, no hace nada. */
export function goToTarget(t: NavTarget): void {
  if (t.kind === 'web') {
    Linking.openURL(t.url).catch(() => {});
    return;
  }
  if (!navigationRef.isReady()) return;
  try {
    switch (t.kind) {
      case 'home': {
        // La stack de Inicio registra Jornada/Alineación/Disponibilidad para
        // todos los roles (el club las ve en solo lectura). La disponibilidad
        // no aplica al club.
        const role = currentNavRole();
        if (t.screen === 'Availability' && (role === 'club' || role === 'organizer')) return;
        goTab('Home', t.screen, { matchdayId: t.matchdayId });
        return;
      }
      case 'team':
        // Equipo existe para todos: plantilla (capitán/jugador) o equipos
        // del club. `fallbackHome` queda por compatibilidad del destino.
        if (goTab('Team', 'TeamRoot')) return;
        if (t.fallbackHome) goTab('Home', 'HomeRoot');
        return;
      case 'profile':
        navAny('PublicProfile', { type: 'user', id: t.id });
        return;
      case 'clubDetail': {
        // Detalle EDITABLE del torneo: el organizador lo gestiona desde Inicio;
        // el club con equipos, desde Competir › Torneos. Los demás, la vista
        // de seguimiento.
        const role = currentNavRole();
        const params = { tournamentId: t.tournamentId };
        if (role === 'organizer' && goTab('Home', 'TournamentDetail', params)) return;
        if (role === 'club' && goTab('Competir', 'TournamentDetail', params)) return;
        navAny('TournamentFollow', { tournamentId: t.tournamentId, initialTab: 'players' });
        return;
      }
      case 'clubSchedule':
        goTab('Home', 'ClubSchedule');
        return;
      case 'casualMatch':
        navAny('CasualMatchDetail', { matchId: t.matchId });
        return;
      case 'leagueMatch':
        navAny('LeagueMatchDetail', { matchdayId: t.matchdayId });
        return;
      case 'follow':
        navAny('TournamentFollow', { tournamentId: t.tournamentId, initialTab: t.initialTab });
        return;
    }
  } catch {
    // Destino no disponible para este rol: se queda donde está.
  }
}

/** Texto del botón en línea que lleva al destino (o null si no lleva). */
export function ctaLabel(type: string): string | null {
  switch (type) {
    case 'lineup_published':
      return 'Ver alineación';
    case 'matchday_created':
      return 'Ver jornada';
    case 'lineup_reminder':
      return 'Hacer alineación';
    case 'member_joined':
    case 'player_claimed':
      return 'Ver plantilla';
    case 'schedule_set':
      return 'Ver horario';
    case 'time_poll_open':
    case 'time_poll_reminder':
      return 'Votar';
    case 'time_poll_fixed':
      return 'Ver jornada';
    case 'tournament_bracket':
      return 'Ver cuadro';
    case 'tournament_schedule':
      return 'Ver horario';
    case 'tournament_signup':
      return 'Ver inscripción';
    case 'tournament_payment_due':
      // En la app no se dice «pagar»: botón de pago externo en iOS = riesgo con
      // Apple. Lleva a la web del torneo, donde se paga.
      return 'Ver inscripción';
    default:
      return null;
  }
}

// ── Disponibilidad en línea ──────────────────────────────────────────────
export interface AvailabilityAction {
  playerId: string;
  /** Se puede contestar: jornada 'upcoming' y sin respuesta o en duda. */
  canAnswer: boolean;
  /** Respuesta firme ya guardada (yes/no) con la jornada aún por jugar. */
  answered: Exclude<AvailabilityStatus, 'maybe'> | null;
}

export async function loadAvailabilityAction(
  matchdayId: string,
  userId: string,
): Promise<AvailabilityAction | null> {
  const [playerId, mdRes] = await Promise.all([
    myPlayerForMatchday(matchdayId, userId),
    supabase.from('matchdays').select('status').eq('id', matchdayId).maybeSingle(),
  ]);
  if (!playerId) return null;
  const status = (mdRes.data as { status?: string } | null)?.status;
  if (status !== 'upcoming') return null;
  const map = await fetchAvailability(matchdayId);
  const mine = map[playerId]?.status ?? null;
  return {
    playerId,
    canAnswer: mine === null || mine === 'maybe',
    answered: mine === 'yes' || mine === 'no' ? mine : null,
  };
}

// ── Agrupación ───────────────────────────────────────────────────────────
export type Entry =
  | { kind: 'single'; n: AppNotification }
  | { kind: 'followers'; key: string; items: AppNotification[]; actors: string[] };

export interface Section {
  key: 'today' | 'week' | 'older';
  label: string;
  entries: Entry[];
}

const dayKey = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

/** «Marta López Ruiz» → «Marta L.» */
export function shortName(full: string | null | undefined): string | null {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;
  return parts.length >= 2 ? `${parts[0]} ${parts[1].charAt(0).toUpperCase()}.` : parts[0];
}

/** Nombre de respaldo sacado del título («Marta López te ha empezado a
 *  seguir»), por si el perfil público no carga. */
export function followerNameFromTitle(n: AppNotification): string | null {
  const m = /^(.*?)\s+(te ha empezado a seguir|sigue tu club)\s*$/i.exec(n.title ?? '');
  return shortName(m?.[1]);
}

/** «Marta L., Rubén C. y 1 más» / «Marta L. y Rubén C.» */
export function namesLine(names: string[]): string | null {
  if (names.length === 0) return null;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, 2).join(', ')} y ${names.length - 2} más`;
}

/** Secciones HOY (desde las 00:00) / ESTA SEMANA (últimos 7 días) / ANTES,
 *  con los `new_follower` de PERSONAS a ti (no a tu club) del mismo día
 *  juntos en una sola fila. `items` viene ordenado desc. */
export function buildSections(items: AppNotification[], now = new Date()): Section[] {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startWeek = now.getTime() - 7 * 24 * 3600 * 1000;

  // 1) Agrupar seguidores por día.
  const groups = new Map<string, AppNotification[]>();
  for (const n of items) {
    if (n.type !== 'new_follower' || n.data?.club_id) continue;
    const k = dayKey(n.created_at);
    const arr = groups.get(k) ?? [];
    arr.push(n);
    groups.set(k, arr);
  }

  const entries: Entry[] = [];
  const emitted = new Set<string>();
  for (const n of items) {
    if (n.type === 'new_follower' && !n.data?.club_id) {
      const k = dayKey(n.created_at);
      const g = groups.get(k)!;
      if (g.length > 1) {
        if (emitted.has(k)) continue;
        emitted.add(k);
        const actors: string[] = [];
        for (const x of g) {
          const id = actorOf(x);
          if (id && !actors.includes(id)) actors.push(id);
        }
        entries.push({ kind: 'followers', key: `f:${k}`, items: g, actors });
        continue;
      }
    }
    entries.push({ kind: 'single', n });
  }

  const sections: Section[] = [
    { key: 'today', label: 'HOY', entries: [] },
    { key: 'week', label: 'ESTA SEMANA', entries: [] },
    { key: 'older', label: 'ANTES', entries: [] },
  ];
  for (const e of entries) {
    const iso = e.kind === 'single' ? e.n.created_at : e.items[0].created_at;
    const t = new Date(iso).getTime();
    const s = t >= startToday ? sections[0] : t >= startWeek ? sections[1] : sections[2];
    s.entries.push(e);
  }
  return sections.filter((s) => s.entries.length > 0);
}
