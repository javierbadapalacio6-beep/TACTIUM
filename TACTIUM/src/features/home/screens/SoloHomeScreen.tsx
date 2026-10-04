import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { FeedPreview } from '@features/social/components/FeedPreview';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconCheck, IconChevron, IconPlus, useLayout } from '@components/ui';
import { ContentColumn } from '@components/layout';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import {
  fetchMyCasualMatches,
  fetchMyCasualStats,
  type CasualMatchSummary,
  type MyCasualStats,
} from '@core/services/casualMatches';
import { getPublicUserProfile } from '@core/services/social';
import { CodeRedeemCard } from '@features/profile/components/CodeRedeemCard';
import { WinRing, StreakPips } from '@features/profile/components/StatsVisuals';
import type { HomeStackScreenProps, RootStackParamList } from '@navigation/types';

// Inicio del JUGADOR SIN EQUIPO. Con partidos: tus números arriba, el botón
// de registrar, los 2 últimos resultados y el feed de tu gente. Sin partidos:
// una lista de 3 pasos que se termina. El código (de partido o de equipo) y el
// puente al equipo van al final.
//
// TABLET: las mismas piezas en una columna de 720 centrada (también en
// horizontal), emparejadas de dos en dos: récord + «Registrar» en una banda,
// pasos + código, resultados + tu gente, código + puente al equipo.

type Nav = HomeStackScreenProps<'HomeRoot'>['navigation'];

/** Personas a seguir para dar el paso por hecho. */
const FOLLOW_GOAL = 3;

const formatShortDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

