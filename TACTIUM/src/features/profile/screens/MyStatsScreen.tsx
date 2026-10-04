import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@navigation/types';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconBack, IconCheck, IconLink } from '@components/ui';
import { SegmentedControl } from '@components/ui/SegmentedControl';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import { fetchMyPlayer, type Player } from '@core/services/players';
import {
  fetchMyCasualStats,
  fetchMyCasualMatches,
  fetchMyFrequentPartners,
  type MyCasualStats,
  type CasualMatchSummary,
  type FrequentPartner,
} from '@core/services/casualMatches';
import { fetchSeasons, type Season } from '@core/services/seasons';
import {
  PhotoShareCard,
  sharePhotoCard,
  pickMatchPhoto,
} from '@components/share/PhotoShareCard';
import { DOWNLOAD_URL } from '@core/config/referral';
import {
  fetchLeagueStatsBundle,
  computePlayerLeagueStats,
  type PlayerLeagueStats,
  type LeagueStatsBundle,
} from '@core/services/playerStats';
import { displayNameOf } from '@core/utils/format';
import { FederacionStatsCard } from '@features/profile/components/FederacionStatsCard';
import { CodeRedeemCard } from '@features/profile/components/CodeRedeemCard';
import { WinRing, StreakPips, GrowBar } from '@features/profile/components/StatsVisuals';

// Mis números. Arriba, el récord (anillo del % y racha); una sola barra
// «Liga · Amistosos · Plantilla» y la temporada en la cabecera. Lo primero es
// lo tuyo en TACTIUM; la ficha de la federación va debajo.

const formatShortDate = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
};

type Tab = 'liga' | 'amistosos' | 'plantilla';
/** 'activa' | 'todas' | id de una temporada concreta. */
type SeasonScope = string;

/** Filas visibles del ranking antes de fijar la tuya al final. */
const RANK_TOP = 6;

