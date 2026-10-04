import React, { useCallback, useMemo, useRef, useState } from 'react';
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
import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { PhotoShareCard, shareCardImage } from '@components/share/PhotoShareCard';
import { DOWNLOAD_URL } from '@core/config/referral';
import { fetchPublicMatchday, type PublicMatchday } from '@core/services/social';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import type { RootStackParamList } from '@navigation/types';

import { MatchRow, MatchScoreboard } from '@features/home/components/match/MatchScoreboard';
import { KudosButton } from '@features/home/components/match/KudosButton';

const MESES = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
];
const shortDate = (iso: string | null): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${MESES[m - 1]} ${y}`;
};

const OUTCOME: Record<string, { label: string; won: boolean | null }> = {
  win: { label: 'Victoria', won: true },
  loss: { label: 'Derrota', won: false },
  draw: { label: 'Empate', won: null },
};

/** Campos que añade la migración 20261004_partido_kudos_detalle (sin aplicar). */
type WithKudos = PublicMatchday & { kudos_count?: number | null; i_gave_kudos?: boolean | null };

/**
 * Detalle público de una jornada de liga (rediseño bloque «Partido»): la
 * misma cabecera con marcador que la Jornada (con la foto de fondo si la
 * hay), kudos y «pista a pista» con quién ganó cada una. Tu pista, primero.
 */
export const LeagueMatchDetailScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'LeagueMatchDetail'>>();
  const { matchdayId } = route.params;
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const activeTeam = useTeamStore((s) => s.team);
  const players = useTeamStore((s) => s.players);
  const myPlayerId = useTeamStore((s) => s.myPlayerId);

  const [loading, setLoading] = useState(true);
  const [md, setMd] = useState<WithKudos | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setMd((await fetchPublicMatchday(matchdayId)) as WithKudos | null);
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
  // ¿Es la jornada de MI equipo activo? Entonces «Abrir jornada» y «Tú».
  const isMyTeam =
    !!md && !!activeTeam && !!md.team_name && activeTeam.name.trim() === md.team_name.trim();
  const myName = isMyTeam && myPlayerId ? players.find((p) => p.id === myPlayerId)?.name ?? null : null;

  const courts = useMemo(() => {
    if (!md) return [];
    const rows = md.courts.map((ct) => {
      let won: boolean | null = null;
      if (ct.forfeit) won = !ct.forfeit_us;
      else if (ct.sets.length > 0) {
        const u = ct.sets.filter((s) => s.us > s.them).length;
        const t = ct.sets.filter((s) => s.them > s.us).length;
        won = u === t ? null : u > t;
      }
      const mine = !!myName && !!ct.pair && ct.pair.toLowerCase().includes(myName.toLowerCase());
      return { ...ct, won, mine };
    });
    // Tu pista primero.
    return [...rows.filter((r) => r.mine), ...rows.filter((r) => !r.mine)];
  }, [md, myName]);

  const cardRef = useRef<View>(null);
  const shareText = useMemo(() => {
    if (!md) return '';
    const header =
      `🎾 ${md.team_name ?? ''} ${md.score_for ?? 0}–${md.score_against ?? 0} ${md.opponent ?? ''}` +
      (md.jornada_number != null ? ` · Jornada ${md.jornada_number}` : '');
    return [header, '', 'Sigue tus ligas con TACTIUM 🏆', DOWNLOAD_URL].join('\n');
  }, [md]);
  const onShare = async () => {
    if (!md) return;
    if (md.photo_url) {
      shareCardImage(cardRef, md.photo_url, shareText);
      return;
    }
    try {
      await Share.share({ message: shareText });
    } catch {
      // cancelado
    }
  };

  const eyebrow = md
    ? [
        md.category,
        md.group_name ? `Grupo ${md.group_name}` : null,
        md.jornada_number != null ? `J${md.jornada_number}` : null,
        shortDate(md.match_date),
      ]
        .filter(Boolean)
        .join(' · ')
        .toUpperCase()
    : '';
  const tint = oc?.won === true ? c.accent : oc?.won === false ? c.error : oc ? c.warning : c.text;

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          style={styles.backBtn}
        >
          <IconBack size={18} color={c.text} />
        </Pressable>
        {md ? (
          <Pressable onPress={onShare} hitSlop={8} accessibilityRole="button">
            <Text style={styles.headerLink}>Compartir</Text>
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
        ) : !md ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Partido no disponible</Text>
          </View>
        ) : (
          <>
            <MatchScoreboard
              eyebrow={eyebrow}
              left={md.team_name ?? 'Nuestro equipo'}
              right={md.opponent ?? 'Rival'}
              us={md.score_for}
              them={md.score_against}
              status={oc ? `${oc.label}${md.is_home != null ? ` · ${md.is_home ? 'local' : 'visitante'}` : ''}` : 'Sin acta'}
              tint={tint}
              photoUrl={md.photo_url}
            />

            {oc && userId ? (
              <KudosButton
                kind="league"
                targetId={md.id}
                userId={userId}
                initialCount={md.kudos_count ?? null}
                initialGiven={md.i_gave_kudos ?? null}
              />
            ) : null}

            {isMyTeam ? (
              <Pressable
                onPress={() =>
                  navigation.navigate('MainTabs', {
                    screen: 'Home',
                    params: { screen: 'Jornada', params: { matchdayId: md.id } },
                  })
                }
                style={({ pressed }) => [styles.openRow, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.openText}>Abrir jornada ›</Text>
              </Pressable>
            ) : null}

            {courts.length > 0 ? (
              <>
                <Text style={styles.sectionLabel}>PISTA A PISTA</Text>
                <View style={{ gap: 8 }}>
                  {courts.map((ct) => (
                    <MatchRow
                      key={ct.court_number}
                      badge={`P${ct.court_number}`}
                      title={ct.mine && myName && ct.pair ? ct.pair.replace(myName, 'Tú') : ct.pair ?? `Pista ${ct.court_number}`}
                      sub={
                        ct.forfeit
                          ? `W.O. ${ct.forfeit_us ? 'en contra' : 'a favor'}`
                          : ct.sets.length
                            ? ct.sets.map((s) => `${s.us}-${s.them}`).join(' ')
                            : 'Sin resultado'
                      }
                      right={ct.won === true ? '✓' : ct.won === false ? '✕' : '—'}
                      rightTone={ct.won === true ? 'win' : ct.won === false ? 'loss' : 'muted'}
                      me={ct.mine}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {md.photo_url ? (
              <>
                <Text style={styles.sectionLabel}>TARJETA PARA COMPARTIR</Text>
                <View style={{ alignItems: 'center' }}>
                  <PhotoShareCard
                    ref={cardRef}
                    photoUri={md.photo_url}
                    title={`${md.team_name ?? ''} ${md.score_for ?? 0} – ${md.score_against ?? 0} ${md.opponent ?? ''}`}
                    subtitle={`${md.jornada_number != null ? `Jornada ${md.jornada_number}` : 'Partido'}${md.category ? ` · ${md.category}` : ''}`}
                    detail={oc ? `${oc.label.toUpperCase()}${md.is_home != null ? ` · ${md.is_home ? 'Local' : 'Visitante'}` : ''}` : ''}
                    homeName={md.team_name ?? 'Nuestro equipo'}
                    homeScore={md.score_for ?? 0}
                    awayName={md.opponent ?? 'Rival'}
                    awayScore={md.score_against ?? 0}
                    highlight={oc?.won === true ? 'home' : oc?.won === false ? 'away' : 'home'}
                  />
                </View>
              </>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
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
    headerLink: { color: c.accent, fontSize: 14, fontWeight: '700' },
    content: { paddingHorizontal: 16, gap: 10 },
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
    openRow: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    openText: { color: c.accent, fontSize: 14, fontWeight: '700' },
    sectionLabel: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10.5,
      letterSpacing: 2,
      fontWeight: '500',
      marginTop: 8,
    },
  });
