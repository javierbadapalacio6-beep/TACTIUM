import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, NeonDot, useLayout } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { toast } from '@store/toastStore';
import * as MatchdaysApi from '@core/services/matchdays';
import { useLiveMatchday, useNow } from '@core/hooks/useLiveMatchday';
import {
  activeScorer,
  applyGameLocal,
  claimCourt,
  finishCourt,
  isLockError,
  isStaleError,
  liveErrorMessage,
  newEventId,
  releaseCourt,
  scoreGame,
  setsWon,
  undoGame,
  type LiveCourtState,
} from '@core/services/live';

import { notifySuccess, notifyWarning, tapLight, tapMedium } from '../components/match/haptics';

import type { HomeStackScreenProps } from '@navigation/types';

/**
 * Marcador en vivo de UNA pista (juego a juego).
 *
 * Pensado para el compañero que mira desde fuera con el móvil en una mano: el
 * tanteo enorme arriba («SET 2» y los juegos, a la manera del contador de
 * pushr) y dos botones gigantes abajo, al alcance del pulgar. Deshacer
 * siempre a la vista. Cambio de set automático (6 con 2 de ventaja, 7-5 o
 * 7-6; el tie-break no lleva puntos).
 *
 * Marcador activo: al entrar se «coge» la pista; si otro la lleva, se dice y
 * se puede tomar el relevo. Al salir se suelta. Cada toque va con su uuid
 * (idempotente) y el nº de juegos que se veía (ordenado), en cola: aunque se
 * toque rápido, llegan en orden.
 */