export const MyStatsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const team = useTeamStore((s) => s.team);
  const players = useTeamStore((s) => s.players);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? null;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);

  // Sin equipo (jugador suelto) solo hay amistosos.
  const [tab, setTab] = useState<Tab>(team ? 'liga' : 'amistosos');
  const [seasonScope, setSeasonScope] = useState<SeasonScope>('activa');
  const [seasonSheet, setSeasonSheet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Player | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [stats, setStats] = useState<PlayerLeagueStats | null>(null);
  const [bundle, setBundle] = useState<LeagueStatsBundle | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [casual, setCasual] = useState<MyCasualStats | null>(null);
  const [casualMatches, setCasualMatches] = useState<CasualMatchSummary[]>([]);
  const [partners, setPartners] = useState<FrequentPartner[]>([]);
  const photoCardRef = React.useRef<View>(null);

  useEffect(() => {
    if (!team && tab !== 'amistosos') setTab('amistosos');
  }, [team, tab]);

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [player, allSeasons] = team
        ? await Promise.all([fetchMyPlayer(team.id, userId), fetchSeasons(team.id)])
        : [null, [] as Season[]];
      setMe(player);
      setSeasons(allSeasons);
      const ids =
        !team
          ? []
          : seasonScope === 'activa'
            ? allSeasons.filter((s) => s.active).map((s) => s.id)
            : seasonScope === 'todas'
              ? allSeasons.map((s) => s.id)
              : allSeasons.filter((s) => s.id === seasonScope).map((s) => s.id);
      const b = ids.length ? await fetchLeagueStatsBundle(ids) : null;
      setBundle(b);
      setStats(player && b ? computePlayerLeagueStats(player.id, b) : null);
      // Amistosos: independientes de la temporada.
      fetchMyCasualStats(userId).then(setCasual).catch(() => setCasual(null));
      fetchMyCasualMatches(userId)
        .then(setCasualMatches)
        .catch(() => setCasualMatches([]));
      fetchMyFrequentPartners(userId)
        .then(setPartners)
        .catch(() => setPartners([]));
    } catch (e) {
      console.warn('MyStats load', e);
    } finally {
      setLoading(false);
    }
  }, [team, userId, seasonScope]);

  useEffect(() => {
    load();
  }, [load]);
  const focusReload = useCallback(() => {
    load();
  }, [load]);
  useFocusEffect(focusReload);

  const shareText = useMemo(() => {
    if (!stats || !me) return '';
    const streak =
      stats.currentStreak > 1 ? ` · racha de ${stats.currentStreak} victorias 🔥` : '';
    return [
      `🎾 *Mis números en TACTIUM*`,
      `${me.name} · ${team?.name ?? ''}`,
      `${stats.played} partidos de liga · ${stats.won}V–${stats.lost}D (${stats.winRate ?? 0}%)${streak}`,
      `Sets: ${stats.setsWon}–${stats.setsLost}`,
      ``,
      `Sigue tus partidos y tus stats en TACTIUM: ${DOWNLOAD_URL}`,
    ].join('\n');
  }, [stats, me, team]);

  const handleShare = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      // cancelado
    }
  };

  const pickPhoto = async () => {
    const uri = await pickMatchPhoto();
    if (uri) setPhotoUri(uri);
  };

  const ranking = useMemo(() => {
    if (!bundle) return [];
    return players
      .map((pl) => ({ pl, s: computePlayerLeagueStats(pl.id, bundle) }))
      .filter((r) => r.s.played > 0)
      .sort(
        (a, b) =>
          (b.s.winRate ?? 0) - (a.s.winRate ?? 0) ||
          b.s.won - a.s.won ||
          b.s.played - a.s.played,
      );
  }, [players, bundle]);

  const seasonLabel =
    seasonScope === 'activa'
      ? seasons.find((s) => s.active)?.name ?? 'Temporada activa'
      : seasonScope === 'todas'
        ? 'Todas las temporadas'
        : seasons.find((s) => s.id === seasonScope)?.name ?? 'Temporada';

  const displayName = me?.name ?? (user ? displayNameOf(user) : 'Tus números');
  const goAmistoso = () =>
    navigation.navigate('MainTabs', { screen: 'Home', params: { screen: 'Amistoso' } });

  // ── Bloques ─────────────────────────────────────────────────────────────
  const renderRecordHero = (p: {
    pct: number | null;
    won: number;
    lost: number;
    lastFive?: ('W' | 'L')[];
    streak?: number;
  }) => (
    <View style={styles.heroCard}>
      <WinRing pct={p.pct} />
      <View style={{ flex: 1, gap: 7 }}>
        <Text style={styles.heroRecord}>
          {p.won}
          <Text style={{ color: c.textFaint }}> V · </Text>
          {p.lost}
          <Text style={{ color: c.textFaint }}> D</Text>
        </Text>
        {p.lastFive && p.lastFive.length > 0 ? <StreakPips results={p.lastFive} /> : null}
        {p.streak && p.streak >= 2 ? (
          <Text style={styles.heroStreak}>🔥 Racha de {p.streak} victorias</Text>
        ) : (
          <Text style={styles.heroStreakMuted}>de victorias</Text>
        )}
      </View>
    </View>
  );

  const renderLiga = () => {
    if (!me) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Aún no estás vinculado</Text>
          <Text style={styles.emptyText}>
            Pide a tu capitán que te invite al equipo y elige tu ficha en la plantilla. A
            partir de ahí, cada partido de liga contará aquí.
          </Text>
        </View>
      );
    }
    if (!stats || stats.played === 0) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Sin partidos de liga todavía</Text>
          <Text style={styles.emptyText}>
            Cuando juegues jornadas con alineación y resultado, tus números aparecerán
            aquí solos.
          </Text>
        </View>
      );
    }
    return (
      <>
        {renderRecordHero({
          pct: stats.winRate,
          won: stats.won,
          lost: stats.lost,
          lastFive: stats.lastFive,
          streak: stats.currentStreak,
        })}
        <View style={styles.grid}>
          <StatCell label="PARTIDOS" value={String(stats.played)} />
          <StatCell label="SETS" value={`${stats.setsWon}–${stats.setsLost}`} />
          <StatCell
            label="RACHA"
            value={
              stats.currentStreak === 0
                ? '—'
                : stats.currentStreak > 0
                  ? `${stats.currentStreak}V`
                  : `${Math.abs(stats.currentStreak)}D`
            }
            highlight={stats.currentStreak >= 3}
          />
          <StatCell label="MEJOR" value={stats.bestStreak > 0 ? `${stats.bestStreak}V` : '—'} />
        </View>

        {stats.byCourt.length > 0 ? (
          <View style={[styles.card, { marginTop: 10 }]}>
            <Text style={styles.cardEyebrow}>POR PISTA</Text>
            {stats.byCourt.map((ct) => {
              const pct = ct.played > 0 ? Math.round((ct.won / ct.played) * 100) : 0;
              return (
                <View key={ct.court} style={styles.courtRow}>
                  <Text style={styles.courtLabel}>P{ct.court}</Text>
                  <GrowBar pct={pct} />
                  <Text style={styles.courtValue}>
                    {ct.won}/{ct.played}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {stats.bestPartner ? (
          <View style={[styles.card, styles.partnerCard, { marginTop: 10 }]}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.cardEyebrowAccent}>MEJOR PAREJA</Text>
              <Text style={styles.partnerName} numberOfLines={1}>
                {stats.bestPartner.name}
              </Text>
              <Text style={styles.partnerMeta}>
                {stats.bestPartner.won} de {stats.bestPartner.played} juntos
              </Text>
            </View>
            <Text style={styles.partnerPct}>
              {Math.round((stats.bestPartner.won / stats.bestPartner.played) * 100)}%
            </Text>
          </View>
        ) : null}

        {photoUri ? (
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <PhotoShareCard
              ref={photoCardRef}
              photoUri={photoUri}
              title={`${stats.winRate}% de victorias`}
              subtitle={`${me?.name ?? ''} · ${team?.name ?? ''}`}
              detail={`${stats.won}V–${stats.lost}D · ${stats.played} PJ${
                stats.currentStreak >= 3 ? ` · 🔥${stats.currentStreak}` : ''
              }`}
            />
          </View>
        ) : null}
        <Pressable
          onPress={photoUri ? () => sharePhotoCard(photoCardRef, photoUri, shareText) : handleShare}
          style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.shareBtnLabel}>
            {photoUri ? 'Compartir foto y números' : 'Compartir mis números'}
          </Text>
        </Pressable>
        <Pressable
          onPress={pickPhoto}
          style={({ pressed }) => [styles.photoBtn, pressed && { opacity: 0.7 }]}
        >
          <Text style={styles.photoBtnLabel}>
            {photoUri ? 'Cambiar foto' : 'Añadir foto del partido'}
          </Text>
        </Pressable>
      </>
    );
  };

  const renderAmistosos = () => {
    if (!casual || casual.played === 0) {
      return (
        <View style={[styles.card, styles.emptyCasual]}>
          <WinRing pct={null} />
          <Text style={styles.emptyTitle}>Tu primer partido empieza aquí</Text>
          <Text style={[styles.emptyText, { textAlign: 'center' }]}>
            Apunta un amistoso y verás tu % de victorias, tu racha y con quién ganas más.
          </Text>
          <Pressable
            onPress={goAmistoso}
            style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
            accessibilityRole="button"
          >
            <Text style={styles.shareBtnLabel}>Registrar un amistoso</Text>
          </Pressable>
        </View>
      );
    }
    // Racha y últimos 5 a partir de la lista (más reciente primero).
    const decided = casualMatches.slice(0, 5).reverse();
    let streak = 0;
    for (const m of casualMatches) {
      if (m.won) streak++;
      else break;
    }
    return (
      <>
        {renderRecordHero({
          pct: casual.winRate,
          won: casual.won,
          lost: casual.lost,
          lastFive: decided.map((m) => (m.won ? 'W' : 'L')),
          streak,
        })}
        <View style={styles.grid}>
          <StatCell label="PARTIDOS" value={String(casual.played)} />
          <StatCell label="AMISTOSOS" value={String(casual.amistosos)} />
          <StatCell label="ENTRENOS" value={String(casual.entrenos)} />
        </View>

        {casualMatches.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>RESULTADOS</Text>
            <View style={[styles.card, { paddingVertical: 4 }]}>
              {casualMatches.map((cm, i) => (
                <Pressable
                  key={cm.id}
                  onPress={() => navigation.navigate('CasualMatchDetail', { matchId: cm.id })}
                  style={({ pressed }) => [
                    styles.resultRow,
                    i > 0 && styles.rowDivider,
                    pressed && { opacity: 0.6 },
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
                    <Text style={styles.rankName} numberOfLines={1}>
                      vs {cm.rivals || 'rival'}
                      {cm.photoUrl ? '  📷' : ''}
                    </Text>
                    <Text style={styles.rankMeta} numberOfLines={1}>
                      {cm.partner ? `con ${cm.partner} · ` : ''}
                      {formatShortDate(cm.playedOn)}
                      {cm.type === 'entreno' ? ' · entreno' : ''}
                    </Text>
                  </View>
                  <Text style={styles.resultSets}>{cm.sets}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {partners.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>MIS COLEGAS</Text>
            <View style={styles.card}>
              {partners.slice(0, 8).map((fp) => (
                <View key={fp.name.toLowerCase()} style={styles.colegaRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.rankName} numberOfLines={1}>
                      {fp.name}
                    </Text>
                    <Text style={styles.rankMeta}>
                      {fp.times} {fp.times === 1 ? 'partido juntos' : 'partidos juntos'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.colegaBadge,
                      fp.user_id ? styles.colegaBadgeOn : styles.colegaBadgeOff,
                    ]}
                  >
                    {fp.user_id ? <IconLink size={10} color={c.accent} /> : null}
                    <Text
                      style={[styles.colegaBadgeTxt, { color: fp.user_id ? c.accent : c.textFaint }]}
                    >
                      {fp.user_id ? 'con cuenta' : 'sin app'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <Text style={styles.colegaHint}>
              Se añaden solos al jugar contigo. «Con cuenta»: sus partidos ya cuentan en sus
              números. «Sin app»: invítale al compartir el próximo partido.
            </Text>
          </>
        ) : null}
      </>
    );
  };

  const renderPlantilla = () => {
    if (ranking.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Sin partidos todavía</Text>
          <Text style={styles.emptyText}>
            El ranking de la plantilla se llena solo con las jornadas de liga que tengan
            alineación y resultado.
          </Text>
        </View>
      );
    }
    const myIdx = me ? ranking.findIndex((r) => r.pl.id === me.id) : -1;
    const top = ranking.slice(0, RANK_TOP);
    const pinMe = myIdx >= RANK_TOP;
    const rows = pinMe ? [...top, ranking[myIdx]] : top;
    return (
      <View style={[styles.card, { paddingVertical: 4 }]}>
        {rows.map((r, i) => {
          const pos = pinMe && i === rows.length - 1 ? myIdx : i;
          const isMe = me != null && r.pl.id === me.id;
          return (
            <View
              key={r.pl.id}
              style={[
                styles.rankRow,
                i > 0 && styles.rowDivider,
                pinMe && i === rows.length - 1 && styles.rankPinned,
              ]}
            >
              <Text style={[styles.rankPos, pos === 0 && { color: c.accent }]}>{pos + 1}</Text>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.rankName, isMe && { color: c.accent }]} numberOfLines={1}>
                  {r.pl.name}
                  {isMe ? ' · tú' : ''}
                </Text>
                <Text style={styles.rankMeta}>
                  {r.s.played} PJ · {r.s.won}V–{r.s.lost}D
                  {r.s.currentStreak >= 3 ? ` · 🔥${r.s.currentStreak}` : ''}
                </Text>
              </View>
              <Text style={[styles.rankPct, isMe && { color: c.accent }]}>{r.s.winRate}%</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          {navigation.canGoBack() ? (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={10}
              style={styles.backBtn}
              accessibilityRole="button"
              accessibilityLabel="Volver"
            >
              <IconBack size={20} color={c.text} />
            </Pressable>
          ) : (
            <View />
          )}
          {team && tab !== 'amistosos' && seasons.length > 0 ? (
            <Pressable
              onPress={() => setSeasonSheet(true)}
              style={({ pressed }) => [styles.seasonPill, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
              accessibilityLabel={`Temporada: ${seasonLabel}. Cambiar`}
            >
              <Text style={styles.seasonPillText} numberOfLines={1}>
                {seasonLabel} ▾
              </Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.eyebrow}>MIS NÚMEROS</Text>
        <Text style={styles.title} numberOfLines={1}>
          {tab === 'plantilla' ? team?.name ?? 'Plantilla' : displayName}
        </Text>

        {team ? (
          <View style={{ marginTop: 14 }}>
            <SegmentedControl<Tab>
              options={[
                { key: 'liga', label: 'Liga' },
                { key: 'amistosos', label: 'Amistosos' },
                { key: 'plantilla', label: 'Plantilla' },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>
        ) : null}

        <View style={{ marginTop: 14 }}>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={c.accent} />
            </View>
          ) : tab === 'liga' ? (
            renderLiga()
          ) : tab === 'plantilla' ? (
            renderPlantilla()
          ) : (
            renderAmistosos()
          )}
        </View>

        {/* La ficha de la federación va DEBAJO de tus números. */}
        {userId && tab !== 'amistosos' ? (
          <View style={{ marginTop: 16 }}>
            <FederacionStatsCard userId={userId} userName={displayName} />
          </View>
        ) : null}

        {tab === 'amistosos' || !team ? (
          <View style={{ marginTop: 16 }}>
            <CodeRedeemCard mode="casual" onClaimed={load} />
          </View>
        ) : null}

        <Text style={styles.footNote}>
          Liga: partidos con alineación y resultado. Amistosos: los que te apuntan con tu
          cuenta (o reclamas con un código).
        </Text>
      </ScrollView>

      <BottomSheet open={seasonSheet} onClose={() => setSeasonSheet(false)}>
        <Text style={styles.eyebrow}>TEMPORADA</Text>
        <View style={[styles.card, { paddingVertical: 4, marginTop: 10 }]}>
          {[
            { id: 'activa', name: 'Temporada activa' },
            { id: 'todas', name: 'Todas las temporadas' },
            ...seasons.map((s) => ({ id: s.id, name: s.name })),
          ].map((opt, i) => {
            const sel = seasonScope === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => {
                  setSeasonScope(opt.id);
                  setSeasonSheet(false);
                }}
                style={({ pressed }) => [
                  styles.sheetRow,
                  i > 0 && styles.rowDivider,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: sel }}
              >
                <Text style={[styles.rankName, sel && { color: c.accent }]}>{opt.name}</Text>
                {sel ? <IconCheck size={16} color={c.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
};

const StatCell: React.FC<{ label: string; value: string; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.statCell}>
      <Text style={[styles.statValue, highlight && { color: c.accent }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 20 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 14,
      minHeight: 38,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    seasonPill: {
      maxWidth: 220,
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    seasonPillText: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 3,
      color: c.accent,
      fontWeight: '500',
      marginBottom: 6,
    },
    title: { color: c.text, fontSize: 26, fontWeight: '700', letterSpacing: -0.6 },
    loader: { paddingTop: 60, alignItems: 'center' },
    emptyBox: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      padding: 20,
    },
    emptyCasual: { alignItems: 'center', gap: 8, paddingVertical: 20 },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700', marginTop: 4 },
    emptyText: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 4 },
    heroCard: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.accent40,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
    },
    heroRecord: { fontFamily: Fonts.mono, color: c.text, fontSize: 20, fontWeight: '800' },
    heroStreak: { color: c.textMuted, fontSize: 12.5 },
    heroStreakMuted: { color: c.textFaint, fontSize: 12 },
    grid: { flexDirection: 'row', gap: 8, marginTop: 10 },
    statCell: {
      flex: 1,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hair,
      paddingVertical: 12,
      alignItems: 'center',
    },
    statValue: { fontFamily: Fonts.mono, color: c.text, fontSize: 16, fontWeight: '800' },
    statLabel: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 8.5,
      letterSpacing: 1,
      marginTop: 4,
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
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      padding: 14,
      gap: 10,
    },
    cardEyebrow: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10,
      letterSpacing: 2,
    },
    cardEyebrowAccent: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 10,
      letterSpacing: 2,
      marginBottom: 2,
    },
    rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.hair },
    rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
    rankPinned: { borderTopWidth: 1, borderColor: c.hairStrong, borderStyle: 'dashed' },
    rankPos: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 13,
      fontWeight: '700',
      width: 22,
      textAlign: 'center',
    },
    rankName: { color: c.text, fontSize: 14, fontWeight: '600' },
    rankMeta: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, marginTop: 2 },
    rankPct: { fontFamily: Fonts.mono, color: c.text, fontSize: 16, fontWeight: '800' },
    courtRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    courtLabel: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 12,
      fontWeight: '700',
      width: 26,
    },
    courtValue: {
      fontFamily: Fonts.mono,
      color: c.textMuted,
      fontSize: 12,
      width: 40,
      textAlign: 'right',
    },
    partnerCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    partnerName: { color: c.text, fontSize: 15, fontWeight: '700' },
    partnerMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    partnerPct: { fontFamily: Fonts.mono, color: c.accent, fontSize: 22, fontWeight: '800' },
    shareBtn: {
      marginTop: 20,
      height: 50,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtn: {
      alignSelf: 'stretch',
      marginTop: 8,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareBtnLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
    photoBtn: {
      marginTop: 8,
      height: 44,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoBtnLabel: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    colegaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    colegaBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 999,
      borderWidth: 1,
    },
    colegaBadgeOn: { backgroundColor: c.accent15, borderColor: c.accent40 },
    colegaBadgeOff: { backgroundColor: c.bgRaised, borderColor: c.hairStrong },
    colegaBadgeTxt: { fontSize: 11, fontWeight: '700' },
    colegaHint: { color: c.textFaint, fontSize: 11, lineHeight: 15, marginTop: 8 },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
    resultBadge: {
      width: 26,
      height: 26,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultBadgeTxt: { fontSize: 12, fontWeight: '800' },
    resultSets: { fontFamily: Fonts.mono, color: c.text, fontSize: 12, fontWeight: '600' },
    sheetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
    },
    footNote: {
      color: c.textFaint,
      fontSize: 11,
      textAlign: 'center',
      marginTop: 16,
      lineHeight: 16,
    },
  });
