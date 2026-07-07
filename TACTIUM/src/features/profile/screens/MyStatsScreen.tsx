import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Share,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import { fetchMyPlayer, type Player } from '@core/services/players';
import {
  fetchMyCasualStats,
  fetchMyFrequentPartners,
  getClaimableParticipants,
  claimCasualParticipant,
  type MyCasualStats,
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

// Mis estadísticas (F5a): números de LIGA del jugador, calculados de las
// alineaciones oficiales + resultados. Es la pieza de retención del
// jugador y el contenido del futuro perfil público. Los amistosos se
// sumarán en F5b (requiere RPC de lectura + picker con user_id).

type Scope = 'activa' | 'todas' | 'amistosos';

export const MyStatsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const team = useTeamStore((s) => s.team);
  const players = useTeamStore((s) => s.players);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [scope, setScope] = useState<Scope>('activa');
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Player | null>(null);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [stats, setStats] = useState<PlayerLeagueStats | null>(null);
  const [bundle, setBundle] = useState<LeagueStatsBundle | null>(null);
  // Vista: mis números o ranking interno de la plantilla (pique sano =
  // retención). El ranking usa el MISMO bundle, cero consultas extra.
  const [view, setView] = useState<'yo' | 'plantilla'>('yo');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [casual, setCasual] = useState<MyCasualStats | null>(null);
  // Diagnóstico: si la carga de amistosos falla, mostramos el motivo en
  // pantalla en vez de tragarlo (imprescindible mientras probamos).
  const [casualError, setCasualError] = useState<string | null>(null);
  // Mis colegas: la gente con la que has jugado amistosos. 🔗 = tiene
  // cuenta vinculada (sus partidos le cuentan); sin 🔗 = invítale.
  const [partners, setPartners] = useState<FrequentPartner[]>([]);
  const photoCardRef = React.useRef<View>(null);

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
      const ids =
        scope === 'amistosos'
          ? [] // el ámbito amistosos no necesita datos de liga
          : scope === 'activa'
            ? allSeasons.filter((s) => s.active).map((s) => s.id)
            : allSeasons.map((s) => s.id);
      const b = await fetchLeagueStatsBundle(ids);
      setBundle(b);
      setStats(player ? computePlayerLeagueStats(player.id, b) : null);
      // Amistosos vinculados (F5b): independientes de la temporada.
      fetchMyCasualStats(userId)
        .then((c) => {
          setCasual(c);
          setCasualError(null);
        })
        .catch((e) => {
          setCasual(null);
          setCasualError(String((e as Error)?.message ?? e));
        });
      fetchMyFrequentPartners(userId)
        .then(setPartners)
        .catch(() => setPartners([]));
    } catch (e) {
      console.warn('MyStats load', e);
    } finally {
      setLoading(false);
    }
  }, [team, userId, scope]);

  useEffect(() => {
    load();
  }, [load]);

  // La pestaña Stats queda MONTADA (tabs con lazy:false): sin esto, al
  // guardar un amistoso y volver aquí no se refrescaban los números.
  const focusReload = useCallback(() => {
    load();
  }, [load]);
  useFocusEffect(focusReload);

  // Canje de código de partido: el invitado que acaba de registrarse
  // introduce el código y elige su nombre → el partido pasa a su cuenta.
  const redeemCode = () => {
    Alert.prompt(
      'Código de partido',
      'Introduce el código que te pasaron (p. ej. K7M2XQ)',
      async (raw) => {
        const code = (raw ?? '').trim();
        if (!code) return;
        try {
          const parts = await getClaimableParticipants(code);
          if (parts.length === 0) {
            Alert.alert(
              'Nada que reclamar',
              'El código no es válido o el partido ya fue reclamado.',
            );
            return;
          }
          Alert.alert('¿Quién eres tú?', 'Elige tu nombre en ese partido:', [
            ...parts.slice(0, 4).map((pt) => ({
              text: pt.name,
              onPress: async () => {
                try {
                  const ok = await claimCasualParticipant(
                    code,
                    pt.participant_id,
                  );
                  if (ok) {
                    Alert.alert(
                      '¡Partido reclamado!',
                      'Ya cuenta en tus estadísticas.',
                    );
                    load();
                  } else {
                    Alert.alert('No se pudo reclamar', 'Inténtalo de nuevo.');
                  }
                } catch {
                  Alert.alert('No se pudo reclamar', 'Inténtalo de nuevo.');
                }
              },
            })),
            { text: 'Cancelar', style: 'cancel' },
          ]);
        } catch {
          Alert.alert(
            'Función no disponible',
            'Los códigos de partido se activan al aplicar la migración 20260707_claim_codes.sql en Supabase.',
          );
        }
      },
    );
  };

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
      `La app del capitán de pádel: ${DOWNLOAD_URL}`,
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

  const hasSeasons =
    scope === 'activa' ? seasons.some((s) => s.active) : seasons.length > 0;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            // Tab bar flotante: 64 + offset 12 + colchón 32
            paddingBottom: insets.bottom + 64 + 12 + 32,
          },
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

        {/* Filtros en UNA línea: ámbito ‖ vista */}
        <View style={styles.scopeRow}>
          {(
            [
              { id: 'activa', label: 'Activa' },
              { id: 'todas', label: 'Todas' },
              { id: 'amistosos', label: 'Amistosos' },
            ] as const
          ).map((s) => {
            const sel = scope === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => {
                  setScope(s.id);
                  if (s.id === 'amistosos') setView('yo');
                }}
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

          {scope !== 'amistosos' ? (
            <>
          <View style={styles.filterDivider} />

          {(
            [
              { id: 'yo', label: 'Yo' },
              { id: 'plantilla', label: 'Plantilla' },
            ] as const
          ).map((v) => {
            const sel = view === v.id;
            return (
              <Pressable
                key={v.id}
                onPress={() => setView(v.id)}
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
                  {v.label}
                </Text>
              </Pressable>
            );
          })}
            </>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : view === 'plantilla' ? (
          ranking.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Sin partidos todavía</Text>
              <Text style={styles.emptyText}>
                El ranking de la plantilla se llena solo con las jornadas de
                liga que tengan alineación y resultado.
              </Text>
            </View>
          ) : (
            <View style={[styles.card, { marginTop: 18 }]}>
              {ranking.map((r, i) => {
                const isMe = me != null && r.pl.id === me.id;
                return (
                  <View key={r.pl.id} style={styles.rankRow}>
                    <Text
                      style={[
                        styles.rankPos,
                        i === 0 && { color: Colors.accent },
                      ]}
                    >
                      {i + 1}
                    </Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        style={[
                          styles.rankName,
                          isMe && { color: Colors.accent },
                        ]}
                        numberOfLines={1}
                      >
                        {r.pl.name}
                        {isMe ? '  ·  tú' : ''}
                      </Text>
                      <Text style={styles.rankMeta}>
                        {r.s.played} PJ · {r.s.won}V–{r.s.lost}D
                        {r.s.currentStreak >= 3
                          ? `  ·  🔥${r.s.currentStreak}`
                          : ''}
                      </Text>
                    </View>
                    <Text style={styles.rankPct}>{r.s.winRate}%</Text>
                  </View>
                );
              })}
            </View>
          )
        ) : !me && scope !== 'amistosos' ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Aún no estás vinculado</Text>
            <Text style={styles.emptyText}>
              Pide a tu capitán que te invite al equipo y reclama tu ficha de
              jugador. A partir de ahí, cada partido de liga contará aquí.
            </Text>
          </View>
        ) : (
          <>
            {scope === 'amistosos' ? (
              casual && casual.played > 0 ? (
                <>
                  <View style={styles.hero}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.heroPct}>{casual.winRate}%</Text>
                      <Text style={styles.heroLabel}>DE VICTORIAS</Text>
                    </View>
                    <View style={styles.heroRight}>
                      <Text style={styles.heroRecord}>
                        {casual.won}
                        <Text style={{ color: Colors.textFaint }}> V · </Text>
                        {casual.lost}
                        <Text style={{ color: Colors.textFaint }}> D</Text>
                      </Text>
                    </View>
                  </View>
                  <View style={styles.grid}>
                    <StatCell
                      label="PARTIDOS"
                      value={String(casual.played)}
                    />
                    <StatCell
                      label="AMISTOSOS"
                      value={String(casual.amistosos)}
                    />
                    <StatCell
                      label="ENTRENOS"
                      value={String(casual.entrenos)}
                    />
                  </View>
                </>
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={styles.emptyTitle}>Sin amistosos todavía</Text>
                  <Text style={styles.emptyText}>
                    Registra un amistoso desde la Home (o canjea un código de
                    partido) y tus números aparecerán aquí.
                  </Text>
                  {casualError ? (
                    <Text style={styles.debugError}>⚠️ {casualError}</Text>
                  ) : null}
                  <Text style={styles.debugError}>
                    {casualError
                      ? ''
                      : `debug: user ${userId ? userId.slice(0, 8) : 'null'} · casual ${
                          casual ? `${casual.played} partidos` : 'null'
                        }`}
                  </Text>
                </View>
              )
            ) : !hasSeasons || !stats || stats.played === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>
                  Sin partidos de liga todavía
                </Text>
                <Text style={styles.emptyText}>
                  Cuando juegues jornadas de liga con alineación y resultado,
                  tus números aparecerán aquí solos.
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

            {/* Amistosos vinculados */}
              </>
            )}

            {scope !== 'amistosos' && casual && casual.played > 0 ? (
              <>
                <Text style={styles.sectionLabel}>AMISTOSOS</Text>
                <View style={[styles.card, styles.partnerCard]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.partnerName}>
                      {casual.played}{' '}
                      {casual.played === 1 ? 'partido' : 'partidos'}
                    </Text>
                    <Text style={styles.partnerMeta}>
                      {casual.won}V–{casual.lost}D
                    </Text>
                  </View>
                  <Text style={styles.partnerPct}>{casual.winRate}%</Text>
                </View>
              </>
            ) : null}

            {/* Mis colegas: con quién juegas y su estado de vínculo */}
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
                          {fp.times}{' '}
                          {fp.times === 1
                            ? 'partido juntos'
                            : 'partidos juntos'}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.colegaBadge,
                          fp.user_id
                            ? styles.colegaBadgeOn
                            : styles.colegaBadgeOff,
                        ]}
                      >
                        <Text
                          style={[
                            styles.colegaBadgeTxt,
                            { color: fp.user_id ? Colors.accent : Colors.textFaint },
                          ]}
                        >
                          {fp.user_id ? '🔗 vinculado' : 'sin app'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
                <Text style={styles.colegaHint}>
                  Se añaden solos al jugar contigo. 🔗 = sus partidos ya
                  cuentan en sus stats; "sin app": invítale al compartir el
                  próximo partido.
                </Text>
              </>
            ) : null}

            {/* Compartir (solo con números de liga) */}
            {scope !== 'amistosos' && stats && stats.played > 0 ? (
              <>
            {photoUri && stats ? (
              <View style={{ alignItems: 'center', marginTop: 20 }}>
                <PhotoShareCard
                  ref={photoCardRef}
                  photoUri={photoUri}
                  title={`${stats.winRate}% de victorias`}
                  subtitle={`${me?.name ?? ''} · ${team?.name ?? ''}`}
                  detail={`${stats.won}V–${stats.lost}D · ${stats.played} PJ${
                    stats.currentStreak >= 3
                      ? ` · 🔥${stats.currentStreak}`
                      : ''
                  }`}
                />
              </View>
            ) : null}

            {photoUri ? (
              <Pressable
                onPress={() =>
                  sharePhotoCard(photoCardRef, photoUri, shareText)
                }
                style={({ pressed }) => [
                  styles.shareBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.shareBtnLabel}>
                  Compartir foto + stats
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.shareBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.shareBtnLabel}>Compartir mis números</Text>
              </Pressable>
            )}
            <Pressable
              onPress={pickPhoto}
              style={({ pressed }) => [
                styles.photoBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.photoBtnLabel}>
                {photoUri ? 'Cambiar foto' : '📸 Añadir foto del partido'}
              </Text>
            </Pressable>
              </>
            ) : null}

            <Text style={styles.footNote}>
              Liga: partidos con alineación y resultado. Amistosos: solo los
              registrados eligiéndote de la plantilla (chip 🔗).
            </Text>

            <Pressable onPress={redeemCode} hitSlop={8}>
              <Text style={styles.claimLink}>
                🎟️ ¿Tienes un código de partido? Canjéalo aquí
              </Text>
            </Pressable>
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
  scopeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
    alignItems: 'center',
  },
  filterDivider: {
    width: 1,
    height: 22,
    backgroundColor: Colors.hairStrong,
    marginHorizontal: 2,
  },
  scopeChip: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeChipText: { fontSize: 12.5, fontWeight: '600' },
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
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rankPos: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 13,
    fontWeight: '700',
    width: 22,
    textAlign: 'center',
  },
  rankName: { color: Colors.text, fontSize: 14, fontWeight: '600' },
  rankMeta: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  rankPct: { color: Colors.text, fontSize: 16, fontWeight: '800' },
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
  photoBtn: {
    marginTop: 8,
    height: 44,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoBtnLabel: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  colegaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  colegaBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  colegaBadgeOn: {
    backgroundColor: Colors.accent15,
    borderColor: Colors.accent40,
  },
  colegaBadgeOff: {
    backgroundColor: Colors.bgRaised,
    borderColor: Colors.hairStrong,
  },
  colegaBadgeTxt: { fontSize: 11, fontWeight: '700' },
  colegaHint: {
    color: Colors.textFaint,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 8,
  },
  debugError: {
    color: '#ff6b6b',
    fontSize: 11,
    marginTop: 8,
    fontFamily: Fonts.mono,
  },
  claimLink: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 14,
  },
  footNote: {
    color: Colors.textFaint,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 16,
  },
});
