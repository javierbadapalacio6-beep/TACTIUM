import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
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

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconBack, IconMenu } from '@components/ui';
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

import { MatchScoreboard } from '@features/home/components/match/MatchScoreboard';
import { SetsTable } from '@features/home/components/match/GamesPicker';
import { KudosButton } from '@features/home/components/match/KudosButton';

const formatDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

const pairNames = (parts: CasualMatchDetail['participants'], side: number): string => {
  const names = parts
    .filter((p) => p.side === side)
    .sort((a, b) => a.slot - b.slot)
    .map((p) => p.name)
    .filter(Boolean);
  return names.join(' / ') || (side === 0 ? 'Nosotros' : 'Rival');
};

/** Campos que añade la migración 20261004_partido_kudos_detalle (sin aplicar). */
type WithKudos = CasualMatchDetail & { kudos_count?: number | null; i_gave_kudos?: boolean | null };

/**
 * Detalle de amistoso (rediseño bloque «Partido»): marcador con la misma
 * cabecera que la liga, sets en tabla, kudos, cara a cara en una barra y el
 * código de reclamo solo si alguien no tiene cuenta. Foto y compartir, en ⋯.
 */
export const CasualMatchDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'CasualMatchDetail'>>();
  const { matchId } = route.params;
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<WithKudos | null>(null);
  const [h2h, setH2h] = useState<CasualH2H | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const cardRef = useRef<View>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const d = await fetchCasualMatchDetail(matchId, userId);
      setDetail(d as WithKudos | null);
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
    return {
      ourPair: pairNames(participants, mySide),
      rivalPair: pairNames(participants, otherSide),
      ourScore: mySide === 0 ? s0 : s1,
      rivalScore: mySide === 0 ? s1 : s0,
      setsStr: sets.map(([a, b]) => (mySide === 0 ? `${a}-${b}` : `${b}-${a}`)).join(' '),
      setScores: sets.map(([a, b]) => (mySide === 0 ? { us: a, them: b } : { us: b, them: a })),
      won: winnerSide != null && winnerSide === mySide,
      decided: winnerSide != null,
    };
  }, [detail]);

  const isMine = !!detail && !!userId && detail.createdBy === userId;
  const typeLabel = detail?.type === 'entreno' ? 'Entreno' : 'Amistoso';
  const unclaimed = useMemo(
    () => (detail?.participants ?? []).filter((p) => !p.user_id && p.name.trim()),
    [detail],
  );
  const canClaim = unclaimed.length > 0;

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
    setMenuOpen(false);
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
    setMenuOpen(false);
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

  const onShare = async () => {
    setMenuOpen(false);
    if (detail?.photoUrl) {
      shareCardImage(cardRef, detail.photoUrl, shareText);
      return;
    }
    try {
      await Share.share({ message: shareText });
    } catch {
      // cancelado
    }
  };

  const shareText2 = async () => {
    setMenuOpen(false);
    try {
      await Share.share({ message: shareText });
    } catch {
      // cancelado
    }
  };

  const tint = view?.decided ? (view.won ? c.accent : c.error) : c.text;
  const pair = h2h?.pair ?? null;
  const pairPct = pair && pair.total > 0 ? Math.round((pair.wins / pair.total) * 100) : 0;
  // Quien aparece como actor en el feed recibe el aviso del kudos.
  const kudosTarget = detail && detail.createdBy !== userId ? detail.createdBy : null;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.iconBtn}
        >
          <IconBack size={18} color={c.text} />
        </Pressable>
        {detail ? (
          <Pressable
            onPress={() => setMenuOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Más opciones"
            style={styles.iconBtn}
          >
            <IconMenu size={16} color={c.text} />
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : !detail || !view ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Partido no encontrado</Text>
          </View>
        ) : (
          <>
            <MatchScoreboard
              eyebrow={`${typeLabel} · ${formatDate(detail.playedOn)}`.toUpperCase()}
              left={view.ourPair}
              right={view.rivalPair}
              crests={false}
              us={view.ourScore}
              them={view.rivalScore}
              status={view.decided ? (view.won ? 'Victoria' : 'Derrota') : 'Sin decidir'}
              tint={tint}
            />

            {detail.sets.length > 0 ? (
              <View style={styles.card}>
                <SetsTable sets={view.setScores} usLabel={view.ourPair} themLabel={view.rivalPair} />
              </View>
            ) : null}

            <KudosButton
              kind="casual"
              targetId={detail.id}
              targetUserId={kudosTarget}
              userId={userId}
              initialCount={detail.kudos_count ?? null}
              initialGiven={detail.i_gave_kudos ?? null}
            />

            {pair ? (
              <>
                <Text style={styles.sectionLabel}>
                  CARA A CARA · {pair.total} {pair.total === 1 ? 'PARTIDO' : 'PARTIDOS'}
                </Text>
                <View style={styles.h2h}>
                  <Text style={[styles.h2hNum, { color: c.accent }]}>{pair.wins}</Text>
                  <View style={styles.bar} accessibilityLabel={`${pair.wins} ganados y ${pair.losses} perdidos`}>
                    <View style={[styles.barFill, { width: `${pairPct}%` }]} />
                  </View>
                  <Text style={[styles.h2hNum, { color: c.error }]}>{pair.losses}</Text>
                </View>
              </>
            ) : null}

            {h2h && h2h.individuals.length > 0 ? (
              <View style={styles.card}>
                {h2h.individuals.map((iv, i) => (
                  <View
                    key={iv.user_id ?? iv.name.toLowerCase()}
                    style={[styles.indivRow, i === h2h.individuals.length - 1 && { borderBottomWidth: 0 }]}
                  >
                    <View style={styles.av}>
                      <Text style={styles.avText}>{iv.name.trim().slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.indivName} numberOfLines={1}>
                        Contra {iv.name}
                      </Text>
                      <Text style={styles.indivSub}>
                        {iv.wins} {iv.wins === 1 ? 'ganado' : 'ganados'} · {iv.losses}{' '}
                        {iv.losses === 1 ? 'perdido' : 'perdidos'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {isMine && canClaim && detail.claimCode ? (
              <Pressable
                onPress={shareText2}
                accessibilityRole="button"
                accessibilityLabel="Compartir el código del partido"
                style={({ pressed }) => [styles.code, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.codeHint} numberOfLines={2}>
                  {unclaimed.length === 1
                    ? `${unclaimed[0].name} aún no tiene TACTIUM`
                    : `${unclaimed.length} jugadores aún no tienen TACTIUM`}
                  {' · toca para compartir'}
                </Text>
                <Text style={styles.codeValue} selectable>
                  {detail.claimCode}
                </Text>
              </Pressable>
            ) : null}

            {detail.photoUrl ? (
              <>
                <Text style={styles.sectionLabel}>FOTO DEL PARTIDO</Text>
                <View style={{ alignItems: 'center' }}>
                  <PhotoShareCard
                    ref={cardRef}
                    photoUri={detail.photoUrl}
                    title={`${view.ourPair} ${view.ourScore} – ${view.rivalScore} ${view.rivalPair}`}
                    subtitle={`${typeLabel} · ${formatDate(detail.playedOn)}`}
                    detail={
                      view.decided
                        ? `${view.won ? 'VICTORIA' : 'DERROTA'}${view.setsStr ? ` · ${view.setsStr}` : ''}`
                        : view.setsStr
                    }
                    homeName={view.ourPair}
                    homeScore={view.ourScore}
                    awayName={view.rivalPair}
                    awayScore={view.rivalScore}
                    highlight={view.decided ? (view.won ? 'home' : 'away') : 'home'}
                  />
                </View>
              </>
            ) : null}
            {busy ? <ActivityIndicator color={c.accent} /> : null}
          </>
        )}
      </ScrollView>

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <View style={styles.menu}>
          <MenuItem label={detail?.photoUrl ? 'Compartir foto' : 'Compartir resultado'} onPress={onShare} />
          {detail?.photoUrl ? <MenuItem label="Compartir solo el texto" onPress={shareText2} /> : null}
          {isMine ? (
            <MenuItem label={detail?.photoUrl ? 'Cambiar foto' : 'Añadir foto del partido'} onPress={onAddPhoto} />
          ) : null}
          {isMine && detail?.photoUrl ? <MenuItem label="Quitar foto" danger onPress={onRemovePhoto} /> : null}
        </View>
      </BottomSheet>
    </View>
  );
};

const MenuItem: React.FC<{ label: string; onPress: () => void; danger?: boolean }> = ({
  label,
  onPress,
  danger,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: c.accent10 }]}
    >
      <Text style={[styles.menuText, danger && { color: c.error }]}>{label}</Text>
    </Pressable>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    content: { paddingHorizontal: 16, gap: 10 },
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
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hair,
      padding: 12,
    },
    sectionLabel: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10.5,
      letterSpacing: 2,
      fontWeight: '500',
      marginTop: 6,
    },
    h2h: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    h2hNum: { fontFamily: Fonts.mono, fontSize: 18, fontWeight: '800', minWidth: 22, textAlign: 'center' },
    bar: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: 'rgba(255,107,107,0.45)',
      overflow: 'hidden',
    },
    barFill: { height: '100%', backgroundColor: c.accent },
    indivRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hair,
    },
    av: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avText: { fontFamily: Fonts.mono, fontSize: 10.5, fontWeight: '700', color: c.textMuted },
    indivName: { color: c.text, fontSize: 14, fontWeight: '600' },
    indivSub: { color: c.textFaint, fontSize: 12, marginTop: 1 },
    code: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: 12,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.hairStrong,
    },
    codeHint: { flex: 1, color: c.textFaint, fontSize: 12 },
    codeValue: { fontFamily: Fonts.mono, color: c.text, fontSize: 16, fontWeight: '700', letterSpacing: 3 },
    menu: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.bgCard,
      overflow: 'hidden',
    },
    menuItem: {
      minHeight: 50,
      justifyContent: 'center',
      paddingHorizontal: 14,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hair,
    },
    menuText: { color: c.text, fontSize: 15, fontWeight: '600' },
  });
