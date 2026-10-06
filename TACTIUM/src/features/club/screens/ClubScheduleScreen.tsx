import React, { useCallback, useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Share,
} from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconAlert, IconPlus, BottomSheet, useLayout } from '@components/ui';
import { SidePanel } from '@components/layout';
import { SegmentedControl } from '@components/ui/SegmentedControl';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { FcpImportSheet } from '@features/club/components/FcpImportSheet';
import { useTeamStore } from '@store/teamStore';
import { toast } from '@store/toastStore';
import { createInvitation } from '@core/services/invitations';
import {
  getClubHomeSchedule,
  getVenueHomeSchedule,
  getVenueTeams,
  getTeamGroups,
  type VenueTeam,
  setVenueMatchdaySlot,
  fetchUnconfirmedVenues,
  currentRoundMatches,
  type ClubHomeMatch,
} from '@core/services/clubSchedule';
import { updateMatchday } from '@core/services/matchdays';
import { notifyPush } from '@core/push';
import {
  PreferredSlotsEditor,
  parseSlot,
  fmtSlot,
  DOW_NAME,
  DOW_SHORT,
  TIME_OPTIONS,
} from '@features/team/components/PreferredSlotsEditor';
import { tapSuccess } from '../clubOps';

import type { HomeStackScreenProps } from '@navigation/types';

const hhmm = (t: string | null): string => (t ? t.slice(0, 5) : '');

const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const DOW_UP = ['', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

const isoDow = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  const js = new Date(y, m - 1, d).getDay();
  return js === 0 ? 7 : js;
};
const fmtIso = (dt: Date) =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
const snapToDow = (iso: string, targetDow: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const cur = dt.getDay() === 0 ? 7 : dt.getDay();
  dt.setDate(dt.getDate() + (targetDow - cur));
  return fmtIso(dt);
};
/** Fecha que se guardará al elegir un día de la semana (la misma regla que al
 *  guardar): con fecha, se mueve dentro de su semana; sin fecha, la próxima
 *  vez que caiga ese día. */
const targetDate = (match: ClubHomeMatch, dow: number | null): string | null => {
  if (!dow) return match.match_date;
  if (match.match_date) return snapToDow(match.match_date, dow);
  const d = new Date();
  const cur = ((d.getDay() + 6) % 7) + 1;
  d.setDate(d.getDate() + ((dow - cur + 7) % 7));
  return fmtIso(d);
};

const dateLabel = (iso: string | null): string => {
  if (!iso) return 'Sin fecha';
  const [y, m, d] = iso.split('-');
  return d && m ? `${DOW_NAME[isoDow(iso)]} ${d}/${m}/${y?.slice(2) ?? ''}` : iso;
};
const groupLabel = (iso: string): string => {
  const [, m, d] = iso.split('-').map(Number);
  return `${DOW_UP[isoDow(iso)]} ${d} ${MONTHS[m - 1]}`;
};

// Franjas favoritas de un equipo del store (el campo aún no está en los tipos).
const teamSlotsOf = (t: unknown): string[] =>
  (t as { preferred_home_slots?: string[] })?.preferred_home_slots ?? [];

const sameCourt = (a: string | null, b: string | null) =>
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Partido que ya ocupa esa pista a esa hora (mismo día, hora y pista). */
function findClash(
  all: ClubHomeMatch[],
  selfId: string,
  date: string | null,
  time: string | null,
  court: string | null,
): ClubHomeMatch | null {
  if (!date || !time || !court) return null;
  return (
    all.find(
      (m) =>
        m.matchday_id !== selfId &&
        m.match_date === date &&
        hhmm(m.match_time) === time &&
        sameCourt(m.location, court),
    ) ?? null
  );
}

type Tab = 'partidos' | 'equipos';

/** Día/hora («D|HH:MM») y pista ya puestos al abrir el panel desde la rejilla. */
type SlotPreset = { slot: string; court: string };

/** Ancho mínimo para pintar la rejilla de pistas × horas (tablet). */
const GRID_MIN_WIDTH = 780;
const GRID_SIDEBAR = 320;
const GRID_TIME_COL = 58;
const GRID_COURT_MIN = 150;
const GRID_ROW_H = 58;

