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
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
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
  IconTeam,
  IconAnalytics,
  IconChevron,
  IconPin,
  NeonDot,
  TeamSwitcher,
  IconGift,
  IconBall,
} from '@components/ui';
import { ProgressRing } from '@components/ui/ProgressRing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import { buildCaptainInviteMessage } from '@core/config/referral';
import { usePremiumGate } from '@core/hooks/usePremiumGate';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { matchdayState } from '@core/utils/matchday';

import type { HomeStackScreenProps } from '@navigation/types';

export const HomeScreen = ({
  navigation,
}: HomeStackScreenProps<'HomeRoot'>) => {
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
            const md = await MatchdaysApi.fetchUpcomingMatchday(season.id);
            if (cancelled) return;
            setNextMatchday(md);

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

  const avail = players.filter((p) => p.available).length;
  const total = players.length || 1;
  const pct = Math.round((avail / total) * 100);

  const inviteCaptain = async () => {
    try {
      await Share.share({ message: buildCaptainInviteMessage(team?.name) });
    } catch {
      // cancelado
    }
  };

  const goSeasons = () => navigation.getParent()?.navigate('Seasons');
  const goTeam = () => navigation.getParent()?.navigate('Team');
  // Atajo al aha moment del capitán: abrir directamente el ScanSheet de
  // matchdays sin tener que descubrir la pestaña Temporadas. Solo tiene
  // sentido si ya hay activeSeason — sin temporada no hay dónde colgar
  // los matchdays escaneados.
  // Reverse trial: escanear es premium. El gate comprueba la sub al pulsar →
  // bloquea al usuario sin sub activa (nuevo o caducado) aunque ya tenga
  // temporada. Sin esto, un trial cancelado seguiría escaneando gratis.
  const gate = usePremiumGate();
  const goScanCalendar = gate(() => {
    if (!activeSeason) return;
    navigation.getParent()?.navigate('Seasons', {
      screen: 'SeasonDetail',
      params: { id: activeSeason.id, autoOpen: 'scan' },
    });
  }, 'calendar_scan');

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
        ]}
        showsVerticalScrollIndicator={false}
      >
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
              <Text style={heroStyles.heroLiveText}>
                J·{String(nextMatchday.jornada_number).padStart(2, '0')}
                {nextMatchday.match_date ? ` · ${nextMatchday.match_date}` : ''}
                {nextMatchday.match_time ? ` · ${nextMatchday.match_time.slice(0, 5)}` : ''}
              </Text>
            </View>

            <Text style={heroStyles.heroLabel}>vs.</Text>
            <Text style={heroStyles.heroTitle}>{nextMatchday.opponent}</Text>
            {nextMatchday.location?.trim() ? (
              <View style={heroStyles.heroLocationRow}>
                <IconPin size={12} color={darkColors.textMuted} />
                <Text style={heroStyles.heroLocation} numberOfLines={1}>
                  {nextMatchday.location.trim()}
                </Text>
              </View>
            ) : null}

            <View style={heroStyles.statRow}>
              <StatChip label="DISPONIBLES" value={`${avail}`} suffix={`/ ${total}`} highlight />
              <StatChip
                label="ALINEACIÓN"
                value={
                  lineupFilled === 0
                    ? '—'
                    : lineupFilled >= matchesPerRound
                      ? '✓'
                      : `${lineupFilled}/${matchesPerRound}`
                }
                sub={
                  lineupFilled === 0
                    ? 'Pendiente'
                    : lineupFilled >= matchesPerRound
                      ? 'Lista'
                      : 'En curso'
                }
                highlight={lineupFilled >= matchesPerRound}
              />
              <StatChip
                label="ESTADO"
                value={
                  nextMatchday.status === 'in_progress'
                    ? 'EN JUEGO'
                    : matchdayState(nextMatchday) === 'pending-acta'
                      ? 'PENDIENTE'
                      : 'PRÓXIMA'
                }
              />
            </View>

            <View style={heroStyles.heroFooter}>
              <Text style={heroStyles.heroFooterText}>Abrir jornada</Text>
              <View style={heroStyles.heroFooterArrow}>
                <IconArrowRight size={14} color={darkColors.textInverse} />
              </View>
            </View>
          </Pressable>
        ) : (
          <View style={[styles.hero, styles.heroEmpty]}>
            <Text style={styles.heroEmptyTitle}>Aún no hay jornadas</Text>
            <Text style={styles.heroEmptyText}>
              {isPlayer
                ? 'El capitán todavía no ha planificado jornadas.'
                : activeSeason
                  ? 'Escanea el calendario de tu liga y TACTIUM importa todas las jornadas de un golpe.'
                  : 'Crea una temporada activa desde la pestaña Temporadas.'}
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

        {nextMatchday && canEdit ? (
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
            <Text style={styles.primaryCtaLabel}>Crear alineación</Text>
          </Pressable>
        ) : null}

        <Text style={[styles.eyebrowFaint, { marginTop: 32 }]}>ATAJOS</Text>

        <View style={{ gap: 8 }}>
          <ActionRow
            icon={<IconTeam size={20} color={c.accent} />}
            title={isPlayer ? 'Mi disponibilidad' : 'Disponibilidad'}
            value={`${avail}/${total}`}
            hint={
              isPlayer
                ? 'Marca si puedes jugar la próxima jornada'
                : `${pct}% del equipo confirmado`
            }
            onPress={() =>
              navigation.navigate('Availability', {
                matchdayId: nextMatchday?.id,
              })
            }
          />
          {canEdit ? (
            <>
              <ActionRow
                icon={<IconAnalytics size={20} color={c.accent} />}
                title="Plantilla"
                value={String(players.length)}
                hint="Estadísticas y puntos FEP"
                onPress={goTeam}
              />
              <ActionRow
                icon={<IconCalendar size={20} color={c.accent} />}
                title="Temporadas"
                value={activeSeason ? activeSeason.name.replace('Temporada ', '') : '—'}
                hint={
                  activeSeason
                    ? `${activeSeason.category ?? '—'}${
                        activeSeason.total_matchdays != null
                          ? ` · ${activeSeason.total_matchdays} jornadas`
                          : ''
                      }`
                    : 'Sin temporada activa'
                }
                onPress={goSeasons}
              />
            </>
          ) : null}
          {canEdit ? (
            <ActionRow
              icon={<IconGift size={20} color={c.accent} />}
              title="Invita a un capitán"
              hint="¿Conoces a otro capitán? Regálale dejar el Excel"
              onPress={inviteCaptain}
            />
          ) : null}
          <ActionRow
            icon={<IconBall size={20} color={c.accent} />}
            title="Amistoso"
            hint={
              canEdit
                ? 'Registra un equipo vs equipo y compártelo'
                : 'Registra un amistoso y compártelo'
            }
            onPress={() => navigation.navigate('Amistoso')}
          />
        </View>

        {canEdit ? (
          <Pressable
            onPress={() =>
              navigation.navigate('Availability', {
                matchdayId: nextMatchday?.id,
              })
            }
            style={({ pressed }) => [
              styles.statusFooter,
              pressed && { opacity: 0.85 },
            ]}
          >
            <ProgressRing pct={pct} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.statusTitle}>Equipo confirmado</Text>
              <Text style={styles.statusMeta}>
                {avail} de {total} disponibles para J·07
              </Text>
            </View>
            <Text style={styles.statusAction}>Gestionar →</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
};

const StatChip: React.FC<{
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  highlight?: boolean;
}> = ({ label, value, suffix, sub, highlight }) => {
  // StatChip vive solo dentro de la tarjeta de jornada (siempre oscura),
  // así que usa la paleta oscura fija para que su texto se lea sobre el
  // degradado verde también en modo claro.
  const c = darkColors;
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View
      style={[
        styles.statChip,
        highlight && { borderColor: c.accent40 },
      ]}
    >
      <Text style={styles.statChipLabel} numberOfLines={1}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 2, marginTop: 4 }}>
        <Text
          style={[
            styles.statChipValue,
            highlight && { color: c.accent },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.55}
        >
          {value}
        </Text>
        {suffix ? <Text style={styles.statChipSuffix}>{suffix}</Text> : null}
      </View>
      {sub ? <Text style={styles.statChipSub}>{sub}</Text> : null}
    </View>
  );
};

const ActionRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  /** Pill de la derecha; vacío u omitido = no se pinta (sin recuadro). */
  value?: string;
  hint: string;
  onPress: () => void;
}> = ({ icon, title, value, hint, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${value ?? ''}. ${hint}`}
      style={({ pressed }) => [
        styles.actionRow,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={styles.actionIcon}>{icon}</View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.actionTitle}>{title}</Text>
        <Text style={styles.actionHint}>{hint}</Text>
      </View>
      {value ? (
        <View style={styles.actionPill}>
          <Text style={styles.actionPillText}>{value}</Text>
        </View>
      ) : null}
      <IconChevron size={14} color={c.textFaint} />
    </Pressable>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
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
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 22,
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
    marginBottom: 14,
  },
  heroLiveText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.accent,
    letterSpacing: 1.6,
  },
  heroLabel: {
    fontSize: 12,
    color: c.textMuted,
    fontWeight: '500',
    marginBottom: 4,
  },
  heroTitle: {
    color: c.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 32,
    marginBottom: 6,
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
  statRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
  },
  statChip: {
    flex: 1,
    backgroundColor: c.black35,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statChipLabel: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    color: c.textFaint,
    letterSpacing: 1.4,
    fontWeight: '500',
  },
  statChipValue: {
    color: c.text,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  statChipSuffix: {
    color: c.textFaint,
    fontSize: 11,
  },
  statChipSub: {
    color: c.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  heroFooter: {
    marginTop: 22,
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: c.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroFooterText: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
  },
  heroFooterArrow: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.accent,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
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
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hair,
  },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: c.accent15,
    borderWidth: 1,
    borderColor: c.accent25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  actionHint: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  actionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: c.bgRaised,
  },
  actionPillText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: c.text,
    fontWeight: '600',
  },
  statusFooter: {
    marginTop: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  statusTitle: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
  },
  statusMeta: {
    color: c.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statusAction: {
    color: c.accent,
    fontSize: 12,
    fontWeight: '600',
  },
});
