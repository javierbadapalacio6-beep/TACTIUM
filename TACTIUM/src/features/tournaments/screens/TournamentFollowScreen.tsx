import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
  Share,
  StyleSheet,
} from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconShare, IconCheck, useLayout } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { toast } from '@store/toastStore';
import { useFavoritesStore } from '@store/favoritesStore';
import { toggleFavorite } from '@core/services/favorites';
import {
  publicGetTournament,
  publicListRegistrations,
  publicListMatches,
  computeStandings,
  isSocialFormat,
  tournamentBucket,
  bracketLabel,
  bracketRank,
  formatFee,
  getRegistrationPartnerCode,
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
  formatStartsOn,
  type RegInfo,
  type TabKey,
  type Division,
} from './TournamentDetailScreen';
import {
  FollowBell,
  LiveDot,
  MySummaryCard,
  NextMatchCard,
  YouAreInCard,
  buildPath,
  divShort,
  feeText,
  fetchMyRegPayments,
  fetchSignupOnline,
  longDay,
  roundNameOf,
  scoreFor,
  summarizeMyTournament,
  useNow,
} from '../components/PlayerTournamentParts';

const noop = () => {};
const RELOAD_MS = 60_000;

/**
 * Ficha del torneo para quien NO lo organiza (visitante, seguidor, jugador).
 *
 * Arriba lo práctico (cuándo, cuota por persona, plazas) y la acción que toca a
 * cada uno: «Apuntarme» fijo abajo para el visitante; «Estás dentro» y «Tu
 * próximo partido» para el inscrito; la campana para seguirlo. Mientras la
 * pantalla está abierta se recarga sola cada 60 s (sin Realtime).
 */
