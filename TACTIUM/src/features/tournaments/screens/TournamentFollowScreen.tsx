import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@core/theme';
import { IconBack } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { toast } from '@store/toastStore';
import {
  publicGetTournament,
  publicListRegistrations,
  publicListMatches,
  computeStandings,
  isSocialFormat,
  type Tournament,
  type TournamentRegistration,
  type TournamentMatch,
} from '@core/services/tournaments';
import type { RootStackScreenProps } from '@navigation/types';

import {
  makeStyles,
  ChampionHero,
  ContentTabs,
  PlayersView,
  InfoView,
  ScheduleView,
  BracketView,
  RoundRobinView,
  GroupsView,
  SocialView,
  divLabel,
  sameDiv,
  fmtTime,
  STATUS_LABEL,
  formatStartsOn,
  type RegInfo,
  type TabKey,
  type Division,
} from './TournamentDetailScreen';

const noop = () => {};

export const TournamentFollowScreen = ({
  navigation,
  route,
}: RootStackScreenProps<'TournamentFollow'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { tournamentId } = route.params;
  const uid = useAuthStore((s) => s.user?.id ?? null);

  const [t, setT] = useState<Tournament | null>(null);
  const [regs, setRegs] = useState<TournamentRegistration[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDiv, setActiveDiv] = useState<Division | null>(null);
  const [tab, setTab] = useState<TabKey>('main');
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    try {
      const [tt, rr, mm] = await Promise.all([
        publicGetTournament(tournamentId),
        publicListRegistrations(tournamentId),
        publicListMatches(tournamentId),
      ]);
      setT(tt);
      setRegs(rr);
      setMatches(mm);
    } catch (e: any) {
      toast.error('No se pudo cargar el torneo', e?.message ?? '');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const toggleRound = (r: number) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(r) ? next.delete(r) : next.add(r);
      return next;
    });

  const divisions = useMemo<Division[]>(() => {
    const gs = t?.genders?.length ? t.genders : [null];
    const cs = t?.categories?.length ? t.categories : [null];
    const out: Division[] = [];
    for (const g of gs) for (const cat of cs) out.push({ gender: g, category: cat });
    return out;
  }, [t]);

  const dg = activeDiv?.gender ?? null;
  const dc = activeDiv?.category ?? null;
  const inDiv = <T extends { gender: string | null; category: string | null }>(x: T) =>
    x.gender === dg && x.category === dc;
  const regsCat = useMemo(() => regs.filter(inDiv), [regs, dg, dc]);
  const matchesCat = useMemo(() => matches.filter(inDiv), [matches, dg, dc]);

  const isRR = t?.format === 'round_robin';
  const isGroups = t?.format === 'groups_ko';
  const isSocial = isSocialFormat(t?.format ?? '');
  const isMexicano = t?.format === 'mexicano';
  const hasBracket = matchesCat.length > 0;
  const mainTabLabel = isRR ? 'Clasificación' : isGroups ? 'Grupos' : isSocial ? 'Rondas' : 'Cuadro';

  const regInfo = useCallback(
    (id: string | null): RegInfo => {
      const r = id ? regs.find((x) => x.id === id) : null;
      return {
        name: r?.p1_name ?? '—',
        partner: r?.p2_name ?? null,
        seed: r?.seed ?? null,
        avatar: r?.p1_avatar ?? null,
        partnerAvatar: r?.p2_avatar ?? null,
      };
    },
    [regs],
  );
  const regName = useCallback(
    (id: string | null): string => {
      if (!id) return '—';
      const r = regs.find((x) => x.id === id);
      if (!r) return '—';
      const seed = r.seed ? `(${r.seed}) ` : '';
      return `${seed}${r.p1_name}${r.p2_name ? ` / ${r.p2_name}` : ''}`;
    },
    [regs],
  );

  const standings = useMemo(
    () => (isRR ? computeStandings(regsCat, matchesCat) : []),
    [isRR, regsCat, matchesCat],
  );

  const champion = useMemo(() => {
    if (!hasBracket) return null;
    if (isRR) {
      const allPlayed = matchesCat.length > 0 && matchesCat.every((m) => m.status === 'finished');
      return allPlayed ? standings[0]?.regId ?? null : null;
    }
    const mainBracket = isGroups ? 'gold' : 'main';
    const ko = matchesCat.filter((m) => m.bracket === mainBracket);
    const tr = ko.reduce((mx, x) => Math.max(mx, x.round), 0);
    const final = ko.find((m) => m.round === tr && m.slot === 0 && m.status === 'finished');
    return final?.winner_reg ?? null;
  }, [hasBracket, isRR, isGroups, matchesCat, standings]);

  // Partidos del jugador actual (si está inscrito).
  const myRegIds = useMemo(
    () =>
      new Set(
        regs
          .filter((r) => (uid && (r.p1_user_id === uid || r.p2_user_id === uid)))
          .map((r) => r.id),
      ),
    [regs, uid],
  );
  const myMatches = useMemo(
    () =>
      matches
        .filter(
          (m) =>
            m.status !== 'bye' &&
            [m.home_reg, m.away_reg, m.home_reg2, m.away_reg2].some(
              (x) => x && myRegIds.has(x),
            ),
        )
        .sort((a, b) => (a.scheduled_at ?? 'zz').localeCompare(b.scheduled_at ?? 'zz')),
    [matches, myRegIds],
  );

  const rivalLabel = (m: TournamentMatch): string => {
    const mine = m.home_reg && myRegIds.has(m.home_reg) ? 'home' : 'away';
    const rHome = regInfo(m.home_reg);
    const rAway = regInfo(m.away_reg);
    const rival = mine === 'home' ? rAway : rHome;
    return `${rival.name}${rival.partner ? ` / ${rival.partner}` : ''}`;
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={{ paddingTop: insets.top + 12, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 12 }}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
          >
            <IconBack size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.headMeta}>
              {t?.status ? (
                <View style={[styles.statusPill, t.status === 'finished' && styles.statusPillDone]}>
                  <Text style={[styles.statusPillText, t.status === 'finished' && styles.statusPillTextDone]}>
                    {STATUS_LABEL[t.status] ?? t.status.toUpperCase()}
                  </Text>
                </View>
              ) : null}
              {formatStartsOn(t?.starts_on ?? null) ? (
                <Text style={styles.headDate}>{formatStartsOn(t?.starts_on ?? null)}</Text>
              ) : null}
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {t?.name ?? ''}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : !t ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Torneo no disponible.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }} showsVerticalScrollIndicator={false}>
          {t.cover_url ? (
            <View style={styles.coverBanner}>
              <Image source={{ uri: t.cover_url }} style={styles.coverBannerImg} />
              <LinearGradient colors={['transparent', c.background]} style={styles.coverBannerFade} />
            </View>
          ) : null}

          {champion ? <ChampionHero info={regInfo(champion)} styles={styles} c={c} /> : null}

          {t.status === 'open' ? (
            <Pressable
              onPress={() =>
                navigation.navigate('TournamentSignup', { code: t.signup_code ?? undefined })
              }
              style={({ pressed }) => [styles.generateBtn, { marginHorizontal: 22, marginTop: 12 }, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.generateLabel}>Apuntarme a este torneo</Text>
            </Pressable>
          ) : null}

          {/* Tus partidos */}
          {myMatches.length > 0 ? (
            <View style={{ paddingHorizontal: 22, marginTop: 18 }}>
              <Text style={styles.sectionLabel}>TUS PARTIDOS</Text>
              <View style={{ gap: 8, marginTop: 8 }}>
                {myMatches.map((m) => (
                  <View key={m.id} style={styles.myMatchCard}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.myMatchRival} numberOfLines={1}>
                        vs {rivalLabel(m)}
                      </Text>
                      <Text style={styles.myMatchMeta} numberOfLines={1}>
                        {m.scheduled_at
                          ? `🕐 ${fmtTime(m.scheduled_at)}${m.court ? ` · ${m.court}` : ''}`
                          : 'Hora por confirmar'}
                      </Text>
                    </View>
                    {m.status === 'finished' ? (
                      <Text style={styles.myMatchScore}>
                        {m.home_score}–{m.away_score}
                      </Text>
                    ) : null}
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {divisions.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catTabs}>
              {divisions.map((d) => {
                const sel = activeDiv != null && sameDiv(d, activeDiv);
                return (
                  <Pressable
                    key={divLabel(d)}
                    onPress={() => setActiveDiv(d)}
                    style={[styles.catTab, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
                  >
                    <Text style={[styles.catTabText, { color: sel ? c.textInverse : c.textMuted }]}>{divLabel(d)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          <ContentTabs tab={tab} setTab={setTab} mainLabel={mainTabLabel} showSchedule={hasBracket} styles={styles} c={c} />

          {tab === 'schedule' ? (
            <ScheduleView
              tournament={t}
              matches={matches}
              regs={regs}
              info={regInfo}
              onEdit={noop}
              onConfigure={noop}
              onGenerate={noop}
              onClear={noop}
              generating={false}
              readOnly
              styles={styles}
              c={c}
            />
          ) : tab === 'players' ? (
            <PlayersView
              regs={regsCat}
              info={regInfo}
              social={isSocial}
              canEdit={false}
              onAdd={noop}
              onRemove={noop}
              divName={activeDiv && divisions.length > 1 ? divLabel(activeDiv) : null}
              maxPairs={t.max_pairs ?? null}
              styles={styles}
              c={c}
            />
          ) : tab === 'info' ? (
            <InfoView
              t={t}
              onShareCode={async () => {
                if (!t.signup_code) return;
                try {
                  await Share.share({
                    message: `🎾 Apúntate al torneo "${t.name}" en TACTIUM.\nCódigo: ${t.signup_code}`,
                  });
                } catch {
                  /* cancelado */
                }
              }}
              styles={styles}
              c={c}
            />
          ) : !hasBracket ? (
            <Text style={[styles.emptyText, { paddingHorizontal: 22, marginTop: 16 }]}>
              El {mainTabLabel.toLowerCase()} aún no está publicado. Cuando el club lo
              genere lo verás aquí.
            </Text>
          ) : isSocial ? (
            <SocialView
              regs={regsCat}
              matches={matchesCat}
              info={regInfo}
              isMexicano={isMexicano}
              collapsed={collapsed}
              toggleRound={toggleRound}
              onEdit={noop}
              onGenerateNextRound={noop}
              generating={false}
              readOnly
            />
          ) : isRR ? (
            <RoundRobinView standings={standings} matches={matchesCat} info={regInfo} onEdit={noop} readOnly />
          ) : isGroups ? (
            <GroupsView
              regs={regsCat}
              matches={matchesCat}
              regName={regName}
              info={regInfo}
              collapsed={collapsed}
              toggleRound={toggleRound}
              onEdit={noop}
              onGenerateKnockout={noop}
              generating={false}
              readOnly
            />
          ) : (
            <View>
              <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 8 }]}>CUADRO</Text>
              <BracketView
                matches={matchesCat.filter((m) => m.bracket === 'main')}
                regName={regName}
                onEdit={noop}
                collapsed={collapsed}
                toggleRound={toggleRound}
                readOnly
              />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
};
