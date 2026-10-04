import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useReducedMotion,
} from 'react-native-reanimated';
import { useFocusEffect, useScrollToTop, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import {
  BottomSheet,
  IconCheck,
  IconChevron,
  IconClock,
  IconPlus,
  IconTrophy,
  IconTicket,
  IconFile,
  IconPencil,
  useLayout,
} from '@components/ui';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { FcpImportSheet } from '../components/FcpImportSheet';
import { fcpSeasonStatus } from '@core/services/fcpSeason';
import { FCP_FEDERATION_CODE, hasFcpLinkedTeams } from '@core/services/fcpOnboarding';
import { FeedPreview } from '@features/social/components/FeedPreview';
import { TeamMembersSheet } from '@features/club/components/TeamMembersSheet';
import { TrialHomeCard } from '@features/subscription/components/TrialHomeCard';
import { toast } from '@store/toastStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { clubCoverage } from '@core/entitlements/coverage';
import { useTeamGate } from '@core/hooks/usePremiumGate';
import { PLAN_BY_TIER, isLiveSub } from '@core/subscriptions/plans';
import * as ClubDashboardApi from '@core/services/clubDashboard';
import type { ClubTeamOverview } from '@core/services/clubDashboard';
import {
  getClubHomeSchedule,
  getVenueHomeSchedule,
  fetchUnconfirmedVenues,
  currentRoundMatches,
  type ClubHomeMatch,
} from '@core/services/clubSchedule';
import { listTournaments, type Tournament } from '@core/services/tournaments';
import { fetchClubInscripciones, refreshInscripcionRoster } from '@core/services/fcpInscripciones';
import type { FcpInscripcionesResumen } from '@core/services/fcpInscripciones';
import { fetchTournamentStats, tournamentPhase } from '../clubOps';

import type { HomeStackScreenProps, RootStackParamList } from '@navigation/types';
import type { PaywallIntent } from '@core/subscriptions/paywallReasons';

const MONTH_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAY_ES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const fmtPts = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** «SÁB 10» de una fecha ISO. */
function dayLabel(iso: string | null): { dow: string; day: string } {
  if (!iso) return { dow: 'SIN', day: 'FECHA' };
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return { dow: '—', day: iso };
  return { dow: WEEKDAY_ES[d.getDay()], day: String(d.getDate()) };
}

function shortDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${MONTH_ES[d.getMonth()]}`;
}

/** Una fila de «Por hacer». */
interface TodoItem {
  key: string;
  count: number;
  title: string;
  sub: string;
  onPress: () => void;
}

export const ClubDashboardScreen = ({
  navigation,
}: HomeStackScreenProps<'HomeRoot'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // Tablet: 3 columnas en horizontal y 2 en vertical. En móvil, la lista.
  const layout = useLayout();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((s) => s.teams);

  const [membersSheet, setMembersSheet] = useState<{
    teamId: string;
    teamName: string;
  } | null>(null);
  const [overviews, setOverviews] = useState<ClubTeamOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [fcpOpen, setFcpOpen] = useState(false);
  const isFcpClub = club?.federation === FCP_FEDERATION_CODE;

  // Datos de «Por hacer» y de «Gestión del club». Cada fuente va por su lado y
  // ninguna tumba el panel si falla.
  const [homeMatches, setHomeMatches] = useState<ClubHomeMatch[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [unpaid, setUnpaid] = useState<{ count: number; tournamentId: string | null; name: string | null }>({
    count: 0,
    tournamentId: null,
    name: null,
  });
  const [todoReady, setTodoReady] = useState(false);

  const clubTeams = useMemo(
    () => (club ? teams.filter((t) => t.club_id === club.id) : []),
    [teams, club],
  );

  // Inscripciones de la temporada SIGUIENTE (la FCP las publica meses antes de
  // que haya calendario). Null casi todo el año: solo aparece cuando hay una
  // liga en inscripción con equipos de este club.
  const [inscripciones, setInscripciones] = useState<FcpInscripcionesResumen | null>(null);
  // Plantilla abierta en la hoja (índice de fila).
  const [abierta, setAbierta] = useState<number | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  // Relee la plantilla de ese equipo en la Federación, ahora. Para cuando el
  // club acaba de dar a alguien de alta y no quiere esperar al volcado
  // automático, que pasa dos veces por semana.
  const refrescarPlantilla = async (i: number) => {
    const fila = inscripciones?.rows[i];
    if (!fila || refrescando) return;
    if (!fila.teamId) {
      toast.error(
        'Ese equipo no está en TACTIUM',
        'Impórtalo de la Federación y podrás actualizar su plantilla.',
      );
      return;
    }
    setRefrescando(true);
    try {
      const r = await refreshInscripcionRoster(fila.teamId);
      if (!r.found) {
        toast.error(
          'No aparece inscrito',
          'La Federación no tiene este equipo en la temporada que viene.',
        );
      } else {
        const res = await fetchClubInscripciones(
          clubTeams.map((t) => ({
            id: t.id, name: t.name, gender: t.gender, category: t.category,
          })),
        );
        setInscripciones(res);
        toast.success(
          'Plantilla actualizada',
          r.players != null ? `${r.players} jugadores inscritos.` : 'Sin cambios.',
        );
      }
    } catch (e: any) {
      toast.error('No se pudo consultar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setRefrescando(false);
    }
  };

  useEffect(() => {
    if (!isFcpClub || clubTeams.length === 0) {
      setInscripciones(null);
      return;
    }
    let alive = true;
    fetchClubInscripciones(
      clubTeams.map((t) => ({
        id: t.id,
        name: t.name,
        gender: t.gender,
        category: t.category,
      })),
    )
      .then((r) => alive && setInscripciones(r))
      .catch(() => alive && setInscripciones(null));
    return () => {
      alive = false;
    };
  }, [isFcpClub, clubTeams]);

  // ¿La Federación ha publicado ya una temporada más nueva que la que tienen
  // vinculada los equipos del club? El vínculo caduca cada año (los ids de la
  // FCP cambian por temporada), así que toca re-volcar. Basta con preguntar por
  // un equipo: todos van en la misma liga.
  const [newSeason, setNewSeason] = useState(false);
  useEffect(() => {
    const probe = clubTeams.find((t) => t.federation === FCP_FEDERATION_CODE);
    if (!isFcpClub || !probe) {
      setNewSeason(false);
      return;
    }
    let cancelled = false;
    fcpSeasonStatus(probe.id)
      .then((st) => {
        if (!cancelled) setNewSeason(st.newSeasonPublished);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isFcpClub, clubTeams]);

  // ¿Ya se importó de la Federación? Se mira por VÍNCULOS reales
  // (fcp_team_links), no por el campo `federation`: un equipo creado a mano en
  // un club FCP hereda federation='FCantP' pero NO está importado.
  const [hasFcpTeams, setHasFcpTeams] = useState(false);
  useEffect(() => {
    if (!isFcpClub || !club) {
      setHasFcpTeams(false);
      return;
    }
    let alive = true;
    hasFcpLinkedTeams(club.id)
      .then((v) => alive && setHasFcpTeams(v))
      .catch(() => alive && setHasFcpTeams(false));
    return () => {
      alive = false;
    };
  }, [isFcpClub, club?.id, teams]);

  // Cobertura dura: cuántos equipos cubre el plan y cuántos van usados.
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);
  const coverage = clubCoverage(club?.id ?? null, teams, subscriptions);
  const clubPlan = useMemo(() => {
    if (!club) return null;
    const sub = subscriptions.find(
      (s) => s.subject_type === 'club' && s.subject_id === club.id && isLiveSub(s),
    );
    return sub ? PLAN_BY_TIER[sub.plan_tier] : null;
  }, [subscriptions, club]);
  // Gate POR EQUIPO (no el activo): tocar un equipo no cubierto ofrece cubrirlo.
  const teamGate = useTeamGate();

  // AUTO-COBERTURA: al detectar una sub de club activa, cubrimos los equipos
  // solos para que el gestor no tenga que ir uno a uno. Regla segura: solo si
  // TODO cabe (nº de equipos ≤ cupo del plan); si hay más equipos que plazas,
  // hay que elegir cuáles (pantalla «Elige qué equipos cubre»), porque cubrir
  // es permanente.
  const coverTeams = useTeamStore((s) => s.coverTeams);
  const autoCovering = useRef(false);
  useEffect(() => {
    if (!club?.id || !coverage.hasActiveSub || autoCovering.current) return;
    if (clubTeams.length === 0 || clubTeams.length > coverage.quota) return;
    const uncovered = clubTeams.filter((t) => !t.covered);
    if (uncovered.length === 0) return;
    autoCovering.current = true;
    coverTeams(uncovered.map((t) => t.id)).finally(() => {
      autoCovering.current = false;
    });
  }, [club?.id, coverage.hasActiveSub, coverage.quota, clubTeams, coverTeams]);

  // El VOLCADO desde la Federación es premium (acción de más valor). Si el club
  // no tiene suscripción activa, lleva al paywall en vez de importar.
  const rootNav =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const openFcpImport = () => {
    if (coverage.hasActiveSub) {
      setFcpOpen(true);
      return;
    }
    Alert.alert(
      'Volcado automático',
      'Crea los equipos del club con la plantilla y los puntos oficiales de la Federación — es una función premium. Con suscripción es automático; sin ella, crea los equipos a mano.',
      [
        { text: 'A mano', style: 'cancel' },
        {
          text: 'Ver planes',
          onPress: () =>
            rootNav.navigate('Paywall', {
              intent: 'club_roster_import' satisfies PaywallIntent,
            }),
        },
      ],
    );
  };

  // Spinner solo en la 1ª carga; los refrescos al volver a foco van en 2º plano.
  // Guard de cancelación: si el usuario cambia de pestaña rápido, un fetch
  // viejo no pisa al nuevo.
  const didLoadRef = useRef(false);
  const [loadError, setLoadError] = useState(false);
  useFocusEffect(
    useCallback(() => {
      if (clubTeams.length === 0) {
        setOverviews([]);
        setLoadError(false);
        setLoading(false);
        return;
      }
      let cancelled = false;
      (async () => {
        if (!didLoadRef.current) setLoading(true);
        try {
          const data = await ClubDashboardApi.fetchClubOverview(clubTeams);
          if (!cancelled) {
            setOverviews(data);
            setLoadError(false);
          }
        } catch (e) {
          if (!cancelled) {
            console.warn('club overview', e);
            setLoadError(true);
          }
        } finally {
          if (!cancelled) {
            didLoadRef.current = true;
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [clubTeams]),
  );

  // «Por hacer» y gestión: horarios de local, sedes por confirmar, torneos y
  // parejas sin pagar. Se refresca al volver a la pantalla (p. ej. tras poner
  // una hora) para que la fila resuelta se tache y desaparezca.
  useFocusEffect(
    useCallback(() => {
      if (!club) return;
      let cancelled = false;
      (async () => {
        const [own, guests, tours] = await Promise.all([
          getClubHomeSchedule(club.id).catch(() => [] as ClubHomeMatch[]),
          getVenueHomeSchedule(club.id).catch(() => [] as ClubHomeMatch[]),
          listTournaments(club.id).catch(() => [] as Tournament[]),
        ]);
        const all = [...own, ...guests];
        const pending = await fetchUnconfirmedVenues(all.map((m) => m.matchday_id)).catch(
          () => new Set<string>(),
        );
        const openTours = tours.filter((t) => t.status === 'open' || t.status === 'draft');
        const stats = await fetchTournamentStats(openTours);
        if (cancelled) return;
        setHomeMatches(all.map((m) => ({ ...m, home_unconfirmed: pending.has(m.matchday_id) })));
        setTournaments(tours);
        let count = 0;
        let top: Tournament | null = null;
        let topCount = 0;
        for (const t of openTours) {
          const n = stats[t.id]?.pendingClub ?? 0;
          count += n;
          if (n > topCount) {
            topCount = n;
            top = t;
          }
        }
        setUnpaid({ count, tournamentId: top?.id ?? null, name: top?.name ?? null });
        setTodoReady(true);
      })();
      return () => {
        cancelled = true;
      };
    }, [club]),
  );

  // Scroll-to-top al pulsar la pestaña activa + al recuperar el foco.
  const scrollRef = useRef<ScrollView | null>(null);
  useScrollToTop(scrollRef);
  const didMountRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (didMountRef.current) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        didMountRef.current = true;
      }
    }, []),
  );

  const openManage = (teamId: string, teamName: string) => {
    setMembersSheet({ teamId, teamName });
  };

  // Tap en una jornada: fijamos el equipo activo al de la tarjeta (JornadaScreen
  // lo lee del store) y navegamos. Como el rol sigue siendo club_admin, la
  // jornada queda en solo lectura.
  const setActiveTeam = useTeamStore((s) => s.setActiveTeam);
  const openMatchday = useCallback(
    async (teamId: string, matchdayId: string) => {
      try {
        await setActiveTeam(teamId);
        navigation.navigate('Jornada', { matchdayId });
      } catch (e) {
        console.warn('ClubDashboard openMatchday', e);
      }
    },
    [navigation, setActiveTeam],
  );

  const openTournaments = useCallback(
    () => navigation.navigate('Competir', { screen: 'ClubTournaments' }),
    [navigation],
  );

  // ── «Por hacer» ───────────────────────────────────────────────────────────
  const round = useMemo(() => currentRoundMatches(homeMatches), [homeMatches]);
  const todo = useMemo<TodoItem[]>(() => {
    const out: TodoItem[] = [];
    const noTime = round.filter((m) => !m.match_time);
    if (noTime.length) {
      const names = noTime.slice(0, 3).map((m) => m.team_name + (m.is_guest ? ' (invitado)' : ''));
      const j = noTime.find((m) => m.jornada_number)?.jornada_number;
      out.push({
        key: 'noTime',
        count: noTime.length,
        title: noTime.length === 1 ? 'Partido de local sin hora' : 'Partidos de local sin hora',
        sub: [j ? `J${j}` : null, names.join(', ') + (noTime.length > 3 ? '…' : '')]
          .filter(Boolean)
          .join(' · '),
        onPress: () => navigation.navigate('ClubSchedule'),
      });
    }
    const venues = homeMatches.filter((m) => m.home_unconfirmed);
    if (venues.length) {
      const first = venues[0];
      out.push({
        key: 'venues',
        count: venues.length,
        title: venues.length === 1 ? 'Sede de playoff por confirmar' : 'Sedes de playoff por confirmar',
        sub: [first.team_name, first.match_date ? shortDate(first.match_date) : null]
          .filter(Boolean)
          .join(' · '),
        onPress: () => navigation.navigate('ClubSchedule'),
      });
    }
    if (unpaid.count > 0) {
      out.push({
        key: 'unpaid',
        count: unpaid.count,
        title: unpaid.count === 1 ? 'Pareja sin pagar en el club' : 'Parejas sin pagar en el club',
        sub: unpaid.name ?? 'Tus torneos',
        onPress: () =>
          unpaid.tournamentId
            ? navigation.navigate('TournamentDetail', { tournamentId: unpaid.tournamentId })
            : openTournaments(),
      });
    }
    const uncovered = coverage.hasActiveSub ? clubTeams.filter((t) => !t.covered) : [];
    if (uncovered.length) {
      out.push({
        key: 'cover',
        count: uncovered.length,
        title: uncovered.length === 1 ? 'Equipo sin cubrir por el plan' : 'Equipos sin cubrir por el plan',
        sub: uncovered
          .slice(0, 2)
          .map((t) => [t.name, t.category].filter(Boolean).join(' · '))
          .join(', '),
        onPress: () => rootNav.navigate('ClubCoverTeams'),
      });
    }
    if (isFcpClub && hasFcpTeams && newSeason) {
      out.push({
        key: 'season',
        count: 1,
        title: 'Volcar la temporada nueva',
        sub: 'La Federación ya publicó la liga: revisa y vuelve a volcar tus equipos',
        onPress: openFcpImport,
      });
    }
    return out;
    // openFcpImport depende de la cobertura, ya incluida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, homeMatches, unpaid, coverage.hasActiveSub, clubTeams, isFcpClub, hasFcpTeams, newSeason, navigation, rootNav, openTournaments]);

  if (!club) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.empty}>Sin club activo.</Text>
      </View>
    );
  }

  // ── Esta semana: la próxima jornada de cada equipo dentro de 7 días ────────
  const today = localIso(new Date());
  const in7 = localIso(new Date(Date.now() + 6 * 86400000));
  const upcoming = overviews
    .filter((o) => o.nextMatchday)
    .sort((a, b) =>
      (a.nextMatchday!.match_date ?? 'z').localeCompare(b.nextMatchday!.match_date ?? 'z'),
    );
  const thisWeek = upcoming.filter(
    (o) => o.nextMatchday!.match_date && o.nextMatchday!.match_date >= today && o.nextMatchday!.match_date <= in7,
  );
  const weekList = thisWeek.length ? thisWeek : upcoming.slice(0, 4);
  const weekJ = weekList[0]?.nextMatchday?.jornada_number;

  // ── Última jornada: V/E/D de los últimos resultados ───────────────────────
  const results = overviews.filter((o) => o.lastResult);
  const tally = { win: 0, draw: 0, loss: 0 };
  for (const o of results) {
    const out = o.lastResult!.outcome;
    if (out === 'win') tally.win++;
    else if (out === 'loss') tally.loss++;
    else if (out) tally.draw++;
  }
  const latest = results
    .slice()
    .sort((a, b) => (b.lastResult!.match_date ?? '').localeCompare(a.lastResult!.match_date ?? ''))[0];

  const live = tournaments.filter((t) => tournamentPhase(t) === 3).length;
  const openSignup = tournaments.filter((t) => tournamentPhase(t) === 0).length;
  const toursSub =
    tournaments.length === 0
      ? 'Crea el primero: gratis hasta 16 parejas'
      : [
          live ? `${live} en juego` : null,
          openSignup ? `${openSignup} con inscripción abierta` : null,
        ]
          .filter(Boolean)
          .join(' · ') || `${tournaments.length} ${tournaments.length === 1 ? 'torneo' : 'torneos'}`;

  const isEmptyClub = clubTeams.length === 0;

  // ── Bloques del panel (los mismos en móvil y tablet; solo cambia dónde van) ──
  const errorNode = (
    <>
      {loadError ? (
        <Pressable
          onPress={() => {
            didLoadRef.current = false;
            setLoading(true);
            ClubDashboardApi.fetchClubOverview(clubTeams)
              .then((d) => {
                setOverviews(d);
                setLoadError(false);
              })
              .catch(() => setLoadError(true))
              .finally(() => setLoading(false));
          }}
          style={({ pressed }) => [styles.errorBanner, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.errorBannerText}>
            No se pudieron cargar los datos de los equipos. Toca para reintentar.
          </Text>
        </Pressable>
      ) : null}
    </>
  );
  const todoNode = (
    <>
      {/* POR HACER: solo lo que pide una acción, con su enlace. */}
      {todoReady ? (
        todo.length > 0 ? (
          <View style={styles.todoCard}>
            <View style={styles.todoHead}>
              <Text style={styles.todoEyebrow}>POR HACER</Text>
              <Text style={styles.todoCount}>
                {todo.reduce((n, t) => n + t.count, 0)}
              </Text>
            </View>
            {todo.map((t, i) => (
              <Animated.View
                key={t.key}
                layout={reduced ? undefined : LinearTransition.duration(300)}
                exiting={reduced ? undefined : FadeOut.duration(300)}
              >
                <Pressable
                  onPress={t.onPress}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.count} ${t.title}. ${t.sub}`}
                  style={({ pressed }) => [
                    styles.todoRow,
                    i > 0 && styles.todoRowDivider,
                    pressed && { opacity: 0.75 },
                  ]}
                >
                  <Text style={styles.todoNum}>{t.count}</Text>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.todoTitle} numberOfLines={1}>
                      {t.title}
                    </Text>
                    <Text style={styles.todoSub} numberOfLines={1}>
                      {t.sub}
                    </Text>
                  </View>
                  <IconChevron size={14} color={c.textFaint} />
                </Pressable>
              </Animated.View>
            ))}
          </View>
        ) : (
          <Animated.View
            entering={reduced ? undefined : FadeIn.duration(300)}
            style={styles.allGood}
          >
            <View style={styles.allGoodDot}>
              <IconCheck size={14} color={c.textInverse} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.allGoodTitle}>Todo al día</Text>
              <Text style={styles.allGoodSub}>
                Horarios puestos, equipos cubiertos y torneos sin pagos pendientes.
              </Text>
            </View>
          </Animated.View>
        )
      ) : null}
    </>
  );
  const inscripNode = (
    <>
      {/* PRETEMPORADA: inscripciones de la liga que viene, en el sitio de
          «Esta semana». */}
      {inscripciones ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardEyebrow}>
              TEMPORADA {inscripciones.temporada} · INSCRIPCIONES
            </Text>
          </View>
          <Text style={styles.inscripLead}>
            {inscripciones.confirmados === inscripciones.total
              ? `Tus ${inscripciones.total} equipos están confirmados por la Federación`
              : `${inscripciones.confirmados} de ${inscripciones.total} equipos confirmados por la Federación`}
          </Text>
          <View style={styles.inscripBar}>
            <View
              style={[
                styles.inscripFill,
                {
                  width: `${inscripciones.total ? Math.round((inscripciones.confirmados / inscripciones.total) * 100) : 0}%`,
                },
              ]}
            />
          </View>
          {inscripciones.rows.map((r, i) => (
            <Pressable
              key={`${r.equipo}-${r.genero}`}
              onPress={() => setAbierta(i)}
              style={({ pressed }) => [styles.inscripRow, pressed && { opacity: 0.7 }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.inscripTeam} numberOfLines={1}>
                  {r.equipo}
                </Text>
                <Text style={styles.inscripMeta} numberOfLines={1}>
                  {[
                    r.genero === 'F' ? 'Femenino' : 'Masculino',
                    r.categoriaActual && r.categoria && r.categoriaActual !== r.categoria
                      ? `${r.categoriaActual} → ${r.categoria}`
                      : r.categoria,
                    r.enTactium ? null : 'nuevo',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </View>
              <View style={[styles.pill, !r.confirmado && styles.pillWarn]}>
                <Text style={[styles.pillText, !r.confirmado && { color: c.warning }]}>
                  {r.confirmado ? 'Confirmado' : 'Pendiente'}
                </Text>
              </View>
            </Pressable>
          ))}
          <Text style={styles.cardFoot}>
            Toca un equipo para ver la plantilla inscrita y actualizarla desde la
            Federación. Cuando salga el calendario, te avisaremos para volcar la
            temporada.
          </Text>
        </View>
      ) : null}
    </>
  );
  const weekNode = (
    <>
      {/* ESTA SEMANA */}
      {!inscripciones && weekList.length > 0 ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockLabel}>
              {thisWeek.length ? 'ESTA SEMANA' : 'PRÓXIMAS JORNADAS'}
              {weekJ ? ` · J${weekJ}` : ''}
            </Text>
            <Pressable
              onPress={() =>
                navigation.navigate('Competir', {
                  screen: 'CompetirRoot',
                  params: { segment: 'liga' },
                })
              }
              hitSlop={8}
            >
              <Text style={styles.blockLink}>Ver liga ›</Text>
            </Pressable>
          </View>
          <View style={{ gap: 8 }}>
            {weekList.map((o) => (
              <WeekRow
                key={o.team.id}
                overview={o}
                onPress={() => openMatchday(o.team.id, o.nextMatchday!.id)}
              />
            ))}
          </View>
        </View>
      ) : null}
    </>
  );
  const lastNode = (
    <>
      {/* ÚLTIMA JORNADA, en una línea */}
      {latest ? (
        <View style={styles.block}>
          <View style={styles.blockHead}>
            <Text style={styles.blockLabel}>ÚLTIMA JORNADA</Text>
            <Text style={styles.tally}>
              {tally.win}V · {tally.draw}E · {tally.loss}D
            </Text>
          </View>
          <LastResultRow
            overview={latest}
            onPress={() => openMatchday(latest.team.id, latest.lastResult!.id)}
          />
        </View>
      ) : null}
    </>
  );
  const teamsNode = (
    <>
      {/* EQUIPOS, con su cupo */}
      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={styles.blockLabel}>EQUIPOS · {clubTeams.length}</Text>
          <Pressable
            onPress={() => navigation.navigate('CreateTeamFromClub')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Crear nuevo equipo"
            style={({ pressed }) => [styles.newBtn, pressed && { opacity: 0.75 }]}
          >
            <IconPlus size={12} color={c.accent} />
            <Text style={styles.newBtnText}>Nuevo</Text>
          </Pressable>
        </View>
        {coverage.hasActiveSub ? (
          <CoverageMeter
            planName={clubPlan?.displayName ?? 'tu plan'}
            used={coverage.used}
            quota={coverage.quota}
            reduced={!!reduced}
          />
        ) : null}
        <View style={styles.teamList}>
          {overviews.map((o, idx) => {
            const uncovered = coverage.hasActiveSub && !o.team.covered;
            return (
              <TeamRow
                key={o.team.id}
                overview={o}
                last={idx === overviews.length - 1}
                uncovered={uncovered}
                onCover={() => rootNav.navigate('ClubCoverTeams')}
                onManage={teamGate(
                  o.team,
                  () => openManage(o.team.id, o.team.name),
                  'club_manage_team',
                )}
              />
            );
          })}
        </View>
      </View>
    </>
  );
  const manageNode = (
    <>
      {/* GESTIÓN DEL CLUB: los accesos que ya tenía la web. */}
      <View style={styles.block}>
        <Text style={[styles.blockLabel, { marginBottom: 8 }]}>GESTIÓN DEL CLUB</Text>
        <View style={styles.teamList}>
          <ManageRow
            icon={<IconTrophy size={16} color={c.accent} />}
            title="Torneos"
            sub={toursSub}
            onPress={openTournaments}
          />
          <ManageRow
            icon={<IconTicket size={16} color={c.accent} />}
            title="Cobros y facturación"
            sub={clubPlan ? `${clubPlan.displayName} · cobro de inscripciones` : 'Plan del club y cobro de inscripciones'}
            onPress={() => rootNav.navigate('ClubBilling')}
          />
          {isFcpClub ? (
            <ManageRow
              icon={<IconFile size={16} color={c.accent} />}
              title="Importar de la Federación"
              sub="Equipos, plantillas y puntos"
              onPress={openFcpImport}
            />
          ) : null}
          <ManageRow
            icon={<IconPencil size={16} color={c.accent} />}
            title="Ajustes del club"
            sub="Nombre, federación y borrar club"
            onPress={() => rootNav.navigate('ClubSettings')}
            last
          />
        </View>
      </View>
    </>
  );
  // Tablet: la última jornada entera (todos los equipos), no solo la más reciente.
  const lastAllNode = latest ? (
    <View style={styles.block}>
      <View style={styles.blockHead}>
        <Text style={styles.blockLabel}>
          ÚLTIMA JORNADA{latest.lastResult?.jornada_number ? ` · J${latest.lastResult.jornada_number}` : ''}
        </Text>
        <Text style={styles.tally}>
          {tally.win}V · {tally.draw}E · {tally.loss}D
        </Text>
      </View>
      <View style={{ gap: 8 }}>
        {results
          .slice()
          .sort((a, b) =>
            (b.lastResult!.match_date ?? '').localeCompare(a.lastResult!.match_date ?? ''),
          )
          .map((o) => (
            <LastResultRow
              key={o.team.id}
              overview={o}
              onPress={() => openMatchday(o.team.id, o.lastResult!.id)}
            />
          ))}
      </View>
    </View>
  ) : null;
  const feedNode = <FeedPreview style={{ marginHorizontal: 22, marginTop: 18 }} />;


  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <TactiumMark size={34} gradient />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>CLUB · ADMIN</Text>
            <Text style={styles.brandName} numberOfLines={1}>
              {club.name}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => navigation.navigate('ClubSchedule')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Horarios de local"
            style={({ pressed }) => [styles.headerIconBtn, pressed && { opacity: 0.6 }]}
          >
            <IconClock size={20} color={c.text} />
          </Pressable>
          <NotificationBell />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : isEmptyClub ? (
          <>
            <TrialHomeCard containerPadding={0} />
            <SetupChecklist
              clubName={club.name}
              isFcp={isFcpClub}
              onImport={openFcpImport}
              onCreateTeam={() => navigation.navigate('CreateTeamFromClub')}
              onInvite={() => navigation.navigate('Team')}
              onSlots={() => navigation.navigate('ClubSchedule')}
              onTournaments={openTournaments}
            />
            <FeedPreview style={{ marginHorizontal: 22, marginTop: 18 }} />
          </>
        ) : !layout.isTablet ? (
          <>
            <TrialHomeCard containerPadding={0} />
            {errorNode}
            {todoNode}
            {inscripNode}
            {weekNode}
            {lastNode}
            {teamsNode}
            {manageNode}
            {/* TU GENTE: el feed de quien sigue el club, con kudos. */}
            {feedNode}
          </>
        ) : layout.mode === 'tabletLandscape' ? (
          // TABLET HORIZONTAL: tres columnas que se ven sin mover nada.
          <>
            <TrialHomeCard containerPadding={0} />
            {errorNode}
            <View style={styles.tCols}>
              <View style={styles.tCol}>
                {todoNode}
                {lastAllNode}
                {feedNode}
              </View>
              <View style={styles.tCol}>
                {inscripNode}
                {weekNode}
              </View>
              <View style={styles.tCol}>
                {teamsNode}
                {manageNode}
              </View>
            </View>
          </>
        ) : (
          // TABLET VERTICAL: dos columnas y el feed debajo.
          <>
            <TrialHomeCard containerPadding={0} />
            {errorNode}
            <View style={styles.tCols}>
              <View style={styles.tCol}>
                {todoNode}
                {inscripNode}
                {weekNode}
                {lastAllNode}
              </View>
              <View style={styles.tCol}>
                {teamsNode}
                {manageNode}
              </View>
            </View>
            {feedNode}
          </>
        )}
      </ScrollView>

      <TeamMembersSheet
        open={membersSheet !== null}
        teamId={membersSheet?.teamId ?? null}
        teamName={membersSheet?.teamName ?? null}
        onClose={() => setMembersSheet(null)}
      />

      {/* Plantilla inscrita de un equipo (pretemporada), en hoja. */}
      <BottomSheet open={abierta != null} onClose={() => setAbierta(null)}>
        {abierta != null && inscripciones?.rows[abierta] ? (
          <View>
            <Text style={styles.cardEyebrow}>PLANTILLA INSCRITA</Text>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {inscripciones.rows[abierta].equipo}
            </Text>
            {inscripciones.rows[abierta].sede ? (
              <Text style={styles.sheetSub}>Juega en {inscripciones.rows[abierta].sede}</Text>
            ) : null}
            <View style={{ marginTop: 12 }}>
              {inscripciones.rows[abierta].jugadores.length === 0 ? (
                <Text style={styles.cardFoot}>
                  La Federación todavía no publica jugadores en este equipo.
                </Text>
              ) : (
                inscripciones.rows[abierta].jugadores.map((j, i) => (
                  <View key={j.idJugador} style={styles.rosterRow}>
                    <Text style={styles.rosterNum}>{i + 1}</Text>
                    <Text style={styles.rosterName} numberOfLines={1}>
                      {j.nombre}
                    </Text>
                    <Text style={styles.rosterPts}>{fmtPts(j.puntos)}</Text>
                  </View>
                ))
              )}
            </View>
            <Pressable
              onPress={() => refrescarPlantilla(abierta)}
              disabled={refrescando}
              style={({ pressed }) => [
                styles.rosterBtn,
                (pressed || refrescando) && { opacity: 0.6 },
              ]}
            >
              <Text style={styles.rosterBtnText}>
                {refrescando ? 'Consultando…' : 'Actualizar desde la Federación'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </BottomSheet>

      <FcpImportSheet open={fcpOpen} clubId={club.id} onClose={() => setFcpOpen(false)} />
    </View>
  );
};

// ─── Lista de arranque (club sin equipos) ───────────────────────────────────
const SetupChecklist: React.FC<{
  clubName: string;
  isFcp: boolean;
  onImport: () => void;
  onCreateTeam: () => void;
  onInvite: () => void;
  onSlots: () => void;
  onTournaments: () => void;
}> = ({ clubName, isFcp, onImport, onCreateTeam, onInvite, onSlots, onTournaments }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const steps = [
    { key: 'club', title: 'Crear el club', sub: isFcp ? `${clubName} · Federación Cántabra` : clubName, done: true, onPress: undefined as undefined | (() => void) },
    isFcp
      ? { key: 'teams', title: 'Importar tus equipos de la Federación', sub: 'Plantillas y puntos oficiales, en un paso', done: false, onPress: onImport }
      : { key: 'teams', title: 'Crear el primer equipo', sub: 'Nombre, categoría y género', done: false, onPress: onCreateTeam },
    { key: 'invite', title: 'Invitar a los capitanes', sub: 'Un código por equipo, por WhatsApp', done: false, onPress: onInvite },
    { key: 'slots', title: 'Poner las franjas de tus pistas', sub: 'Sábado 10:00 y 12:00, por ejemplo', done: false, onPress: onSlots },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  return (
    <View style={styles.card}>
      <Text style={styles.setupTitle}>Pon en marcha el club</Text>
      <Text style={styles.setupSub}>
        {steps.length} pasos. Puedes hacerlos en cualquier orden.
      </Text>
      <View style={styles.inscripBar}>
        <View style={[styles.inscripFill, { width: `${(doneCount / steps.length) * 100}%` }]} />
      </View>
      {steps.map((s) => (
        <Pressable
          key={s.key}
          onPress={s.onPress}
          disabled={!s.onPress}
          style={({ pressed }) => [styles.setupRow, pressed && { opacity: 0.75 }]}
        >
          <View style={[styles.setupCheck, s.done && styles.setupCheckDone]}>
            {s.done ? <IconCheck size={12} color={c.textInverse} /> : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.todoTitle, s.done && { color: c.textMuted }]} numberOfLines={1}>
              {s.title}
            </Text>
            <Text style={styles.todoSub} numberOfLines={1}>
              {s.sub}
            </Text>
          </View>
          {s.onPress ? <IconChevron size={14} color={c.textFaint} /> : null}
        </Pressable>
      ))}
      <Pressable
        onPress={onTournaments}
        style={({ pressed }) => [styles.setupAside, pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.todoTitle}>¿También organizas torneos?</Text>
        <Text style={styles.todoSub}>
          Gratis hasta 16 parejas. Para cobrar la inscripción online, conecta Stripe.
        </Text>
      </Pressable>
      {next?.onPress ? (
        <Pressable
          onPress={next.onPress}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.primaryBtnText}>{next.title}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

// ─── Medidor de cupo («Cubiertos por Club Pro 4/10») ────────────────────────
const CoverageMeter: React.FC<{
  planName: string;
  used: number;
  quota: number;
  reduced: boolean;
}> = ({ planName, used, quota, reduced }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const cells = Math.max(quota, used);
  return (
    <View style={styles.meter}>
      <View style={styles.meterHead}>
        <Text style={styles.meterLabel}>Cubiertos por {planName}</Text>
        <Text style={styles.meterValue}>
          {used} / {quota}
        </Text>
      </View>
      <View style={styles.meterCells}>
        {Array.from({ length: cells }).map((_, i) => (
          <Animated.View
            key={i}
            entering={reduced || i >= used ? undefined : FadeIn.delay(i * 40).duration(180)}
            style={[styles.meterCell, i < used && { backgroundColor: c.accent }]}
          />
        ))}
      </View>
    </View>
  );
};

// ─── Fila de la semana ──────────────────────────────────────────────────────
const WeekRow: React.FC<{ overview: ClubTeamOverview; onPress: () => void }> = ({
  overview,
  onPress,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const md = overview.nextMatchday!;
  const { dow, day } = dayLabel(md.match_date);
  const time = md.match_time ? md.match_time.slice(0, 5) : null;
  const noTime = md.is_home && !time;
  const tag = noTime ? 'Sin hora' : md.is_home ? 'Casa' : 'Fuera';
  const line = md.is_home
    ? `${overview.team.name} vs ${md.opponent}${time ? ` · ${time}` : ' · —'}${md.location ? ` · ${md.location}` : ''}`
    : `${overview.team.name} @ ${md.opponent}${time ? ` · ${time}` : ''}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Jornada ${md.jornada_number}: ${line}`}
      style={({ pressed }) => [styles.weekRow, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.weekDate}>
        <Text style={styles.weekDow}>{dow}</Text>
        <Text style={styles.weekDay}>{day}</Text>
      </View>
      <Text style={styles.weekLine} numberOfLines={2}>
        {line}
      </Text>
      <View style={[styles.pill, noTime && styles.pillWarn, !md.is_home && styles.pillMute]}>
        <Text
          style={[
            styles.pillText,
            noTime && { color: c.warning },
            !md.is_home && { color: c.textMuted },
          ]}
        >
          {tag}
        </Text>
      </View>
    </Pressable>
  );
};

// ─── Último resultado, en una línea ─────────────────────────────────────────
const LastResultRow: React.FC<{ overview: ClubTeamOverview; onPress: () => void }> = ({
  overview,
  onPress,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const md = overview.lastResult!;
  const tint = md.outcome === 'win' ? c.accent : md.outcome === 'loss' ? c.error : c.warning;
  const label = md.outcome === 'win' ? 'V' : md.outcome === 'loss' ? 'D' : 'E';
  const hasScore = md.score_for != null && md.score_against != null;
  const left = md.is_home ? overview.team.name : md.opponent;
  const right = md.is_home ? md.opponent : overview.team.name;
  const ls = md.is_home ? md.score_for : md.score_against;
  const rs = md.is_home ? md.score_against : md.score_for;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Jornada ${md.jornada_number}: ${left} ${ls ?? ''} ${right} ${rs ?? ''}`}
      style={({ pressed }) => [styles.weekRow, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.outcome, { borderColor: tint + '80' }]}>
        <Text style={[styles.outcomeText, { color: tint }]}>{label}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.weekLine} numberOfLines={1}>
          {left}{' '}
          <Text style={styles.score}>
            {hasScore ? `${ls} · ${rs}` : '—'}
          </Text>{' '}
          {right}
        </Text>
        <Text style={styles.todoSub} numberOfLines={1}>
          J{md.jornada_number}
          {overview.team.category ? ` · ${overview.team.category}` : ''}
          {overview.team.group_name ? ` · Grupo ${overview.team.group_name}` : ''}
        </Text>
      </View>
      <IconChevron size={14} color={c.textFaint} />
    </Pressable>
  );
};

// ─── TeamRow ────────────────────────────────────────────────────────────────
const TeamRow: React.FC<{
  overview: ClubTeamOverview;
  last: boolean;
  uncovered?: boolean;
  onManage: () => void;
  onCover: () => void;
}> = ({ overview, last, uncovered, onManage, onCover }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { team, playersCount } = overview;
  const meta =
    [team.gender, team.category, team.group_name && `Grupo ${team.group_name}`]
      .filter(Boolean)
      .join(' · ') || 'Sin configurar';
  const players = `${playersCount} ${playersCount === 1 ? 'jugador' : 'jugadores'}`;

  return (
    <Pressable
      onPress={onManage}
      accessibilityRole="button"
      accessibilityLabel={`Gestionar equipo ${team.name}. ${meta}. ${players}.`}
      style={({ pressed }) => [styles.row, last ? null : styles.rowDivider, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.teamBadge}>
        <Text style={styles.teamBadgeText}>
          {(team.category ?? team.name).slice(0, 3).toUpperCase()}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.teamName} numberOfLines={1}>
          {team.name}
        </Text>
        <Text style={[styles.teamMeta, uncovered && { color: c.warning }]} numberOfLines={1}>
          {uncovered ? `Sin cubrir · ${players}` : `${meta} · ${players}`}
        </Text>
      </View>
      {uncovered ? (
        <Pressable
          onPress={onCover}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Cubrir ${team.name}`}
          style={({ pressed }) => [styles.coverBtn, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.coverBtnText}>Cubrir</Text>
        </Pressable>
      ) : (
        <IconChevron size={14} color={c.textFaint} />
      )}
    </Pressable>
  );
};

const ManageRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  sub: string;
  onPress: () => void;
  last?: boolean;
}> = ({ icon, title, sub, onPress, last }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${sub}`}
      style={({ pressed }) => [styles.row, !last && styles.rowDivider, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.manageIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.teamName} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.teamMeta} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <IconChevron size={14} color={c.textFaint} />
    </Pressable>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  empty: { color: c.textFaint, textAlign: 'center', fontSize: 14 },

  topbar: {
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '500',
  },
  brandName: { color: c.text, fontSize: 18, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },

  scroll: { paddingTop: 18 },
  loaderBox: { paddingVertical: 36, alignItems: 'center' },
  errorBanner: {
    marginHorizontal: 22,
    marginBottom: 14,
    backgroundColor: c.error + '1A',
    borderWidth: 1,
    borderColor: c.error + '55',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorBannerText: { color: c.error, fontSize: 13, fontWeight: '600', textAlign: 'center' },

  // Por hacer
  todoCard: {
    marginHorizontal: 22,
    marginBottom: 6,
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.warning + '55',
    overflow: 'hidden',
  },
  todoHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  todoEyebrow: {
    fontFamily: Fonts.mono,
    color: c.warning,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
  },
  todoCount: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11 },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  todoRowDivider: { borderTopWidth: 1, borderTopColor: c.hair },
  todoNum: {
    fontFamily: Fonts.mono,
    color: c.warning,
    fontSize: 20,
    fontWeight: '700',
    minWidth: 24,
    textAlign: 'center',
  },
  todoTitle: { color: c.text, fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  todoSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  allGood: {
    marginHorizontal: 22,
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
  },
  allGoodDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allGoodTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  allGoodSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },

  // Bloques
  block: { marginHorizontal: 22, marginTop: 20 },
  // Tablet: columnas. Los bloques llevan su margen de 22; el negativo lo
  // recorta para que entre columnas queden 32 y al borde 20.
  tCols: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 4 },
  tCol: { flex: 1, minWidth: 0, marginHorizontal: -6 },
  blockHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  blockLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.text,
    letterSpacing: 2,
    fontWeight: '500',
  },
  blockLink: { color: c.accent, fontSize: 12.5, fontWeight: '600' },
  tally: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 11.5, letterSpacing: 0.5 },
  newBtn: {
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
  newBtnText: { color: c.accent, fontSize: 12, fontWeight: '700' },

  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 56,
  },
  weekDate: { width: 40, alignItems: 'center' },
  weekDow: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 10, letterSpacing: 1 },
  weekDay: { fontFamily: Fonts.mono, color: c.text, fontSize: 18, fontWeight: '700' },
  weekLine: { flex: 1, minWidth: 0, color: c.text, fontSize: 13.5, fontWeight: '600' },
  score: { fontFamily: Fonts.mono, color: c.text, fontWeight: '700' },
  outcome: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outcomeText: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700' },

  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
  },
  pillWarn: { backgroundColor: c.warning + '1A', borderColor: c.warning + '66' },
  pillMute: { backgroundColor: 'transparent', borderColor: c.hairStrong },
  pillText: { color: c.accent, fontSize: 11, fontWeight: '700' },

  // Tarjetas genéricas
  card: {
    marginHorizontal: 22,
    marginTop: 14,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    borderRadius: Radius.lg,
    padding: 16,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardEyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 1.6,
    fontWeight: '500',
  },
  cardFoot: { color: c.textFaint, fontSize: 12, lineHeight: 17, marginTop: 12 },

  inscripLead: { color: c.text, fontSize: 15, fontWeight: '700', marginTop: 8 },
  inscripBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.hairStrong,
    marginTop: 10,
    marginBottom: 6,
    overflow: 'hidden',
  },
  inscripFill: { height: 6, borderRadius: 3, backgroundColor: c.accent },
  inscripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: c.hair,
    minHeight: 48,
  },
  inscripTeam: { color: c.text, fontSize: 13.5, fontWeight: '700' },
  inscripMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },

  sheetTitle: { color: c.text, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, marginTop: 4 },
  sheetSub: { color: c.textMuted, fontSize: 13, marginTop: 2 },
  rosterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rosterNum: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, width: 20 },
  rosterName: { flex: 1, minWidth: 0, color: c.text, fontSize: 14 },
  rosterPts: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 12 },
  rosterBtn: {
    marginTop: 14,
    height: 46,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.accent40,
    backgroundColor: c.accent10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterBtnText: { color: c.accent, fontSize: 14, fontWeight: '700' },

  // Lista de arranque
  setupTitle: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  setupSub: { color: c.textMuted, fontSize: 13, marginTop: 4 },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: c.hair,
    minHeight: 56,
  },
  setupCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setupCheckDone: { backgroundColor: c.accent, borderColor: c.accent },
  setupAside: {
    marginTop: 10,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard2,
  },
  primaryBtn: {
    marginTop: 14,
    height: 50,
    borderRadius: Radius.lg,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: c.textInverse, fontSize: 15, fontWeight: '700' },

  // Medidor
  meter: {
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    borderRadius: Radius.md,
    padding: 12,
    marginBottom: 8,
  },
  meterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterLabel: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
  meterValue: { fontFamily: Fonts.mono, color: c.text, fontSize: 13, fontWeight: '700' },
  meterCells: { flexDirection: 'row', gap: 4, marginTop: 8 },
  meterCell: { flex: 1, height: 8, borderRadius: 2, backgroundColor: c.hairStrong },

  teamList: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 60,
  },
  rowDivider: { borderBottomWidth: 1, borderColor: c.hair },
  teamBadge: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamBadgeText: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  manageIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.accent10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamName: { color: c.text, fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  teamMeta: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  coverBtn: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 9,
    backgroundColor: c.warning + '1F',
    borderWidth: 1,
    borderColor: c.warning + '77',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBtnText: { color: c.warning, fontSize: 12.5, fontWeight: '700' },
});