export const TournamentFollowScreen = ({
  navigation,
  route,
}: RootStackScreenProps<'TournamentFollow'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const own = useMemo(() => makeOwnStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { tournamentId } = route.params;
  const uid = useAuthStore((s) => s.user?.id ?? null);
  const now = useNow(60_000);
  const { mode } = useLayout();

  const [t, setT] = useState<Tournament | null>(null);
  const [regs, setRegs] = useState<TournamentRegistration[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDiv, setActiveDiv] = useState<Division | null>(null);
  const [tab, setTab] = useState<TabKey | null>(route.params?.initialTab ?? null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [activeBracket, setActiveBracket] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [payments, setPayments] = useState<
    Record<string, { status: string | null; method: string | null }>
  >({});
  const [partnerCode, setPartnerCode] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const prevStatus = useRef<Map<string, string> | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const following = useFavoritesStore((s) =>
    s.items.some((f) => f.kind === 'tournament' && f.refId === tournamentId),
  );

  const load = useCallback(async () => {
    try {
      const [tt, rr, mm] = await Promise.all([
        publicGetTournament(tournamentId),
        publicListRegistrations(tournamentId),
        publicListMatches(tournamentId),
      ]);
      // Resultado recién llegado → se ilumina 2 s en la lista de partidos.
      const before = prevStatus.current;
      if (before) {
        const newly = mm
          .filter((m) => m.status === 'finished' && before.get(m.id) !== 'finished')
          .map((m) => m.id);
        if (newly.length) {
          setFresh(new Set(newly));
          setTimeout(() => setFresh(new Set()), 2200);
        }
      }
      prevStatus.current = new Map(mm.map((m) => [m.id, m.status]));
      setT(tt);
      setRegs(rr);
      setMatches(mm);
      setUpdatedAt(Date.now());
    } catch (e: any) {
      // En la recarga silenciosa no molestamos con un aviso por cada fallo.
      if (!prevStatus.current) toast.error('No se pudo cargar el torneo', e?.message ?? '');
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  // Carga al entrar y recarga cada 60 s mientras la pantalla está a la vista.
  useFocusEffect(
    useCallback(() => {
      load();
      const id = setInterval(load, RELOAD_MS);
      return () => clearInterval(id);
    }, [load]),
  );

  // Vuelta del pago del torneo (deep link `tactium://tournament/{id}?paid=1`).
  const paid = route.params?.paid;
  useEffect(() => {
    if (paid) toast.success('Pago confirmado', 'Tu torneo ya está publicado.');
  }, [paid]);

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

  // Mis inscripciones (si estoy inscrito).
  const myRegs = useMemo(
    () => (uid ? regs.filter((r) => r.p1_user_id === uid || r.p2_user_id === uid) : []),
    [regs, uid],
  );
  const myRegIds = useMemo(() => new Set(myRegs.map((r) => r.id)), [myRegs]);
  const myRegIdList = useMemo(() => [...myRegIds], [myRegIds]);
  const myReg = myRegs[0] ?? null;

  // La división de partida es la MÍA si juego; si no, la primera.
  useEffect(() => {
    if (!divisions.length) return;
    if (activeDiv && divisions.some((d) => sameDiv(d, activeDiv))) return;
    const mine = myReg
      ? divisions.find((d) => d.gender === myReg.gender && d.category === myReg.category)
      : null;
    setActiveDiv(mine ?? divisions[0]);
  }, [divisions, myReg]); // eslint-disable-line react-hooks/exhaustive-deps

  // Datos que solo ve el propio jugador: estado del pago y código de pareja.
  useEffect(() => {
    if (!uid || !myReg) return;
    let alive = true;
    fetchMyRegPayments(tournamentId, uid).then((p) => alive && setPayments(p));
    if (myReg.p1_user_id === uid && !myReg.p2_user_id) {
      getRegistrationPartnerCode(myReg.id)
        .then((code) => alive && setPartnerCode(code))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [uid, myReg?.id, myReg?.p2_user_id, tournamentId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cómo se cobra la cuota (solo para el texto: la app no abre ningún pago).
  useEffect(() => {
    if (!t || !t.entry_fee || t.entry_fee <= 0) return;
    let alive = true;
    fetchSignupOnline(t.id).then((v) => alive && setOnline(v));
    return () => {
      alive = false;
    };
  }, [t?.id, t?.entry_fee]); // eslint-disable-line react-hooks/exhaustive-deps

  const dg = activeDiv?.gender ?? null;
  const dc = activeDiv?.category ?? null;
  const inDiv = <T extends { gender: string | null; category: string | null }>(x: T) =>
    x.gender === dg && x.category === dc;
  const regsCat = useMemo(() => regs.filter(inDiv), [regs, dg, dc]); // eslint-disable-line react-hooks/exhaustive-deps
  const matchesCat = useMemo(() => matches.filter(inDiv), [matches, dg, dc]); // eslint-disable-line react-hooks/exhaustive-deps

  const isRR = t?.format === 'round_robin';
  const isGroups = t?.format === 'groups_ko';
  const isSocial = isSocialFormat(t?.format ?? '');
  const isMexicano = t?.format === 'mexicano';
  const hasBracket = matchesCat.length > 0;
  const hasAnyMatches = matches.length > 0;
  const mainTabLabel = isRR ? 'Clasificación' : isGroups ? 'Grupos' : isSocial ? 'Rondas' : 'Cuadro';
  const koBrackets = useMemo(
    () =>
      Array.from(new Set(matchesCat.filter((m) => m.bracket !== 'grp').map((m) => m.bracket))).sort(
        (a, b) => bracketRank(a) - bracketRank(b),
      ),
    [matchesCat],
  );
  useEffect(() => {
    if (koBrackets.length && (!activeBracket || !koBrackets.includes(activeBracket))) {
      setActiveBracket(koBrackets[0]);
    }
  }, [koBrackets, activeBracket]);

  // Pestañas: antes del sorteo Info · Parejas · Cuadro; con cuadro
  // Partidos · Cuadro · Parejas · Info.
  const tabOrder: TabKey[] = hasAnyMatches
    ? ['schedule', 'main', 'players', 'info']
    : ['info', 'players', 'main'];
  const curTab: TabKey = tab && tabOrder.includes(tab) ? tab : tabOrder[0];

  const regById = useMemo(() => new Map(regs.map((r) => [r.id, r])), [regs]);
  const regInfo = useCallback(
    (id: string | null): RegInfo => {
      const r = id ? regById.get(id) : null;
      return {
        name: r?.p1_name ?? '—',
        partner: r?.p2_name ?? null,
        seed: r?.seed ?? null,
        avatar: r?.p1_avatar ?? null,
        partnerAvatar: r?.p2_avatar ?? null,
      };
    },
    [regById],
  );
  const regName = useCallback(
    (id: string | null): string => {
      if (!id) return '—';
      const r = regById.get(id);
      if (!r) return '—';
      const seed = r.seed ? `(${r.seed}) ` : '';
      return `${seed}${r.p1_name}${r.p2_name ? ` / ${r.p2_name}` : ''}`;
    },
    [regById],
  );

  const standings = useMemo(
    () => (isRR ? computeStandings(regsCat, matchesCat) : []),
    [isRR, regsCat, matchesCat],
  );

  // Campeones de la categoría elegida: final, subcampeones y consolación.
  const champ = useMemo(() => {
    if (!hasBracket) return null;
    if (isRR) {
      const allPlayed = matchesCat.every((m) => m.status === 'finished');
      if (!allPlayed || !standings[0]) return null;
      return { winner: standings[0].regId, runner: standings[1]?.regId ?? null, score: null, consol: null };
    }
    const finalOf = (b: string) => {
      const ko = matchesCat.filter((m) => m.bracket === b);
      const tr = ko.reduce((mx, x) => Math.max(mx, x.round), 0);
      return ko.find((m) => m.round === tr && m.slot === 0 && m.status === 'finished' && !!m.winner_reg) ?? null;
    };
    const mainB = matchesCat.some((m) => m.bracket === 'main') ? 'main' : 'gold';
    const final = finalOf(mainB);
    if (!final?.winner_reg) return null;
    const homeWon = final.winner_reg === final.home_reg;
    return {
      winner: final.winner_reg,
      runner: homeWon ? final.away_reg : final.home_reg,
      score: scoreFor(final, homeWon),
      consol: finalOf('consol')?.winner_reg ?? null,
    };
  }, [hasBracket, isRR, matchesCat, standings]);

  // Mi siguiente partido: el primero sin terminar con las dos parejas conocidas.
  const myNext = useMemo(() => {
    if (!myRegIds.size) return null;
    return (
      matches
        .filter(
          (m) =>
            m.status !== 'finished' &&
            m.status !== 'bye' &&
            !!m.home_reg &&
            !!m.away_reg &&
            [m.home_reg, m.away_reg, m.home_reg2, m.away_reg2].some((x) => x && myRegIds.has(x)),
        )
        .sort((a, b) => (a.scheduled_at ?? 'zz').localeCompare(b.scheduled_at ?? 'zz'))[0] ?? null
    );
  }, [matches, myRegIds]);
  const path = useMemo(
    () => (t && myRegIds.size ? buildPath(t, matches, myRegIds, regById, now) : null),
    [t, matches, myRegIds, regById, now],
  );
  const summary = useMemo(
    () => (t?.status === 'finished' ? summarizeMyTournament(matches, myRegIds) : null),
    [t?.status, matches, myRegIds],
  );

  const share = async (message: string) => {
    try {
      await Share.share({ message });
    } catch {
      /* cancelado */
    }
  };

  const onFollow = () => {
    if (!t) return;
    toggleFavorite({
      kind: 'tournament',
      refId: t.id,
      label: t.name,
      meta: [formatStartsOn(t.starts_on), t.location].filter(Boolean).join(' · ') || null,
    });
  };

  const onJoin = () => {
    if (!t) return;
    // Sin sesión: directo a crear la cuenta (antes salía una alerta del
    // sistema). TournamentFollow es de nivel RAÍZ, así que se navega al AuthFlow.
    if (!uid) {
      (navigation as any).navigate('AuthFlow', { screen: 'Login', params: { tab: 'signup' } });
      return;
    }
    navigation.navigate('TournamentSignup', { code: t.signup_code ?? undefined });
  };

  // ── Derivados de cabecera ──
  const bucket = t ? tournamentBucket(t.status, t.starts_on) : 'upcoming';
  const liveRound = useMemo(() => {
    const pending = matches
      .filter((m) => m.status !== 'finished' && m.status !== 'bye' && m.home_reg && m.away_reg)
      .sort((a, b) => (a.scheduled_at ?? 'zz').localeCompare(b.scheduled_at ?? 'zz'))[0];
    return pending ? roundNameOf(pending, matches) : null;
  }, [matches]);
  const dateRange =
    t && formatStartsOn(t.starts_on)
      ? t.ends_on && t.ends_on !== t.starts_on
        ? `${formatStartsOn(t.starts_on)} – ${formatStartsOn(t.ends_on)}`
        : formatStartsOn(t.starts_on)
      : null;
  const statusEyebrow = !t
    ? ''
    : t.status === 'open'
      ? 'Inscripción abierta'
      : t.status === 'finished'
        ? `Completado${dateRange ? ` · ${dateRange}` : ''}`
        : t.status === 'canceled'
          ? 'Cancelado'
          : bucket === 'live'
            ? `En juego${liveRound ? ` · ${liveRound}` : ''}`
            : t.status === 'in_progress'
              ? 'Próximamente'
              : 'Borrador';
  const fee = t ? feeText(t, online) : null;
  const unit = isSocial ? 'jugadores' : 'parejas';
  const showFacts = !!t && !myReg && (t.status === 'open' || bucket === 'upcoming');
  const showJoinBar = !!t && !myReg && t.status === 'open';
  const showFollowBar = !!t && !myReg && t.status !== 'open';

  const bottomPad = insets.bottom + (showJoinBar || showFollowBar ? 96 : 32);

  // «Tu próximo partido» (solo quien está inscrito). En tablet horizontal va
  // en una columna lateral junto a las pestañas; quien solo sigue el torneo
  // tiene todo el ancho para las pistas.
  const nextCard =
    t && myReg && myNext && t.status !== 'finished' ? (
      <NextMatchCard
        t={t}
        match={myNext}
        matches={matches}
        regById={regById}
        myIds={myRegIds}
        path={path?.current?.id === myNext.id ? path.steps : []}
        consolNote={path?.current?.id === myNext.id ? path.consolNote : null}
        onSeeBracket={() => setTab('main')}
        onSeeMatches={() => setTab('schedule')}
      />
    ) : null;
  const sideNext = mode === 'tabletLandscape' && !!nextCard;

  return (
    <View style={styles.root}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : !t ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Torneo no disponible.</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingBottom: bottomPad }}
          showsVerticalScrollIndicator={false}
        >
          {/* Portada compacta: la información va debajo, no encima. */}
          <View style={[own.cover, { height: 118 + insets.top }]}>
            {t.cover_url ? (
              <Image source={{ uri: t.cover_url }} style={StyleSheet.absoluteFill} />
            ) : (
              <LinearGradient
                colors={[c.accent25, c.bgCard]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <LinearGradient
              colors={['rgba(0,0,0,0.45)', 'transparent', c.background]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <View style={own.titleBlock}>
            <View style={own.statusRow}>
              {bucket === 'live' ? <LiveDot /> : null}
              <Text
                style={[own.statusText, t.status === 'open' || bucket === 'live' ? { color: c.accent } : null]}
                numberOfLines={1}
              >
                {statusEyebrow.toUpperCase()}
              </Text>
            </View>
            <Text style={own.title} numberOfLines={2}>
              {t.name}
            </Text>
            <Text style={own.meta} numberOfLines={2}>
              {[t.location, t.status === 'finished' ? null : longDay(t.starts_on)]
                .filter(Boolean)
                .join(' · ') || 'Fecha por confirmar'}
            </Text>
          </View>

          {/* Lo práctico arriba: cuándo, cuota y plazas. */}
          {showFacts ? (
            <View style={own.facts}>
              <View style={own.factRow}>
                <Text style={own.factLabel}>CUÁNDO</Text>
                <Text style={own.factValue}>
                  {longDay(t.starts_on) ?? 'Por confirmar'}
                  {t.start_time ? ` desde las ${t.start_time.slice(0, 5)}` : ''}
                  {t.ends_on && t.ends_on !== t.starts_on ? ` · hasta ${longDay(t.ends_on)}` : ''}
                </Text>
              </View>
              <View style={[own.factRow, own.factBorder]}>
                <Text style={own.factLabel}>CUOTA</Text>
                <View style={{ flex: 1 }}>
                  <Text style={own.factValue}>{fee?.amount}</Text>
                  {fee?.note ? <Text style={own.factSub}>{fee.note}</Text> : null}
                </View>
              </View>
              <View style={[own.factRow, own.factBorder]}>
                <Text style={own.factLabel}>PLAZAS</Text>
                <View style={{ flex: 1 }}>
                  <Text style={own.factValue}>
                    {t.max_pairs ? `${regs.length} de ${t.max_pairs} ${unit}` : `${regs.length} ${unit} · sin límite`}
                  </Text>
                  {t.max_pairs ? (
                    <View style={own.bar}>
                      <View
                        style={[
                          own.barFill,
                          { width: `${Math.min(100, Math.round((regs.length / t.max_pairs) * 100))}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {/* Lo mío: próximo partido y camino, o «Estás dentro». */}
          {sideNext ? null : nextCard}
          {myReg && t.status !== 'finished' && (!myNext || (partnerCode && !myReg.p2_user_id)) ? (
            <YouAreInCard
              t={t}
              reg={myReg}
              payment={payments[myReg.id] ?? null}
              partnerCode={partnerCode}
              hasBracket={hasAnyMatches}
              onSendCode={(code) =>
                share(
                  `🎾 Te he apuntado al torneo "${t.name}" en TACTIUM. Entra con este código de pareja para verlo en tu móvil: ${code}`,
                )
              }
            />
          ) : null}

          {!myReg && following ? (
            <View style={own.followNote}>
              <IconCheck size={14} color={c.accent} />
              <Text style={own.followNoteText}>
                Sigues este torneo. Lo tienes guardado en tus favoritos.
              </Text>
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
                    <Text style={[styles.catTabText, { color: sel ? c.textInverse : c.textMuted }]}>
                      {divShort(d.gender, d.category)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}

          {champ ? (
            <ChampionHero
              info={regInfo(champ.winner)}
              styles={styles}
              c={c}
              divName={divisions.length > 1 && activeDiv ? divShort(activeDiv.gender, activeDiv.category) : null}
              finalScore={champ.score}
              runnerUp={champ.runner ? regInfo(champ.runner) : null}
              consolWinner={champ.consol ? regInfo(champ.consol) : null}
            />
          ) : null}

          {summary ? (
            <MySummaryCard
              summary={summary}
              onShare={() =>
                share(
                  `🎾 ${t.name}: ${summary.reached}. ${summary.wins} ${summary.wins === 1 ? 'victoria' : 'victorias'}, ${summary.losses} ${summary.losses === 1 ? 'derrota' : 'derrotas'} y ${summary.games} juegos ganados. Lo sigo en TACTIUM: https://tactium.io/torneos/${t.id}`,
                )
              }
            />
          ) : null}

          <ContentTabs
            tab={curTab}
            setTab={setTab}
            mainLabel={mainTabLabel}
            showSchedule={hasAnyMatches}
            order={tabOrder}
            playersLabel={isSocial ? 'Jugadores' : 'Parejas'}
            playersCount={regsCat.length || undefined}
            styles={styles}
            c={c}
          />

          <View style={sideNext ? own.splitRow : undefined}>
          <View style={sideNext ? own.splitMain : undefined}>
          {curTab === 'schedule' ? (
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
              myRegIds={myRegIdList}
              fresh={fresh}
              updatedAt={updatedAt}
              styles={styles}
              c={c}
            />
          ) : curTab === 'players' ? (
            <PlayersView
              regs={regsCat}
              info={regInfo}
              social={isSocial}
              canEdit={false}
              onAdd={noop}
              onRemove={noop}
              divName={activeDiv && divisions.length > 1 ? divLabel(activeDiv) : null}
              maxPairs={t.max_pairs ?? null}
              myRegIds={myRegIdList}
              styles={styles}
              c={c}
            />
          ) : curTab === 'info' ? (
            <InfoView
              t={t}
              audience="player"
              feeNote={
                myReg && payments[myReg.id]?.method === 'stripe'
                  ? 'pagada online'
                  : fee?.note || null
              }
              onShareCode={() =>
                t.signup_code
                  ? share(`🎾 Apúntate al torneo "${t.name}" en TACTIUM.\nCódigo: ${t.signup_code}`)
                  : undefined
              }
              styles={styles}
              c={c}
            />
          ) : !hasBracket ? (
            <View style={own.emptyMain}>
              <Text style={own.emptyMainTitle}>
                {t.status === 'open' ? 'Sale cuando cierre la inscripción' : 'Aún no está publicado'}
              </Text>
              <Text style={styles.emptyText}>
                Cuando el club genere el {mainTabLabel.toLowerCase()} lo verás aquí
                {myReg ? ', con tu camino marcado.' : '.'}
              </Text>
            </View>
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
              {koBrackets.length > 1 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catTabs}>
                  {koBrackets.map((b) => {
                    const sel = activeBracket === b;
                    return (
                      <Pressable
                        key={b}
                        onPress={() => setActiveBracket(b)}
                        style={[styles.catTab, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
                      >
                        <Text style={[styles.catTabText, { color: sel ? c.textInverse : c.textMuted }]}>
                          {bracketLabel(b)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}
              <Text style={[styles.sectionLabel, { paddingHorizontal: 22, marginTop: 8 }]}>
                {(activeBracket ? bracketLabel(activeBracket) : 'CUADRO').toUpperCase()}
              </Text>
              <BracketView
                matches={matchesCat.filter((m) => m.bracket === (activeBracket ?? 'main'))}
                regName={regName}
                onEdit={noop}
                collapsed={collapsed}
                toggleRound={toggleRound}
                readOnly
                myRegIds={myRegIdList}
              />
            </View>
          )}
          </View>
          {sideNext ? <View style={own.splitSide}>{nextCard}</View> : null}
          </View>
        </ScrollView>
      )}

      {/* Controles sobre la portada: atrás · compartir · seguir. */}
      <View style={[own.controls, { top: insets.top + 6 }]} pointerEvents="box-none">
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          accessibilityLabel="Atrás"
          style={({ pressed }) => [styles.heroCtrlBtn, pressed && { opacity: 0.7 }]}
        >
          <IconBack size={20} color="#fff" />
        </Pressable>
        {t ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable
              onPress={() => share(`🎾 ${t.name} en TACTIUM: https://tactium.io/torneos/${t.id}`)}
              hitSlop={10}
              accessibilityLabel="Compartir el torneo"
              style={({ pressed }) => [styles.heroCtrlBtn, pressed && { opacity: 0.7 }]}
            >
              <IconShare size={17} color="#fff" />
            </Pressable>
            <FollowBell on={following} onPress={onFollow} color="#fff" style={styles.heroCtrlBtn} />
          </View>
        ) : null}
      </View>

      {/* Barra de acción fija: solo cuando hay algo que hacer. */}
      {showJoinBar && t ? (
        <Animated.View
          entering={SlideInDown.duration(200)}
          style={[own.bar2, { paddingBottom: insets.bottom + 10 }]}
        >
          <Pressable
            onPress={onJoin}
            accessibilityRole="button"
            style={({ pressed }) => [own.joinBtn, pressed && { opacity: 0.9 }]}
          >
            <Text style={own.joinText}>
              Apuntarme ·{' '}
              {t.entry_fee && t.entry_fee > 0 ? `${formatFee(t.entry_fee, t.fee_currency)}/pers.` : 'Gratis'}
            </Text>
          </Pressable>
          <Text style={own.barSub}>
            {uid ? 'Inscripción en 3 pasos' : 'Necesitas una cuenta gratis para apuntarte'}
          </Text>
        </Animated.View>
      ) : showFollowBar && t ? (
        <Animated.View
          entering={SlideInDown.duration(200)}
          style={[own.bar2, own.barRow, { paddingBottom: insets.bottom + 10 }]}
        >
          <Pressable
            onPress={() => share(`🎾 ${t.name} en TACTIUM: https://tactium.io/torneos/${t.id}`)}
            style={({ pressed }) => [own.ghostBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={own.ghostText}>Compartir</Text>
          </Pressable>
          <Pressable
            onPress={onFollow}
            accessibilityState={{ selected: following }}
            style={({ pressed }) => [following ? own.ghostBtn : own.joinBtn, { flex: 1 }, pressed && { opacity: 0.9 }]}
          >
            <Text style={following ? own.ghostText : own.joinText}>
              {following ? '✓ Siguiendo' : 'Seguir torneo'}
            </Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </View>
  );
};

const makeOwnStyles = (c: Palette) =>
  StyleSheet.create({
    // Tablet horizontal: pestañas + «Tu próximo partido» en un lateral.
    splitRow: { flexDirection: 'row', alignItems: 'flex-start' },
    splitMain: { flex: 1, minWidth: 0 },
    splitSide: { width: 380 },
    cover: { width: '100%', backgroundColor: c.bgCard, overflow: 'hidden' },
    controls: {
      position: 'absolute',
      left: 16,
      right: 16,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    titleBlock: { paddingHorizontal: 22, marginTop: -6 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    statusText: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 1.8,
      fontWeight: '700',
      color: c.textFaint,
    },
    title: { color: c.text, fontSize: 25, fontWeight: '800', letterSpacing: -0.6, marginTop: 6, lineHeight: 30 },
    meta: { color: c.textMuted, fontSize: 13.5, marginTop: 4 },
    facts: {
      marginHorizontal: 22,
      marginTop: 16,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
    },
    factRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, alignItems: 'flex-start' },
    factBorder: { borderTopWidth: 1, borderColor: c.hair },
    factLabel: {
      width: 64,
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 1.4,
      fontWeight: '700',
      color: c.textFaint,
      paddingTop: 2,
    },
    factValue: { flex: 1, color: c.text, fontSize: 14, fontWeight: '700' },
    factSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    bar: { height: 5, borderRadius: 3, backgroundColor: c.hairStrong, marginTop: 8, overflow: 'hidden' },
    barFill: { height: 5, borderRadius: 3, backgroundColor: c.accent },
    followNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginHorizontal: 22,
      marginTop: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: Radius.md,
      backgroundColor: c.accent10,
    },
    followNoteText: { flex: 1, color: c.text, fontSize: 12.5, fontWeight: '600' },
    emptyMain: { paddingHorizontal: 22, paddingTop: 6, gap: 6 },
    emptyMainTitle: { color: c.text, fontSize: 15, fontWeight: '800' },
    bar2: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 18,
      paddingTop: 12,
      backgroundColor: c.background,
      borderTopWidth: 1,
      borderColor: c.hairStrong,
    },
    barRow: { flexDirection: 'row', gap: 10 },
    joinBtn: {
      height: 50,
      borderRadius: 14,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    joinText: { color: c.textInverse, fontSize: 15.5, fontWeight: '800' },
    ghostBtn: {
      height: 50,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 18,
    },
    ghostText: { color: c.text, fontSize: 14.5, fontWeight: '700' },
    barSub: { color: c.textFaint, fontSize: 11.5, textAlign: 'center', marginTop: 7 },
  });