export const SoloHomeScreen = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const rootNav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const setSoloMode = useTeamStore((s) => s.setSoloMode);
  const setSoloUpgrade = useTeamStore((s) => s.setSoloUpgrade);
  const { isTablet } = useLayout();
  const [matches, setMatches] = useState<CasualMatchSummary[]>([]);
  const [stats, setStats] = useState<MyCasualStats | null>(null);
  const [following, setFollowing] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    if (!user?.id) return;
    Promise.all([
      fetchMyCasualMatches(user.id).catch(() => [] as CasualMatchSummary[]),
      fetchMyCasualStats(user.id).catch(() => null),
      getPublicUserProfile(user.id)
        .then((p) => p?.following_count ?? 0)
        .catch(() => 0),
    ]).then(([m, s, f]) => {
      setMatches(m);
      setStats(s);
      setFollowing(f);
      setLoaded(true);
    });
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const firstName = (() => {
    const meta = (user?.user_metadata ?? {}) as { full_name?: string; username?: string };
    const uname = (meta.username ?? '').trim();
    if (uname) return uname;
    const n = (meta.full_name ?? '').trim();
    return n ? n.split(' ')[0] : null;
  })();

  const hasMatches = (stats?.played ?? 0) > 0 || matches.length > 0;
  const lastFive = matches.slice(0, 5).reverse().map((m) => (m.won ? 'W' : 'L') as 'W' | 'L');
  const goStats = () => rootNav.navigate('MyStats');
  const goAmistoso = () => navigation.navigate('Amistoso');
  const goUpgrade = () => {
    setSoloUpgrade(true);
    setSoloMode(false);
  };

  // ── Piezas (las mismas en móvil y tablet; solo cambia cómo se colocan) ──
  const recordCard = (
    <Pressable
      onPress={goStats}
      style={({ pressed }) => [styles.recordCard, pressed && { opacity: 0.92 }]}
      accessibilityRole="button"
      accessibilityLabel="Ver mis estadísticas"
    >
      <WinRing pct={stats?.winRate ?? null} size={64} />
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={styles.recordText}>
          {stats?.won ?? 0}
          <Text style={{ color: c.textFaint }}> V · </Text>
          {stats?.lost ?? 0}
          <Text style={{ color: c.textFaint }}> D</Text>
        </Text>
        {lastFive.length > 0 ? <StreakPips results={lastFive} /> : null}
        <Text style={styles.recordLink}>Amistosos · ver todo ›</Text>
      </View>
    </Pressable>
  );

  const amistosoBtn = (
    <Pressable
      onPress={goAmistoso}
      style={({ pressed }) => [
        styles.primaryBtn,
        isTablet && styles.tBtn,
        pressed && { opacity: 0.88 },
      ]}
      accessibilityRole="button"
    >
      <IconPlus size={16} color={c.textInverse} />
      <Text style={styles.primaryBtnLabel}>Registrar un amistoso</Text>
    </Pressable>
  );

  const lastResults =
    matches.length > 0 ? (
      <View style={[styles.card, { paddingVertical: 4 }]}>
        {matches.slice(0, isTablet ? 3 : 2).map((cm, i) => (
          <Pressable
            key={cm.id}
            onPress={() => rootNav.navigate('CasualMatchDetail', { matchId: cm.id })}
            style={({ pressed }) => [
              styles.resultRow,
              i > 0 && styles.rowDivider,
              pressed && { opacity: 0.7 },
            ]}
          >
            <View
              style={[
                styles.resultBadge,
                { backgroundColor: cm.won ? c.accent15 : 'rgba(255,107,107,0.12)' },
              ]}
            >
              <Text style={[styles.resultBadgeTxt, { color: cm.won ? c.accent : c.error }]}>
                {cm.won ? 'V' : 'D'}
              </Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.resultName} numberOfLines={1}>
                vs {cm.rivals || 'rival'}
              </Text>
              <Text style={styles.resultMeta} numberOfLines={1}>
                {cm.partner ? `con ${cm.partner} · ` : ''}
                {formatShortDate(cm.playedOn)}
              </Text>
            </View>
            <Text style={styles.resultSets}>{cm.sets}</Text>
          </Pressable>
        ))}
      </View>
    ) : null;

  const steps = (
    <View style={[styles.card, { paddingVertical: 4 }]}>
      <Step first done label="Crear tu cuenta" />
      <Step label="Registrar tu primer amistoso" action="Empezar" onPress={goAmistoso} />
      <Step
        label={`Seguir a ${FOLLOW_GOAL} personas`}
        sub={`${Math.min(following, FOLLOW_GOAL)} de ${FOLLOW_GOAL}`}
        done={following >= FOLLOW_GOAL}
        onPress={() => rootNav.navigate('SearchCommunity')}
      />
    </View>
  );

  const codeCard = <CodeRedeemCard mode="any" onClaimed={load} />;

  /* Puente al modo equipo */
  const teamBox = (
    <View style={[styles.teamBox, isTablet && { marginTop: 0 }]}>
      <Text style={styles.teamBoxTitle}>¿Juegas liga con un equipo?</Text>
      <Text style={styles.teamBoxText}>
        Si tu capitán usa TACTIUM, pídele el enlace de invitación o su código y
        escríbelo aquí arriba.
      </Text>
      <Pressable onPress={goUpgrade} hitSlop={8} accessibilityRole="button">
        <Text style={styles.teamBoxLink}>¿Capitaneas tú? Crea tu equipo →</Text>
      </Pressable>
    </View>
  );

  const header = (
    <>
      <Text style={styles.eyebrow}>
        {firstName ? `HOLA, ${firstName.toUpperCase()}` : 'TU PÁDEL'}
      </Text>
      <Text style={styles.title}>
        {!loaded || hasMatches ? 'Tu pádel, tus números' : 'Empieza en 3 pasos'}
      </Text>
    </>
  );

  return (
    <View style={styles.root}>
      <View style={[styles.topbar, { paddingTop: insets.top + 12 }]}>
        <View style={styles.brandRow}>
          <TactiumMark size={30} gradient />
          <Text style={styles.brand}>TACTIUM</Text>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 64 + 12 + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isTablet ? (
          <ContentColumn>
            {header}
            {!loaded ? null : hasMatches ? (
              <>
                <View style={styles.tBand}>
                  <View style={{ flex: 1.4, minWidth: 0 }}>{recordCard}</View>
                  <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
                    {amistosoBtn}
                  </View>
                </View>
                <View style={styles.tPair}>
                  <View style={styles.tCol}>{lastResults}</View>
                  {/* TU GENTE: el feed de quien sigues, con kudos. */}
                  <View style={styles.tCol}>
                    <FeedPreview />
                  </View>
                </View>
                <View style={styles.tPair}>
                  <View style={styles.tCol}>{codeCard}</View>
                  <View style={styles.tCol}>{teamBox}</View>
                </View>
              </>
            ) : (
              <>
                <View style={[styles.tPair, { marginTop: 0 }]}>
                  <View style={styles.tCol}>{steps}</View>
                  <View style={styles.tCol}>{codeCard}</View>
                </View>
                <View style={{ marginTop: 14 }}>{teamBox}</View>
              </>
            )}
          </ContentColumn>
        ) : (
          <>
            {header}

            {!loaded ? null : hasMatches ? (
              <>
                {recordCard}

                {amistosoBtn}

                {lastResults}

                {/* TU GENTE: el feed de quien sigues, con kudos. */}
                <FeedPreview />
              </>
            ) : (
              steps
            )}

            <View style={{ marginTop: 14 }}>{codeCard}</View>

            {teamBox}
          </>
        )}
      </ScrollView>
    </View>
  );
};

