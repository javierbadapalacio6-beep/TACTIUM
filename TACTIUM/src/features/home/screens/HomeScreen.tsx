import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Share,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useScrollToTop, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Rect } from 'react-native-svg';

import * as SeasonsApi from '@core/services/seasons';
import * as MatchdaysApi from '@core/services/matchdays';
import * as LineupVariantsApi from '@core/services/lineupVariants';
import * as LineupsApi from '@core/services/lineups';
import { getCourtsForCompetition } from '@core/data/federations';

import { useColors, useIsDark, darkColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  IconCalendar,
  IconArrowRight,
  IconCourt,
  IconShare,
  IconAnalytics,
  IconChevron,
  IconPin,
  NeonDot,
  TeamSwitcher,
  IconGift,
  IconBall,
  IconTrophy,
} from '@components/ui';
import { useLayout, type LayoutMode } from '@components/ui/ResponsiveFrame';
import { ContentColumn } from '@components/layout';
import { fmtPts } from '@features/home/components/lineup/lineupLogic';
import { TOURNAMENTS_ENABLED } from '@core/config/featureFlags';
import { TactiumMark } from '@components/brand/TactiumMark';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import { buildCaptainInviteMessage } from '@core/config/referral';
import { usePremiumGate } from '@core/hooks/usePremiumGate';
import { FeedPreview } from '@features/social/components/FeedPreview';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { TrialHomeCard } from '@features/subscription/components/TrialHomeCard';
import { matchdayState } from '@core/utils/matchday';
import { useMatchdayAvailability } from '@core/hooks/useMatchdayAvailability';
import { RsvpCard } from '@features/availability/components/RsvpCard';
import { TimePollCard } from '@features/timePoll/components/TimePollCard';
import { ConvocatoriaCard } from '@features/availability/components/ConvocatoriaCard';
import { useRemindPending } from '@features/availability/hooks/useRemindPending';
import {
  OtherTeamsMatchdays,
  formatMatchDate,
} from '@features/home/components/OtherTeamsMatchdays';
import { LiveHomeCard } from '@features/home/components/live/LiveHomeCard';

import type { HomeStackScreenProps, RootStackParamList } from '@navigation/types';

