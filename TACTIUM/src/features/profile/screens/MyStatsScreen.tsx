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
import { useNavigation } from '@react-navigation/native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import { fetchMyPlayer, type Player } from '@core/services/players';
import { fetchSeasons, type Season } from '@core/services/seasons';
import {
  fetchLeagueStatsBundle,
  computePlayerLeagueStats,
  type PlayerLeagueStats,
} from '@core/services/playerStats';

// Mis estadísticas (F5a): números de LIGA del jugador, calculados de las
// alineaciones oficiales + resultados. Es la pieza de retención del
// jugador y el contenido del futuro perfil público. Los amistosos se
// sumarán en F5b (requiere RPC de lectura + picker con user_id).

type Scope = 'activa' | 'todas';

export const MyStatsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const team = useTeamStore((s) => s.team);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [scope, setScope] = useState<Scope>('activa');
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Player | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [stats, setStats] = useState<PlayerLeagueStats | null>(null);

  const load = useCallback(async () => {
    if (!team || !userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [player, allSeasons] = await Promise.all([
        fetchMyPlayer(team.id, userId),
        fetchSeasons(team.id),
      ]);
      setMe(player);
      setSeasons(allSeasons);
      if (player) {
        const ids =
          scope === 'activa'
            ? allSeasons.filter((s) => s.active).map((s) => s.id)
            : allSeasons.map((s) => s.id);
        const bundle = await fetchLeagueStatsBundle(ids);
        setStats(computePlayerLeagueStats(player.id, bundle));
      }
    } catch (e) {
      console.warn('MyStats load', e);
    } finally {
      setLoading(false);
    }
  }, [team, userId, scope]);

  useEffect(() => {
    load();
  }, [load]);

  const shareText = useMemo(() => {
    if (!stats || !me) return '';
    const streak =
      stats.currentStreak > 1
        ? ` · racha de ${stats.currentStreak} victorias 🔥`
        : '';
    return [
      `🎾 *Mis números en TACTIUM*`,
      `${me.name} · ${team?.name ?? ''}`,
      `${stats.played} partidos de liga · ${stats.won}V–${stats.lost}D (${
        stats.winRate ?? 0
      }%)${streak}`,
      `Sets: ${stats.setsWon}–${stats.setsLost}`,
      ``,
      `La app del capitán de pádel · tactium.io`,
    ].join('\n');
  }, [stats, me, team]);

  const handleShare = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      // cancelado
    }
  };

  const hasSeasons =
    scope === 'activa' ? seasons.some((s) => s.active) : seasons.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 60 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {navigation.canGoBack() ? (
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={styles.backBtn}
          >
            <IconBack size={20} color={Colors.text} />
          </Pressable>
        ) : null}

        <Text style={styles.eyebrow}>MIS ESTADÍSTICAS · LIGA</Text>
        <Text style={styles.title}>{me?.name ?? 'Tus números'}</Text>

        {/* Ámbito */}
        <View style={styles.scopeRow}>
          {(
            [
              { id: 'activa', label: 'Temporada activa' },
              { id: 'todas', label: 'Histórico' },
            ] as const
          ).map((s) => {
            const sel = scope === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setScope(s.id)}
                style={[
                  styles.scopeChip,
                  sel && {
                    backgroundColor: Colors.accent,
                    borderColor: Colors.accent,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.scopeChipText,
                    { color: sel ? '#000' : Colors.text },
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : !me ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Aún no estás vinculado</Text>
            <Text style={styles.emptyText}>
              Pide a tu capitán que te invite al equipo y reclama tu ficha de
              jugador. A partir de ahí, cada partido de liga contará aquí.
            </Text>
          </View>
        ) : !hasSeasons || !stats || stats.played === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Sin partidos todavía</Text>
            <Text style={styles.emptyText}>
              Cuando juegues jornadas de liga con alineación y resultado, tus
              números aparecerán aquí solos.
            </Text>
          </View>
        ) : (
          <>
            {/* Hero: % victorias */}
            <View style={styles.hero}>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroPct}>{stats.winRate}%</Text>
                <Text style={styles.heroLabel}>DE VICTORIAS</Text>
              </View>
              <View style={styles.heroRight}>
                <Text style={styles.heroRecord}>
                  {stats.won}
                  <Text style={{ color: Colors.textFaint }}> V · </Text>
                  {stats.lost}
                  <Text style={{ color: Colors.textFaint }}> D</Text>
                </Text>
                <View style={styles.lastFiveRow}>
                  {stats.lastFive.map((r, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor:
                            r === 'W' ? Colors.accent : Colors.error,
                        },
                      ]}
                    />
                  ))}
                </View>
              </View>
            </View>

            {/* Grid de métricas */}
            <View style={styles.grid}>
              <StatCell label="PARTIDOS" value={String(stats.played)} />
              <StatCell
                label="SETS"
                value={`${stats.setsWon}–${stats.setsLost}`}
              />
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
              <StatCell
                label="MEJOR RACHA"
                value={stats.bestStreak > 0 ? `${stats.bestStreak}V` : '—'}
              />
            </View>

            {/* Por pista */}
            {stats.byCourt.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>POR PISTA</Text>
                <View style={styles.card}>
                  {stats.byCourt.map((c) => {
                    const pct =
                      c.played > 0 ? Math.round((c.won / c.played) * 100) : 0;
                    return (
                      <View key={c.court} style={styles.courtRow}>
                        <Text style={styles.courtLabel}>P{c.court}</Text>
                        <View style={styles.barTrack}>
                          <View
                            style={[styles.barFill, { width: `${pct}%` }]}
                          />
                        </View>
                        <Text style={styles.courtValue}>
                          {c.won}/{c.played}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : null}

            {/* Mejor compañero */}
            {stats.bestPartner ? (
              <>
                <Text style={styles.sectionLabel}>MEJOR COMPAÑERO</Text>
                <View style={[styles.card, styles.partnerCard]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.partnerName} numberOfLines={1}>
                      {stats.bestPartner.name}
                    </Text>
                    <Text style={styles.partnerMeta}>
                      {stats.bestPartner.won} victorias en{' '}
                      {stats.bestPartner.played} partidos juntos
                    </Text>
                  </View>
                  <Text style={styles.partnerPct}>
                    {Math.round(
                      (stats.bestPartner.won / stats.bestPartner.played) * 100,
                    )}
                    %
                  </Text>
                </View>
              </>
            ) : null}

            {/* Compartir */}
            <Pressable
              onPress={handleShare}
              style={({ pressed }) => [
                styles.shareBtn,
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.shareBtnLabel}>Compartir mis números</Text>
            </Pressable>

            <Text style={styles.footNote}>
              Solo partidos de liga con resultado. Los amistosos contarán
              pronto.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const StatCell: React.FC<{
  label: string;
  value: string;
  highlight?: boolean;
}> = ({ label, value, highlight }) => (
  <View style={styles.statCell}>
    <Text
      style={[styles.statValue, highlight && { color: Colors.accent }]}
      numberOfLines={1}
    >
      {value}
    </Text>
    <Text style={styles.statLabel}>{label}</Text>
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
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    fontWeight: '500',
    marginBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  scopeRow: { flexDirection: 'row', gap: 6, marginTop: 16 },
  scopeChip: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipText: { fontSize: 13, fontWeight: '600' },
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
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  hero: {
    marginTop: 18,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.accent40,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroPct: {
    color: Colors.accent,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 2,
  },
  heroRight: { alignItems: 'flex-end', gap: 8 },
  heroRecord: { color: Colors.text, fontSize: 22, fontWeight: '700' },
  lastFiveRow: { flexDirection: 'row', gap: 5 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  grid: { flexDirection: 'row', gap: 8, marginTop: 10 },
  statCell: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingVertical: 12,
    alignItems: 'center',
  },
  statValue: { color: Colors.text, fontSize: 17, fontWeight: '800' },
  statLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 8.5,
    letterSpacing: 1,
    marginTop: 4,
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
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    padding: 14,
    gap: 10,
  },
  courtRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  courtLabel: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '700',
    width: 28,
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.bgRaised,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  courtValue: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 12,
    width: 44,
    textAlign: 'right',
  },
  partnerCard: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  partnerName: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  partnerMeta: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  partnerPct: { color: Colors.accent, fontSize: 24, fontWeight: '800' },
  shareBtn: {
    marginTop: 24,
    height: 50,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnLabel: { color: '#001810', fontSize: 15, fontWeight: '700' },
  footNote: {
    color: Colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});