/** Paso de la lista de inicio: círculo (relleno si está hecho) y acción. */
const Step: React.FC<{
  label: string;
  sub?: string;
  done?: boolean;
  first?: boolean;
  action?: string;
  onPress?: () => void;
}> = ({ label, sub, done, first, action, onPress }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const content = (
    <>
      <View style={[styles.stepDot, done && styles.stepDotDone]}>
        {done ? <IconCheck size={11} color={c.textInverse} /> : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[styles.stepLabel, done && styles.stepLabelDone]}>{label}</Text>
        {sub ? <Text style={styles.stepSub}>{sub}</Text> : null}
      </View>
      {!done && action ? (
        <View style={styles.stepBtn}>
          <Text style={styles.stepBtnLabel}>{action}</Text>
        </View>
      ) : !done && onPress ? (
        <IconChevron size={14} color={c.textFaint} />
      ) : null}
    </>
  );
  if (done || !onPress) {
    return <View style={[styles.stepRow, !first && styles.stepDivider]}>{content}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.stepRow, !first && styles.stepDivider, pressed && { opacity: 0.7 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {content}
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    topbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingBottom: 10,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    brand: { color: c.text, fontSize: 15, fontWeight: '800', letterSpacing: 2 },
    scroll: { paddingHorizontal: 20, paddingTop: 10 },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2,
      marginBottom: 6,
    },
    title: {
      color: c.text,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.6,
      marginBottom: 16,
    },
    recordCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.accent40,
      padding: 14,
    },
    recordText: { fontFamily: Fonts.mono, color: c.text, fontSize: 17, fontWeight: '800' },
    recordLink: { color: c.textFaint, fontSize: 12 },
    primaryBtn: {
      flexDirection: 'row',
      gap: 8,
      height: 50,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 12,
      marginBottom: 12,
    },
    primaryBtnLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      paddingHorizontal: 14,
    },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hair },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
    resultBadge: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultBadgeTxt: { fontSize: 12, fontWeight: '800' },
    resultName: { color: c.text, fontSize: 13.5, fontWeight: '700' },
    resultMeta: { color: c.textFaint, fontSize: 11.5, marginTop: 1 },
    resultSets: { fontFamily: Fonts.mono, color: c.text, fontSize: 12, fontWeight: '600' },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
    stepDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hair },
    stepDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepDotDone: { backgroundColor: c.accent, borderColor: c.accent },
    stepLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    stepLabelDone: { color: c.textFaint, textDecorationLine: 'line-through' },
    stepSub: { color: c.textFaint, fontSize: 11.5, marginTop: 1 },
    stepBtn: {
      height: 32,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    stepBtnLabel: { color: c.textInverse, fontSize: 12.5, fontWeight: '700' },
    teamBox: {
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      borderStyle: 'dashed',
      padding: 16,
      marginTop: 14,
    },
    teamBoxTitle: { color: c.text, fontSize: 13.5, fontWeight: '700', marginBottom: 4 },
    teamBoxText: { color: c.textFaint, fontSize: 12.5, lineHeight: 18 },
    teamBoxLink: { color: c.accent, fontSize: 12.5, fontWeight: '700', marginTop: 10 },
    // Tablet (columna de 720)
    tBand: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
    tBtn: { marginTop: 0, marginBottom: 0, height: 56 },
    tPair: { flexDirection: 'row', gap: 14, alignItems: 'flex-start', marginTop: 14 },
    tCol: { flex: 1, minWidth: 0 },
  });