export const HomeScreen = ({
  navigation,
}: HomeStackScreenProps<'HomeRoot'>) => {
  const rootNav =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const c = useColors();
  const isDark = useIsDark();
  const styles = useMemo(() => makeStyles(c), [c]);
  // La tarjeta de "próxima jornada" es una pieza destacada de degradado
  // verde con texto claro: se mantiene SIEMPRE oscura (también en modo
  // claro) para no perder el look y que el texto se lea. Usa la paleta
  // oscura fija en todo su subárbol.
  const heroStyles = useMemo(() => makeStyles(darkColors), []);
  const insets = useSafeAreaInsets();
  const players = useTeamStore((s) => s.players);
  const team = useTeamStore((s) => s.team);
  const activeRole = useTeamStore((s) => s.activeRole);
  const isPlayer = activeRole === 'player';
  const canEdit = !isPlayer; // capitán y club_admin pueden editar

  const [activeSeason, setActiveSeason] = useState<SeasonsApi.Season | null>(null);
  const [nextMatchday, setNextMatchday] = useState<MatchdaysApi.Matchday | null>(null);
  // Nº de jornadas de la temporada activa: distingue "sin jornadas" (escanear)
  // de "calendario ya cargado y sin jornadas pendientes" (temporada al día).
  const [seasonMatchdayCount, setSeasonMatchdayCount] = useState(0);
  const [lineupFilled, setLineupFilled] = useState(0);
  // Alineación oficial completa de la próxima jornada: permite mostrar al
  // JUGADOR su card personal ("Juegas la P2 con Marco") — F6 del plan.
  const [lineupPairs, setLineupPairs] = useState<LineupsApi.LineupPair[]>([]);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  // Al cambiar de equipo activo, el contenido se reemplaza. Si el usuario
  // estaba scrolleado, la nueva data podría tener distinta altura y el
  // scroll se "atornilla" en una posición incoherente → se siente brusco.
  // Además, los estados locales (matchday, lineup, season) muestran data
  // del equipo anterior mientras llega la nueva fetch — eso provoca el
  // "a veces no aparece, después sí". Limpiamos en cuanto cambia team.id
  // para que useFocusEffect repinte limpio.
  const scrollRef = useRef<ScrollView | null>(null);
  // Pulsar la pestaña "Inicio" cuando ya estamos en HomeRoot dispara
  // scroll-to-top automáticamente (hook estándar de react-navigation).
  useScrollToTop(scrollRef);

  const prevTeamIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = team?.id ?? null;
    if (prevTeamIdRef.current !== null && prevTeamIdRef.current !== currentId) {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      setNextMatchday(null);
      setSeasonMatchdayCount(0);
      setLineupFilled(0);
      setLineupPairs([]);
      setActiveSeason(null);
    }
    prevTeamIdRef.current = currentId;
  }, [team?.id]);

  // Si el usuario está en otra pantalla del Home stack (Jornada, Lineup…)
  // o en otra pestaña y pulsa "Inicio", al recuperar el foco hacemos
  // scroll a la parte superior. En el primer mount no hacemos nada.
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

  // Refetcheamos cada vez que el screen vuelve a foco. El team puede no
  // cambiar de referencia, pero el usuario puede haber creado/editado
  // jornadas en otras pantallas.
  useFocusEffect(
    useCallback(() => {
      if (!team) return;
      let cancelled = false;
      (async () => {
        try {
          const season = await SeasonsApi.fetchActiveSeason(team.id);
          if (cancelled) return;
          setActiveSeason(season);
          if (season) {
            const [md, mdCount] = await Promise.all([
              MatchdaysApi.fetchUpcomingMatchday(season.id),
              MatchdaysApi.countMatchdays(season.id),
            ]);
            if (cancelled) return;
            setNextMatchday(md);
            setSeasonMatchdayCount(mdCount);

            if (md) {
              // Cuenta parejas completas en la variante OFICIAL para reflejar
              // el estado real de la alineación en el card.
              const activeVariant =
                await LineupVariantsApi.fetchActiveVariant(md.id);
              if (cancelled) return;
              if (activeVariant) {
                const lineup = await LineupsApi.fetchLineup(activeVariant.id);
                if (cancelled) return;
                const filled = lineup.filter(
                  (p) => p.player_a_id && p.player_b_id,
                ).length;
                setLineupFilled(filled);
                setLineupPairs(lineup);
              } else {
                setLineupFilled(0);
                setLineupPairs([]);
              }
            } else {
              setLineupFilled(0);
              setLineupPairs([]);
            }
          } else {
            setNextMatchday(null);
            setSeasonMatchdayCount(0);
            setLineupFilled(0);
            setLineupPairs([]);
          }
        } catch (e) {
          console.warn('Home fetch', e);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [team]),
  );

  const matchesPerRound = getCourtsForCompetition(
    team?.federation,
    team?.league,
    team?.gender,
  );

  // Card personal del jugador: su pareja en la alineación oficial.
  const myPlayerId = useMemo(
    () => players.find((pl) => pl.user_id === userId)?.id ?? null,
    [players, userId],
  );
  const myPair = useMemo(() => {
    if (!myPlayerId) return null;
    return (
      lineupPairs.find(
        (pr) =>
          pr.player_a_id === myPlayerId || pr.player_b_id === myPlayerId,
      ) ?? null
    );
  }, [lineupPairs, myPlayerId]);
  const myPartnerName = myPair
    ? myPair.player_a_id === myPlayerId
      ? myPair.player_b_name
      : myPair.player_a_name
    : null;

  // Disponibilidad POR JORNADA (antes: players.available, global).
  const availability = useMatchdayAvailability(
    nextMatchday && nextMatchday.status === 'upcoming' ? nextMatchday.id : null,
  );
  const { counts: availCounts } = availability;
  const remind = useRemindPending({
    matchdayId: nextMatchday?.id,
    opponent: nextMatchday?.opponent,
    jornadaNumber: nextMatchday?.jornada_number,
    lastReminder: availability.lastReminder,
    setLastReminder: availability.setLastReminder,
  });
  const avail = availCounts.yes;

  const inviteCaptain = async () => {
    try {
      await Share.share({ message: buildCaptainInviteMessage(team?.name) });
    } catch {
      // cancelado
    }
  };

  // Temporadas viven ahora en Competir → segmento «Liga».
  const goSeasons = () =>
    navigation.navigate('Competir', {
      screen: 'CompetirRoot',
      params: { segment: 'liga' },
    });
  const goTeam = () => navigation.navigate('Team');
  // Atajo al aha moment del capitán: abrir directamente el ScanSheet de
  // matchdays sin tener que pasar por Competir › Liga. Solo tiene
  // sentido si ya hay activeSeason — sin temporada no hay dónde colgar
  // los matchdays escaneados.
  // Reverse trial: escanear es premium. El gate comprueba la sub al pulsar →
  // bloquea al usuario sin sub activa (nuevo o caducado) aunque ya tenga
  // temporada. Sin esto, un trial cancelado seguiría escaneando gratis.
  const gate = usePremiumGate();
  const goScanCalendar = gate(() => {
    if (!activeSeason) return;
    navigation.navigate('Competir', {
      screen: 'SeasonDetail',
      params: { id: activeSeason.id, autoOpen: 'scan' },
    });
  }, 'calendar_scan');

  // Tablet horizontal: dos columnas (la jornada a la izquierda; borrador de
  // la alineación y «Tu gente» a la derecha). Vertical: columna de 720.
  const { mode, isTablet } = useLayout();
  const wide = mode === 'tabletLandscape';

  const lineupCta =
    nextMatchday && canEdit ? (
      <Pressable
        onPress={() =>
          navigation.navigate('Lineup', { matchdayId: nextMatchday.id })
        }
        style={({ pressed }) => [
          styles.primaryCta,
          pressed && { opacity: 0.85 },
        ]}
      >
        <IconCourt size={20} color="#001810" />
        <Text style={styles.primaryCtaLabel}>
          {isTablet && lineupFilled > 0
            ? `Seguir con la alineación · ${Math.min(lineupFilled, matchesPerRound)}/${matchesPerRound}`
            : 'Crear alineación'}
        </Text>
      </Pressable>
    ) : null;

  return (
    <View style={styles.root}>
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.topbarSide}>
          <TactiumMark size={34} gradient />
        </View>
        <View style={styles.topbarCenter}>
          <TeamSwitcher />
        </View>
        <View style={styles.topbarRight}>
          {canEdit ? (
            <Pressable
              onPress={goSeasons}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Abrir temporadas"
            >
              <IconCalendar size={18} color={c.text} />
            </Pressable>
          ) : null}
          <NotificationBell />
        </View>
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
        <HomeColumns
          mode={mode}
          aside={
            wide ? (
              <>
                {canEdit && nextMatchday ? (
                  <LineupDraftCard
                    pairs={lineupPairs}
                    courts={matchesPerRound}
                    onOpen={() =>
                      navigation.navigate('Lineup', { matchdayId: nextMatchday.id })
                    }
                  />
                ) : null}
                <FeedPreview />
              </>
            ) : null
          }
        >
        {/* Prueba gratis de 14 días (solo quien gestiona/paga). */}
        {canEdit ? <TrialHomeCard /> : null}

        {/* Varios equipos: la próxima jornada de los demás, para saltar a
            ellos de un toque. Con un solo equipo no pinta nada. */}
        <OtherTeamsMatchdays bleed={22} />

        {/* Jornada en juego: marcador global en directo (solo si hay). */}
        {nextMatchday ? (
          <LiveHomeCard
            matchdayId={nextMatchday.id}
            teamName={team?.name ?? 'Nosotros'}
            opponent={nextMatchday.opponent}
            jornadaNumber={nextMatchday.jornada_number}
            onOpen={() => navigation.navigate('Jornada', { matchdayId: nextMatchday.id })}
          />
        ) : null}

        <Text style={styles.eyebrow}>
          {nextMatchday && matchdayState(nextMatchday) === 'pending-acta'
            ? 'JORNADA PENDIENTE'
            : 'PRÓXIMA JORNADA'}
        </Text>

        {nextMatchday ? (
          <Pressable
            onPress={() => navigation.navigate('Jornada', { matchdayId: nextMatchday.id })}
            style={({ pressed }) => [heroStyles.hero, pressed && { opacity: 0.95 }]}
          >
            <LinearGradient
              colors={[darkColors.primary, '#062520', darkColors.background]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={heroStyles.heroWatermark} pointerEvents="none">
              <Svg width={240} height={160} viewBox="0 0 240 160">
                <Rect x="2" y="2" width="236" height="156" rx="3"
                  stroke={darkColors.accent} strokeWidth="1.2" fill="none" opacity={0.4} />
                <Line x1="120" y1="2" x2="120" y2="158" stroke={darkColors.accent} strokeWidth="1" opacity={0.4} />
                <Line x1="2" y1="80" x2="238" y2="80" stroke={darkColors.accent} strokeWidth="1" opacity={0.4} />
                <Line x1="70" y1="2" x2="70" y2="158" stroke={darkColors.accent} strokeWidth="1" opacity={0.3} />
                <Line x1="170" y1="2" x2="170" y2="158" stroke={darkColors.accent} strokeWidth="1" opacity={0.3} />
              </Svg>
            </View>

            <View style={heroStyles.heroLive}>
              <NeonDot size={6} />
              <Text style={heroStyles.heroLiveText} numberOfLines={1}>
                J{String(nextMatchday.jornada_number).padStart(2, '0')}
                {nextMatchday.match_date ? ` · ${formatMatchDate(nextMatchday.match_date)}` : ''}
                {nextMatchday.match_time ? ` · ${nextMatchday.match_time.slice(0, 5)}` : ''}
              </Text>
              <View style={heroStyles.heroOpen}>
                <IconArrowRight size={13} color={darkColors.textInverse} />
              </View>
            </View>

            <Text
              style={heroStyles.heroTitle}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              <Text style={heroStyles.heroVs}>vs </Text>
              {nextMatchday.opponent}
            </Text>

            <View style={heroStyles.heroMetaRow}>
              {nextMatchday.location?.trim() ? (
                <View style={[heroStyles.heroMeta, { flexShrink: 1 }]}>
                  <IconPin size={11} color={darkColors.textMuted} />
                  <Text style={heroStyles.heroMetaText} numberOfLines={1}>
                    {nextMatchday.location.trim()}
                  </Text>
                </View>
              ) : null}
              <View style={heroStyles.heroMeta}>
                <Text style={[heroStyles.heroMetaText, { color: darkColors.accent }]}>
                  {avail}/{players.length} van
                </Text>
              </View>
              <View style={heroStyles.heroMeta}>
                <Text style={heroStyles.heroMetaText}>
                  {nextMatchday.status === 'in_progress'
                    ? 'En juego'
                    : matchdayState(nextMatchday) === 'pending-acta'
                      ? 'Falta el acta'
                      : lineupFilled === 0
                        ? 'Sin alineación'
                        : lineupFilled >= matchesPerRound
                          ? 'Alineación lista'
                          : `Alineación ${lineupFilled}/${matchesPerRound}`}
                </Text>
              </View>
            </View>

            {nextMatchday.status === 'upcoming' && myPlayerId ? (
              <RsvpCard
                embedded
                palette={darkColors}
                jornadaNumber={nextMatchday.jornada_number}
                answer={availability.map[myPlayerId]}
                deadline={availability.deadline}
                maybeClosed={availability.maybeClosed}
                onRespond={(status, extra) => availability.respond(myPlayerId, status, extra)}
              />
            ) : null}

            {/* Encuesta de hora abierta: el jugador vota aquí, el capitán ve
                el recuento (features/timePoll). */}
            {nextMatchday.status === 'upcoming' ? (
              <TimePollCard
                variant="home"
                palette={darkColors}
                matchdayId={nextMatchday.id}
                canManage={canEdit}
              />
            ) : null}
          </Pressable>
        ) : activeSeason && seasonMatchdayCount > 0 ? (
          // Temporada abierta con el calendario ya cargado y sin jornadas
          // pendientes (todas disputadas). No tiene sentido "escanear": está al día.
          <View style={[styles.hero, styles.heroEmpty]}>
            <Text style={styles.heroEmptyTitle}>No hay más jornadas programadas</Text>
            <Text style={styles.heroEmptyText}>
              {isPlayer
                ? 'Has disputado todas las jornadas del calendario.'
                : 'El calendario está completo: no quedan jornadas por disputar en esta temporada.'}
            </Text>
            {canEdit ? (
              <Pressable
                onPress={goSeasons}
                style={({ pressed }) => [styles.heroEmptySecondary, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.heroEmptySecondaryLabel}>Ver temporada</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={[styles.hero, styles.heroEmpty]}>
            <Text style={styles.heroEmptyTitle}>Aún no hay jornadas</Text>
            <Text style={styles.heroEmptyText}>
              {isPlayer
                ? 'El capitán todavía no ha planificado jornadas.'
                : activeSeason
                  ? 'Escanea el calendario de tu liga y TACTIUM importa todas las jornadas de un golpe.'
                  : 'Crea una temporada activa en Competir › Liga.'}
            </Text>
            {canEdit ? (
              <Pressable
                onPress={activeSeason ? goScanCalendar : goSeasons}
                style={({ pressed }) => [
                  styles.heroEmptyCta,
                  isDark ? styles.heroEmptyCtaSolid : styles.heroEmptyCtaSoft,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text
                  style={[
                    styles.heroEmptyCtaLabel,
                    { color: isDark ? c.textInverse : c.accent },
                  ]}
                >
                  {activeSeason ? 'Escanear calendario' : 'Crear temporada'}
                </Text>
                <IconArrowRight
                  size={14}
                  color={isDark ? c.textInverse : c.accent}
                />
              </Pressable>
            ) : null}
            {canEdit && activeSeason ? (
              <Pressable
                onPress={goSeasons}
                style={({ pressed }) => [
                  styles.heroEmptySecondary,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.heroEmptySecondaryLabel}>
                  Añadir manualmente
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}

        {canEdit && nextMatchday && nextMatchday.status === 'upcoming' && players.length > 0 ? (
          <ConvocatoriaCard
            counts={availCounts}
            needed={matchesPerRound * 2}
            courts={matchesPerRound}
            onRemind={remind.remind}
            remindDisabledUntil={remind.cooldownUntil}
            sending={remind.sending}
            onOpen={() => navigation.navigate('Availability', { matchdayId: nextMatchday.id })}
          />
        ) : null}

        {isPlayer && nextMatchday && myPair ? (
          <Pressable
            onPress={() =>
              navigation.navigate('Jornada', { matchdayId: nextMatchday.id })
            }
            style={({ pressed }) => [
              styles.myMatch,
              pressed && { opacity: 0.9 },
            ]}
          >
            <View style={styles.myMatchCourt}>
              <Text style={styles.myMatchCourtTxt}>
                P{myPair.court_number}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.myMatchTitle} numberOfLines={1}>
                Juegas con {myPartnerName ?? '—'}
              </Text>
              <Text style={styles.myMatchMeta} numberOfLines={1}>
                vs. {nextMatchday.opponent}
                {nextMatchday.match_time
                  ? ` · ${nextMatchday.match_time.slice(0, 5)}`
                  : ''}
                {' · '}
                {nextMatchday.is_home ? 'Local' : 'Visitante'}
              </Text>
            </View>
            <IconChevron size={14} color={c.textFaint} />
          </Pressable>
        ) : isPlayer &&
          nextMatchday &&
          myPlayerId &&
          lineupFilled > 0 ? (
          <View style={styles.myMatchOut}>
            <Text style={styles.myMatchOutTxt}>
              Esta jornada no estás en la alineación. ¡La próxima cae! 💪
            </Text>
          </View>
        ) : null}

        {!wide ? lineupCta : null}

        {/* Atajos: una fila de iconos (antes, 4-5 filas grandes). La
            disponibilidad ya no va aquí: la cubre la tarjeta de la jornada. */}
        <View style={styles.shortcuts}>
          {/* Atajo del jugador a su federación (también está en Competir). */}
          {team?.federation === 'FCantP' && isPlayer ? (
            <ShortcutTile
              icon={<IconTrophy size={20} color={c.accent} />}
              label="Federación"
              onPress={() => navigation.navigate('Federacion')}
            />
          ) : null}
          <ShortcutTile
            icon={<IconBall size={20} color={c.accent} />}
            label="Amistoso"
            onPress={() => navigation.navigate('Amistoso')}
          />
          {TOURNAMENTS_ENABLED ? (
            <ShortcutTile
              icon={<IconCalendar size={20} color={c.accent} />}
              label="Torneos"
              onPress={() => rootNav.navigate('ExploreTournaments')}
            />
          ) : null}
          {canEdit ? (
            <ShortcutTile
              icon={<IconGift size={20} color={c.accent} />}
              label="Invitar capitán"
              onPress={inviteCaptain}
            />
          ) : null}
        </View>

        {wide ? lineupCta : null}

        {/* TU GENTE: el feed de quien sigues, con kudos. En tablet
            horizontal va en la columna derecha. */}
        {!wide ? <FeedPreview /> : null}
        </HomeColumns>
      </ScrollView>
    </View>
  );
};

/**
 * Reparto del Inicio por modo. Móvil: tal cual (fragmento). Tablet
 * vertical: columna centrada de 720. Tablet horizontal: la jornada a la
 * izquierda y `aside` (borrador + «Tu gente») en una columna de 300.
 */
const HomeColumns: React.FC<{
  mode: LayoutMode;
  aside: React.ReactNode;
  children: React.ReactNode;
}> = ({ mode, aside, children }) => {
  if (mode === 'phone') return <>{children}</>;
  if (mode === 'tabletPortrait') return <ContentColumn>{children}</ContentColumn>;
  return (
    <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start' }}>
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      <View style={{ width: 300, gap: 14 }}>{aside}</View>
    </View>
  );
};

/** Tablet: resumen de la alineación (variante oficial) de la próxima jornada. */
const LineupDraftCard: React.FC<{
  pairs: LineupsApi.LineupPair[];
  courts: number;
  onOpen: () => void;
}> = ({ pairs, courts, onOpen }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const short = (n: string | null) => {
    if (!n) return null;
    const parts = n.trim().split(/\s+/);
    return parts.length > 1 ? parts[parts.length - 1] : parts[0];
  };
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel="Abrir la alineación"
      style={({ pressed }) => [styles.draftCard, pressed && { opacity: 0.9 }]}
    >
      <View style={styles.draftHead}>
        <Text style={styles.draftEyebrow}>ALINEACIÓN</Text>
        <Text style={styles.draftLink}>Editar ›</Text>
      </View>
      {Array.from({ length: courts }).map((_, i) => {
        const pr = pairs.find((p) => p.court_number === i + 1);
        const a = short(pr?.player_a_name ?? null);
        const b = short(pr?.player_b_name ?? null);
        const full = !!(a && b);
        return (
          <View key={i} style={styles.draftRow}>
            <Text style={[styles.draftCourt, !full && { color: c.textFaint }]}>P{i + 1}</Text>
            <Text
              style={[styles.draftNames, !full && { color: c.textFaint }]}
              numberOfLines={1}
            >
              {a || b ? `${a ?? 'falta uno'} / ${b ?? 'falta uno'}` : 'Sin colocar'}
            </Text>
            <Text style={styles.draftPts}>
              {pr?.pair_points ? fmtPts(pr.pair_points) : '—'}
            </Text>
          </View>
        );
      })}
    </Pressable>
  );
};

const ShortcutTile: React.FC<{
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}> = ({ icon, label, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.shortcut, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.shortcutIcon}>{icon}</View>
      <Text style={styles.shortcutLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  draftCard: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 2,
  },
  draftHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  draftEyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    letterSpacing: 1.6,
    color: c.textFaint,
  },
  draftLink: { color: c.accent, fontSize: 12, fontWeight: '700' },
  draftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.hair,
  },
  draftCourt: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    color: c.accent,
    width: 24,
  },
  draftNames: { flex: 1, minWidth: 0, color: c.text, fontSize: 13, fontWeight: '600' },
  draftPts: { fontFamily: Fonts.mono, fontSize: 12, color: c.textMuted },
  shortcuts: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 24,
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: Radius.lg,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  shortcutIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: c.accent10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    color: c.text,
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
  },
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
  fedHomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent25,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
  },
  fedHomeTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
  fedHomeText: { color: c.textMuted, fontSize: 12.5, marginTop: 3 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 4,
  },
  topbarSide: {
    width: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  topbarSideRight: {
    justifyContent: 'flex-end',
  },
  topbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  topbarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    minWidth: 0,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 28,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    color: c.accent,
    fontWeight: '500',
    marginBottom: 14,
  },
  myMatch: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.accent40,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  myMatchCourt: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: c.accent15,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  myMatchCourtTxt: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  myMatchTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  myMatchMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
  myMatchOut: {
    marginTop: 12,
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
    padding: 14,
  },
  myMatchOutTxt: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  eyebrowFaint: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2.4,
    color: c.textFaint,
    fontWeight: '500',
    marginBottom: 14,
  },
  hero: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: c.accent40,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 8,
  },
  heroWatermark: {
    position: 'absolute',
    top: -20,
    right: -50,
    opacity: 0.4,
  },
  heroLive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  heroOpen: {
    marginLeft: 'auto',
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVs: {
    color: c.textMuted,
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0,
  },
  heroMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  heroMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: c.black35,
    borderWidth: 1,
    borderColor: c.hairStrong,
  },
  heroMetaText: {
    color: c.textMuted,
    fontSize: 11.5,
    fontWeight: '600',
  },
  heroLiveText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.accent,
    letterSpacing: 1.6,
  },
  heroTitle: {
    color: c.text,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 28,
  },
  heroLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  heroLocation: {
    color: c.textMuted,
    fontSize: 12,
    flexShrink: 1,
  },
  heroEmpty: {
    backgroundColor: c.bgCard,
    borderColor: c.hairStrong,
    paddingVertical: 28,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  heroEmptyTitle: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  heroEmptyText: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  heroEmptyCta: {
    marginTop: 8,
    height: 44,
    paddingHorizontal: 18,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  // Oscuro: relleno verde sólido (look de producción). Claro: verde suave
  // (tinte + borde) para que el CTA no resalte tanto sobre el fondo blanco.
  heroEmptyCtaSolid: {
    backgroundColor: c.accent,
  },
  heroEmptyCtaSoft: {
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
  },
  heroEmptyCtaLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  heroEmptySecondary: {
    marginTop: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  heroEmptySecondaryLabel: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  primaryCta: {
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    shadowColor: c.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  primaryCtaLabel: {
    color: '#001810',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
});