export const LiveScoreScreen = ({ navigation, route }: HomeStackScreenProps<'LiveScore'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const { isTablet } = useLayout();
  const { matchdayId, court } = route.params;
  const myUserId = useAuthStore((s) => s.user?.id ?? null);
  const team = useTeamStore((s) => s.team);
  const { state, reload } = useLiveMatchday(matchdayId);
  const now = useNow(10_000);

  const [matchday, setMatchday] = useState<MatchdaysApi.Matchday | null>(null);
  const [claiming, setClaiming] = useState(true);
  const [lockedBy, setLockedBy] = useState<string | null>(null);
  // Estado optimista mientras hay toques en vuelo.
  const [local, setLocal] = useState<LiveCourtState | null>(null);
  const [pending, setPending] = useState(0);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  // Último estado CONFIRMADO por el servidor (lo que se manda como esperado).
  const confirmed = useRef<LiveCourtState | null>(null);

  const courtState = state?.courts.find((ct) => ct.court_number === court) ?? null;
  const serverLive = courtState?.live ?? null;
  // Lo local manda mientras hay toques en vuelo o si es más nuevo que lo que
  // ha llegado por Realtime (evita el parpadeo hacia atrás).
  const live =
    local &&
    (pending > 0 ||
      !serverLive ||
      new Date(local.updated_at).getTime() >= new Date(serverLive.updated_at).getTime())
      ? local
      : serverLive;
  const otherScorer = activeScorer(serverLive, myUserId, now);
  const blocked = !!lockedBy || !!otherScorer;
  const finished = live?.status === 'finished';
  const closed = state?.matchday_status === 'finished';
  const isAdmin = !!state?.is_admin;

  useEffect(() => {
    if (pending === 0) confirmed.current = serverLive;
  }, [serverLive, pending]);

  useEffect(() => {
    MatchdaysApi.fetchMatchday(matchdayId)
      .then(setMatchday)
      .catch(() => {});
  }, [matchdayId]);

  const claim = useCallback(
    async (force: boolean) => {
      setClaiming(true);
      try {
        const s = await claimCourt(matchdayId, court, force);
        confirmed.current = s;
        setLockedBy(null);
        if (force) tapMedium();
        reload();
      } catch (e) {
        if (isLockError(e)) {
          setLockedBy(serverLive?.scorer_name ?? 'otro compañero');
        } else {
          toast.error('No se puede marcar', liveErrorMessage(e));
        }
      } finally {
        setClaiming(false);
      }
    },
    // serverLive solo para el nombre del aviso
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchdayId, court, reload],
  );

  // Coger la pista al entrar; soltarla al salir.
  useEffect(() => {
    claim(false);
    return () => {
      releaseCourt(matchdayId, court).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchdayId, court]);

  const enqueue = (job: () => Promise<LiveCourtState>) => {
    setPending((p) => p + 1);
    queue.current = queue.current
      .then(async () => {
        try {
          const s = await job();
          confirmed.current = s;
          setLocal(s);
        } catch (e) {
          setLocal(null);
          if (isLockError(e)) {
            notifyWarning();
            setLockedBy(serverLive?.scorer_name ?? 'otro compañero');
          } else if (isStaleError(e)) {
            notifyWarning();
            toast.warn('El tanteo acaba de cambiar', 'Revísalo y vuelve a marcar.');
          } else {
            notifyWarning();
            toast.error('No se ha guardado el juego', liveErrorMessage(e));
          }
          reload();
          throw e;
        }
      })
      .catch(() => {})
      .finally(() => setPending((p) => Math.max(0, p - 1)));
  };

  const base = (): LiveCourtState =>
    live ?? {
          id: '',
          court_number: court,
          format: 'normal',
          status: 'live',
          sets: [{ us: 0, them: 0 }],
          winner: null,
          games_count: 0,
          started_at: new Date().toISOString(),
          finished_at: null,
          updated_at: new Date().toISOString(),
          scorer_id: myUserId,
          scorer_name: null,
          scorer_seen_at: null,
          scorer_active: true,
        };

  const addGame = (side: 'us' | 'them') => {
    if (blocked || finished || closed) return;
    const before = base();
    const next = applyGameLocal(before, side);
    if (next.sets.length > before.sets.length || next.status === 'finished') notifySuccess();
    else tapLight();
    setLocal(next);
    const eventId = newEventId();
    enqueue(() =>
      scoreGame(matchdayId, court, side, eventId, confirmed.current?.games_count ?? null),
    );
  };

  const undo = () => {
    if (blocked || closed || !live || live.games_count === 0) return;
    tapMedium();
    enqueue(() => undoGame(matchdayId, court, confirmed.current?.games_count ?? null));
  };

  const finish = () => {
    Alert.alert(
      `¿Terminar la pista ${court}?`,
      'Lo marcado pasa al acta tal cual. Después se puede corregir a mano en Resultados.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Terminar',
          style: 'destructive',
          onPress: () =>
            enqueue(async () => {
              const s = await finishCourt(matchdayId, court);
              notifySuccess();
              return s;
            }),
        },
      ],
    );
  };

  const sets = live?.sets ?? [{ us: 0, them: 0 }];
  const cur = finished ? null : sets[sets.length - 1];
  const done = finished ? sets : sets.slice(0, -1);
  const won = setsWon(live);
  const setLabel = finished
    ? live?.winner === 'us'
      ? 'Pista ganada'
      : live?.winner === 'them'
      ? 'Pista perdida'
      : 'Pista terminada'
    : live?.format === 'super_tb' && sets.length === 3
    ? 'Super tie-break'
    : `Set ${sets.length}`;
  const pair =
    [courtState?.player_a?.name, courtState?.player_b?.name].filter(Boolean).join(' / ') ||
    'Nosotros';
  const rival = matchday?.opponent ?? 'Rival';
  const disabled = blocked || finished || closed || claiming;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Jornada', { matchdayId }))}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Volver a la jornada"
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>Jornada</Text>
        </Pressable>
        <View style={styles.headerMid}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Pista {court}
            {team?.name ? ` · ${team.name}` : ''}
          </Text>
          <View style={styles.liveRow}>
            {finished || closed ? null : <NeonDot size={6} color={c.error} />}
            <Text style={[styles.liveTxt, { color: finished || closed ? c.textMuted : c.error }]}>
              {closed ? 'Acta cerrada' : finished ? 'Terminada' : 'En directo'}
            </Text>
            {pending > 0 ? <ActivityIndicator size="small" color={c.textFaint} /> : null}
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
          isTablet && styles.scrollTablet,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Quién marca */}
        {blocked ? (
          <View style={styles.lockCard}>
            <Text style={styles.lockTitle}>
              La marca {otherScorer ?? lockedBy ?? 'otro compañero'}
            </Text>
            <Text style={styles.lockBody}>
              Para que no se marque doble, solo una persona lleva cada pista. Si ya no
              está pendiente, toma tú el relevo.
            </Text>
            <Pressable
              onPress={() => claim(true)}
              disabled={claiming}
              style={({ pressed }) => [styles.relayBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
            >
              {claiming ? (
                <ActivityIndicator color={c.textInverse} />
              ) : (
                <Text style={styles.relayTxt}>Tomar el relevo</Text>
              )}
            </Pressable>
          </View>
        ) : (
          <Text style={styles.youMark}>
            {claiming ? 'Cogiendo la pista…' : closed ? 'El acta está cerrada.' : 'Marcas tú esta pista.'}
          </Text>
        )}

        {/* Tanteo */}
        <View style={styles.board}>
          <Text style={styles.setLabel}>{setLabel.toUpperCase()}</Text>
          <View style={styles.bigRow}>
            <View style={styles.side}>
              <Text style={styles.sideName} numberOfLines={2}>
                {pair}
              </Text>
              <Text style={[styles.bigNum, live?.winner === 'us' && { color: c.accent }]}>
                {cur ? cur.us : won.us}
              </Text>
            </View>
            <Text style={styles.bigDash}>–</Text>
            <View style={styles.side}>
              <Text style={styles.sideName} numberOfLines={2}>
                {rival}
              </Text>
              <Text style={[styles.bigNum, live?.winner === 'them' && { color: c.error }]}>
                {cur ? cur.them : won.them}
              </Text>
            </View>
          </View>
          {done.length > 0 ? (
            <View style={styles.history}>
              {done.map((s, i) => (
                <View key={i} style={[styles.chip, s.us > s.them ? styles.chipWin : styles.chipLoss]}>
                  <Text style={[styles.chipTxt, { color: s.us > s.them ? c.accent : c.textMuted }]}>
                    {s.us}-{s.them}
                  </Text>
                </View>
              ))}
              {!finished ? (
                <Text style={styles.histSub}>
                  Sets {won.us}-{won.them}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.histSub}>Toca quien gana cada juego. El set cambia solo.</Text>
          )}
        </View>

        {/* Botonera */}
        <View style={styles.pad}>
          <Pressable
            onPress={() => addGame('us')}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Juego para nosotros"
            style={({ pressed }) => [
              styles.bigBtn,
              styles.bigBtnUs,
              disabled && styles.bigBtnOff,
              pressed && !disabled && { transform: [{ scale: 0.98 }], opacity: 0.92 },
            ]}
          >
            <Text style={[styles.bigBtnPlus, { color: c.textInverse }]}>+</Text>
            <Text style={[styles.bigBtnTxt, { color: c.textInverse }]}>Nosotros</Text>
          </Pressable>
          <Pressable
            onPress={() => addGame('them')}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Juego para el rival"
            style={({ pressed }) => [
              styles.bigBtn,
              styles.bigBtnThem,
              disabled && styles.bigBtnOff,
              pressed && !disabled && { transform: [{ scale: 0.98 }], opacity: 0.92 },
            ]}
          >
            <Text style={[styles.bigBtnPlus, { color: c.text }]}>+</Text>
            <Text style={[styles.bigBtnTxt, { color: c.text }]}>Rival</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={undo}
          disabled={blocked || closed || !live || live.games_count === 0}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.undoBtn,
            (blocked || closed || !live || live.games_count === 0) && { opacity: 0.4 },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={styles.undoTxt}>↶  Deshacer último juego</Text>
        </Pressable>

        {finished ? (
          <Text style={styles.note}>
            Ya está en el acta. Si algo no cuadra, deshaz el último juego o corrígelo en Resultados.
          </Text>
        ) : null}

        {isAdmin && !closed && live && !finished ? (
          <Pressable
            onPress={finish}
            disabled={blocked}
            accessibilityRole="button"
            style={({ pressed }) => [styles.finishBtn, blocked && { opacity: 0.4 }, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.finishTxt}>Terminar pista y pasarla al acta</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 8 },
    backBtn: {
      height: 36,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    backLabel: { color: c.text, fontSize: 13, fontWeight: '600' },
    headerMid: { flex: 1, minWidth: 0 },
    headerTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    liveTxt: { fontSize: 12, fontWeight: '600' },
    scroll: { paddingHorizontal: 16, paddingTop: 8 },
    scrollTablet: { width: '100%', maxWidth: 560, alignSelf: 'center' },
    youMark: { color: c.textMuted, fontSize: 13, textAlign: 'center', marginBottom: 10 },
    lockCard: {
      backgroundColor: withAlpha(c.warning, 0.1),
      borderColor: withAlpha(c.warning, 0.35),
      borderWidth: 1,
      borderRadius: Radius.md,
      padding: 14,
      marginBottom: 12,
    },
    lockTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
    lockBody: { color: c.textMuted, fontSize: 13, marginTop: 4, lineHeight: 18 },
    relayBtn: {
      marginTop: 12,
      height: 44,
      borderRadius: Radius.md,
      backgroundColor: c.warning,
      alignItems: 'center',
      justifyContent: 'center',
    },
    relayTxt: { color: '#1A1400', fontSize: 15, fontWeight: '700' },
    board: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingVertical: 18,
      paddingHorizontal: 14,
      alignItems: 'center',
    },
    setLabel: { fontFamily: Fonts.mono, fontSize: 12, color: c.textMuted, letterSpacing: 1.5 },
    bigRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8, width: '100%' },
    side: { flex: 1, alignItems: 'center', minWidth: 0 },
    sideName: { color: c.textMuted, fontSize: 13, fontWeight: '600', textAlign: 'center', minHeight: 34 },
    bigNum: { fontFamily: Fonts.mono, fontSize: 88, fontWeight: '700', color: c.text, lineHeight: 96 },
    bigDash: { fontFamily: Fonts.mono, fontSize: 40, color: c.textFaint, marginBottom: 24 },
    history: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' },
    chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
    chipWin: { borderColor: withAlpha(c.accent, 0.45), backgroundColor: withAlpha(c.accent, 0.1) },
    chipLoss: { borderColor: c.hairStrong },
    chipTxt: { fontFamily: Fonts.mono, fontSize: 14, fontWeight: '700' },
    histSub: { color: c.textFaint, fontSize: 12.5, marginTop: 10, textAlign: 'center' },
    pad: { flexDirection: 'row', gap: 12, marginTop: 16 },
    bigBtn: {
      flex: 1,
      height: 148,
      borderRadius: Radius.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bigBtnUs: { backgroundColor: c.accent },
    bigBtnThem: { backgroundColor: c.bgCard2, borderWidth: 1, borderColor: c.hairStrong },
    bigBtnOff: { opacity: 0.35 },
    bigBtnPlus: { fontSize: 44, fontWeight: '300', lineHeight: 48 },
    bigBtnTxt: { fontSize: 18, fontWeight: '700' },
    undoBtn: {
      marginTop: 12,
      height: 52,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    undoTxt: { color: c.text, fontSize: 15, fontWeight: '600' },
    note: { color: c.textMuted, fontSize: 13, textAlign: 'center', marginTop: 12, lineHeight: 18 },
    finishBtn: { marginTop: 18, alignItems: 'center', paddingVertical: 10 },
    finishTxt: { color: c.error, fontSize: 14, fontWeight: '600' },
  });
