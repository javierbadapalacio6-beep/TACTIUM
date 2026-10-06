import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useScrollToTop, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  IconPlus,
  IconChevron,
  IconX,
  IconSearch,
  BottomSheet,
  ScanSheet,
  Toggle,
} from '@components/ui';
import { InvitePlayersSheet } from '@features/team/components/InvitePlayersSheet';
import { EditTeamSheet } from '@features/team/components/EditTeamSheet';
import { ImportFcpSheet } from '@features/team/components/ImportFcpSheet';
import { PlayerCardSheet } from '@features/team/components/PlayerCardSheet';
import { useLayout } from '@components/ui/ResponsiveFrame';
import { ContentColumn } from '@components/layout';
import { useMatchdayAvailability } from '@core/hooks/useMatchdayAvailability';
import * as SeasonsApi from '@core/services/seasons';
import * as MatchdaysApi from '@core/services/matchdays';
import {
  FederationSheet,
  RosterMenuSheet,
  TeamSwitchSheet,
} from '@features/team/components/TeamSheets';
import { TeamCrest } from '@features/team/components/TeamCrest';
import {
  CrossFade,
  SlidingSegment,
  StaggerRow,
  lightTap,
} from '@features/team/components/TeamMotion';
import {
  fetchTeamLeagueBundle,
  fetchTeamPairRows,
  teamLogoOf,
  type PairRow,
} from '@features/team/teamData';
import { RedeemInvitationSheet } from '@features/onboarding/components/RedeemInvitationSheet';
import { FcpSeasonUpdateSheet } from '@features/club/components/FcpSeasonUpdateSheet';
import { FcpGroupSheet } from '@features/club/components/FcpGroupSheet';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { seasonUpdateAvailable, fcpSeasonStatus } from '@core/services/fcpSeason';
import { resyncFcpRoster } from '@core/services/fcpOnboarding';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FCP_ENABLED } from '@core/config/featureFlags';
import {
  fetchClubInscripciones,
  refreshInscripcionRoster,
} from '@core/services/fcpInscripciones';
import type { FcpInscripcion } from '@core/services/fcpInscripciones';
import * as InvitationsApi from '@core/services/invitations';
import * as TeamMembersApi from '@core/services/teamMembers';
import { captainUnclaimPlayer } from '@core/services/players';
import type { LeagueStatsBundle } from '@core/services/playerStats';
import {
  useTeamStore,
  selectIsCaptain,
  type Player,
  type Side,
} from '@store/teamStore';
import { toast } from '@store/toastStore';
import {
  NAME_MAX_LENGTH,
  isValidName,
  normalizeName,
  parsePts,
  sanitizePtsInput,
} from '@core/utils/validation';
import type { ScannedPlayer } from '@core/services/imageRecognition';
import { bulkUpsertPlayers } from '@core/utils/bulkUpsertPlayers';
import { useIsPremium } from '@core/hooks/usePremiumGate';
import type { RootStackParamList } from '@navigation/types';
import { uploadPlayerPhoto, removePlayerPhoto } from '@core/services/playerPhoto';
import { displayName, initialsOf, photoOf } from '@core/utils/playerName';
import type { PaywallIntent } from '@core/subscriptions/paywallReasons';

const SIDES: Side[] = ['Drive', 'Revés', 'Ambos'];
/** Liga Cántabra: 5 parejas por encuentro = 10 jugadores. */
const MATCHDAY_PLAYERS = 10;

type Tab = 'plantilla' | 'parejas';
type NoticeKind = 'season' | 'signing' | 'inscripcion';

/** Apellido para las parejas: «Luis Gómez» → «Gómez»; con alias, el alias. */
function surname(p: { name: string; alias?: string | null }): string {
  const alias = p.alias?.trim();
  if (alias) return alias;
  const parts = p.name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : parts[0];
}

/**
 * Pestaña Equipo (capitán y jugador). Rediseño 2026-10:
 *  · Cabecera: escudo + nombre (con «▾» si hay varios equipos), y dos
 *    botones con nombre —«Invitar» y «Plantilla ▾»— en vez de cinco iconos.
 *  · Los avisos de la Federación se juntan en una línea que se puede cerrar
 *    y que abre «Federación» (todo en un sitio).
 *  · Tocar a un jugador abre su ficha (no un menú del sistema).
 *  · El jugador tiene su fila arriba con «Disponible / De baja» y puede ver
 *    la ficha de cualquiera, en solo lectura.
 *  · «Parejas»: quién gana con quién (team_pair_stats), por victorias.
 */
