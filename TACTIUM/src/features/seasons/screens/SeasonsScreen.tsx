import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { useColors, darkColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  IconPlus,
  IconChevron,
  IconCamera,
  NeonDot,
  BottomSheet,
} from '@components/ui';
import * as SeasonsApi from '@core/services/seasons';
import * as MatchdaysApi from '@core/services/matchdays';
import type * as TeamsApi from '@core/services/teams';
import { importFcpSeason } from '@core/services/fcpSeason';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import {
  fetchLeagueStatsBundle,
  computePlayerLeagueStats,
  type PlayerLeagueStats,
} from '@core/services/playerStats';
import { matchdayState } from '@core/utils/matchday';
import { useMatchdayAvailability } from '@core/hooks/useMatchdayAvailability';
import { useTeamStore, selectIsCaptain } from '@store/teamStore';
import { toast } from '@store/toastStore';
import { usePremiumGate } from '@core/hooks/usePremiumGate';
import { zoneColor } from '@core/data/fcpZones';
import {
  useFcpStanding,
  loadFcpStanding,
  fetchSeasonsBalance,
  fmtMatchLine,
  phaseLabel,
  playedChrono,
  pickNextMatchday,
  shortGroupName,
  CountUp,
  ScoreChip,
  ActionRow,
  Glyph,
  type SeasonBalance,
} from '../components/ligaParts';

import { FcpStandings } from '../components/FcpStandings';
import { useLayout } from '@components/ui/ResponsiveFrame';
import { ContentColumn, useIsSplit } from '@components/layout';

import type { CompetirStackScreenProps } from '@navigation/types';

/**
 * Competir › Liga. La temporada activa se lee como un marcador (puesto y zona
 * de la Federación, próxima jornada con la disponibilidad y la racha con su
 * resultado). Sin temporada, el capitán tiene los tres caminos que ya existen
 * (volcado de la Federación, escáner y alta a mano); el jugador, el aviso y el
 * salto a Federación. El histórico lleva el balance de cada temporada.
 */
