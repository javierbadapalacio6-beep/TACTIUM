import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import {
  fetchCasualMatchDetail,
  fetchCasualH2H,
  uploadCasualPhoto,
  removeCasualPhoto,
  type CasualMatchDetail,
  type CasualH2H,
} from '@core/services/casualMatches';
import {
  PhotoShareCard,
  shareCardImage,
  pickMatchPhoto,
} from '@components/share/PhotoShareCard';
import { DOWNLOAD_URL } from '@core/config/referral';
import type { RootStackParamList } from '@navigation/types';

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

const pairNames = (
  parts: CasualMatchDetail['participants'],
  side: number,
): string => {
  const names = parts
    .filter((p) => p.side === side)
    .sort((a, b) => a.slot - b.slot)
    .map((p) => p.name)
    .filter(Boolean);
  return names.join(' / ') || (side === 0 ? 'Nosotros' : 'Rival');
};

export const CasualMatchDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route =
    useRoute<RouteProp<RootStackParamList, 'CasualMatchDetail'>>();
  const { matchId } = route.params;
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<CasualMatchDetail | null>(null);
  const [h2h, setH2h] = useState<CasualH2H | null>(null);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<View>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await fetchCasualMatchDetail(matchId, userId);
      setDetail(d);
      fetchCasualH2H(userId, matchId)
        .then(setH2h)
        .catch(() => setH2h(null));
    } catch (e) {
      console.warn('CasualMatchDetail load', e);
    } finally {
      setLoading(false);
    }
  }, [matchId, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Marcador desde MI perspectiva.
  const view = useMemo(() => {
    if (!detail) return null;
    const { mySide, sets, winnerSide, participants } = detail;
    const otherSide = mySide === 0 ? 1 : 0;
    let s0 = 0;
    let s1 = 0;
    for (const [a, b] of sets) {
      if (a > b) s0++;
      else if (b > a) s1++;
    }
    const ourScore = mySide === 0 ? s0 : s1;
    const rivalScore = mySide === 0 ? s1 : s0;
    const setsStr = sets
      .map(([a, b]) => (mySide === 0 ? `${a}-${b}` : `${b}-${a}`))
      .join(' ');
    return {
      ourPair: pairNames(participants, mySide),
      rivalPair: pairNames(participants, otherSide),
      ourScore,
      rivalScore,
      setsStr,
      won: winnerSide != null && winnerSide === mySide,
      decided: winnerSide != null,
    };
  }, [detail]);

  const isMine = !!detail && !!userId && detail.createdBy === userId;
  const typeLabel = detail?.type === 'entreno' ? 'Entreno' : 'Amistoso';

  // ¿Hay alguien que jugó y NO está en la app? Ese es a quien le sirve el
  // código para reclamar sus stats.
  const canClaim = useMemo(
    () => !!detail?.participants.some((p) => !p.user_id && p.name.trim()),
    [detail],
  );

  const shareText = useMemo(() => {
    if (!detail || !view) return '';
    const header =
      `🎾 ${view.ourPair} ${view.ourScore}–${view.rivalScore} ${view.rivalPair}` +
      (view.setsStr ? ` (${view.setsStr})` : '');
    const hook =
      canClaim && detail.claimCode
        ? `Este partido ya vive en TACTIUM. Con el código ${detail.claimCode} lo sumas a tus stats: victorias, rachas y cara a cara. 🏆`
        : 'Organiza tus amistosos con TACTIUM: victorias, rachas y cara a cara. 🏆';
    return [header, '', hook, DOWNLOAD_URL].join('\n');
  }, [detail, view, canClaim]);

  const onAddPhoto = async () => {
    if (!userId) return;
    const uri = await pickMatchPhoto();
    if (!uri) return;
    setBusy(true);
    try {
      await uploadCasualPhoto(userId, matchId, uri);
      await load();
    } catch (e) {
      Alert.alert('No se pudo subir la foto', String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const onRemovePhoto = () => {
    if (!userId) return;
    Alert.alert('Quitar foto', '¿Seguro que quieres quitar la foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeCasualPhoto(userId, matchId);
            await load();
          } catch (e) {
            Alert.alert('Error', String((e as Error).message ?? e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const onShare = () => {
    if (!detail?.photoUrl) return;
    shareCardImage(cardRef, detail.photoUrl, shareText);
  };

  // Compartir SOLO el texto (con el código) — para cuando no hay foto o se
  // quiere mandar el código suelto a quien jugó y no tiene la app.
  const shareCode = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      // cancelado por el usuario
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <IconBack size={20} color={Colors.text} />
        </Pressable>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : !detail || !view ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Partido no encontrado</Text>
          </View>
        ) : (
          <>
            <Text style={styles.eyebrow}>
              {typeLabel.toUpperCase()} · {formatDate(detail.playedOn)}
            </Text>

            {/* Tarjeta estilo liga: pareja/resultado sobre pareja/resultado.
                Con foto → tarjeta Strava (overlay). Sin foto → scoreboard. */}
            {detail.photoUrl ? (
              <View style={styles.cardWrap}>
                <PhotoShareCard
                  ref={cardRef}
                  photoUri={detail.photoUrl}
                  title={`${view.ourPair} ${view.ourScore} – ${view.rivalScore} ${view.rivalPair}`}
                  subtitle={`${typeLabel} · ${formatDate(detail.playedOn)}`}
                  detail={
                    view.decided
                      ? `${view.won ? 'VICTORIA' : 'DERROTA'}${
                          view.setsStr ? ` · ${view.setsStr}` : ''
                        }`
                      : view.setsStr
                  }
                  homeName={view.ourPair}
                  homeScore={view.ourScore}
                  awayName={view.rivalPair}
                  awayScore={view.rivalScore}
                  highlight={
                    view.decided ? (view.won ? 'home' : 'away') : 'home'
                  }
                />
              </View>
            ) : (
              <View style={styles.scoreCard}>
                <ScoreRow
                  name={view.ourPair}
                  score={view.ourScore}
                  win={view.decided && view.won}
                />
                <View style={styles.scoreDivider} />
                <ScoreRow
                  name={view.rivalPair}
                  score={view.rivalScore}
                  win={view.decided && !view.won}
                />
              </View>
            )}

            {/* Sets, set a set (desde mi perspectiva) */}
            <Text style={styles.sectionLabel}>SETS</Text>
            <View style={styles.setsCard}>
              {detail.sets.length > 0 ? (
                detail.sets.map(([a, b], i) => {
                  const us = detail.mySide === 0 ? a : b;
                  const them = detail.mySide === 0 ? b : a;
                  return (
                    <View key={i} style={styles.setRow}>
                      <Text style={styles.setLabel}>SET {i + 1}</Text>
                      <Text style={styles.setScore}>
                        <Text
                          style={us > them ? styles.setWin : styles.setLose}
                        >
                          {us}
                        </Text>
                        <Text style={styles.setSep}> – </Text>
                        <Text
                          style={them > us ? styles.setWin : styles.setLose}
                        >
                          {them}
                        </Text>
                      </Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyText}>Sin sets registrados.</Text>
              )}
            </View>

            {/* Head-to-head PAREJA vs PAREJA (encuentros anteriores) */}
            {h2h?.pair ? (
              <>
                <Text style={styles.sectionLabel}>
                  CARA A CARA · TU PAREJA VS ELLOS
                </Text>
                <View style={styles.h2hCard}>
                  <View style={styles.h2hHeadline}>
                    <Text style={styles.h2hBig}>
                      <Text style={{ color: Colors.accent }}>
                        {h2h.pair.wins}
                      </Text>
                      <Text style={styles.h2hSep}> – </Text>
                      <Text style={{ color: Colors.error }}>
                        {h2h.pair.losses}
                      </Text>
                    </Text>
                    <Text style={styles.h2hMeta}>
                      {h2h.pair.total}{' '}
                      {h2h.pair.total === 1 ? 'encuentro previo' : 'encuentros previos'}
                    </Text>
                  </View>
                  <Text style={styles.h2hPairs} numberOfLines={2}>
                    {h2h.pair.usNames.join(' / ')}{'  vs  '}
                    {h2h.pair.themNames.join(' / ')}
                  </Text>
                </View>
              </>
            ) : null}

            {/* Head-to-head INDIVIDUAL contra cada rival */}
            {h2h && h2h.individuals.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>
                  CARA A CARA · TÚ VS CADA RIVAL
                </Text>
                <View style={styles.card}>
                  {h2h.individuals.map((iv) => (
                    <View
                      key={iv.user_id ?? iv.name.toLowerCase()}
                      style={styles.indivRow}
                    >
                      <Text style={styles.indivName} numberOfLines={1}>
                        {iv.name}
                      </Text>
                      <Text style={styles.indivRecord}>
                        <Text style={{ color: Colors.accent }}>{iv.wins}</Text>
                        <Text style={styles.h2hSep}>–</Text>
                        <Text style={{ color: Colors.error }}>{iv.losses}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </>
            ) : null}

            {/* Código del partido: para que quien jugó y no está en la app
                reclame sus stats. Solo lo ve el creador y solo si hay algún
                participante sin cuenta. */}
            {isMine && canClaim && detail.claimCode ? (
              <>
                <Text style={styles.sectionLabel}>CÓDIGO DEL PARTIDO</Text>
                <View style={styles.codeCard}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.codeValue} selectable>
                      {detail.claimCode}
                    </Text>
                    <Text style={styles.codeHint}>
                      Compártelo con quien jugó y no tiene TACTIUM: al
                      registrarse, mete el código en Stats y este partido cuenta
                      en sus estadísticas.
                    </Text>
                  </View>
                  <Pressable
                    onPress={shareCode}
                    style={({ pressed }) => [
                      styles.codeShareBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.codeShareLabel}>Compartir</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {/* Acciones de foto (solo el creador puede escribir) */}
            {isMine ? (
              <View style={styles.actions}>
                {detail.photoUrl ? (
                  <>
                    <Pressable
                      onPress={onShare}
                      disabled={busy}
                      style={({ pressed }) => [
                        styles.primaryBtn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={styles.primaryBtnLabel}>Compartir foto</Text>
                    </Pressable>
                    <View style={styles.actionRow}>
                      <Pressable
                        onPress={onAddPhoto}
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.secondaryBtn,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={styles.secondaryBtnLabel}>
                          Cambiar foto
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={onRemovePhoto}
                        disabled={busy}
                        style={({ pressed }) => [
                          styles.secondaryBtn,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.secondaryBtnLabel,
                            { color: Colors.error },
                          ]}
                        >
                          Quitar foto
                        </Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <Pressable
                    onPress={onAddPhoto}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      pressed && { opacity: 0.85 },
                    ]}
                  >
                    <Text style={styles.primaryBtnLabel}>
                      Añadir foto del partido
                    </Text>
                  </Pressable>
                )}
                {busy ? (
                  <ActivityIndicator
                    color={Colors.accent}
                    style={{ marginTop: 10 }}
                  />
                ) : null}
              </View>
            ) : detail.photoUrl ? (
              <View style={styles.actions}>
                <Image
                  source={{ uri: detail.photoUrl }}
                  style={styles.readonlyPhoto}
                  resizeMode="cover"
                />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const ScoreRow: React.FC<{ name: string; score: number; win: boolean }> = ({
  name,
  score,
  win,
}) => (
  <View style={styles.scoreRow}>
    <Text
      style={[styles.scoreName, win && { color: Colors.text }]}
      numberOfLines={1}
    >
      {name}
    </Text>
    <Text style={[styles.scoreValue, win && { color: Colors.accent }]}>
      {score}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20 },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  loader: { paddingTop: 60, alignItems: 'center' },
  emptyBox: {
    marginTop: 24,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    padding: 20,
  },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  emptyText: { color: Colors.textMuted, fontSize: 13 },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.accent,
    fontWeight: '500',
    marginBottom: 12,
  },
  cardWrap: { alignItems: 'center', marginBottom: 4 },
  scoreCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.accent40,
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
    color: Colors.textMuted,
    fontSize: 19,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  scoreValue: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 26,
    fontWeight: '800',
    minWidth: 30,
    textAlign: 'right',
  },
  scoreDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.hair,
    marginVertical: 6,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
    marginTop: 22,
    marginBottom: 8,
  },
  codeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.accent40,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  codeValue: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 4,
  },
  codeHint: {
    color: Colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
  },
  codeShareBtn: {
    height: 40,
    borderRadius: 11,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  codeShareLabel: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  setsCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair,
  },
  setLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  setScore: { fontFamily: Fonts.mono, fontSize: 16, fontWeight: '700' },
  setWin: { color: Colors.accent },
  setLose: { color: Colors.textMuted },
  setSep: { color: Colors.textFaint },
  h2hCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    padding: 16,
    gap: 8,
  },
  h2hHeadline: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  h2hBig: { fontFamily: Fonts.mono, fontSize: 30, fontWeight: '800' },
  h2hSep: { color: Colors.textFaint },
  h2hMeta: { color: Colors.textFaint, fontSize: 12, fontFamily: Fonts.mono },
  h2hPairs: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingHorizontal: 16,
  },
  indivRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.hair,
  },
  indivName: { flex: 1, color: Colors.text, fontSize: 15, fontWeight: '600' },
  indivRecord: { fontFamily: Fonts.mono, fontSize: 16, fontWeight: '800' },
  actions: { marginTop: 24 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  primaryBtn: {
    height: 50,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnLabel: { color: '#001810', fontSize: 15, fontWeight: '700' },
  secondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnLabel: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  readonlyPhoto: {
    width: '100%',
    height: 220,
    borderRadius: Radius.lg,
    backgroundColor: Colors.bgCard,
  },
});