export const TeamScreen = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const players = useTeamStore((s) => s.players);
  const teams = useTeamStore((s) => s.teams);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const removePlayer = useTeamStore((s) => s.removePlayer);
  const setSelfAvail = useTeamStore((s) => s.setSelfAvail);
  const myPlayerId = useTeamStore((s) => s.myPlayerId);

  const team = useTeamStore((s) => s.team);
  // El JUGADOR ve la pestaña en solo lectura: sin añadir, editar, importar ni
  // invitar. (Decisión 1 del rediseño: el «Invitar» del jugador queda fuera
  // porque la RLS de `team_invitations` solo deja leer el código al admin del
  // equipo.)
  const canManage = useTeamStore(selectIsCaptain);
  const loadForUser = useTeamStore((s) => s.loadForUser);
  const isFcpTeam = team?.federation === FCP_FEDERATION_CODE;
  const rootNav =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ── Federación ────────────────────────────────────────────────────────
  const [canPrepareSeason, setCanPrepareSeason] = useState(false);
  useEffect(() => {
    if (!team?.id || !isFcpTeam) {
      setCanPrepareSeason(false);
      return;
    }
    let cancelled = false;
    seasonUpdateAvailable(team.id)
      .then((v) => {
        if (!cancelled) setCanPrepareSeason(v);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [team?.id, isFcpTeam]);

  // Inscripción del equipo a la temporada que VIENE. El servicio casa cada
  // fila de la Federación con un equipo de TACTIUM por jugadores en común (y
  // si no, por nombre), así que la fila mía es la que trae este `teamId`
  // aunque la FCP le haya cambiado la letra.
  //
  // Se le pasan los equipos del club que este usuario ve, no solo el activo:
  // con los hermanos delante, el cruce no le adjudica a este equipo la fila
  // de otro del mismo club que comparta un par de jugadores. Un jugador suelto
  // solo ve su equipo, y entonces va solo; el cruce por plantilla basta.
  const [inscripcion, setInscripcion] = useState<{
    temporada: string;
    fila: FcpInscripcion;
  } | null>(null);
  const [refrescando, setRefrescando] = useState(false);
  const inscripcionTeams = useMemo(() => {
    if (!team) return [];
    const hermanos = team.club_id ? teams.filter((t) => t.club_id === team.club_id) : [];
    const lista = hermanos.some((t) => t.id === team.id) ? hermanos : [...hermanos, team];
    return lista.map((t) => ({ id: t.id, name: t.name, gender: t.gender, category: t.category }));
  }, [team, teams]);
  // Clave estable para el efecto: el array se recrea con cada cambio del store.
  const inscripcionTeamsKey = inscripcionTeams
    .map((t) => `${t.id}|${t.name}|${t.gender}|${t.category}`)
    .join(',');

  const cargarInscripcion = useCallback(async () => {
    if (!team?.id) return null;
    const r = await fetchClubInscripciones(inscripcionTeams);
    const fila = r?.rows.find((x) => x.teamId === team.id);
    return fila && r ? { temporada: r.temporada, fila } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id, inscripcionTeamsKey]);

  useEffect(() => {
    if (!team?.id || !isFcpTeam) {
      setInscripcion(null);
      return;
    }
    let alive = true;
    cargarInscripcion()
      .then((v) => alive && setInscripcion(v))
      .catch(() => alive && setInscripcion(null));
    return () => {
      alive = false;
    };
  }, [team?.id, isFcpTeam, cargarInscripcion]);

  /** Relee la plantilla en la web de la Federación, sin esperar al volcado
   *  automático (martes y viernes). */
  const refrescarInscripcion = async () => {
    if (!team?.id || refrescando) return;
    setRefrescando(true);
    try {
      await refreshInscripcionRoster(team.id, inscripcion?.fila.idEquipo);
      setInscripcion(await cargarInscripcion());
    } catch {
      /* el texto ya dice de cuándo es la foto */
    } finally {
      setRefrescando(false);
    }
  };

  const [fcpStatus, setFcpStatus] = useState<{
    newSeason: boolean;
    signing: boolean;
    latestLiga: string;
  }>({ newSeason: false, signing: false, latestLiga: '?' });
  const [noticeHidden, setNoticeHidden] = useState<Record<NoticeKind, boolean>>({
    season: false,
    signing: false,
    inscripcion: false,
  });
  const [resyncing, setResyncing] = useState(false);
  useEffect(() => {
    if (!team?.id || !isFcpTeam) {
      setFcpStatus({ newSeason: false, signing: false, latestLiga: '?' });
      return;
    }
    let cancelled = false;
    fcpSeasonStatus(team.id)
      .then(async (st) => {
        if (cancelled) return;
        const latestLiga = String(st.latestLiga ?? '?');
        setFcpStatus({
          newSeason: st.newSeasonPublished,
          signing: st.signingWindowOpen && !st.newSeasonPublished,
          latestLiga,
        });
        // El de temporada vuelve si publican otra; el de fichajes, cada mes.
        const now = new Date();
        const [sv, gv] = await Promise.all([
          AsyncStorage.getItem(`fcpNotice:season:${team.id}:${latestLiga}`),
          AsyncStorage.getItem(
            `fcpNotice:signing:${team.id}:${now.getFullYear()}-${now.getMonth()}`,
          ),
        ]);
        if (!cancelled)
          setNoticeHidden((p) => ({ ...p, season: sv === '1', signing: gv === '1' }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [team?.id, isFcpTeam]);

  const hideNotice = async (kind: NoticeKind) => {
    setNoticeHidden((p) => ({ ...p, [kind]: true }));
    if (!team?.id || kind === 'inscripcion') return;
    const now = new Date();
    // Antes se guardaba `…:latest` y se leía `…:{liga}`: el aviso de temporada
    // volvía a salir siempre aunque lo cerraras. Misma clave en los dos lados.
    const key =
      kind === 'season'
        ? `fcpNotice:season:${team.id}:${fcpStatus.latestLiga}`
        : `fcpNotice:signing:${team.id}:${now.getFullYear()}-${now.getMonth()}`;
    try {
      await AsyncStorage.setItem(key, '1');
    } catch {
      /* si no se puede guardar, el aviso volverá: no es grave */
    }
  };

  const doResync = async () => {
    if (!team?.id || resyncing) return;
    setResyncing(true);
    try {
      const added = await resyncFcpRoster(team.id);
      await loadForUser();
      toast.success(
        added > 0 ? `${added} ${added === 1 ? 'fichaje' : 'fichajes'}` : 'Plantilla al día',
        added > 0 ? 'Añadidos a la plantilla.' : 'No hay jugadores nuevos en la Federación.',
      );
      void hideNotice('signing');
    } catch (e: any) {
      toast.error('No se pudo revisar', e?.message ?? '');
    } finally {
      setResyncing(false);
    }
  };

  // Una sola línea de aviso, la más urgente. Antes podían salir dos
  // párrafos largos a la vez.
  const notice: { kind: NoticeKind; title: string; sub: string } | null = !isFcpTeam
    ? null
    : canManage && fcpStatus.newSeason && !noticeHidden.season
      ? {
          kind: 'season',
          title: 'Temporada nueva en la Federación',
          sub: 'Trae la plantilla y el calendario',
        }
      : canManage && fcpStatus.signing && !noticeHidden.signing
        ? {
            kind: 'signing',
            title: 'Ventana de fichajes abierta',
            sub: 'Hasta el fin de la primera vuelta',
          }
        : inscripcion && !inscripcion.fila.confirmado && !noticeHidden.inscripcion
          ? {
              kind: 'inscripcion',
              title: `Inscripción ${inscripcion.temporada}`,
              sub: 'La Federación aún no la ha confirmado',
            }
          : null;

  // ── Hojas ─────────────────────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('plantilla');
  const [cardId, setCardId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Player | null>(null);
  const [adding, setAdding] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [importingFcp, setImportingFcp] = useState(false);
  const [seasonOpen, setSeasonOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [fedOpen, setFedOpen] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const openInvite = () => setInviting(true);

  // La IMPORTACIÓN COMPLETA (escaneo del ranking o import de la Federación)
  // es premium. Mismo aviso de siempre: con premium abre directo; si no,
  // «A mano / Ver planes» → paywall con motivo `roster_import`.
  const isPremium = useIsPremium();
  const requestImport = (open: () => void) => {
    if (isPremium) {
      open();
      return;
    }
    Alert.alert(
      'Volcado automático',
      'Escanea tu ranking (o impórtalo de la Federación) y volcamos tu plantilla entera con los puntos oficiales — es una función premium. Con suscripción es automático; sin ella, añade tus jugadores a mano.',
      [
        { text: 'A mano', style: 'cancel', onPress: () => setAdding(true) },
        {
          text: 'Ver planes',
          onPress: () =>
            rootNav.navigate('Paywall', {
              intent: 'roster_import' satisfies PaywallIntent,
            }),
        },
      ],
    );
  };
  const openScan = () => requestImport(() => setScanning(true));
  const openFcpImport = () => requestImport(() => setImportingFcp(true));

  const handleBulkPlayers = async (scanned: ScannedPlayer[]) => {
    // UPSERT por nombre normalizado: si el jugador ya existe actualizamos sus
    // puntos (re-escanear el ranking al salir la tirada nueva); si no, INSERT.
    try {
      const { added, updated } = await bulkUpsertPlayers({
        scanned,
        existing: players,
        addPlayer,
        updatePlayer,
      });
      if (added > 0 && updated > 0) {
        toast.success(
          'Plantilla actualizada',
          `${updated} ${updated === 1 ? 'actualizado' : 'actualizados'} · ${added} ${added === 1 ? 'nuevo' : 'nuevos'}`,
        );
      } else if (updated > 0) {
        toast.success('Puntos actualizados', `${updated} ${updated === 1 ? 'jugador' : 'jugadores'}`);
      } else if (added > 0) {
        toast.success(`${added} ${added === 1 ? 'jugador añadido' : 'jugadores añadidos'}`);
      }
    } catch (e: any) {
      toast.error('Error al importar', e?.message ?? 'Inténtalo de nuevo.');
    }
  };

  // ── Datos de apoyo: capitanes, ficha y parejas ────────────────────────
  const [captainIds, setCaptainIds] = useState<Set<string>>(new Set());
  const [captainName, setCaptainName] = useState<string | null>(null);
  useEffect(() => {
    if (!team?.id) return;
    let alive = true;
    TeamMembersApi.fetchTeamMembersWithProfiles(team.id)
      .then((ms) => {
        if (!alive) return;
        const caps = ms.filter((m) => m.role === 'captain' || m.role === 'admin');
        setCaptainIds(new Set(caps.map((m) => m.user_id)));
        setCaptainName(caps[0]?.profile?.full_name ?? null);
      })
      .catch(() => {
        if (alive) {
          setCaptainIds(new Set());
          setCaptainName(null);
        }
      });
    return () => {
      alive = false;
    };
  }, [team?.id]);

  const [bundle, setBundle] = useState<LeagueStatsBundle | null>(null);
  const [bundleLoading, setBundleLoading] = useState(false);
  const bundleTeam = useRef<string | null>(null);
  useEffect(() => {
    setBundle(null);
    bundleTeam.current = null;
    setPairs(null);
  }, [team?.id]);
  const ensureBundle = useCallback(() => {
    if (!team?.id || bundleTeam.current === team.id) return;
    bundleTeam.current = team.id;
    setBundleLoading(true);
    fetchTeamLeagueBundle(team.id)
      .then(setBundle)
      .catch(() => {
        bundleTeam.current = null;
      })
      .finally(() => setBundleLoading(false));
  }, [team?.id]);

  const [pairs, setPairs] = useState<PairRow[] | null>(null);
  const [pairsError, setPairsError] = useState(false);
  useEffect(() => {
    if (tab !== 'parejas' || !team?.id || pairs) return;
    let alive = true;
    setPairsError(false);
    fetchTeamPairRows(team.id)
      .then((r) => alive && setPairs(r))
      .catch(() => alive && setPairsError(true));
    return () => {
      alive = false;
    };
  }, [tab, team?.id, pairs]);

  const openCard = (p: Player) => {
    ensureBundle();
    setCardId(p.id);
  };
  const cardPlayer = cardId ? players.find((p) => p.id === cardId) ?? null : null;

  // Enlace del equipo para el estado vacío (código compartido de jugador).
  // Solo LECTURA al pintar; si aún no existe se crea al pulsar.
  const [shareCode, setShareCode] = useState<string | null>(null);
  useEffect(() => {
    setShareCode(null);
    if (!team?.id || !canManage || players.length >= MATCHDAY_PLAYERS) return;
    let alive = true;
    InvitationsApi.fetchTeamInvitations(team.id)
      .then((invs) => {
        const shared = invs.find(InvitationsApi.isSharedCode);
        if (alive && shared) setShareCode(shared.code);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id, canManage]);

  const shareTeamLink = async () => {
    if (!team?.id) return;
    try {
      const code =
        shareCode ?? (await InvitationsApi.createInvitation(team.id, 'player')).code;
      setShareCode(code);
      await Share.share({
        message: InvitationsApi.buildInviteMessage(team.name, code, 'player'),
      });
    } catch (e: any) {
      if (e?.message) toast.error('No se pudo compartir', e.message);
    }
  };

  // ── Scroll ────────────────────────────────────────────────────────────
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

  const sorted = useMemo(() => [...players].sort((a, b) => b.pts - a.pts), [players]);
  const me = myPlayerId ? players.find((p) => p.id === myPlayerId) ?? null : null;
  const q = search.trim().toLowerCase();
  const shown = sorted.filter(
    (p) =>
      (!me || p.id !== me.id) &&
      (!q || `${p.name} ${p.alias ?? ''}`.toLowerCase().includes(q)),
  );
  const totalPts = players.reduce((a, p) => a + p.pts, 0);
  const avg = players.length ? Math.round(totalPts / players.length) : 0;
  const linked = players.filter((p) => !!p.user_id).length;
  const multi = teams.length > 1;

  // Barra «N de 10»: suma un tramo con un pequeño rebote al entrar gente.
  const fill = useSharedValue(Math.min(players.length, MATCHDAY_PLAYERS) / MATCHDAY_PLAYERS);
  useEffect(() => {
    const to = Math.min(players.length, MATCHDAY_PLAYERS) / MATCHDAY_PLAYERS;
    fill.value = reduced ? to : withSpring(to, { damping: 12, stiffness: 140 });
  }, [players.length, reduced, fill]);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, fill.value)) * 100}%`,
  }));

  // Fila «Tú»: se atenúa al pasar a «De baja».
  const meDim = useSharedValue(me && !me.available ? 0.55 : 1);
  useEffect(() => {
    const to = me && !me.available ? 0.55 : 1;
    meDim.value = reduced ? to : withTiming(to, { duration: 220 });
  }, [me?.available, reduced, meDim, me]);
  const meDimStyle = useAnimatedStyle(() => ({ opacity: meDim.value }));

  const toggleMe = async (v: boolean) => {
    if (!me) return;
    lightTap();
    try {
      await setSelfAvail(me.id, v);
    } catch (e: any) {
      toast.error('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.');
    }
  };

  const confirmRemove = (p: Player) => {
    Alert.alert(
      'Quitar de la plantilla',
      `Vas a borrar a «${p.name}» de la plantilla. Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Quitar',
          style: 'destructive',
          onPress: () => {
            setCardId(null);
            removePlayer(p.id)
              .then(() => toast.success('Jugador eliminado', p.name))
              .catch((e: any) => toast.error('No se pudo quitar', e?.message ?? ''));
          },
        },
      ],
    );
  };

  const unlinkPlayer = (p: Player) => {
    Alert.alert(
      'Desvincular de su cuenta',
      `La ficha de «${p.name}» se queda en la plantilla, pero deja de estar unida a su cuenta. Útil si se vinculó a la ficha equivocada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desvincular',
          style: 'destructive',
          onPress: async () => {
            try {
              await captainUnclaimPlayer(p.id);
              setEditing(null);
              await loadForUser();
              toast.success('Desvinculado', p.name);
            } catch (e: any) {
              toast.error('No se pudo desvincular', e?.message ?? '');
            }
          },
        },
      ],
    );
  };

  const metaLine = [
    team?.category,
    team?.group_name ? `Grupo ${team.group_name}` : null,
    canManage ? (isFcpTeam ? 'Liga Cántabra' : team?.league) : null,
    !canManage && captainName ? `capitán: ${captainName}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const rosterMenu = [
    ...(FCP_ENABLED
      ? [
          {
            key: 'fcp',
            glyph: 'F',
            title: 'Traer de la Federación',
            sub: 'Jugadores y puntos oficiales',
            pro: !isPremium,
            onPress: openFcpImport,
          },
        ]
      : []),
    {
      key: 'scan',
      glyph: '◎',
      title: 'Escanear el ranking',
      sub: 'Una foto de la lista de puntos',
      pro: !isPremium,
      onPress: openScan,
    },
    {
      key: 'add',
      glyph: '＋',
      title: 'Añadir a mano',
      sub: 'Nombre, posición y puntos',
      onPress: () => setAdding(true),
    },
  ];
  const teamMenu = [
    {
      key: 'edit',
      glyph: '✎',
      title: 'Editar el equipo',
      sub: 'Escudo, categoría, grupo y horarios',
      onPress: () => setEditingTeam(true),
    },
    ...(isFcpTeam
      ? [
          {
            key: 'fed',
            glyph: '▦',
            title: 'Mi grupo en la Federación',
            sub: 'Volcar jornadas y clasificación',
            onPress: () => setFedOpen(true),
          },
        ]
      : []),
    ...(isFcpTeam && canPrepareSeason
      ? [
          {
            key: 'season',
            glyph: '★',
            title: 'Preparar la temporada nueva',
            sub: 'Traer la plantilla de la liga nueva',
            onPress: () => setSeasonOpen(true),
          },
        ]
      : []),
  ];

  const renderRow = (p: Player, i: number, last: boolean) => {
    const isCap = !!p.user_id && captainIds.has(p.user_id);
    const photo = photoOf(p);
    return (
      <StaggerRow key={p.id} index={i} animate={!reduced && i < 14}>
        <Pressable
          onPress={() => openCard(p)}
          accessibilityRole="button"
          accessibilityLabel={`Ficha de ${displayName(p)}`}
          style={({ pressed }) => [
            styles.row,
            !last && styles.rowDividerInline,
            pressed && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.rankText}>{String(i + 1).padStart(2, '0')}</Text>
          <View>
            <View style={styles.rowAvatar}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.rowAvatarImg} resizeMode="cover" />
              ) : (
                <Text style={styles.rowAvatarInitials}>{initialsOf(p)}</Text>
              )}
            </View>
            {p.user_id ? <View style={styles.dot} /> : null}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.rowNameRow}>
              <Text style={styles.rowName} numberOfLines={1}>
                {displayName(p)}
              </Text>
              {isCap ? (
                <View style={styles.capBadge}>
                  <Text style={styles.capBadgeText}>CAP</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.rowMeta} numberOfLines={1}>
              {p.position}
              {!p.user_id && canManage ? ' · sin cuenta' : ''}
            </Text>
          </View>
          {!p.available ? (
            <View style={styles.bajaBadge}>
              <Text style={styles.bajaBadgeText}>BAJA</Text>
            </View>
          ) : !p.user_id && canManage ? (
            <Pressable
              onPress={openInvite}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Invitar a ${displayName(p)}`}
              style={({ pressed }) => [styles.rowInvite, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.rowInviteText}>Invitar</Text>
            </Pressable>
          ) : (
            <Text style={styles.ptsText}>{p.pts}</Text>
          )}
        </Pressable>
      </StaggerRow>
    );
  };

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // ── Tablet ────────────────────────────────────────────────────────────
  // La plantilla pasa a tabla (posición, puntos, en TACTIUM y la respuesta
  // de la próxima jornada) y la ficha a un panel: en horizontal, columna
  // fija a la derecha (se cambia de jugador sin cerrarla); en vertical, el
  // SidePanel de 420.
  const { mode, isTablet } = useLayout();
  const wide = mode === 'tabletLandscape';
  const [nextMd, setNextMd] = useState<{ id: string; n: number } | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!isTablet || !team?.id) return undefined;
      let alive = true;
      (async () => {
        try {
          const season = await SeasonsApi.fetchActiveSeason(team.id);
          const md = season ? await MatchdaysApi.fetchUpcomingMatchday(season.id) : null;
          if (alive)
            setNextMd(md && md.status === 'upcoming' ? { id: md.id, n: md.jornada_number } : null);
        } catch {
          if (alive) setNextMd(null);
        }
      })();
      return () => {
        alive = false;
      };
    }, [isTablet, team?.id]),
  );
  const nextAvail = useMatchdayAvailability(isTablet ? nextMd?.id ?? null : null);

  const tableHeader = (
    <View style={[styles.tRow, styles.tHeadRow]}>
      <Text style={[styles.tCellNum, styles.tHeadText]}>#</Text>
      <Text style={[styles.tCellName, styles.tHeadText]}>JUGADOR</Text>
      <Text style={[styles.tCellPos, styles.tHeadText]}>POSICIÓN</Text>
      <Text style={[styles.tCellPts, styles.tHeadText, { textAlign: 'right' }]}>PUNTOS</Text>
      <Text style={[styles.tCellApp, styles.tHeadText]}>TACTIUM</Text>
      {nextMd ? (
        <Text style={[styles.tCellRsvp, styles.tHeadText]}>
          J{String(nextMd.n).padStart(2, '0')}
        </Text>
      ) : null}
    </View>
  );

  const renderTableRow = (p: Player, i: number, last: boolean) => {
    const isCap = !!p.user_id && captainIds.has(p.user_id);
    const photo = photoOf(p);
    const st = nextAvail.map[p.id]?.status ?? null;
    const rsvp = !p.available
      ? { t: 'BAJA', col: c.error }
      : st === 'yes'
        ? { t: 'VOY', col: c.accent }
        : st === 'maybe'
          ? { t: 'DUDA', col: c.warning }
          : st === 'no'
            ? { t: 'NO', col: c.error }
            : { t: '—', col: c.textFaint };
    const selected = wide && cardId === p.id;
    return (
      <Pressable
        key={p.id}
        onPress={() => openCard(p)}
        accessibilityRole="button"
        accessibilityLabel={`Ficha de ${displayName(p)}`}
        style={({ pressed }) => [
          styles.tRow,
          !last && styles.rowDividerInline,
          selected && { backgroundColor: c.accent10 },
          !p.available && { opacity: 0.6 },
          pressed && { opacity: 0.85 },
        ]}
      >
        <Text style={[styles.tCellNum, styles.rankText]}>{String(i + 1).padStart(2, '0')}</Text>
        <View style={[styles.tCellName, styles.tNameWrap]}>
          <View>
            <View style={styles.rowAvatar}>
              {photo ? (
                <Image source={{ uri: photo }} style={styles.rowAvatarImg} resizeMode="cover" />
              ) : (
                <Text style={styles.rowAvatarInitials}>{initialsOf(p)}</Text>
              )}
            </View>
            {p.user_id ? <View style={styles.dot} /> : null}
          </View>
          <Text style={[styles.rowName, { flexShrink: 1 }]} numberOfLines={1}>
            {displayName(p)}
          </Text>
          {isCap ? (
            <View style={styles.capBadge}>
              <Text style={styles.capBadgeText}>CAP</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.tCellPos, styles.rowMeta]} numberOfLines={1}>
          {p.position}
        </Text>
        <Text style={[styles.tCellPts, styles.ptsText, { textAlign: 'right' }]}>{p.pts}</Text>
        <View style={styles.tCellApp}>
          {p.user_id ? (
            <Text style={[styles.tApp, { color: c.accent }]}>● sí</Text>
          ) : canManage ? (
            <Pressable
              onPress={openInvite}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Invitar a ${displayName(p)}`}
              style={({ pressed }) => [styles.rowInvite, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.rowInviteText}>Invitar</Text>
            </Pressable>
          ) : (
            <Text style={[styles.tApp, { color: c.textFaint }]}>no</Text>
          )}
        </View>
        {nextMd ? (
          <Text style={[styles.tCellRsvp, styles.tRsvp, { color: rsvp.col }]}>{rsvp.t}</Text>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      <View style={wide ? styles.tBody : styles.tBodyPhone}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TabletColumn on={isTablet} maxWidth={wide ? 980 : 720}>
        {/* ── Cabecera ─────────────────────────────────────────────── */}
        <CrossFade id={team?.id ?? 'none'}>
          <Pressable
            onPress={() => multi && setSwitchOpen(true)}
            disabled={!multi}
            accessibilityRole={multi ? 'button' : undefined}
            accessibilityLabel={multi ? 'Cambiar de equipo' : undefined}
            style={({ pressed }) => [styles.crestRow, pressed && { opacity: 0.8 }]}
          >
            <TeamCrest name={team?.name ?? 'Equipo'} logo={teamLogoOf(team)} size={48} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={styles.titleRow}>
                <Text style={styles.title} numberOfLines={1}>
                  {team?.name ?? 'Equipo'}
                </Text>
                {multi ? <Text style={styles.titleChev}>▾</Text> : null}
              </View>
              {metaLine ? (
                <Text style={styles.teamMeta} numberOfLines={1}>
                  {metaLine}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </CrossFade>

        {canManage ? (
          <View style={styles.btnRow}>
            <Pressable
              onPress={openInvite}
              accessibilityRole="button"
              style={({ pressed }) => [styles.btn, styles.btnAccent, pressed && { opacity: 0.85 }]}
            >
              <IconPlus size={15} color={c.textInverse} />
              <Text style={styles.btnAccentText}>Invitar</Text>
            </Pressable>
            <Pressable
              onPress={() => setMenuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Plantilla: importar, añadir y editar el equipo"
              style={({ pressed }) => [styles.btn, styles.btnGhost, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.btnGhostText}>Plantilla ▾</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.kpis}>
          <Kpi label="jugadores" value={String(players.length)} />
          <View style={styles.kpiSep} />
          <Kpi label="en TACTIUM" value={String(linked)} highlight />
          <View style={styles.kpiSep} />
          <Kpi label="media pts" value={String(avg)} />
        </View>

        {notice ? (
          <View style={styles.notice}>
            <Pressable
              onPress={() => setFedOpen(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.noticeMain, pressed && { opacity: 0.8 }]}
            >
              <View style={styles.noticeDot} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.noticeTitle} numberOfLines={1}>
                  {notice.title}
                </Text>
                <Text style={styles.noticeSub} numberOfLines={1}>
                  {notice.sub}
                </Text>
              </View>
              <Text style={styles.noticeLink}>Revisar ›</Text>
            </Pressable>
            <Pressable
              onPress={() => hideNotice(notice.kind)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Cerrar aviso"
              style={styles.noticeClose}
            >
              <IconX size={12} color={c.textFaint} />
            </Pressable>
          </View>
        ) : null}

        {/* ── Inscripción a la temporada que viene: siempre a la vista
            (cambio de categoría, sede y plantilla inscrita), no solo
            cuando falta confirmarla. El detalle está en la hoja Federación. */}
        {inscripcion && notice?.kind !== 'inscripcion' ? (
          <Pressable
            onPress={() => setFedOpen(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.inscCard, pressed && { opacity: 0.85 }]}
          >
            <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.inscEyebrow}>INSCRIPCIÓN {inscripcion.temporada}</Text>
                <Text
                  style={[
                    styles.inscChip,
                    inscripcion.fila.confirmado ? styles.inscChipOk : styles.inscChipWarn,
                  ]}
                >
                  {inscripcion.fila.confirmado ? 'CONFIRMADA' : 'SIN CONFIRMAR'}
                </Text>
              </View>
              <Text style={styles.inscTitle} numberOfLines={1}>
                {inscripcion.fila.categoriaActual &&
                inscripcion.fila.categoria &&
                inscripcion.fila.categoriaActual !== inscripcion.fila.categoria
                  ? `Cambiáis de ${inscripcion.fila.categoriaActual} a ${inscripcion.fila.categoria}`
                  : inscripcion.fila.categoria
                    ? `Jugáis en ${inscripcion.fila.categoria}`
                    : 'Categoría aún sin publicar'}
                {inscripcion.fila.subgrupo ? `, grupo ${inscripcion.fila.subgrupo}` : ''}
              </Text>
              <Text style={styles.inscSub} numberOfLines={1}>
                {[
                  inscripcion.fila.sedeCorta || inscripcion.fila.sede
                    ? `Sede: ${inscripcion.fila.sedeCorta || inscripcion.fila.sede}`
                    : 'Sede sin asignar',
                  `${inscripcion.fila.jugadores.length} inscritos`,
                ].join(' · ')}
              </Text>
            </View>
            <Text style={styles.noticeLink}>Ver ›</Text>
          </Pressable>
        ) : null}

        {/* ── Tú (jugador) ─────────────────────────────────────────── */}
        {!canManage && me ? (
          <>
            <Text style={styles.sectionLabel}>Tú</Text>
            <Animated.View style={[styles.meCard, meDimStyle]}>
              <Pressable
                onPress={() => openCard(me)}
                style={styles.meMain}
                accessibilityRole="button"
                accessibilityLabel="Tu ficha"
              >
                <View style={styles.rowAvatar}>
                  {photoOf(me) ? (
                    <Image source={{ uri: photoOf(me) as string }} style={styles.rowAvatarImg} />
                  ) : (
                    <Text style={styles.rowAvatarInitials}>{initialsOf(me)}</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {displayName(me)}
                  </Text>
                  <Text style={styles.rowMeta}>
                    {me.position} · {me.pts} pts
                  </Text>
                </View>
              </Pressable>
              <View style={styles.meToggle}>
                <Text style={[styles.meToggleText, !me.available && { color: c.warning }]}>
                  {me.available ? 'Disponible' : 'De baja'}
                </Text>
                <Toggle value={me.available} onChange={toggleMe} />
              </View>
            </Animated.View>
            <Text style={styles.meHint}>
              Es la baja larga (lesión, una temporada fuera). Para cada jornada
              sigue el Voy / Duda / No.
            </Text>
          </>
        ) : null}

        {/* ── Plantilla / Parejas ──────────────────────────────────── */}
        {players.length > 0 ? (
          <View style={{ marginTop: 18 }}>
            <SlidingSegment<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'plantilla', label: `Plantilla · ${players.length}` },
                { value: 'parejas', label: 'Parejas' },
              ]}
              colors={{
                track: c.bgCard,
                pill: c.bgCard2,
                border: c.hair,
                on: c.text,
                off: c.textMuted,
              }}
            />
          </View>
        ) : null}

        {players.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyEyebrow}>PLANTILLA VACÍA</Text>
            <Text style={styles.emptyTitle}>
              {canManage
                ? `Para jugar una jornada hacen falta ${MATCHDAY_PLAYERS}`
                : 'Tu capitán todavía no ha añadido jugadores'}
            </Text>
            {canManage ? (
              <>
                <Text style={styles.emptySubtitle}>
                  Una jornada de la Liga Cántabra son 5 parejas. Trae la plantilla
                  de la Federación o manda el enlace al grupo.
                </Text>
                <View style={styles.progressTrack}>
                  <Animated.View style={[styles.progressFill, fillStyle]} />
                </View>
                <Text style={styles.progressText}>
                  0 de {MATCHDAY_PLAYERS}
                </Text>
                <View style={{ gap: 8, marginTop: 14 }}>
                  {FCP_ENABLED ? (
                    <Pressable
                      onPress={openFcpImport}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.emptyAction, pressed && { opacity: 0.85 }]}
                    >
                      <View style={styles.emptyGlyph}>
                        <Text style={styles.emptyGlyphText}>F</Text>
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.emptyActionTitle}>Traer de la Federación</Text>
                        <Text style={styles.emptyActionSub}>Búscate y llegan con sus puntos</Text>
                      </View>
                      <IconChevron size={14} color={c.textFaint} />
                    </Pressable>
                  ) : null}
                  <Pressable
                    onPress={shareTeamLink}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.emptyAction, pressed && { opacity: 0.85 }]}
                  >
                    <View style={styles.emptyGlyph}>
                      <Text style={styles.emptyGlyphText}>↗</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.emptyActionTitle}>Enviar el enlace por WhatsApp</Text>
                      <Text style={styles.emptyActionSub} numberOfLines={1}>
                        {shareCode
                          ? `${InvitationsApi.inviteUrlDisplay(shareCode)} · gratis`
                          : 'El enlace del equipo · gratis'}
                      </Text>
                    </View>
                    <IconChevron size={14} color={c.textFaint} />
                  </Pressable>
                </View>
                <Pressable onPress={() => setAdding(true)} hitSlop={8} style={{ marginTop: 14 }}>
                  <Text style={styles.emptyLink}>o añádelos a mano</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : tab === 'plantilla' ? (
          <CrossFade id="plantilla">
            {canManage && players.length < MATCHDAY_PLAYERS ? (
              <View style={styles.goal}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.goalText}>
                    Faltan {MATCHDAY_PLAYERS - players.length} para una jornada
                  </Text>
                  <View style={[styles.progressTrack, { marginTop: 8 }]}>
                    <Animated.View style={[styles.progressFill, fillStyle]} />
                  </View>
                </View>
                <Pressable onPress={shareTeamLink} hitSlop={8}>
                  <Text style={styles.goalLink}>Enviar enlace ›</Text>
                </Pressable>
              </View>
            ) : null}
            {players.length > 8 ? (
              <View style={styles.search}>
                <IconSearch size={14} color={c.textFaint} />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Buscar jugador"
                  placeholderTextColor={c.textFaint}
                  style={styles.searchInput}
                />
                {search ? (
                  <Pressable onPress={() => setSearch('')} hitSlop={6}>
                    <IconX size={12} color={c.textFaint} />
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            <View style={styles.list}>
              {isTablet && shown.length > 0 ? tableHeader : null}
              {shown.length === 0 ? (
                <View style={styles.noMatch}>
                  <Text style={styles.emptySubtitle}>
                    {q ? `Ningún jugador coincide con «${search}».` : 'Solo estás tú en la plantilla.'}
                  </Text>
                </View>
              ) : (
                shown.map((p, i) =>
                  isTablet
                    ? renderTableRow(p, i, i === shown.length - 1)
                    : renderRow(p, i, i === shown.length - 1),
                )
              )}
            </View>
          </CrossFade>
        ) : (
          <CrossFade id="parejas">
            <Text style={styles.pairsLede}>
              Liga · ordenadas por victorias, no por porcentaje
            </Text>
            <View style={styles.list}>
              {pairsError ? (
                <View style={styles.noMatch}>
                  <Text style={styles.emptySubtitle}>No se pudieron cargar las parejas.</Text>
                  <Pressable onPress={() => setPairs(null)} hitSlop={8} style={{ marginTop: 8 }}>
                    <Text style={styles.emptyLink}>Reintentar</Text>
                  </Pressable>
                </View>
              ) : !pairs ? (
                <View style={styles.noMatch}>
                  <ActivityIndicator color={c.accent} />
                </View>
              ) : pairs.length === 0 ? (
                <View style={styles.noMatch}>
                  <Text style={styles.emptySubtitle}>
                    En cuanto cerréis actas con resultados, aquí se verá qué parejas funcionan.
                  </Text>
                </View>
              ) : (
                pairs.map((r, i) => {
                  const a = byId.get(r.a);
                  const b = byId.get(r.b);
                  const mine = !!myPlayerId && (r.a === myPlayerId || r.b === myPlayerId);
                  const label = [a, b]
                    .map((x) =>
                      x ? `${surname(x)}${x.id === myPlayerId ? ' (tú)' : ''}` : '—',
                    )
                    .join(' / ');
                  return (
                    <StaggerRow key={`${r.a}-${r.b}`} index={i}>
                      <View
                        style={[
                          styles.pairRow,
                          i < pairs.length - 1 && styles.rowDividerInline,
                          mine && { backgroundColor: c.accent10 },
                        ]}
                      >
                        <Text style={styles.rankText}>{i + 1}</Text>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {label}
                          </Text>
                          <Text style={styles.rowMeta}>
                            {r.played} {r.played === 1 ? 'jugado' : 'jugados'}
                          </Text>
                        </View>
                        {isTablet ? (
                          <View style={styles.tPairBarWrap}>
                            <View style={styles.tPairBar}>
                              <View
                                style={[
                                  styles.tPairFill,
                                  {
                                    width: `${r.played ? Math.round((r.wins / r.played) * 100) : 0}%`,
                                  },
                                ]}
                              />
                            </View>
                            <Text style={styles.tPairPct}>
                              {r.played ? Math.round((r.wins / r.played) * 100) : 0}%
                            </Text>
                          </View>
                        ) : null}
                        <Text
                          style={[
                            styles.pairScore,
                            { color: r.wins * 2 >= r.played ? c.accent : c.textMuted },
                          ]}
                        >
                          {r.wins}–{r.played - r.wins}
                        </Text>
                      </View>
                    </StaggerRow>
                  );
                })
              )}
            </View>
          </CrossFade>
        )}
        </TabletColumn>
      </ScrollView>
      {wide ? (
        <PlayerCardSheet
          inline
          player={cardPlayer}
          teamName={team?.name ?? 'Equipo'}
          canManage={canManage}
          isCaptainRow={!!cardPlayer?.user_id && captainIds.has(cardPlayer.user_id)}
          myPlayerId={myPlayerId}
          bundle={bundle}
          bundleLoading={bundleLoading}
          onClose={() => setCardId(null)}
          onEdit={() => cardPlayer && setEditing(cardPlayer)}
          onToggleAvailable={(v) => {
            if (!cardPlayer) return;
            // Sin gestión solo se ve el interruptor de la propia ficha, y va
            // por la RPC del jugador (la RLS no le deja tocar `players`).
            if (!canManage) return void toggleMe(v);
            lightTap();
            updatePlayer(cardPlayer.id, { available: v }).catch((e: any) =>
              toast.error('No se pudo guardar', e?.message ?? ''),
            );
          }}
          onRemove={() => cardPlayer && confirmRemove(cardPlayer)}
          onOpenProfile={(userId) =>
            rootNav.navigate('PublicProfile', { type: 'user', id: userId })
          }
        />
      ) : null}
      </View>

      <PlayerCardSheet
        player={wide ? null : cardPlayer}
        teamName={team?.name ?? 'Equipo'}
        canManage={canManage}
        isCaptainRow={!!cardPlayer?.user_id && captainIds.has(cardPlayer.user_id)}
        myPlayerId={myPlayerId}
        bundle={bundle}
        bundleLoading={bundleLoading}
        onClose={() => setCardId(null)}
        onEdit={() => {
          const p = cardPlayer;
          setCardId(null);
          if (p) setTimeout(() => setEditing(p), 320);
        }}
        onToggleAvailable={(v) => {
          if (!cardPlayer) return;
          if (!canManage) return void toggleMe(v);
          lightTap();
          updatePlayer(cardPlayer.id, { available: v }).catch((e: any) =>
            toast.error('No se pudo guardar', e?.message ?? ''),
          );
        }}
        onRemove={() => cardPlayer && confirmRemove(cardPlayer)}
        onOpenProfile={(userId) => {
          setCardId(null);
          rootNav.navigate('PublicProfile', { type: 'user', id: userId });
        }}
      />

      <RosterMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        roster={rosterMenu}
        team={teamMenu}
      />

      <TeamSwitchSheet
        open={switchOpen}
        onClose={() => setSwitchOpen(false)}
        onJoin={() => setRedeemOpen(true)}
      />
      <RedeemInvitationSheet open={redeemOpen} onClose={() => setRedeemOpen(false)} />

      {team && isFcpTeam ? (
        <FederationSheet
          open={fedOpen}
          onClose={() => setFedOpen(false)}
          teamName={team.name}
          canManage={canManage}
          inscripcion={inscripcion}
          newSeason={fcpStatus.newSeason || canPrepareSeason}
          signing={fcpStatus.signing}
          resyncing={resyncing}
          refreshing={refrescando}
          onOpenGroup={() => setGroupOpen(true)}
          onPrepareSeason={() => setSeasonOpen(true)}
          onResync={doResync}
          onRefresh={refrescarInscripcion}
        />
      ) : null}

      <EditPlayerSheet
        player={editing}
        teamId={team?.id ?? null}
        onClose={() => setEditing(null)}
        onPhotoChange={(url) => {
          if (editing) {
            // El service ya escribió photo_url en BD; sincronizamos el store.
            updatePlayer(editing.id, { photo_url: url });
            setEditing((prev) => (prev ? { ...prev, photo_url: url } : prev));
          }
        }}
        onSave={(patch) => {
          if (editing) {
            updatePlayer(editing.id, patch);
            toast.success('Jugador actualizado', editing.name);
          }
          setEditing(null);
        }}
        onInvite={() => {
          setEditing(null);
          setTimeout(openInvite, 320);
        }}
        onUnlink={() => editing && unlinkPlayer(editing)}
      />

      <AddPlayerSheet
        open={adding}
        onClose={() => setAdding(false)}
        onAdd={(data) => {
          addPlayer({ ...data, available: true })
            .then(() => toast.success('Jugador añadido', data.name))
            .catch((e: any) => {
              console.warn('addPlayer failed', e);
              toast.error('No se pudo añadir el jugador', e?.message ?? 'Inténtalo de nuevo.');
            });
          setAdding(false);
        }}
      />

      <ScanSheet
        open={scanning}
        onClose={() => setScanning(false)}
        mode="ranking"
        teamName={team?.name}
        onConfirm={handleBulkPlayers}
      />

      <ImportFcpSheet
        open={importingFcp}
        onClose={() => setImportingFcp(false)}
        onImport={handleBulkPlayers}
      />

      {team ? (
        <FcpSeasonUpdateSheet
          open={seasonOpen}
          teamId={team.id}
          teamName={team.name}
          teamGender={team.gender}
          onClose={() => setSeasonOpen(false)}
        />
      ) : null}

      {team ? (
        <FcpGroupSheet
          open={groupOpen}
          teamId={team.id}
          teamName={team.name}
          onClose={() => setGroupOpen(false)}
        />
      ) : null}

      <InvitePlayersSheet
        open={inviting}
        teamId={team?.id ?? null}
        teamName={team?.name ?? null}
        onClose={() => setInviting(false)}
      />

      <EditTeamSheet open={editingTeam} onClose={() => setEditingTeam(false)} />
    </View>
  );
};

/** Tablet: columna centrada. En el móvil no envuelve nada. */
const TabletColumn: React.FC<{ on: boolean; maxWidth: number; children: React.ReactNode }> = ({
  on,
  maxWidth,
  children,
}) => (on ? <ContentColumn maxWidth={maxWidth}>{children}</ContentColumn> : <>{children}</>);

const Kpi: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
  <View>
    <Text
      style={[
        styles.kpiValue,
        { color: highlight ? c.accent : c.text },
      ]}
    >
      {value}
    </Text>
    <Text style={styles.kpiLabel}>{label}</Text>
  </View>
  );
};

interface EditProps {
  player: Player | null;
  teamId: string | null;
  onClose: () => void;
  onSave: (patch: Partial<Player>) => void;
  /** Sin cuenta: invitarle con el enlace del equipo. */
  onInvite: () => void;
  /** Con cuenta: soltar la ficha de su cuenta (captain_unclaim_player). */
  onUnlink: () => void;
  // Notifica al padre el nuevo photo_url (o null) tras subir/quitar foto,
  // para que el store refresque sin reabrir el sheet.
  onPhotoChange: (url: string | null) => void;
}
const EditPlayerSheet: React.FC<EditProps> = ({
  player,
  teamId,
  onClose,
  onSave,
  onInvite,
  onUnlink,
  onPhotoChange,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [pts, setPts] = useState('');
  const [pos, setPos] = useState<Side>('Drive');
  const [avail, setAvail] = useState(true);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  React.useEffect(() => {
    if (player) {
      setName(player.name);
      setAlias(player.alias ?? '');
      setPts(String(player.pts));
      setPos(player.position);
      setAvail(player.available);
      setPhoto(player.photo_url ?? null);
    }
  }, [player]);

  const doUploadPhoto = async (uri: string) => {
    if (!player || !teamId) return;
    setPhotoBusy(true);
    try {
      const url = await uploadPlayerPhoto(teamId, player.id, uri);
      setPhoto(url);
      onPhotoChange(url);
      toast.success('Foto actualizada', player.name);
    } catch (e: any) {
      Alert.alert('No se pudo subir', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setPhotoBusy(false);
    }
  };

  const pickPhoto = (source: 'camera' | 'library') => async () => {
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Permiso requerido',
        source === 'camera'
          ? 'Necesitamos acceso a la cámara.'
          : 'Necesitamos acceso a tus fotos.',
      );
      return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    await doUploadPhoto(result.assets[0].uri);
  };

  const onPhotoPress = () => {
    if (photoBusy || !player || !teamId) return;
    Alert.alert('Foto del jugador', undefined, [
      { text: 'Hacer foto', onPress: pickPhoto('camera') },
      { text: 'Elegir de galería', onPress: pickPhoto('library') },
      ...(photo
        ? [
            {
              text: 'Quitar foto',
              style: 'destructive' as const,
              onPress: async () => {
                setPhotoBusy(true);
                try {
                  await removePlayerPhoto(teamId, player.id);
                  setPhoto(null);
                  onPhotoChange(null);
                } catch (e: any) {
                  Alert.alert('No se pudo quitar', e?.message ?? '');
                } finally {
                  setPhotoBusy(false);
                }
              },
            },
          ]
        : []),
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <BottomSheet
      open={player != null}
      onClose={onClose}
      footer={
        <View style={styles.sheetActions}>
          <Pressable
            disabled={!isValidName(name)}
            onPress={() =>
              onSave({
                name: normalizeName(name),
                alias: alias.trim() ? alias.trim() : null,
                pts: parsePts(pts),
                position: pos,
                available: avail,
              })
            }
            style={({ pressed }) => [
              styles.saveBtn,
              !isValidName(name) && { opacity: 0.4 },
              pressed && isValidName(name) && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.saveBtnText}>Guardar</Text>
          </Pressable>
        </View>
      }
    >
      <Text style={styles.sheetEyebrow}>EDITAR JUGADOR</Text>
      <Text style={styles.sheetTitle}>{player ? displayName(player) : ''}</Text>

      <Pressable
        onPress={onPhotoPress}
        disabled={photoBusy}
        style={({ pressed }) => [
          styles.photoPick,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.photoCircle}>
          {photoBusy ? (
            <ActivityIndicator color={c.accent} />
          ) : player?.profile_avatar_url ?? photo ? (
            <Image
              source={{ uri: (player?.profile_avatar_url ?? photo) as string }}
              style={styles.photoImg}
              resizeMode="cover"
            />
          ) : (
            <Text style={styles.photoInitials}>
              {player ? initialsOf(player) : ''}
            </Text>
          )}
        </View>
        <Text style={styles.photoPickLabel}>
          {photo ? 'Cambiar foto' : 'Añadir foto'}
        </Text>
      </Pressable>

      <FormRow label="NOMBRE Y APELLIDOS">
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX_LENGTH}
          autoCapitalize="words"
          placeholder="Nombre y apellidos"
          style={styles.sheetInput}
          placeholderTextColor={c.textFaint}
        />
      </FormRow>
      <FormRow label="ALIAS · OPCIONAL">
        <TextInput
          value={alias}
          onChangeText={setAlias}
          maxLength={40}
          autoCapitalize="words"
          placeholder="Cómo le llamáis en el equipo"
          style={styles.sheetInput}
          placeholderTextColor={c.textFaint}
        />
      </FormRow>
      <FormRow label="PUNTOS DE LA FEDERACIÓN">
        <TextInput
          value={pts}
          onChangeText={(v) => setPts(sanitizePtsInput(v))}
          keyboardType="number-pad"
          maxLength={5}
          style={[styles.sheetInput, { fontFamily: Fonts.mono }]}
          placeholderTextColor={c.textFaint}
        />
      </FormRow>
      <FormRow label="POSICIÓN">
        <View style={styles.posRow}>
          {SIDES.map((p) => {
            const sel = pos === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPos(p)}
                style={[
                  styles.posBtn,
                  sel && { backgroundColor: c.accent, borderColor: c.accent },
                ]}
              >
                <Text
                  style={[
                    styles.posBtnText,
                    { color: sel ? '#000' : c.text },
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FormRow>
      {player && !player.user_id ? (
        <Pressable
          onPress={onInvite}
          accessibilityRole="button"
          style={({ pressed }) => [styles.accountCard, pressed && { opacity: 0.85 }]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.accountTitle}>Todavía no está en TACTIUM</Text>
            <Text style={styles.accountText}>
              Mándale el enlace y su ficha queda unida a su cuenta
            </Text>
          </View>
          <Text style={styles.accountLink}>Invitar ›</Text>
        </Pressable>
      ) : player?.user_id ? (
        <Pressable
          onPress={onUnlink}
          accessibilityRole="button"
          hitSlop={6}
          style={({ pressed }) => [styles.unlink, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.unlinkText}>Desvincular de su cuenta</Text>
        </Pressable>
      ) : null}
    </BottomSheet>
  );
};

interface AddProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: {
    name: string;
    pts: number;
    position: Side;
    alias?: string | null;
  }) => void;
}
const AddPlayerSheet: React.FC<AddProps> = ({ open, onClose, onAdd }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [name, setName] = useState('');
  const [alias, setAlias] = useState('');
  const [pts, setPts] = useState('300');
  const [pos, setPos] = useState<Side>('Drive');

  React.useEffect(() => {
    if (open) {
      setName('');
      setAlias('');
      setPts('300');
      setPos('Drive');
    }
  }, [open]);

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <Pressable
          disabled={!isValidName(name)}
          onPress={() =>
            onAdd({
              name: normalizeName(name),
              alias: alias.trim() ? alias.trim() : null,
              pts: parsePts(pts),
              position: pos,
            })
          }
          style={({ pressed }) => [
            styles.saveBtnFull,
            !isValidName(name) && { opacity: 0.4 },
            pressed && isValidName(name) && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.saveBtnText}>Añadir al equipo</Text>
        </Pressable>
      }
    >
      <Text style={styles.sheetEyebrow}>NUEVO</Text>
      <Text style={styles.sheetTitle}>Añadir jugador</Text>

      <FormRow label="NOMBRE">
        <TextInput
          value={name}
          onChangeText={setName}
          autoFocus
          maxLength={NAME_MAX_LENGTH}
          autoCapitalize="words"
          placeholder="Nombre y apellidos"
          style={styles.sheetInput}
          placeholderTextColor={c.textFaint}
        />
      </FormRow>
      <FormRow label="ALIAS · OPCIONAL">
        <TextInput
          value={alias}
          onChangeText={setAlias}
          maxLength={40}
          autoCapitalize="words"
          placeholder="Cómo le llamáis en el equipo"
          style={styles.sheetInput}
          placeholderTextColor={c.textFaint}
        />
      </FormRow>
      <FormRow label="PUNTOS DE LA FEDERACIÓN">
        <TextInput
          value={pts}
          onChangeText={(v) => setPts(sanitizePtsInput(v))}
          keyboardType="number-pad"
          maxLength={5}
          style={[styles.sheetInput, { fontFamily: Fonts.mono }]}
        />
      </FormRow>
      <FormRow label="POSICIÓN">
        <View style={styles.posRow}>
          {SIDES.map((p) => {
            const sel = pos === p;
            return (
              <Pressable
                key={p}
                onPress={() => setPos(p)}
                style={[
                  styles.posBtn,
                  sel && { backgroundColor: c.accent, borderColor: c.accent },
                ]}
              >
                <Text
                  style={[
                    styles.posBtnText,
                    { color: sel ? '#000' : c.text },
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </FormRow>
    </BottomSheet>
  );
};

const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
  <View style={{ marginBottom: 14 }}>
    <Text style={styles.formLabel}>{label}</Text>
    {children}
  </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  // ── Tablet ──
  tBody: { flex: 1, flexDirection: 'row' },
  tBodyPhone: { flex: 1 },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tHeadRow: { borderBottomWidth: 1, borderBottomColor: c.hair, paddingVertical: 8 },
  tHeadText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    color: c.textFaint,
  },
  tCellNum: { width: 26 },
  tCellName: { flex: 1, minWidth: 0 },
  tNameWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tCellPos: { width: 84 },
  tCellPts: { width: 64 },
  tCellApp: { width: 76, alignItems: 'flex-start' },
  tCellRsvp: { width: 54 },
  tApp: { fontSize: 12, fontWeight: '700' },
  tRsvp: { fontFamily: Fonts.mono, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  tPairBarWrap: { width: 150, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tPairBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.bgCard2,
    overflow: 'hidden',
  },
  tPairFill: { height: 6, borderRadius: 3, backgroundColor: c.accent },
  tPairPct: { width: 34, textAlign: 'right', fontFamily: Fonts.mono, fontSize: 11, color: c.textMuted },
  root: { flex: 1, backgroundColor: c.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    flexShrink: 1,
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: c.accent,
    fontWeight: '500',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fcpBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scanBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBtnIcon: { fontSize: 14 },
  scanBtnLabel: {
    color: c.text,
    fontSize: 13,
    fontWeight: '500',
  },
  intro: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  title: {
    flexShrink: 1,
    color: c.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  teamMeta: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 0.5,
    color: c.textMuted,
    marginTop: 4,
  },
  kpis: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: c.hair,
  },
  kpiSep: {
    width: 1,
    backgroundColor: c.hair,
  },
  kpiValue: {
    fontFamily: Fonts.mono,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 24,
  },
  kpiLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: c.textFaint,
    letterSpacing: 1.5,
    marginTop: 6,
    textTransform: 'uppercase',
  },
  fcpNotice: {
    marginHorizontal: 20,
    marginTop: 14,
    padding: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.accent40,
    backgroundColor: c.accent10,
  },
  // La tarjeta de inscripcion lleva mas texto que los otros dos avisos —dos
  // parrafos y una lista desplegable— asi que respira con su propio aire en
  // vez de engordar la clase que comparten los tres.
  inscripCard: { padding: 18, marginTop: 16, marginBottom: 6 },
  inscripCardTitle: { fontSize: 15, marginBottom: 2 },
  inscripCardText: { fontSize: 13, lineHeight: 20, marginTop: 10 },
  fcpNoticeTitle: { color: c.text, fontSize: 14, fontWeight: '800' },
  fcpNoticeText: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 5 },
  fcpNoticeRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12 },
  fcpNoticeBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: c.accent,
    minWidth: 150,
    alignItems: 'center',
  },
  fcpNoticeBtnText: { color: c.textInverse, fontSize: 13, fontWeight: '800' },
  fcpNoticeSkip: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
  fcpNoticeAlt: { color: c.accent, fontSize: 13, fontWeight: '700' },
  // Plantilla inscrita para la temporada que viene. Fila estrecha a
  // proposito: es una lista de consulta, no algo que se edite aqui.
  inscripRosterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  inscripRosterNum: {
    color: c.textFaint,
    fontSize: 11,
    width: 18,
    textAlign: 'center',
  },
  inscripRosterName: { flex: 1, minWidth: 0, color: c.text, fontSize: 13.5 },
  inscripRosterPts: { color: c.accent, fontSize: 13, fontWeight: '700' },
  searchWrap: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  search: {
    marginTop: 14,
    marginBottom: 10,
    height: 38,
    borderRadius: 11,
    paddingHorizontal: 12,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: c.text,
    fontSize: 14,
    paddingVertical: 0,
  },
  scroll: {
    paddingHorizontal: 20,
  },
  list: {
    marginTop: 12,
    backgroundColor: c.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowDividerInline: {
    borderBottomWidth: 1,
    borderColor: c.hair,
  },
  rank: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // El recuadro verde oscuro se mantiene SOLO en modo oscuro; en claro el
  // número va sin encuadrar (solo el verde del texto) para no cargar tanto.
  rankBoxDark: {
    backgroundColor: c.primaryDim,
  },
  rankText: {
    width: 20,
    color: c.textFaint,
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
  },
  rowAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: c.accent15,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowAvatarImg: {
    width: 34,
    height: 34,
  },
  rowAvatarInitials: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: c.accent,
  },
  rowNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowName: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  bajaBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(242,201,76,0.18)',
  },
  bajaBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: c.warning,
    letterSpacing: 0.5,
  },
  rowMeta: {
    color: c.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  ptsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hair,
  },
  ptsPillText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    letterSpacing: 0.4,
  },
  empty: {
    paddingVertical: 30,
    color: c.textFaint,
    textAlign: 'center',
    fontSize: 13,
  },
  emptyState: {
    paddingVertical: 36,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    maxWidth: 280,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptyCtaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: c.accent,
  },
  emptyCtaPrimaryLabel: {
    color: c.textInverse,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  emptyCtaSecondary: {
    paddingHorizontal: 16,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaSecondaryLabel: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  sheetEyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  sheetTitle: {
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 12,
  },
  photoPick: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  photoCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: c.accent15,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoImg: {
    width: 84,
    height: 84,
  },
  photoInitials: {
    fontFamily: Fonts.mono,
    fontSize: 26,
    fontWeight: '700',
    color: c.accent,
  },
  photoPickLabel: {
    color: c.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  formLabel: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 2,
    paddingLeft: 4,
    marginBottom: 6,
  },
  sheetInput: {
    width: '100%',
    height: 46,
    borderRadius: 11,
    paddingHorizontal: 14,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
  },
  posRow: {
    flexDirection: 'row',
    gap: 6,
  },
  posBtn: {
    flex: 1,
    height: 44,
    borderRadius: 11,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  posBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  availRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: c.bgCard,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: c.hairStrong,
  },
  availLabel: {
    fontSize: 14,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  removeBtn: {
    flex: 1,
    height: 50,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: c.error,
    fontSize: 14,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 2,
    height: 50,
    borderRadius: 13,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.accent,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  saveBtnFull: {
    height: 52,
    marginTop: 8,
    borderRadius: 13,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.accent,
    shadowOpacity: 0.4,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  saveBtnText: {
    color: '#001810',
    fontSize: 15,
    fontWeight: '700',
  },
  // ── Rediseño 2026-10 ─────────────────────────────────────────────
  crestRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  titleChev: { color: c.textMuted, fontSize: 18, marginLeft: 2 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  btnAccent: { backgroundColor: c.accent },
  btnAccentText: { color: c.textInverse, fontSize: 14.5, fontWeight: '700' },
  btnGhost: { backgroundColor: c.bgCard, borderWidth: 1, borderColor: c.hairStrong },
  btnGhostText: { color: c.text, fontSize: 14.5, fontWeight: '700' },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.accent40,
    backgroundColor: c.accent10,
  },
  noticeMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 14,
    paddingVertical: 11,
  },
  noticeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent },
  noticeTitle: { color: c.text, fontSize: 13.5, fontWeight: '700' },
  noticeSub: { color: c.textMuted, fontSize: 12, marginTop: 1 },
  noticeLink: { color: c.accent, fontSize: 13, fontWeight: '700' },
  noticeClose: { paddingHorizontal: 14, paddingVertical: 14 },
  inscCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hairStrong,
    backgroundColor: c.bgCard,
  },
  inscEyebrow: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 9.5, letterSpacing: 1.6 },
  inscChip: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  inscChipOk: { color: c.accent, backgroundColor: c.accent10 },
  inscChipWarn: { color: c.warning, backgroundColor: c.warning + '22' },
  inscTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  inscSub: { color: c.textMuted, fontSize: 12 },
  sectionLabel: {
    color: c.textFaint,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
  },
  meCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.accent40,
  },
  meMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  meToggle: { alignItems: 'flex-end', gap: 4 },
  meToggleText: { color: c.accent, fontSize: 11.5, fontWeight: '700' },
  meHint: { color: c.textFaint, fontSize: 12, lineHeight: 17, marginTop: 8 },
  emptyCard: {
    marginTop: 18,
    padding: 18,
    borderRadius: 16,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  emptyEyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
    marginBottom: 6,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.hairStrong,
    overflow: 'hidden',
    marginTop: 16,
  },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: c.accent },
  progressText: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, marginTop: 6 },
  emptyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard2,
    borderWidth: 1,
    borderColor: c.hairStrong,
  },
  emptyGlyph: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGlyphText: { color: c.accent, fontSize: 15, fontWeight: '700' },
  emptyActionTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  emptyActionSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  emptyLink: { color: c.accent, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 14,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  goalText: { color: c.text, fontSize: 13.5, fontWeight: '700' },
  goalLink: { color: c.accent, fontSize: 13, fontWeight: '700' },
  noMatch: { paddingVertical: 26, paddingHorizontal: 18, alignItems: 'center' },
  pairsLede: { color: c.textFaint, fontSize: 12, marginTop: 14, marginBottom: 8 },
  pairRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  pairScore: { fontFamily: Fonts.mono, fontSize: 15, fontWeight: '700' },
  dot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.bgCard,
  },
  capBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: c.accent15,
  },
  capBadgeText: { fontFamily: Fonts.mono, fontSize: 9, color: c.accent, letterSpacing: 0.5 },
  rowInvite: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.accent40,
  },
  rowInviteText: { color: c.accent, fontSize: 12, fontWeight: '700' },
  ptsText: { fontFamily: Fonts.mono, color: c.text, fontSize: 14, fontWeight: '700' },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginTop: 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.accent40,
    backgroundColor: c.accent10,
  },
  accountTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  accountText: { color: c.textMuted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
  accountLink: { color: c.accent, fontSize: 13, fontWeight: '700' },
  unlink: { alignSelf: 'center', marginTop: 8, paddingVertical: 6 },
  unlinkText: { color: c.error, fontSize: 13.5, fontWeight: '700' },
});