export const SeasonsScreen = ({
  navigation,
}: CompetirStackScreenProps<'CompetirRoot'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const team = useTeamStore((s) => s.team);
  // Competir › Liga es la misma para capitán y jugador. El JUGADOR solo
  // consulta: sin crear temporadas (ni jornadas, que gatea SeasonDetail).
  const canManage = useTeamStore(selectIsCaptain);
  const myPlayerId = useTeamStore((s) => s.myPlayerId);
  const gate = usePremiumGate();
  const isFcp = team?.federation === FCP_FEDERATION_CODE;

  const [seasons, setSeasons] = useState<SeasonsApi.Season[]>([]);
  const [activeMatchdays, setActiveMatchdays] = useState<MatchdaysApi.Matchday[]>([]);
  const [balances, setBalances] = useState<Record<string, SeasonBalance>>({});
  const [loading, setLoading] = useState(true);
  // Hoja de alta: `then` decide qué pasa al crearla (abrir el escáner en el
  // detalle, o nada).
  const [creating, setCreating] = useState<null | { then?: 'scan' }>(null);
  const [importing, setImporting] = useState(false);
  // Marcamos cuando la última carga falló para mostrar empty-state con
  // botón "Reintentar" en lugar de pintar como si no hubiera temporadas
  // (que es semánticamente distinto).
  const [loadError, setLoadError] = useState(false);

  // Los tres caminos pasan por el mismo paywall que el alta de siempre.
  const startCreating = gate(() => setCreating({}), 'season_create');
  const startScan = gate(() => setCreating({ then: 'scan' }), 'season_create');

  const didLoadRef = useRef(false);
  const reload = React.useCallback(async () => {
    if (!team) return;
    if (!didLoadRef.current) setLoading(true);
    setLoadError(false);
    try {
      const list = await SeasonsApi.fetchSeasons(team.id);
      setSeasons(list);
      const act = list.find((s) => s.active);
      const [mds, bal] = await Promise.all([
        act ? MatchdaysApi.fetchMatchdays(act.id) : Promise.resolve([] as MatchdaysApi.Matchday[]),
        fetchSeasonsBalance(list.filter((s) => !s.active).map((s) => s.id)).catch(
          () => ({}) as Record<string, SeasonBalance>,
        ),
      ]);
      setActiveMatchdays(mds);
      setBalances(bal);
    } catch (e: any) {
      console.warn('fetchSeasons', e);
      setLoadError(true);
      toast.error(
        'No se pudieron cargar las temporadas',
        e?.message ?? 'Comprueba tu conexión.',
      );
    } finally {
      didLoadRef.current = true;
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    didLoadRef.current = false;
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Scroll-to-top al pulsar la pestaña activa + al recuperar el foco
  // desde otra pantalla (tab o stack nested).
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

  const active = seasons.find((s) => s.active) ?? null;
  const past = seasons.filter((s) => !s.active);

  // «Traer de la Federación»: el mismo volcado que «Mi grupo» en Equipo.
  const importFromFederation = gate(async () => {
    if (!team || importing) return;
    setImporting(true);
    try {
      const st = await loadFcpStanding(team.id);
      if (st.idEquipo == null) {
        toast.error('Tu equipo no está vinculado', 'Vincúlalo a la Federación desde Equipo.');
        return;
      }
      const res = await importFcpSeason(team.id, st.idEquipo, 'Liga Cántabra');
      toast.success(
        res.new_season ? 'Temporada nueva creada' : 'Temporada volcada',
        `${res.created} jornadas creadas${res.updated ? ` · ${res.updated} actualizadas` : ''}.`,
      );
      await reload();
      if (res.season_id) navigation.navigate('SeasonDetail', { id: res.season_id });
    } catch (e: any) {
      toast.error('No se pudo traer la temporada', e?.message ?? '');
    } finally {
      setImporting(false);
    }
  }, 'season_create');

  const activeBlock = active ? (
              <>
                <ActiveSeasonScoreboard
                  season={active}
                  team={team}
                  matchdays={activeMatchdays}
                  canManage={canManage}
                  myPlayerId={myPlayerId}
                  onOpen={() => navigation.navigate('SeasonDetail', { id: active.id })}
                  onAvailability={(matchdayId) =>
                    navigation.navigate('Availability', { matchdayId })
                  }
                  onStandings={(idGrupo, nombre) =>
                    idGrupo
                      ? navigation.navigate('FcpGroup', { idGrupo, nombre: nombre ?? undefined })
                      : navigation.navigate('SeasonDetail', { id: active.id })
                  }
                />
                {!canManage && myPlayerId ? (
                  <MySeasonCard seasonId={active.id} playerId={myPlayerId} />
                ) : null}
              </>
  ) : null;

  const pastBlock =
    past.length > 0 ? (
              <>
                <View style={styles.histHeader}>
                  <Text style={styles.histLabel}>HISTÓRICO · {past.length}</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {past.map((s) => (
                    <PastSeasonCard
                      key={s.id}
                      season={s}
                      team={team}
                      balance={balances[s.id]}
                      onPress={() => navigation.navigate('SeasonDetail', { id: s.id })}
                    />
                  ))}
                </View>
              </>
    ) : null;

  // Tablet horizontal (liga federada con temporada en marcha): el marcador de
  // la temporada a la izquierda y la clasificación del grupo a la derecha.
  const { isTablet } = useLayout();
  const twoCol =
    useIsSplit(340, 420) && isFcp && !!active && activeMatchdays.length > 0 && !loading && !!team;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow} numberOfLines={1}>
          {team
            ? [team.name.toUpperCase(), team.category].filter(Boolean).join(' · ')
            : 'TEMPORADAS'}
        </Text>
        {canManage && active ? (
          <Pressable
            onPress={startCreating}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Crear temporada"
            style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
          >
            <IconPlus size={16} color={c.accent} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          // Reserva el alto del tab bar flotante (~64) + offset (12) + colchón (32)
          // para que el último item no quede pegado al pill cristal.
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
          isTablet && { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {twoCol && team ? (
          <View style={styles.twoCol}>
            <View style={styles.twoColLeft}>
              {activeBlock}
              {pastBlock}
            </View>
            <View style={styles.twoColRight}>
              <Text style={styles.histLabel}>CLASIFICACIÓN</Text>
              <FcpStandings
                teamId={team.id}
                onTeamPress={(idEquipo, teamName) =>
                  navigation.navigate('FcpTeam', { idEquipo, name: teamName })
                }
              />
            </View>
          </View>
        ) : (
        <TabletColumn on={isTablet}>
        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : loadError && seasons.length === 0 ? (
          // Fallo en la primera carga (sin caché previa) — distinguimos del
          // empty-state "Sin temporadas" para dejar claro que es un error
          // de red, no que no haya datos.
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No se pudieron cargar</Text>
            <Text style={styles.emptyText}>
              Comprueba tu conexión y vuelve a intentarlo.
            </Text>
            <Pressable
              onPress={reload}
              style={({ pressed }) => [
                styles.emptyCta,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reintentar cargar temporadas"
            >
              <Text style={styles.emptyCtaLabel}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {active ? (
              activeBlock
            ) : canManage ? (
              <StartSeasonPaths
                isFcp={isFcp}
                importing={importing}
                onImport={importFromFederation}
                onScan={startScan}
                onManual={startCreating}
              />
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>
                  Tu capitán aún no ha empezado la temporada
                </Text>
                <Text style={styles.emptyText}>
                  Cuando la cree, aquí verás tu próxima jornada, el puesto y la
                  racha. Mientras, mira la Federación.
                </Text>
                <Pressable
                  onPress={() => navigation.navigate('Federacion')}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.fedLink, pressed && { opacity: 0.85 }]}
                >
                  <View style={styles.fedLinkTile}>
                    <Text style={styles.fedLinkTileText}>FCP</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.fedLinkTitle}>Mira la Federación</Text>
                    <Text style={styles.fedLinkSub}>Clasificaciones, equipos y jugadores</Text>
                  </View>
                  <IconChevron size={14} color={c.textFaint} />
                </Pressable>
              </View>
            )}

            {pastBlock}
          </>
        )}
        </TabletColumn>
        )}
      </ScrollView>

      <CreateSeasonSheet
        open={!!creating}
        onClose={() => setCreating(null)}
        onCreated={(season) => {
          const then = creating?.then;
          setCreating(null);
          reload();
          if (then === 'scan' && season) {
            navigation.navigate('SeasonDetail', {
              id: season.id,
              autoOpen: 'scan',
              nonce: Date.now(),
            });
          }
        }}
      />
    </View>
  );
};

/** Tablet: columna centrada de 720. En el móvil no envuelve nada. */
const TabletColumn: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) =>
  on ? <ContentColumn>{children}</ContentColumn> : <>{children}</>;

// Mapping de fase a etiqueta compacta (badge cuadrado del histórico).
function phaseShortLabel(phase: SeasonsApi.SeasonPhase): string {
  if (phase === 'mixto') return 'L+P';
  if (phase === 'playoff') return 'P';
  return 'L';
}

// ─── Marcador de la temporada activa ─────────────────────────────────────────

const ActiveSeasonScoreboard: React.FC<{
  season: SeasonsApi.Season;
  team: TeamsApi.Team | null;
  matchdays: MatchdaysApi.Matchday[];
  canManage: boolean;
  myPlayerId: string | null;
  onOpen: () => void;
  onAvailability: (matchdayId: string) => void;
  onStandings: (idGrupo: string | null, nombre: string | null) => void;
}> = ({ season, team, matchdays, canManage, myPlayerId, onOpen, onAvailability, onStandings }) => {
  // Tarjeta destacada de degradado verde: se mantiene SIEMPRE oscura (con
  // texto claro) también en modo claro, para no perder el look y que el
  // texto se lea sobre el verde. Paleta oscura fija en todo su subárbol.
  const c = darkColors;
  const styles = useMemo(() => makeStyles(c), [c]);
  const isFcp = team?.federation === FCP_FEDERATION_CODE;
  const { data: standing } = useFcpStanding(team?.id, isFcp);

  const wins = matchdays.filter((m) => m.outcome === 'win').length;
  const draws = matchdays.filter((m) => m.outcome === 'draw').length;
  const losses = matchdays.filter((m) => m.outcome === 'loss').length;
  const played = wins + draws + losses;
  const total = season.total_matchdays ?? matchdays.length;
  const last5 = playedChrono(matchdays).slice(-5);
  const next = useMemo(
    () => pickNextMatchday(matchdays, (m) => matchdayState(m) === 'upcoming'),
    [matchdays],
  );
  const avail = useMatchdayAvailability(next?.id ?? null);
  const myStatus = myPlayerId ? avail.map[myPlayerId]?.status : undefined;

  const me = standing.me;
  const zone = standing.zone;
  const meta = [team?.name, shortGroupName(standing.grupo) ?? team?.category]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Abrir ${season.name}`}
      style={({ pressed }) => [styles.activeCard, pressed && { opacity: 0.96 }]}
    >
      <LinearGradient
        colors={[c.primary, c.bgCard2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.activeRow}>
        <NeonDot size={6} />
        <Text style={styles.activeBadge}>ACTIVA · {phaseLabel(season.phase)}</Text>
      </View>
      <Text style={styles.activeName}>{season.name}</Text>
      {meta ? (
        <Text style={styles.activeMeta} numberOfLines={1}>
          {meta}
        </Text>
      ) : null}

      {/* Puesto (de la Federación) + balance. Sin equipo vinculado, el puesto
          no se pinta. */}
      <View style={styles.sbRow}>
        {me?.posicion != null ? (
          <View style={styles.sbPos}>
            {zone ? (
              <Text style={[styles.zoneTag, { color: zoneColor(zone.key, c) }]} numberOfLines={1}>
                {zone.label.toUpperCase()}
              </Text>
            ) : null}
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
              <CountUp value={me.posicion} suffix="º" style={styles.sbPosNum} />
              <Text style={styles.sbPosOf}>DE {standing.rows.length}</Text>
            </View>
          </View>
        ) : null}
        <View style={styles.sbStats}>
          <SbCell styles={styles} value={`${played}/${total || '—'}`} label="JORN." />
          <SbCell styles={styles} value={String(wins)} label="V" color={c.accent} />
          <SbCell styles={styles} value={String(draws)} label="E" />
          <SbCell styles={styles} value={String(losses)} label="D" color={c.error} />
        </View>
      </View>

      {/* Próxima jornada */}
      {next ? (
        <View style={styles.nextRow}>
          <View style={styles.nextBadge}>
            <Text style={styles.nextBadgeText}>
              J{String(next.jornada_number).padStart(2, '0')}
            </Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.nextRival} numberOfLines={1}>
              vs {next.opponent}
            </Text>
            <Text style={styles.nextMeta} numberOfLines={1}>
              {fmtMatchLine(next)}
            </Text>
          </View>
          {canManage ? (
            avail.counts.total > 0 ? (
              <Pressable
                onPress={() => onAvailability(next.id)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${avail.counts.yes} de ${avail.counts.total} van. Abrir disponibilidad`}
                style={styles.availPill}
              >
                <Text style={styles.availPillText}>
                  {avail.counts.yes}/{avail.counts.total} van
                </Text>
              </Pressable>
            ) : null
          ) : myPlayerId ? (
            <Pressable
              onPress={() => onAvailability(next.id)}
              hitSlop={6}
              accessibilityRole="button"
              style={[styles.availPill, !myStatus && styles.availPillAsk]}
            >
              <Text style={[styles.availPillText, !myStatus && { color: c.textInverse }]}>
                {myStatus === 'yes'
                  ? 'Tú: Voy'
                  : myStatus === 'maybe'
                  ? 'Tú: Duda'
                  : myStatus === 'no'
                  ? 'Tú: No'
                  : '¿Puedes jugar?'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Racha con resultado + clasificación */}
      {last5.length > 0 || standing.idGrupo ? (
        <View style={styles.streakRow}>
          <View style={{ flexDirection: 'row', gap: 6, flexShrink: 1 }}>
            {last5.map((m, i) => (
              <ScoreChip key={m.id} matchday={m} index={i} palette={c} />
            ))}
          </View>
          {standing.idGrupo ? (
            <Pressable
              onPress={() => onStandings(standing.idGrupo, standing.grupo)}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={styles.streakLink}>Clasificación ›</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
};

const SbCell: React.FC<{
  styles: ReturnType<typeof makeStyles>;
  value: string;
  label: string;
  color?: string;
}> = ({ styles, value, label, color }) => (
  <View style={styles.sbCell}>
    <Text style={[styles.sbCellNum, color ? { color } : null]}>{value}</Text>
    <Text style={styles.sbCellLabel}>{label}</Text>
  </View>
);

// ─── «Tu temporada» (jugador) ─────────────────────────────────────────────────

const MySeasonCard: React.FC<{ seasonId: string; playerId: string }> = ({ seasonId, playerId }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [stats, setStats] = useState<PlayerLeagueStats | null>(null);
  useEffect(() => {
    let alive = true;
    fetchLeagueStatsBundle([seasonId])
      .then((b) => alive && setStats(computePlayerLeagueStats(playerId, b)))
      .catch(() => alive && setStats(null));
    return () => {
      alive = false;
    };
  }, [seasonId, playerId]);
  if (!stats) return null;
  // La pareja MÁS REPETIDA (no la de mejor porcentaje).
  const partner = [...stats.partners].sort((a, b) => b.played - a.played)[0];
  const surname = partner ? partner.name.trim().split(/\s+/).slice(-1)[0] : '—';
  return (
    <View style={styles.mineCard}>
      <Text style={styles.mineLabel}>TU TEMPORADA</Text>
      <View style={styles.mineRow}>
        <View style={styles.mineCell}>
          <Text style={styles.mineNum}>{stats.played}</Text>
          <Text style={styles.mineCellLabel}>JUGADOS</Text>
        </View>
        <View style={styles.mineCell}>
          <Text style={[styles.mineNum, { color: c.accent }]}>{stats.won}</Text>
          <Text style={styles.mineCellLabel}>GANADOS</Text>
        </View>
        <View style={[styles.mineCell, { flex: 1.4 }]}>
          <Text style={styles.mineName} numberOfLines={1}>
            {surname}
          </Text>
          <Text style={styles.mineCellLabel}>TU PAREJA</Text>
        </View>
      </View>
    </View>
  );
};

// ─── Sin temporada activa (capitán): tres caminos ─────────────────────────────

const StartSeasonPaths: React.FC<{
  isFcp: boolean;
  importing: boolean;
  onImport: () => void;
  onScan: () => void;
  onManual: () => void;
}> = ({ isFcp, importing, onImport, onScan, onManual }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  // La temporada de pádel va de septiembre a junio: «26/27» desde julio.
  const now = new Date();
  const yr = now.getFullYear();
  const from = now.getMonth() >= 6 ? yr : yr - 1;
  const label = `${String(from).slice(2)}/${String(from + 1).slice(2)}`;
  return (
    <View style={styles.pathsCard}>
      <Text style={styles.pathsTitle}>Empieza la temporada {label}</Text>
      <Text style={styles.pathsText}>
        {isFcp
          ? 'Tu equipo está en la Federación Cántabra: podemos traer el calendario con las jornadas, las fechas y los rivales.'
          : 'Elige cómo cargar el calendario de tu liga.'}
      </Text>
      <View style={{ marginTop: 8 }}>
        {isFcp ? (
          <ActionRow
            glyph={importing ? <ActivityIndicator size="small" color={c.accent} /> : <Glyph ch="↓" />}
            title="Traer de la Federación"
            sub="Calendario, rivales y clasificación"
            onPress={onImport}
            disabled={importing}
          />
        ) : null}
        <ActionRow
          glyph={<IconCamera size={16} color={c.accent} />}
          title="Escanear el calendario"
          sub="Foto del PDF o de la tabla"
          onPress={onScan}
        />
        <ActionRow
          glyph={<IconPlus size={16} color={c.accent} />}
          title="Crear a mano"
          sub="Nombre, formato y nº de jornadas"
          onPress={onManual}
          last
        />
      </View>
    </View>
  );
};

// ─── Histórico ───────────────────────────────────────────────────────────────

const PastSeasonCard: React.FC<{
  season: SeasonsApi.Season;
  team: TeamsApi.Team | null;
  balance?: SeasonBalance;
  onPress: () => void;
}> = ({ season, team, balance, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const line =
    balance && balance.total > 0
      ? [team?.category, `${balance.w}-${balance.d}-${balance.l}`].filter(Boolean).join(' · ')
      : team?.category ?? 'Sin jornadas';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pastCard, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.pastBadge}>
        <Text style={styles.pastBadgeText}>{phaseShortLabel(season.phase)}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.pastName}>{season.name}</Text>
        <Text style={styles.pastMeta} numberOfLines={1}>
          {line}
        </Text>
      </View>
      <IconChevron size={14} color={c.textFaint} />
    </Pressable>
  );
};

const PHASE_OPTIONS: { id: SeasonsApi.SeasonPhase; label: string; sub: string }[] = [
  { id: 'liga', label: 'Liga regular', sub: 'Jornadas en orden' },
  { id: 'playoff', label: 'Playoff', sub: 'Eliminatorias' },
  { id: 'mixto', label: 'Liga + Playoff', sub: 'Formato completo' },
];

const CreateSeasonSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: (season: SeasonsApi.Season | null) => void;
}> = ({ open, onClose, onCreated }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const team = useTeamStore((s) => s.team);
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<SeasonsApi.SeasonPhase>('liga');
  // Número de jornadas: vacío por defecto. El capitán lo introduce
  // explícito; algunas ligas son 14, otras 18, otras 22 o lo que sea.
  const [matchdaysStr, setMatchdaysStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      const yr = new Date().getFullYear();
      setName(`Temporada ${String(yr).slice(2)}/${String(yr + 1).slice(2)}`);
      setPhase('liga');
      setMatchdaysStr('');
      // Reset del flag de submitting: el sheet vive permanentemente
      // montado (controlado por `open`), por lo que un submitting=true
      // del cierre anterior persistía al reabrir y dejaba el spinner
      // girando indefinidamente. Reset al abrir = estado limpio.
      setSubmitting(false);
    }
  }, [open]);

  // Parse + validación del número de jornadas. AHORA OPCIONAL — si está
  // vacío se crea la temporada sin total (null en BD). Si se rellena,
  // tiene que ser un entero entre 1 y 99.
  const matchdaysNum =
    matchdaysStr.trim() === '' ? null : Number(matchdaysStr);
  const matchdaysValid =
    matchdaysStr.trim() === '' ||
    (matchdaysNum !== null &&
      Number.isFinite(matchdaysNum) &&
      matchdaysNum >= 1 &&
      matchdaysNum <= 99);

  const canSubmit = !!team && name.trim().length > 0 && matchdaysValid;

  // Helper: insert seasons + manejo de respuesta. Encapsulado para reusar
  // en el flow normal y en el "cerrar previa + reintentar".
  const performInsert = async () => {
    return SeasonsApi.createSeason(team!.id, {
      name: name.trim(),
      category: team!.category ?? undefined,
      phase,
      total_matchdays: matchdaysNum,
      active: true,
    });
  };

  const doCreate = async () => {
    if (!team || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      const created = await performInsert();
      // Éxito directo → cerramos sheet vía onCreated. Reset de submitting
      // no hace falta porque el sheet se desmonta.
      onCreated(created);
      return;
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      const isActiveConflict =
        e?.code === '23505' ||
        msg.includes('one_active_season_per_team');

      // CRÍTICO: liberar submitting ANTES de abrir el Alert. Si dejamos
      // submitting=true mientras el Alert está abierto y el user cancela,
      // el sheet queda con el spinner para siempre — bug reportado.
      setSubmitting(false);

      if (!isActiveConflict) {
        Alert.alert('Error al crear temporada', msg || 'Inténtalo de nuevo.');
        return;
      }

      // Conflict: ofrecemos cerrar la previa y reintentar.
      let current: SeasonsApi.Season | null = null;
      try {
        current = await SeasonsApi.fetchActiveSeason(team.id);
      } catch {
        // Ignoramos — fallback al mensaje genérico abajo.
      }
      if (!current) {
        Alert.alert(
          'Ya hay una temporada activa',
          'Ciérrala desde el detalle de la temporada antes de crear otra.',
        );
        return;
      }
      Alert.alert(
        'Ya hay una temporada activa',
        `Tienes "${current.name}" en curso. ¿Quieres cerrarla y crear "${name.trim()}" como nueva temporada activa?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Cerrar y crear nueva',
            style: 'destructive',
            onPress: async () => {
              setSubmitting(true);
              try {
                await SeasonsApi.closeSeason(current!.id);
                const created = await performInsert();
                onCreated(created);
              } catch (e2: any) {
                Alert.alert(
                  'No se pudo crear',
                  e2?.message ?? 'Inténtalo de nuevo.',
                );
                setSubmitting(false);
              }
            },
          },
        ],
      );
    }
  };

  const submit = doCreate;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.sheetEyebrow}>NUEVA</Text>
      <Text style={styles.sheetTitle}>Crear temporada</Text>

      <Text style={styles.sheetLabel}>NOMBRE</Text>
      <View style={styles.sheetInputWrap}>
        <View style={styles.accentBar} />
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={60}
          autoCapitalize="words"
          style={styles.sheetInput}
          placeholderTextColor={c.textFaint}
        />
      </View>

      <Text style={styles.sheetLabel}>FORMATO</Text>
      <View style={{ gap: 6 }}>
        {PHASE_OPTIONS.map((p) => {
          const sel = phase === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPhase(p.id)}
              style={[
                styles.phaseOption,
                sel && {
                  backgroundColor: c.accent10,
                  borderColor: c.accent50,
                },
              ]}
            >
              <View
                style={[
                  styles.radioOuter,
                  sel && {
                    backgroundColor: c.accent,
                    borderColor: c.accent,
                  },
                ]}
              >
                {sel ? <View style={styles.radioInner} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.phaseLabel}>{p.label}</Text>
                <Text style={styles.phaseSub}>{p.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sheetLabel}>
        {phase === 'playoff'
          ? 'NÚMERO DE ELIMINATORIAS · OPCIONAL'
          : 'NÚMERO DE JORNADAS · OPCIONAL'}
      </Text>
      <View style={styles.sheetInputWrap}>
        <View style={styles.accentBar} />
        <TextInput
          value={matchdaysStr}
          onChangeText={(v) =>
            setMatchdaysStr(v.replace(/[^0-9]/g, '').slice(0, 2))
          }
          keyboardType="number-pad"
          placeholder={phase === 'playoff' ? 'ej. 4' : 'ej. 18'}
          placeholderTextColor={c.textFaint}
          style={styles.sheetInput}
          maxLength={2}
        />
      </View>

      <Pressable
        disabled={submitting || !canSubmit}
        onPress={submit}
        style={({ pressed }) => [
          styles.sheetCta,
          (submitting || !canSubmit) && { opacity: 0.4 },
          pressed && !submitting && canSubmit && { opacity: 0.85 },
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#001810" />
        ) : (
          <Text style={styles.sheetCtaLabel}>Crear temporada</Text>
        )}
      </Pressable>
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  // ── Tablet ──
  twoCol: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  twoColLeft: { width: 340 },
  twoColRight: { flex: 1, minWidth: 0, gap: 10 },
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
  fedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent25,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 18,
  },
  fedCardTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
  fedCardText: { color: c.textMuted, fontSize: 12.5, marginTop: 3 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  eyebrow: {
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
  intro: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  title: {
    color: c.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  lede: {
    color: c.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  activeCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.accent40,
    paddingHorizontal: 22,
    paddingVertical: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  activeBadge: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  activeName: {
    color: c.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 28,
  },
  activeMeta: {
    color: c.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: c.black35,
    marginTop: 18,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  sbRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    marginTop: 18,
  },
  sbPos: { gap: 2 },
  zoneTag: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '700',
  },
  sbPosNum: {
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 42,
    letterSpacing: -1,
  },
  sbPosOf: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 1.4,
    marginBottom: 7,
  },
  sbStats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  sbCell: { alignItems: 'center', gap: 2 },
  sbCellNum: { fontFamily: Fonts.mono, color: c.text, fontSize: 17, fontWeight: '800' },
  sbCellLabel: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 9, letterSpacing: 1.2 },
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: c.hair,
  },
  nextBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.black35,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBadgeText: { fontFamily: Fonts.mono, color: c.accent, fontSize: 13, fontWeight: '800' },
  nextRival: { color: c.text, fontSize: 15, fontWeight: '700' },
  nextMeta: { fontFamily: Fonts.mono, color: c.textMuted, fontSize: 11, marginTop: 3 },
  availPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: c.accent15,
    borderWidth: 1,
    borderColor: c.accent40,
  },
  availPillAsk: { backgroundColor: c.accent, borderColor: c.accent },
  availPillText: { fontFamily: Fonts.mono, color: c.accent, fontSize: 11, fontWeight: '800' },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  streakLink: { color: c.accent, fontSize: 13, fontWeight: '700' },
  mineCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  mineLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    letterSpacing: 2.4,
    color: c.textFaint,
    fontWeight: '600',
  },
  mineRow: { flexDirection: 'row', marginTop: 12, gap: 8 },
  mineCell: { flex: 1, gap: 3 },
  mineNum: { fontFamily: Fonts.mono, color: c.text, fontSize: 22, fontWeight: '800' },
  mineName: { color: c.text, fontSize: 17, fontWeight: '700', lineHeight: 27 },
  mineCellLabel: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 9, letterSpacing: 1.2 },
  pathsCard: {
    padding: 18,
    paddingBottom: 6,
    borderRadius: 20,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
  },
  pathsTitle: { color: c.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  pathsText: { color: c.textMuted, fontSize: 13.5, lineHeight: 19, marginTop: 6 },
  fedLink: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 12,
    borderRadius: Radius.md,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hair,
  },
  fedLinkTile: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: c.accent10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fedLinkTileText: { fontFamily: Fonts.mono, color: c.accent, fontSize: 10.5, fontWeight: '800' },
  fedLinkTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
  fedLinkSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  histHeader: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  histLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: c.textFaint,
    fontWeight: '500',
  },
  histCount: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textFaint,
  },
  pastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: c.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.hair,
  },
  pastBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: c.bgRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: c.text,
  },
  pastName: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  pastMeta: {
    color: c.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  dashed: {
    marginTop: 14,
    paddingVertical: 16,
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: c.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dashedText: {
    color: c.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    backgroundColor: c.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.hair,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyCta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: c.accent,
  },
  emptyCtaLabel: {
    color: c.textInverse,
    fontSize: 13,
    fontWeight: '700',
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
    marginBottom: 8,
  },
  sheetLabel: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  sheetInputWrap: {
    backgroundColor: c.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accentBar: {
    width: 5,
    height: 18,
    borderRadius: 3,
    backgroundColor: c.accent,
  },
  sheetInput: {
    flex: 1,
    color: c.text,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
  },
  phaseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000',
  },
  phaseLabel: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
  },
  phaseSub: {
    color: c.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  sheetCta: {
    height: 52,
    marginTop: 14,
    borderRadius: Radius.md,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  sheetCtaLabel: {
    color: '#001810',
    fontSize: 16,
    fontWeight: '700',
  },
});
