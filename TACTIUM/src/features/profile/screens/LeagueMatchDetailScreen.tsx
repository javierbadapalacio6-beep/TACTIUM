import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { PhotoShareCard, shareCardImage } from '@components/share/PhotoShareCard';
import { DOWNLOAD_URL } from '@core/config/referral';
import { fetchPublicMatchday, type PublicMatchday } from '@core/services/social';
import type { RootStackParamList } from '@navigation/types';

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} de ${MESES[m - 1]} de ${y}`;
};

const OUTCOME: Record<string, { label: string; won: boolean | null }> = {
  win: { label: 'VICTORIA', won: true },
  loss: { label: 'DERROTA', won: false },
  draw: { label: 'EMPATE', won: null },
};

// Partido de liga (jornada) en SOLO LECTURA — al que llevan las fotos de
// jornada del perfil. Sin acciones: es una vista pública.
export const LeagueMatchDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'LeagueMatchDetail'>>();
  const { matchdayId } = route.params;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [md, setMd] = useState<PublicMatchday | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMd(await fetchPublicMatchday(matchdayId));
    } catch (e) {
      console.warn('LeagueMatchDetail load', e);
    } finally {
      setLoading(false);
    }
  }, [matchdayId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const oc = md?.outcome ? OUTCOME[md.outcome] ?? null : null;
  const meta = md
    ? [
        md.category,
        md.group_name ? `Grupo ${md.group_name}` : null,
        formatDate(md.match_date),
      ]
        .filter(Boolean)
        .join(' · ')
    : '';

  const cardRef = useRef<View>(null);
  const shareText = useMemo(() => {
    if (!md) return '';
    const header =
      `🎾 ${md.team_name ?? ''} ${md.score_for ?? 0}–${md.score_against ?? 0} ${md.opponent ?? ''}` +
      (md.jornada_number != null ? ` · Jornada ${md.jornada_number}` : '');
    return [header, '', 'Sigue tus ligas con TACTIUM 🏆', DOWNLOAD_URL].join('\n');
  }, [md]);
  const onShare = () => {
    if (!md?.photo_url) return;
    shareCardImage(cardRef, md.photo_url, shareText);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <IconBack size={20} color={c.text} />
        </Pressable>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : !md ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Partido no disponible</Text>
          </View>
        ) : (
          <>
            <Text style={styles.eyebrow}>
              {md.jornada_number != null ? `JORNADA ${md.jornada_number}` : 'PARTIDO'}
              {meta ? ` · ${meta}` : ''}
            </Text>

            {md.photo_url ? (
              <>
                <View style={styles.cardWrap}>
                  <PhotoShareCard
                    ref={cardRef}
                    photoUri={md.photo_url}
                    title={`${md.team_name ?? ''} ${md.score_for ?? 0} – ${md.score_against ?? 0} ${md.opponent ?? ''}`}
                    subtitle={`${md.jornada_number != null ? `Jornada ${md.jornada_number}` : 'Partido'}${meta ? ` · ${meta}` : ''}`}
                    detail={
                      oc
                        ? `${oc.label}${md.is_home != null ? ` · ${md.is_home ? 'Local' : 'Visitante'}` : ''}`
                        : ''
                    }
                    homeName={md.team_name ?? 'Nuestro equipo'}
                    homeScore={md.score_for ?? 0}
                    awayName={md.opponent ?? 'Rival'}
                    awayScore={md.score_against ?? 0}
                    highlight={oc?.won === true ? 'home' : oc?.won === false ? 'away' : 'home'}
                  />
                </View>
                <Pressable
                  onPress={onShare}
                  style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.shareBtnLabel}>Compartir foto</Text>
                </Pressable>
              </>
            ) : (
              <>
                {/* Sin foto: scoreboard clásico */}
                <View style={styles.scoreCard}>
                  <ScoreRow
                    name={md.team_name ?? 'Nuestro equipo'}
                    score={md.score_for}
                    win={oc?.won === true}
                  />
                  <View style={styles.scoreDivider} />
                  <ScoreRow
                    name={md.opponent ?? 'Rival'}
                    score={md.score_against}
                    win={oc?.won === false}
                  />
                </View>
                {oc ? (
                  <View
                    style={[
                      styles.outcomePill,
                      {
                        borderColor:
                          oc.won === true ? c.accent : oc.won === false ? c.error : c.warning,
                        backgroundColor:
                          (oc.won === true ? c.accent : oc.won === false ? c.error : c.warning) + '14',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.outcomeText,
                        {
                          color:
                            oc.won === true ? c.accent : oc.won === false ? c.error : c.warning,
                        },
                      ]}
                    >
                      {oc.label}
                      {md.is_home != null ? ` · ${md.is_home ? 'Local' : 'Visitante'}` : ''}
                    </Text>
                  </View>
                ) : null}
              </>
            )}

            {/* Resultados por pista */}
            {md.courts.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>RESULTADOS POR PISTA</Text>
                <View style={styles.courtsCard}>
                  {md.courts.map((ct) => (
                    <View key={ct.court_number} style={styles.courtRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.courtLabel}>PISTA {ct.court_number}</Text>
                        {ct.pair ? (
                          <Text style={styles.courtPair} numberOfLines={1}>
                            {ct.pair}
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.courtSets,
                          ct.forfeit && { color: ct.forfeit_us ? c.error : c.accent },
                        ]}
                      >
                        {ct.forfeit
                          ? `W.O. ${ct.forfeit_us ? 'en contra' : 'a favor'}`
                          : ct.sets.length
                            ? ct.sets.map((s) => `${s.us}-${s.them}`).join('  ')
                            : '—'}
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const ScoreRow: React.FC<{ name: string; score: number | null; win: boolean }> = ({
  name,
  score,
  win,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.scoreRow}>
      <Text style={[styles.scoreName, win && { color: c.text }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.scoreValue, win && { color: c.accent }]}>
        {score ?? '–'}
      </Text>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 20 },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 14,
    },
    loader: { paddingTop: 60, alignItems: 'center' },
    emptyBox: {
      marginTop: 24,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      padding: 20,
    },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.accent,
      fontWeight: '500',
      marginBottom: 12,
    },
    cardWrap: { alignItems: 'center', marginBottom: 4 },
    shareBtn: {
      height: 50,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 14,
    },
    shareBtnLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
    scoreCard: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.accent40,
      padding: 18,
      gap: 4,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    scoreName: {
      flex: 1,
      color: c.textMuted,
      fontSize: 19,
      fontWeight: '700',
      letterSpacing: -0.3,
    },
    scoreValue: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 26,
      fontWeight: '800',
      minWidth: 30,
      textAlign: 'right',
    },
    scoreDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.hair,
      marginVertical: 6,
    },
    outcomePill: {
      alignSelf: 'flex-start',
      marginTop: 12,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: 1,
    },
    outcomeText: {
      fontFamily: Fonts.mono,
      fontSize: 12,
      letterSpacing: 1,
      fontWeight: '800',
    },
    sectionLabel: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 11,
      letterSpacing: 2,
      fontWeight: '500',
      marginTop: 22,
      marginBottom: 8,
    },
    courtsCard: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      paddingHorizontal: 16,
    },
    courtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 11,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderColor: c.hair,
    },
    courtLabel: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10,
      letterSpacing: 1,
    },
    courtPair: { color: c.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
    courtSets: { fontFamily: Fonts.mono, color: c.text, fontSize: 15, fontWeight: '700', textAlign: 'right' },
  });