export const ClubScheduleScreen = ({
  navigation,
  embedded,
}: HomeStackScreenProps<'ClubSchedule'> & {
  /** Raíz del segmento Liga de Competir (club): sin «Atrás». */
  embedded?: boolean;
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((s) => s.teams);
  const clubTeams = useMemo(
    () => (club ? teams.filter((t) => t.club_id === club.id) : []),
    [teams, club],
  );

  const [tab, setTab] = useState<Tab>('partidos');
  const [matches, setMatches] = useState<ClubHomeMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ClubHomeMatch | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);
  const [editTeam, setEditTeam] = useState<
    { id: string; name: string; guest?: boolean } | null
  >(null);
  const [showAll, setShowAll] = useState(false);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  // TABLET: rejilla de pistas × horas. Se TOCA una celda libre y se abre el
  // panel de la hora con la pista y la hora ya puestas (el arrastre, después).
  const layout = useLayout();
  const gridMode = layout.isTablet && layout.contentWidth >= GRID_MIN_WIDTH;
  const [preset, setPreset] = useState<SlotPreset | null>(null);
  const [cellPick, setCellPick] = useState<{ court: string; time: string; iso: string } | null>(
    null,
  );
  // Alta de equipos invitados sin salir de Horarios: es donde se echa en falta.
  const [importOpen, setImportOpen] = useState(false);
  const [venueTeams, setVenueTeams] = useState<VenueTeam[]>([]);
  // Grupo de liga por equipo. No está en `teams`: hay que ir a la Federación.
  const [groupByTeam, setGroupByTeam] = useState<Record<string, string>>({});

  // Género, categoría y grupo por equipo. Con varios equipos del mismo club el
  // nombre no distingue: «SMASH PADEL A» puede ser el masculino de 2ª o el
  // femenino de 3ª, y dentro de una categoría cada grupo lleva su calendario.
  const metaByTeam = useMemo(() => {
    const m: Record<string, string> = {};
    const label = (id: string, gender: string | null, category: string | null) =>
      [
        gender === 'femenino' ? 'Fem.' : gender === 'mixto' ? 'Mixto' : 'Masc.',
        category ?? null,
        groupByTeam[id] ?? null,
      ]
        .filter(Boolean)
        .join(' · ');
    for (const t of clubTeams) m[t.id] = label(t.id, t.gender, t.category);
    for (const t of venueTeams) m[t.team_id] = label(t.team_id, t.gender, t.category);
    return m;
  }, [clubTeams, venueTeams, groupByTeam]);

  const teamIdsKey = useMemo(
    () =>
      [
        ...clubTeams.map((t) => t.id),
        ...venueTeams.map((t) => t.team_id),
        ...matches.map((m) => m.team_id),
      ]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort()
        .join(','),
    [clubTeams, venueTeams, matches],
  );

  useEffect(() => {
    const ids = teamIdsKey ? teamIdsKey.split(',') : [];
    if (ids.length === 0) {
      setGroupByTeam({});
      return;
    }
    let alive = true;
    getTeamGroups(ids).then((g) => {
      if (alive) setGroupByTeam(g);
    });
    return () => {
      alive = false;
    };
  }, [teamIdsKey]);

  // Franjas favoritas por equipo (override local sobre lo del store).
  const [slotsByTeam, setSlotsByTeam] = useState<Record<string, string[]>>({});
  useEffect(() => {
    const init: Record<string, string[]> = {};
    for (const t of clubTeams) init[t.id] = teamSlotsOf(t);
    setSlotsByTeam(init);
  }, [clubTeams]);

  // Equipos INVITADOS que juegan aquí. La lista sale de los EQUIPOS (y de sus
  // partidos): un invitado recién añadido o con la temporada acabada también.
  const guestTeams = useMemo(() => {
    const map = new Map<string, { id: string; name: string; claimed: boolean }>();
    for (const t of venueTeams)
      map.set(t.team_id, { id: t.team_id, name: t.team_name, claimed: !!t.claimed });
    for (const m of matches)
      if (m.is_guest && !map.has(m.team_id))
        map.set(m.team_id, { id: m.team_id, name: m.team_name, claimed: false });
    return [...map.values()];
  }, [venueTeams, matches]);

  // Pasarle al capitán de un equipo invitado un código para que entre y se
  // quede con SU equipo (el club sigue poniéndole los horarios).
  const inviteGuestCaptain = async (teamId: string, teamName: string) => {
    if (inviting) return;
    setInviting(teamId);
    try {
      const inv = await createInvitation(teamId, 'captain');
      await Share.share({
        message:
          `Tu equipo "${teamName}" ya está en TACTIUM con su calendario.\n` +
          `Entra con este código y el equipo pasa a ser tuyo: ${inv.code}\n` +
          `Los horarios de local en nuestro club los seguimos poniendo nosotros.`,
      });
    } catch (e: any) {
      toast.error('No se pudo crear el código', e?.message ?? '');
    } finally {
      setInviting(null);
    }
  };

  const load = useCallback(async () => {
    if (!club) return;
    try {
      const [own, guests, vTeams] = await Promise.all([
        getClubHomeSchedule(club.id),
        getVenueHomeSchedule(club.id).catch(() => [] as ClubHomeMatch[]),
        getVenueTeams(club.id).catch(() => [] as VenueTeam[]),
      ]);
      setVenueTeams(vTeams);
      // Playoff: sede propuesta, no confirmada. La marca vive en `matchdays` y
      // el RPC de los equipos propios no la devuelve, así que se consulta aparte.
      const pending = await fetchUnconfirmedVenues(
        [...own, ...guests].map((m) => m.matchday_id),
      ).catch(() => new Set<string>());
      const data = [...own, ...guests].map((m) => ({
        ...m,
        home_unconfirmed: pending.has(m.matchday_id),
      }));
      setMatches(data);
      setSlotsByTeam((prev) => {
        const next = { ...prev };
        for (const t of vTeams) next[t.team_id] = t.preferred_home_slots ?? [];
        for (const m of data) next[m.team_id] = m.preferred_home_slots ?? [];
        return next;
      });
    } catch (e: any) {
      toast.error('No se pudieron cargar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [club]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const roundMatches = useMemo(() => currentRoundMatches(matches), [matches]);
  const hasMore = matches.length > roundMatches.length;
  const visible = showAll ? matches : roundMatches;
  // Al cambiar entre «jornada actual» y «todas», el día marcado en la tira se
  // suelta: si no, la lista seguía filtrada por ese día y el botón parecía no
  // hacer nada.
  const toggleShowAll = () => {
    setShowAll((v) => !v);
    if (!gridMode) setDayFilter(null);
  };

  // Tira de la semana: 7 días desde el lunes de la semana de la jornada en
  // juego. Punto verde si todo tiene hora; ámbar si falta algo.
  const week = useMemo(() => {
    const anchor =
      roundMatches.map((m) => m.match_date).filter(Boolean).sort()[0] ?? fmtIso(new Date());
    const monday = snapToDow(anchor!, 1);
    return [1, 2, 3, 4, 5, 6, 7].map((dow) => {
      const iso = snapToDow(monday, dow);
      const items = matches.filter((m) => m.match_date === iso);
      const missing = items.some((m) => !m.match_time || m.home_unconfirmed);
      return {
        iso,
        dow,
        day: Number(iso.slice(8)),
        state: items.length === 0 ? null : missing ? 'warn' : 'ok',
      } as const;
    });
  }, [roundMatches, matches]);

  const filtered = dayFilter ? visible.filter((m) => m.match_date === dayFilter) : visible;
  // Primero lo que falta (sin hora o sede por confirmar), después lo que ya está.
  const missing = filtered.filter((m) => !m.match_time || m.home_unconfirmed);
  const done = filtered.filter((m) => m.match_time && !m.home_unconfirmed);
  const groups = useMemo(() => {
    const map = new Map<string, ClubHomeMatch[]>();
    for (const m of done) {
      const k = m.match_date ?? '—';
      const arr = map.get(k) ?? [];
      arr.push(m);
      map.set(k, arr);
    }
    for (const arr of map.values())
      arr.sort((a, b) => hhmm(a.match_time).localeCompare(hhmm(b.match_time)));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [done]);

  // ── Rejilla (tablet) ────────────────────────────────────────────────────
  // Lo que falta, de toda la jornada (o de todas), sin filtrar por día.
  const missingAll = useMemo(
    () => visible.filter((m) => !m.match_time || m.home_unconfirmed),
    [visible],
  );
  // Día de la rejilla: el elegido en la tira o, si no, el primero con algo
  // pendiente, el primero con partidos o el sábado.
  const gridDay =
    dayFilter ??
    week.find((d) => d.state === 'warn')?.iso ??
    week.find((d) => d.state)?.iso ??
    week[5].iso;
  // Pistas: las que el club ya ha usado (como en el panel de la hora).
  const gridCourts = useMemo(() => {
    const set = new Map<string, string>();
    for (const m of matches)
      if (m.location?.trim()) set.set(m.location.trim().toLowerCase(), m.location.trim());
    const list = [...set.values()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
    return list.length ? list : ['Pista 1', 'Pista 2', 'Pista 3'];
  }, [matches]);
  // Franjas favoritas de los equipos con algo pendiente (punteadas en verde).
  const favSlots = useMemo(() => {
    const set = new Set<string>();
    for (const m of missingAll)
      for (const sl of slotsByTeam[m.team_id] ?? m.preferred_home_slots ?? []) set.add(sl);
    return set;
  }, [missingAll, slotsByTeam]);

  const openEdit = (m: ClubHomeMatch, p: SlotPreset | null = null) => {
    setPreset(p);
    setEditing(m);
  };

  // Celda libre: si solo hay un partido pendiente, se abre su panel con la
  // pista y la hora puestas; si hay varios, primero se elige cuál.
  const onPickFreeCell = (court: string, time: string) => {
    if (missingAll.length === 0) {
      toast.info('Todo tiene hora', 'No quedan partidos de local sin hora en esta jornada.');
      return;
    }
    if (missingAll.length === 1) {
      openEdit(missingAll[0], { slot: `${isoDow(gridDay)}|${time}`, court });
      return;
    }
    setCellPick({ court, time, iso: gridDay });
  };

  const pickForCell = (m: ClubHomeMatch) => {
    const cell = cellPick;
    setCellPick(null);
    if (!cell) return;
    // Un modal tras otro: se deja cerrar el primero antes de abrir el panel.
    setTimeout(
      () => openEdit(m, { slot: `${isoDow(cell.iso)}|${cell.time}`, court: cell.court }),
      320,
    );
  };

  const onSlotsSaved = (teamId: string, slots: string[]) => {
    setSlotsByTeam((prev) => ({ ...prev, [teamId]: slots }));
    load();
  };

  const renderRow = (m: ClubHomeMatch) => (
    <Animated.View key={m.matchday_id} layout={reduced ? undefined : LinearTransition.duration(250)}>
      <Pressable
        onPress={() => openEdit(m)}
        accessibilityRole="button"
        accessibilityLabel={`${m.team_name}, ${m.opponent ? `contra ${m.opponent}` : ''}. ${m.match_time ? `A las ${hhmm(m.match_time)}` : 'Sin hora'}`}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTeam} numberOfLines={1}>
            {m.team_name}
          </Text>
          <Text style={styles.teamMeta} numberOfLines={1}>
            {[
              m.is_guest ? 'Invitado' : null,
              metaByTeam[m.team_id] || null,
              m.jornada_number ? `J${m.jornada_number}` : null,
              m.opponent ? `vs ${m.opponent}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
          {m.home_unconfirmed ? (
            <Text style={styles.rowWarn}>Sede de playoff por confirmar</Text>
          ) : null}
        </View>
        {m.match_time && !m.home_unconfirmed ? (
          <View style={styles.rowTimeWrap}>
            <Text style={styles.rowTime}>{hhmm(m.match_time)}</Text>
            {m.location ? (
              <Text style={styles.rowCourt} numberOfLines={1}>
                {m.location}
              </Text>
            ) : null}
          </View>
        ) : (
          <View style={styles.setBtn}>
            <Text style={styles.setBtnText}>
              {m.home_unconfirmed && m.match_time ? 'Confirmar' : 'Poner\nhora'}
            </Text>
          </View>
        )}
      </Pressable>
    </Animated.View>
  );

  const weekStrip = (
    <>
      {/* Tira de la semana */}
      <View style={styles.weekStrip}>
        {week.map((d) => {
          const sel = gridMode ? gridDay === d.iso : dayFilter === d.iso;
          return (
            <Pressable
              key={d.iso}
              onPress={() =>
                gridMode ? setDayFilter(d.iso) : setDayFilter(sel ? null : d.iso)
              }
              disabled={!gridMode && !d.state}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              accessibilityLabel={`${DOW_UP[d.dow]} ${d.day}${d.state === 'warn' ? ', falta algo' : d.state === 'ok' ? ', todo con hora' : ''}`}
              style={[styles.weekCell, sel && styles.weekCellOn]}
            >
              <Text style={[styles.weekDow, sel && { color: c.textInverse }]}>
                {DOW_UP[d.dow]}
              </Text>
              <Text style={[styles.weekDay, sel && { color: c.textInverse }]}>{d.day}</Text>
              <View
                style={[
                  styles.weekDot,
                  d.state === 'ok' && { backgroundColor: sel ? c.textInverse : c.accent },
                  d.state === 'warn' && { backgroundColor: c.warning },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
    </>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        {embedded ? null : (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <IconBack size={20} color={c.text} />
          </Pressable>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>{embedded ? 'COMPETIR · LIGA' : 'HORARIOS DE LOCAL'}</Text>
          <Text style={styles.title} numberOfLines={1}>
            Partidos en casa
          </Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
        <SegmentedControl<Tab>
          options={[
            { key: 'partidos', label: 'Partidos' },
            { key: 'equipos', label: 'Equipos y franjas' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : gridMode && tab === 'partidos' ? (
        // TABLET: lo que falta a la izquierda y la rejilla de pistas × horas.
        <View style={styles.gridWrap}>
          <ScrollView
            style={{ width: GRID_SIDEBAR, flexGrow: 0 }}
            contentContainerStyle={{
              paddingLeft: 22,
              paddingRight: 14,
              paddingBottom: insets.bottom + 32,
            }}
            showsVerticalScrollIndicator={false}
          >
            {weekStrip}
            {missingAll.length > 0 ? (
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.groupDate, { color: c.warning }]}>
                  FALTA LA HORA · {missingAll.length}
                </Text>
                <View style={{ gap: 8 }}>{missingAll.map(renderRow)}</View>
                <Text style={styles.footNote}>
                  Toca un hueco libre de la rejilla para ponerle esa pista y esa hora, o toca
                  el partido para elegirlas en el panel.
                </Text>
              </View>
            ) : matches.length === 0 ? (
              <Text style={styles.emptyText}>
                Cuando tus equipos tengan jornadas en casa por jugar, aparecerán aquí para
                ponerles día y hora.
              </Text>
            ) : (
              <Text style={styles.emptyText}>
                {showAll
                  ? `Todas las jornadas tienen hora · ${matches.length} partidos de local.`
                  : 'Todos los partidos de local de esta jornada tienen hora.'}
              </Text>
            )}
            {hasMore ? (
              <Pressable
                onPress={toggleShowAll}
                hitSlop={8}
                style={{ alignSelf: 'flex-start', marginTop: 18 }}
              >
                <Text style={styles.link}>
                  {showAll ? 'Ver solo la jornada actual' : 'Ver todas las jornadas'}
                </Text>
              </Pressable>
            ) : null}
          </ScrollView>
          <ScheduleGrid
            dayIso={gridDay}
            matches={matches}
            courts={gridCourts}
            favSlots={favSlots}
            metaByTeam={metaByTeam}
            bottomPad={insets.bottom + 32}
            onPickMatch={(m) => openEdit(m)}
            onPickFree={onPickFreeCell}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingBottom: insets.bottom + 64 + 12 + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          {tab === 'partidos' ? (
            <>
              {/* La tira es de la semana en juego: con todas las jornadas no aplica. */}
              {showAll ? null : weekStrip}

              {matches.length === 0 ? (
                <Text style={styles.emptyText}>
                  Cuando tus equipos tengan jornadas en casa por jugar, aparecerán aquí para
                  ponerles día y hora.
                </Text>
              ) : (
                <>
                  {missing.length > 0 ? (
                    <View style={{ marginTop: 16 }}>
                      <Text style={[styles.groupDate, { color: c.warning }]}>
                        FALTA LA HORA · {missing.length}
                      </Text>
                      <View style={{ gap: 8 }}>{missing.map(renderRow)}</View>
                    </View>
                  ) : null}
                  {groups.map(([date, items]) => (
                    <View key={date} style={{ marginTop: 16 }}>
                      <Text style={styles.groupDate}>
                        {date === '—' ? 'SIN FECHA' : groupLabel(date)} · CON HORA
                      </Text>
                      <View style={{ gap: 8 }}>{items.map(renderRow)}</View>
                    </View>
                  ))}
                  {filtered.length === 0 ? (
                    <Text style={styles.emptyText}>Ese día no hay partidos en casa.</Text>
                  ) : null}
                </>
              )}

              {hasMore ? (
                <Pressable
                  onPress={toggleShowAll}
                  hitSlop={8}
                  style={{ alignSelf: 'center', marginTop: 18 }}
                >
                  <Text style={styles.linkMuted}>
                    {showAll ? 'Todas las jornadas · ' : 'Jornada actual · '}
                    <Text style={styles.link}>
                      {showAll ? 'Ver solo la actual' : 'Ver todas las jornadas'}
                    </Text>
                  </Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <>
              {/* Equipos propios con sus franjas */}
              {clubTeams.length > 0 ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.sectionLabel}>TUS EQUIPOS · {clubTeams.length}</Text>
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {clubTeams.map((t) => {
                      const slots = slotsByTeam[t.id] ?? teamSlotsOf(t);
                      return (
                        <Pressable
                          key={t.id}
                          onPress={() => setEditTeam({ id: t.id, name: t.name })}
                          accessibilityRole="button"
                          accessibilityLabel={`Franjas de ${t.name}`}
                          style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
                        >
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.rowTeam} numberOfLines={1}>
                              {t.name}
                            </Text>
                            <Text style={styles.teamMeta} numberOfLines={1}>
                              {metaByTeam[t.id]}
                            </Text>
                          </View>
                          {slots.length > 0 ? (
                            <Text style={styles.slotText} numberOfLines={1}>
                              {slots.slice(0, 2).map(fmtSlot).join(' · ')}
                            </Text>
                          ) : (
                            <Text style={styles.slotEmpty}>Sin franjas</Text>
                          )}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ) : null}

              {/* Invitados: juegan en tus pistas sin ser del club */}
              <View style={{ marginTop: 22 }}>
                <View style={styles.guestHead}>
                  <Text style={styles.sectionLabel}>INVITADOS · JUEGAN EN TUS PISTAS</Text>
                  <Pressable
                    onPress={() => setImportOpen(true)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Añadir equipo invitado"
                    style={styles.addChip}
                  >
                    <IconPlus size={12} color={c.accent} />
                    <Text style={styles.addChipText}>Añadir</Text>
                  </Pressable>
                </View>
                {guestTeams.length === 0 ? (
                  <Text style={styles.emptyText}>
                    ¿Hay equipos de otros clubes que juegan en tus pistas? Añádelos y les
                    pondrás día, hora y pista sin que consuman plaza de tu plan.
                  </Text>
                ) : (
                  <View style={{ gap: 8, marginTop: 8 }}>
                    {guestTeams.map((t) => {
                      const gslots = slotsByTeam[t.id] ?? [];
                      return (
                        <View key={t.id} style={styles.row}>
                          <Pressable
                            onPress={() => setEditTeam({ id: t.id, name: t.name, guest: true })}
                            accessibilityRole="button"
                            accessibilityLabel={`Franjas de ${t.name}`}
                            style={({ pressed }) => [{ flex: 1, minWidth: 0 }, pressed && { opacity: 0.85 }]}
                          >
                            <Text style={styles.rowTeam} numberOfLines={1}>
                              {t.name}
                            </Text>
                            <Text style={styles.teamMeta} numberOfLines={1}>
                              {[
                                metaByTeam[t.id] || null,
                                t.claimed ? 'capitán ya dentro' : 'no gasta plaza del plan',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                            {gslots.length > 0 ? (
                              <Text style={styles.slotText} numberOfLines={1}>
                                {gslots.map(fmtSlot).join(' · ')}
                              </Text>
                            ) : null}
                          </Pressable>
                          {t.claimed ? (
                            <View style={styles.pill}>
                              <Text style={styles.pillText}>Suya</Text>
                            </View>
                          ) : (
                            <Pressable
                              onPress={() => inviteGuestCaptain(t.id, t.name)}
                              disabled={inviting === t.id}
                              hitSlop={8}
                              accessibilityRole="button"
                              accessibilityLabel={`Invitar al capitán de ${t.name}`}
                              style={({ pressed }) => [styles.inviteBtn, pressed && { opacity: 0.7 }]}
                            >
                              {inviting === t.id ? (
                                <ActivityIndicator size="small" color={c.accent} />
                              ) : (
                                <Text style={styles.inviteText}>Invitar capitán</Text>
                              )}
                            </Pressable>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
                <Text style={styles.footNote}>
                  Al pasar el código, el equipo pasa a ser de su capitán. Los horarios en tus
                  pistas los sigues poniendo tú.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}

      <EditScheduleSheet
        match={editing}
        all={matches}
        slots={editing ? slotsByTeam[editing.team_id] ?? editing.preferred_home_slots : []}
        preset={preset}
        onClose={() => {
          setEditing(null);
          setPreset(null);
        }}
        onSaved={load}
      />

      {/* Tablet: celda libre con varios partidos pendientes → cuál va ahí. */}
      <SidePanel
        open={!!cellPick}
        onClose={() => setCellPick(null)}
        title={
          cellPick
            ? `${cellPick.court} · ${groupLabel(cellPick.iso)} · ${cellPick.time}`
            : undefined
        }
      >
        <Text style={styles.sheetEyebrow}>¿QUÉ PARTIDO VA AQUÍ?</Text>
        <Text style={[styles.hint, { marginTop: 6, marginBottom: 14 }]}>
          Elige el partido y se abre su horario con esta pista y esta hora ya puestas.
        </Text>
        <View style={{ gap: 8 }}>
          {missingAll.map((m) => (
            <Pressable
              key={m.matchday_id}
              onPress={() => pickForCell(m)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowTeam} numberOfLines={1}>
                  {m.team_name}
                </Text>
                <Text style={styles.teamMeta} numberOfLines={1}>
                  {[
                    m.is_guest ? 'Invitado' : null,
                    metaByTeam[m.team_id] || null,
                    m.jornada_number ? `J${m.jornada_number}` : null,
                    m.opponent ? `vs ${m.opponent}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </SidePanel>

      {club ? (
        <FcpImportSheet
          open={importOpen}
          clubId={club.id}
          onClose={() => setImportOpen(false)}
          onImported={() => {
            setImportOpen(false);
            load();
          }}
        />
      ) : null}

      <TeamSlotsSheet
        team={editTeam}
        guest={!!editTeam?.guest}
        slots={editTeam ? slotsByTeam[editTeam.id] ?? [] : []}
        onClose={() => setEditTeam(null)}
        onSaved={onSlotsSaved}
      />
    </View>
  );
};

// Hoja de franjas favoritas de un equipo.
const TeamSlotsSheet: React.FC<{
  team: { id: string; name: string } | null;
  slots: string[];
  onClose: () => void;
  onSaved: (teamId: string, slots: string[]) => void;
  // Invitado: el guardado va por RPC, no por update directo.
  guest?: boolean;
}> = ({ team, slots, onClose, onSaved, guest = false }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <BottomSheet
      open={!!team}
      onClose={onClose}
      footer={
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.saveLabel}>Listo</Text>
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>FRANJAS FAVORITAS</Text>
      <Text style={styles.sheetTitle} numberOfLines={1}>
        {team?.name ?? ''}
      </Text>
      <Text style={styles.sheetSub}>
        {guest
          ? 'Este equipo juega en tus pistas sin ser de tu club. Sus franjas te salen como atajo al poner la hora de sus partidos, y avisamos a su capitán del cambio.'
          : 'Se usan al poner la hora de los partidos de local de este equipo.'}
      </Text>
      <View style={{ marginTop: 16 }}>
        {team ? (
          <PreferredSlotsEditor
            teamId={team.id}
            initialSlots={slots}
            guest={guest}
            onChanged={(s) => onSaved(team.id, s)}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Hoja de la hora de un partido. Franjas del equipo, pista de una lista (las
// que el club ya ha usado, más «＋») y aviso de choque ANTES de guardar: con
// la pista ocupada a esa hora, «Guardar» se desactiva.
const EditScheduleSheet: React.FC<{
  match: ClubHomeMatch | null;
  all: ClubHomeMatch[];
  slots: string[];
  /** Tablet: pista y hora de la celda tocada en la rejilla. */
  preset?: SlotPreset | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ match, all, slots, preset = null, onClose, onSaved }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const reduced = useReducedMotion();

  const [selected, setSelected] = useState<string | null>(null); // "D|HH:MM"
  const [court, setCourt] = useState('');
  const [addingCourt, setAddingCourt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [adhocDay, setAdhocDay] = useState<number | null>(null);

  useEffect(() => {
    if (!match) return;
    if (match.match_time) {
      const dow = match.match_date ? isoDow(match.match_date) : null;
      setSelected(dow ? `${dow}|${hhmm(match.match_time)}` : hhmm(match.match_time));
    } else {
      setSelected(null);
    }
    setCourt(match.location ?? '');
    setAddingCourt(false);
    setAdhocDay(null);
    if (preset) {
      // Desde la rejilla: la celda manda. Si la hora no es una de sus
      // franjas, se abre «Elegir día y hora» para que se vea marcada.
      setSelected(preset.slot);
      setCourt(preset.court);
      if (!slots.includes(preset.slot)) setAdhocDay(parseSlot(preset.slot).dow);
    }
    // `slots` y `preset` llegan junto con `match`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match, preset]);

  // Pistas que el club ya ha usado (de todos sus partidos), ordenadas.
  const courts = useMemo(() => {
    const set = new Map<string, string>();
    for (const m of all) if (m.location?.trim()) set.set(m.location.trim().toLowerCase(), m.location.trim());
    if (court.trim() && !set.has(court.trim().toLowerCase())) set.set(court.trim().toLowerCase(), court.trim());
    return [...set.values()].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }));
  }, [all, court]);

  const parsed = selected ? parseSlot(selected) : null;
  const clash = match && parsed
    ? findClash(all, match.matchday_id, targetDate(match, parsed.dow), parsed.time, court.trim() || null)
    : null;

  // Sacudida corta de la fila de pistas cuando aparece un choque.
  const shake = useSharedValue(0);
  useEffect(() => {
    if (!clash || reduced) return;
    shake.value = withSequence(
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 60 }),
      withTiming(-3, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [clash?.matchday_id, court, selected, reduced, shake]); // eslint-disable-line react-hooks/exhaustive-deps
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const save = async () => {
    if (!match || !selected || clash) {
      if (!selected) toast.error('Elige día y hora');
      return;
    }
    const { dow, time } = parseSlot(selected);
    setSaving(true);
    try {
      const patch: {
        match_time: string;
        location: string | null;
        match_date?: string | null;
      } = { match_time: `${time}:00`, location: court.trim() || null };
      if (dow) patch.match_date = targetDate(match, dow);
      if (match.is_guest) {
        // Equipo invitado: el club no es su admin. El RPC abre solo
        // día/hora/pista y avisa al capitán por la campana.
        await setVenueMatchdaySlot({
          matchdayId: match.matchday_id,
          matchDate: patch.match_date ?? null,
          matchTime: patch.match_time,
          location: patch.location,
        });
        toast.success('Horario enviado al capitán');
      } else {
        await updateMatchday(match.matchday_id, {
          ...patch,
          // Ponerle día, hora y pista ES confirmar que se juega aquí.
          ...(match.home_unconfirmed ? { home_unconfirmed: false } : {}),
        });
        notifyPush('schedule_set', match.matchday_id);
        toast.success('Horario enviado al equipo');
      }
      tapSuccess();
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const blocked = saving || !selected || !!clash;

  return (
    <BottomSheet
      open={!!match}
      onClose={onClose}
      footer={
        <View>
          <Pressable
            onPress={save}
            disabled={blocked}
            style={({ pressed }) => [
              styles.saveBtn,
              blocked && { opacity: 0.45 },
              pressed && !blocked && { opacity: 0.85 },
            ]}
          >
            {saving ? (
              <ActivityIndicator size="small" color={c.textInverse} />
            ) : (
              <Text style={styles.saveLabel} numberOfLines={1}>
                Guardar y avisar a {match?.team_name ?? 'el equipo'}
              </Text>
            )}
          </Pressable>
          <Text style={styles.saveSub}>
            {match?.is_guest ? 'Le llega un aviso a su capitán' : 'Le llega un aviso a todo el equipo'}
          </Text>
        </View>
      }
    >
      <Text style={styles.sheetEyebrow}>HORARIO DE LOCAL</Text>
      <Text style={styles.sheetTitle} numberOfLines={1}>
        {match?.team_name ?? ''}
        {match?.jornada_number ? ` · J${match.jornada_number}` : ''}
        {match?.opponent ? ` vs ${match.opponent}` : ''}
      </Text>
      <Text style={styles.sheetSub}>{dateLabel(match?.match_date ?? null)}</Text>

      <Text style={[styles.sectionLabel, { marginTop: 20, marginBottom: 8 }]}>SUS FRANJAS</Text>
      {slots.length === 0 ? (
        <Text style={styles.hint}>
          Este equipo aún no tiene franjas favoritas. Elige día y hora abajo.
        </Text>
      ) : (
        <View style={styles.chipsWrap}>
          {slots.map((s) => {
            const sel = selected === s;
            return (
              <Pressable
                key={s}
                onPress={() => {
                  setSelected(s);
                  setAdhocDay(null);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
                style={[styles.chip, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
              >
                <Text style={[styles.chipText, { color: sel ? c.textInverse : c.text }]}>
                  {fmtSlot(s)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={[styles.sectionLabel, { marginTop: 18, marginBottom: 8 }]}>PISTA</Text>
      <Animated.View style={[styles.chipsWrap, shakeStyle]}>
        {courts.map((ct) => {
          const sel = sameCourt(court, ct);
          return (
            <Pressable
              key={ct}
              onPress={() => {
                setCourt(sel ? '' : ct);
                setAddingCourt(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: sel }}
              style={[
                styles.chip,
                sel && { backgroundColor: clash ? c.warning : c.accent, borderColor: clash ? c.warning : c.accent },
              ]}
            >
              <Text style={[styles.chipTextSans, { color: sel ? c.textInverse : c.text }]}>{ct}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => {
            setAddingCourt(true);
            setCourt('');
          }}
          accessibilityRole="button"
          accessibilityLabel="Añadir otra pista"
          style={[styles.chip, addingCourt && { borderColor: c.accent }]}
        >
          <IconPlus size={14} color={c.accent} />
        </Pressable>
      </Animated.View>
      {addingCourt ? (
        <View style={styles.courtInput}>
          <TextInput
            value={court}
            onChangeText={setCourt}
            placeholder="Pista 4, Central…"
            placeholderTextColor={c.textFaint}
            style={styles.courtInputField}
            maxLength={40}
            autoFocus
          />
        </View>
      ) : null}

      {clash ? (
        <Animated.View entering={reduced ? undefined : FadeIn.duration(200)} style={styles.clashBox}>
          <IconAlert size={16} color={c.warning} />
          <Text style={styles.clashText}>
            <Text style={{ fontWeight: '700' }}>{court.trim()} ya está ocupada a esa hora.</Text>
            {'\n'}
            {clash.team_name}
            {clash.opponent ? ` vs ${clash.opponent}` : ''}, {parsed ? fmtSlot(selected!) : ''}. Elige
            otra pista u otra hora.
          </Text>
        </Animated.View>
      ) : null}

      <View style={styles.otherRow}>
        <Text style={styles.hint}>¿Otro día?</Text>
        <Pressable onPress={() => setAdhocDay(adhocDay ? null : 6)} hitSlop={8}>
          <Text style={styles.link}>{adhocDay ? 'Ocultar' : 'Elegir día y hora'}</Text>
        </Pressable>
      </View>
      {adhocDay ? (
        <>
          <View style={styles.dowRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const sel = adhocDay === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => setAdhocDay(d)}
                  accessibilityRole="button"
                  accessibilityLabel={DOW_NAME[d]}
                  style={[styles.dowCell, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
                >
                  <Text style={[styles.dowText, { color: sel ? c.textInverse : c.text }]}>
                    {DOW_SHORT[d]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.chipsWrap, { marginTop: 10 }]}>
            {TIME_OPTIONS.map((t) => {
              const slotStr = `${adhocDay}|${t}`;
              const sel = selected === slotStr;
              return (
                <Pressable
                  key={t}
                  onPress={() => setSelected(slotStr)}
                  style={[styles.chip, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
                >
                  <Text style={[styles.chipText, { color: sel ? c.textInverse : c.text }]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      <View style={styles.selectedRow}>
        <Text style={styles.sectionLabel}>DÍA Y HORA</Text>
        <Text style={[styles.selectedTime, !selected && { color: c.textFaint }]}>
          {selected ? fmtSlot(selected) : '—'}
        </Text>
      </View>
    </BottomSheet>
  );
};


// ─────────────────────────────────────────────────────────────────────────
// TABLET · Rejilla de pistas × horas del día elegido. Celda libre → el panel
// de la hora con esa pista y esa hora. Celda ocupada → el panel de ese
// partido. Dos partidos en la misma pista y hora → la celda en rojo («Choque»).
// Las franjas favoritas de los equipos con algo pendiente van punteadas.
const ScheduleGrid: React.FC<{
  dayIso: string;
  matches: ClubHomeMatch[];
  courts: string[];
  favSlots: Set<string>;
  metaByTeam: Record<string, string>;
  bottomPad: number;
  onPickMatch: (m: ClubHomeMatch) => void;
  onPickFree: (court: string, time: string) => void;
}> = ({ dayIso, matches, courts, favSlots, metaByTeam, bottomPad, onPickMatch, onPickFree }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [w, setW] = useState(0);
  const dow = isoDow(dayIso);

  const dayMatches = useMemo(
    () => matches.filter((m) => m.match_date === dayIso && m.match_time && !m.home_unconfirmed),
    [matches, dayIso],
  );
  // Con hora pero sin pista: columna aparte para que no se pierdan.
  const noCourt = dayMatches.some((m) => !m.location?.trim());
  const cols = noCourt ? [...courts, ''] : courts;

  // Horas en punto de 08 a 23, más cualquier media hora en uso ese día.
  const hours = useMemo(() => {
    const set = new Set<string>(TIME_OPTIONS.filter((t) => t.endsWith(':00')));
    for (const m of dayMatches) set.add(hhmm(m.match_time));
    for (const sl of favSlots) {
      const { dow: d, time } = parseSlot(sl);
      if (d === dow) set.add(time);
    }
    return [...set].sort();
  }, [dayMatches, favSlots, dow]);

  const colW = Math.max(
    GRID_COURT_MIN,
    w > 0 ? Math.floor((w - GRID_TIME_COL - 22) / Math.max(1, cols.length)) : GRID_COURT_MIN,
  );

  const cellMatches = (court: string, time: string) =>
    dayMatches.filter(
      (m) =>
        hhmm(m.match_time) === time &&
        (court ? sameCourt(m.location, court) : !m.location?.trim()),
    );

  return (
    <View style={{ flex: 1, minWidth: 0 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Text style={[styles.groupDate, { marginLeft: GRID_TIME_COL, marginTop: 8 }]}>
        {groupLabel(dayIso)} · {dayMatches.length}{' '}
        {dayMatches.length === 1 ? 'partido con hora' : 'partidos con hora'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
        <View style={{ paddingRight: 22 }}>
          {/* Cabecera de pistas */}
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: GRID_TIME_COL }} />
            {cols.map((ct) => (
              <View key={ct || '—'} style={[styles.gridHead, { width: colW }]}>
                <Text style={styles.gridHeadText} numberOfLines={1}>
                  {ct ? ct.toUpperCase() : 'SIN PISTA'}
                </Text>
              </View>
            ))}
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: bottomPad }}
          >
            {hours.map((t) => {
              const fav = favSlots.has(`${dow}|${t}`) || favSlots.has(t);
              return (
                <View key={t} style={{ flexDirection: 'row' }}>
                  <View style={styles.gridTime}>
                    <Text style={[styles.gridTimeText, fav && { color: c.accent }]}>{t}</Text>
                  </View>
                  {cols.map((ct) => {
                    const here = cellMatches(ct, t);
                    const clash = here.length > 1;
                    if (here.length === 0) {
                      if (!ct) return <View key="—" style={[styles.gridCell, { width: colW }]} />;
                      return (
                        <Pressable
                          key={ct}
                          onPress={() => onPickFree(ct, t)}
                          accessibilityRole="button"
                          accessibilityLabel={`${ct}, ${groupLabel(dayIso)} a las ${t}: libre`}
                          style={({ pressed }) => [
                            styles.gridCell,
                            { width: colW },
                            fav && styles.gridCellFav,
                            pressed && { backgroundColor: c.accent10 },
                          ]}
                        >
                          {fav ? <Text style={styles.gridFavText}>FRANJA</Text> : null}
                        </Pressable>
                      );
                    }
                    return (
                      <View key={ct || '—'} style={[styles.gridCell, { width: colW, gap: 4 }]}>
                        {here.map((m) => (
                          <Pressable
                            key={m.matchday_id}
                            onPress={() => onPickMatch(m)}
                            accessibilityRole="button"
                            accessibilityLabel={`${m.team_name}${m.opponent ? ` contra ${m.opponent}` : ''}, ${t}${clash ? '. Choque de pista' : ''}`}
                            style={({ pressed }) => [
                              styles.gridMatch,
                              clash && styles.gridMatchClash,
                              pressed && { opacity: 0.8 },
                            ]}
                          >
                            <Text style={styles.gridMatchTeam} numberOfLines={1}>
                              {m.team_name}
                              {m.opponent ? (
                                <Text style={styles.gridMatchVs}> vs {m.opponent}</Text>
                              ) : null}
                            </Text>
                            <Text style={styles.gridMatchMeta} numberOfLines={1}>
                              {clash
                                ? 'Choque: misma pista y hora'
                                : [
                                    m.is_guest ? 'Invitado' : null,
                                    metaByTeam[m.team_id] || null,
                                    m.jornada_number ? `J${m.jornada_number}` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    // Tablet · rejilla de pistas × horas
    gridWrap: { flex: 1, flexDirection: 'row' },
    gridHead: {
      paddingVertical: 8,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.hairStrong,
    },
    gridHeadText: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1.2,
      color: c.textMuted,
      fontWeight: '600',
    },
    gridTime: { width: GRID_TIME_COL, height: GRID_ROW_H, paddingTop: 6 },
    gridTimeText: { fontFamily: Fonts.mono, fontSize: 12, color: c.textFaint },
    gridCell: {
      minHeight: GRID_ROW_H,
      padding: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderLeftWidth: StyleSheet.hairlineWidth,
      borderColor: c.hair,
    },
    gridCellFav: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.accent40,
      backgroundColor: c.accent10,
      borderRadius: 8,
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
    },
    gridFavText: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: c.accent },
    gridMatch: {
      flex: 1,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.accent40,
      borderLeftWidth: 3,
      borderLeftColor: c.accent,
    },
    gridMatchClash: {
      borderColor: c.error,
      borderLeftColor: c.error,
      backgroundColor: c.error + '14',
    },
    gridMatchTeam: { color: c.text, fontSize: 12.5, fontWeight: '700' },
    gridMatchVs: { color: c.textMuted, fontWeight: '500' },
    gridMatchMeta: { color: c.textFaint, fontSize: 10.5, marginTop: 2 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 3,
      color: c.accent,
      fontWeight: '500',
    },
    title: { color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyText: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 12 },
    sectionLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
    },
    teamMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
    guestHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    addChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      height: 28,
      borderRadius: 9,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    addChipText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    footNote: { color: c.textFaint, fontSize: 12, lineHeight: 17, marginTop: 12 },
    pill: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    pillText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    inviteBtn: {
      paddingHorizontal: 10,
      height: 32,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    inviteText: { color: c.accent, fontSize: 12.5, fontWeight: '700' },
    slotText: { color: c.accent, fontFamily: Fonts.mono, fontSize: 12, marginTop: 2 },
    slotEmpty: { color: c.textFaint, fontSize: 12 },

    weekStrip: { flexDirection: 'row', gap: 6, marginTop: 6 },
    weekCell: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 8,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      minHeight: 58,
    },
    weekCellOn: { backgroundColor: c.accent, borderColor: c.accent },
    weekDow: { fontFamily: Fonts.mono, fontSize: 9.5, color: c.textFaint, letterSpacing: 0.5 },
    weekDay: { fontFamily: Fonts.mono, fontSize: 16, fontWeight: '700', color: c.text, marginTop: 2 },
    weekDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4, backgroundColor: 'transparent' },

    groupDate: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1.5,
      color: c.textFaint,
      textTransform: 'uppercase',
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minHeight: 60,
    },
    rowTeam: { color: c.text, fontSize: 15, fontWeight: '600' },
    rowWarn: { color: c.warning, fontSize: 12, fontWeight: '600', marginTop: 3 },
    rowTimeWrap: { alignItems: 'flex-end' },
    rowTime: { color: c.accent, fontFamily: Fonts.mono, fontSize: 16, fontWeight: '700' },
    rowCourt: { color: c.textMuted, fontSize: 11, marginTop: 2 },
    setBtn: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 9,
      backgroundColor: c.warning + '1F',
      borderWidth: 1,
      borderColor: c.warning + '77',
      alignItems: 'center',
      justifyContent: 'center',
    },
    setBtnText: { color: c.warning, fontSize: 12, fontWeight: '700', textAlign: 'center' },
    link: { color: c.accent, fontSize: 13, fontWeight: '600' },
    linkMuted: { color: c.textFaint, fontSize: 13 },

    sheetEyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
    },
    sheetTitle: { color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 },
    sheetSub: { color: c.textMuted, fontSize: 13, marginTop: 2 },
    hint: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
    chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingHorizontal: 14,
      minWidth: 44,
      height: 42,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    chipText: { fontFamily: Fonts.mono, fontSize: 15, fontWeight: '600' },
    chipTextSans: { fontSize: 14, fontWeight: '600' },
    clashBox: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 12,
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.warning + '1A',
      borderWidth: 1,
      borderColor: c.warning + '66',
    },
    clashText: { flex: 1, color: c.text, fontSize: 13, lineHeight: 19 },
    otherRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 18,
      marginBottom: 10,
    },
    dowRow: { flexDirection: 'row', gap: 6 },
    dowCell: {
      flex: 1,
      height: 44,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dowText: { fontFamily: Fonts.mono, fontSize: 14, fontWeight: '700' },
    selectedRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 22,
      marginBottom: 8,
    },
    selectedTime: {
      fontFamily: Fonts.mono,
      fontSize: 20,
      fontWeight: '800',
      color: c.accent,
      letterSpacing: 0.5,
    },
    courtInput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 10,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      minHeight: 50,
    },
    courtInputField: { flex: 1, color: c.text, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
    saveBtn: {
      height: 52,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 14,
    },
    saveLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    saveSub: { color: c.textFaint, fontSize: 12, textAlign: 'center', marginTop: 6 },
  });
