import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconSearch, IconTrophy, IconChevron, IconTicket, BottomSheet } from '@components/ui';
import { toast } from '@store/toastStore';
import { useAuthStore } from '@store/authStore';
import {
  exploreTournaments,
  myTournaments,
  tournamentBucket,
  formatFee,
  claimPartnerByCode,
  lookupTournament,
  publicListRegistrations,
  publicListMatches,
  type ExploreTournament,
  type TournamentMatch,
} from '@core/services/tournaments';
import {
  LiveDot,
  countdown,
  divShort,
  fetchMyRegPayments,
  localIso,
  roundNameOf,
  summarizeMyTournament,
  useNow,
} from '../components/PlayerTournamentParts';

import type { RootStackScreenProps } from '@navigation/types';

/**
 * Competir › Torneos. Primero lo que está pasando:
 *   Explorar → «En juego ahora» · «Inscripción abierta» · «Próximamente» ·
 *              «Terminados» (plegados), con tarjetas de una línea.
 *   Mis torneos → por fecha, y cada fila dice lo tuyo (hora de tu partido,
 *              si falta pagar, hasta dónde llegaste).
 * Un solo «Tengo un código»: prueba primero como código de torneo y, si no
 * existe, como código de pareja. Son dos RPC que ya había.
 */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DOW = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const shortDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return null;
  return `${d} ${MESES[m - 1]}`;
};

const STOP = new Set(['torneo', 'de', 'del', 'la', 'el', 'los', 'las', 'y', 'open', 'copa', 'i', 'ii', 'iii']);
/** «OTÑ» para la miniatura sin portada. */
const abbr = (name: string): string => {
  const words = name.split(/\s+/).filter(Boolean);
  const w = words.find((x) => !STOP.has(x.toLowerCase())) ?? words[0] ?? '?';
  return w.slice(0, 3).toUpperCase();
};

type StatusFilter = 'all' | 'open' | 'live';
type Digest = {
  partner: string | null;
  div: string;
  line: string;
  tone: 'accent' | 'warning' | 'muted';
  badge: string | null;
  today: boolean;
};

/** Miniatura cuadrada con la portada o las iniciales, y el estado encima. */
const Thumb: React.FC<{
  t: ExploreTournament;
  live: boolean;
  badge?: string | null;
  s: Styles;
  c: Palette;
}> = ({ t, live, badge, s, c }) => (
  <View style={s.thumb}>
    {t.cover_url ? (
      <Image source={{ uri: t.cover_url }} style={StyleSheet.absoluteFill} />
    ) : (
      <Text style={s.thumbText}>{abbr(t.name)}</Text>
    )}
    {live ? (
      <View style={s.thumbLive}>
        <LiveDot size={7} />
      </View>
    ) : null}
    {badge ? (
      <View style={[s.thumbBadge, { backgroundColor: c.warning }]}>
        <Text style={s.thumbBadgeText}>{badge}</Text>
      </View>
    ) : null}
  </View>
);

const Row: React.FC<{
  t: ExploreTournament;
  onPress: () => void;
  s: Styles;
  c: Palette;
  digest?: Digest | null;
}> = ({ t, onPress, s, c, digest }) => {
  const bucket = tournamentBucket(t.status, t.starts_on);
  const fee = t.entry_fee && t.entry_fee > 0 ? `${formatFee(t.entry_fee, t.fee_currency)}/pers.` : 'Gratis';
  const inscritos = t.pair_based
    ? `${t.players} ${t.players === 1 ? 'pareja inscrita' : 'parejas inscritas'}`
    : `${t.players} ${t.players === 1 ? 'jugador inscrito' : 'jugadores inscritos'}`;
  const meta = digest
    ? [shortDate(t.starts_on), digest.div, digest.partner ? `con ${digest.partner}` : null]
    : [t.club_name, t.location, shortDate(t.starts_on), t.status === 'open' ? fee : null];
  const line = digest
    ? digest.line
    : bucket === 'live'
      ? 'En juego'
      : t.status === 'open'
        ? inscritos
        : bucket === 'finished'
          ? t.status === 'canceled'
            ? 'Cancelado'
            : 'Terminado'
          : 'Próximamente';
  const tone = digest
    ? digest.tone
    : bucket === 'live' || t.status === 'open'
      ? 'accent'
      : 'muted';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
      <Thumb t={t} live={bucket === 'live'} badge={digest?.badge} s={s} c={c} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={s.rowName} numberOfLines={1}>
          {t.name}
        </Text>
        <Text style={s.rowMeta} numberOfLines={1}>
          {meta.filter(Boolean).join(' · ') || 'Fecha por confirmar'}
        </Text>
        <Text
          style={[
            s.rowLine,
            { color: tone === 'accent' ? c.accent : tone === 'warning' ? c.warning : c.textFaint },
          ]}
          numberOfLines={1}
        >
          {line}
        </Text>
      </View>
      <IconChevron size={15} color={c.textFaint} />
    </Pressable>
  );
};

export const ExploreTournamentsScreen = ({
  navigation,
  embedded,
}: RootStackScreenProps<'ExploreTournaments'> & {
  /** Segmento Torneos de Competir: sin cabecera ni «Atrás» y con hueco para
   *  la barra flotante. */
  embedded?: boolean;
}) => {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const uid = useAuthStore((st) => st.user?.id ?? null);
  const now = useNow(60_000);

  const [mode, setMode] = useState<'explore' | 'mine'>('explore');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ExploreTournament[]>([]);
  const [mine, setMine] = useState<ExploreTournament[]>([]);
  const [digests, setDigests] = useState<Record<string, Digest>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [genders, setGenders] = useState<Set<string>>(new Set());
  const [showFinished, setShowFinished] = useState(false);
  // Hoja «Tengo un código» (vale el del torneo y el de tu pareja).
  const [codeOpen, setCodeOpen] = useState(false);
  const [code, setCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);
  const [codeErr, setCodeErr] = useState<string | null>(null);

  const loadExplore = useCallback(async (q?: string) => {
    try {
      setItems(await exploreTournaments(q));
    } catch (e: any) {
      toast.error('No se pudieron cargar', e?.message ?? '');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Cada fila de «Mis torneos» dice lo tuyo. Sale de datos que ya hay
  // (inscripción, horario, cuadro y estado de pago), torneo a torneo.
  const loadDigests = useCallback(
    async (list: ExploreTournament[]) => {
      if (!uid || !list.length) return;
      const out: Record<string, Digest> = {};
      await Promise.all(
        list.slice(0, 12).map(async (t) => {
          try {
            const [regs, matches, pays] = await Promise.all([
              publicListRegistrations(t.id),
              publicListMatches(t.id),
              fetchMyRegPayments(t.id, uid),
            ]);
            const myRegs = regs.filter((r) => r.p1_user_id === uid || r.p2_user_id === uid);
            const me = myRegs[0];
            if (!me) return;
            const ids = new Set(myRegs.map((r) => r.id));
            const partnerFull = me.p1_user_id === uid ? me.p2_name : me.p1_name;
            const partner = partnerFull ? partnerFull.split(/\s+/).slice(0, 2).join(' ') : null;
            const div = divShort(me.gender, me.category);
            const pending = Object.entries(pays).some(
              ([id, p]) => ids.has(id) && p.status === 'pending_club',
            );
            const bucket = tournamentBucket(t.status, t.starts_on);
            let next: TournamentMatch | undefined;
            for (const m of matches) {
              if (m.status === 'finished' || m.status === 'bye' || !m.scheduled_at) continue;
              if (![m.home_reg, m.away_reg, m.home_reg2, m.away_reg2].some((x) => x && ids.has(x))) continue;
              if (!next || m.scheduled_at < (next.scheduled_at ?? '')) next = m;
            }
            let line: string;
            let tone: Digest['tone'] = 'muted';
            if (bucket === 'finished') {
              const sm = summarizeMyTournament(matches, ids);
              line = sm
                ? `${sm.reached} · ${sm.wins} ${sm.wins === 1 ? 'victoria' : 'victorias'}, ${sm.losses} ${sm.losses === 1 ? 'derrota' : 'derrotas'}`
                : 'Terminado';
            } else if (next?.scheduled_at) {
              const cd = countdown(next.scheduled_at, Date.now());
              line = [roundNameOf(next, matches), next.court, cd.text].filter(Boolean).join(' · ');
              tone = 'accent';
            } else if (pending) {
              line = 'Pago pendiente en el club';
              tone = 'warning';
            } else {
              line = matches.length ? 'Inscrito · tu horario aún no está' : 'Inscrito · el cuadro sale al cerrar la inscripción';
            }
            out[t.id] = {
              partner,
              div,
              line,
              tone,
              badge: pending && bucket !== 'finished' ? 'PAGO' : null,
              today:
                bucket === 'live' ||
                (!!next?.scheduled_at && localIso(new Date(next.scheduled_at)) === localIso(new Date())),
            };
          } catch {
            /* la fila se queda con lo básico */
          }
        }),
      );
      setDigests(out);
    },
    [uid],
  );

  const loadMine = useCallback(async () => {
    try {
      const list = await myTournaments();
      setMine(list);
      loadDigests(list);
    } catch (e: any) {
      toast.error('No se pudieron cargar', e?.message ?? '');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [loadDigests]);

  // Búsqueda con debounce (solo en modo explorar).
  useEffect(() => {
    if (mode !== 'explore') return;
    const id = setTimeout(() => loadExplore(search), search ? 300 : 0);
    return () => clearTimeout(id);
  }, [search, mode, loadExplore]);

  const switchMode = (m: 'explore' | 'mine') => {
    if (m === mode) return;
    setMode(m);
    setLoading(true);
    if (m === 'mine') {
      if (!uid) setLoading(false);
      else loadMine();
    } else loadExplore(search);
  };

  const openTournament = (t: ExploreTournament) => {
    navigation.navigate('TournamentFollow', { tournamentId: t.id });
  };

  const submitCode = async () => {
    const v = code.trim().toUpperCase().replace(/\s/g, '');
    if (v.length < 4) {
      setCodeErr('Escribe el código que te han pasado.');
      return;
    }
    setCodeBusy(true);
    setCodeErr(null);
    try {
      // 1) ¿Es el código de un torneo? → a apuntarse.
      let found = null;
      try {
        found = await lookupTournament(v);
      } catch {
        found = null;
      }
      if (found) {
        setCodeOpen(false);
        setCode('');
        navigation.navigate('TournamentSignup', { code: v });
        return;
      }
      // 2) Si no, el de tu pareja → te une a su inscripción.
      if (!uid) {
        setCodeErr('No es el código de ningún torneo abierto. Si es el de tu pareja, inicia sesión y vuelve a meterlo.');
        return;
      }
      const tournamentId = await claimPartnerByCode(v);
      setCodeOpen(false);
      setCode('');
      toast.success('¡Vinculado!', 'Ya tienes el torneo en Mis torneos.');
      navigation.navigate('TournamentFollow', { tournamentId });
    } catch (e: any) {
      setCodeErr(e?.message ? `No encontramos ese código: ${e.message}` : 'No encontramos ese código. Revísalo.');
    } finally {
      setCodeBusy(false);
    }
  };

  // ── Explorar: filtros y grupos por estado ──
  const filtered = items.filter((t) => {
    const b = tournamentBucket(t.status, t.starts_on);
    if (status === 'open' && t.status !== 'open') return false;
    if (status === 'live' && b !== 'live') return false;
    if (genders.size && !(t.genders ?? []).some((g) => genders.has(g))) return false;
    return true;
  });
  const byDate = (a: ExploreTournament, b: ExploreTournament) =>
    (a.starts_on ?? 'zz').localeCompare(b.starts_on ?? 'zz');
  const live = filtered.filter((t) => tournamentBucket(t.status, t.starts_on) === 'live');
  const open = filtered.filter((t) => t.status === 'open').sort(byDate);
  const soon = filtered
    .filter((t) => t.status !== 'open' && tournamentBucket(t.status, t.starts_on) === 'upcoming')
    .sort(byDate);
  const done = filtered
    .filter((t) => tournamentBucket(t.status, t.starts_on) === 'finished')
    .sort((a, b) => byDate(b, a));
  const openCount = items.filter((t) => t.status === 'open').length;

  // ── Mis torneos: hoy · próximos · jugados ──
  const mineSections = useMemo(() => {
    const todayL = mine.filter(
      (t) => tournamentBucket(t.status, t.starts_on) !== 'finished' && digests[t.id]?.today,
    );
    const upcoming = mine
      .filter((t) => tournamentBucket(t.status, t.starts_on) !== 'finished' && !digests[t.id]?.today)
      .sort(byDate);
    const played = mine
      .filter((t) => tournamentBucket(t.status, t.starts_on) === 'finished')
      .sort((a, b) => byDate(b, a));
    const d = new Date(now);
    return [
      { label: `Hoy · ${DOW[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`, data: todayL },
      { label: 'Próximos', data: upcoming },
      { label: 'Jugados', data: played },
    ].filter((x) => x.data.length);
  }, [mine, digests, now]); // eslint-disable-line react-hooks/exhaustive-deps

  const group = (label: string, data: ExploreTournament[], isLive?: boolean) =>
    data.length ? (
      <View key={label} style={{ marginTop: 18 }}>
        <View style={s.groupHead}>
          {isLive ? <LiveDot /> : null}
          <Text style={s.groupLabel}>{label.toUpperCase()}</Text>
          <Text style={s.groupCount}>{data.length}</Text>
        </View>
        <View style={s.groupCard}>
          {data.map((t, i) => (
            <View key={t.id} style={i > 0 ? s.rowBorder : null}>
              <Row t={t} onPress={() => openTournament(t)} s={s} c={c} />
            </View>
          ))}
        </View>
      </View>
    ) : null;

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} onPress={onPress} style={[s.chip, on && s.chipOn]}>
      <Text style={[s.chipText, on && s.chipTextOn]}>{label}</Text>
    </Pressable>
  );
  const toggleGender = (g: string) =>
    setGenders((prev) => {
      const n = new Set(prev);
      n.has(g) ? n.delete(g) : n.add(g);
      return n;
    });

  return (
    <View style={s.root}>
      {embedded ? (
        <View style={{ height: 10 }} />
      ) : (
        <View style={[s.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.6 }]}
          >
            <IconBack size={20} color={c.text} />
          </Pressable>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.eyebrow}>COMPETIR</Text>
            <Text style={s.title}>Torneos</Text>
          </View>
        </View>
      )}

      {/* Explorar / Mis torneos + un solo «Tengo un código». */}
      <View style={s.topRow}>
        <View style={s.modeTabs}>
          {(['explore', 'mine'] as const).map((m) => {
            const sel = mode === m;
            return (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                accessibilityRole="tab"
                accessibilityState={{ selected: sel }}
                style={s.modeTab}
              >
                <Text style={[s.modeTabText, { color: sel ? c.text : c.textMuted, fontWeight: sel ? '800' : '600' }]}>
                  {m === 'explore' ? 'Explorar' : 'Mis torneos'}
                </Text>
                <View style={[s.modeTabBar, sel && { backgroundColor: c.accent }]} />
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => {
            setCodeErr(null);
            setCodeOpen(true);
          }}
          style={({ pressed }) => [s.codeBtn, pressed && { opacity: 0.85 }]}
        >
          <IconTicket size={14} color={c.accent} />
          <Text style={s.codeBtnText}>Tengo un código</Text>
        </Pressable>
      </View>

      {mode === 'explore' ? (
        <>
          <View style={s.searchWrap}>
            <View style={s.searchBox}>
              <IconSearch size={16} color={c.textFaint} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Nombre, club o lugar"
                placeholderTextColor={c.textFaint}
                style={s.searchInput}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chips}
            style={{ flexGrow: 0 }}
          >
            {chip('Todos', status === 'all' && genders.size === 0, () => {
              setStatus('all');
              setGenders(new Set());
            })}
            {chip('Abiertos', status === 'open', () => setStatus(status === 'open' ? 'all' : 'open'))}
            {chip('En juego', status === 'live', () => setStatus(status === 'live' ? 'all' : 'live'))}
            {chip('Masc.', genders.has('masculino'), () => toggleGender('masculino'))}
            {chip('Fem.', genders.has('femenino'), () => toggleGender('femenino'))}
            {chip('Mixto', genders.has('mixto'), () => toggleGender('mixto'))}
          </ScrollView>
        </>
      ) : null}

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + (embedded ? 64 + 12 + 32 : 24),
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                if (mode === 'mine') {
                  if (uid) loadMine();
                  else setRefreshing(false);
                } else loadExplore(search);
              }}
              tintColor={c.accent}
            />
          }
        >
          {mode === 'explore' ? (
            filtered.length === 0 ? (
              <View style={s.emptyBox}>
                <IconTrophy size={26} color={c.textFaint} />
                <Text style={s.emptyTitle}>{search || status !== 'all' || genders.size ? 'Nada con este filtro' : 'Aún no hay torneos'}</Text>
                <Text style={s.emptyText}>
                  {search || status !== 'all' || genders.size
                    ? 'Prueba con otra búsqueda o quita algún filtro.'
                    : 'Cuando un club abra inscripciones, aparecerá aquí. Si te han pasado un código, úsalo arriba.'}
                </Text>
              </View>
            ) : (
              <>
                {group('En juego ahora', live, true)}
                {group('Inscripción abierta', open)}
                {group('Próximamente', soon)}
                {done.length ? (
                  showFinished ? (
                    group('Terminados', done)
                  ) : (
                    <Pressable
                      onPress={() => setShowFinished(true)}
                      style={({ pressed }) => [s.foldRow, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={s.groupLabel}>TERMINADOS</Text>
                      <Text style={s.foldLink}>Ver {done.length} ›</Text>
                    </Pressable>
                  )
                ) : null}
              </>
            )
          ) : !uid ? (
            <View style={s.emptyBox}>
              <IconTrophy size={26} color={c.textFaint} />
              <Text style={s.emptyTitle}>Entra para ver tus torneos</Text>
              <Text style={s.emptyText}>
                Aquí verás los torneos en los que juegas, con tu hora y tu pista.
              </Text>
              <Pressable
                onPress={() => (navigation as any).navigate('AuthFlow', { screen: 'Login' })}
                style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.9 }]}
              >
                <Text style={s.primaryBtnText}>Iniciar sesión</Text>
              </Pressable>
            </View>
          ) : mineSections.length === 0 ? (
            <View style={s.emptyBox}>
              <IconTrophy size={26} color={c.textFaint} />
              <Text style={s.emptyTitle}>Aún no juegas ningún torneo</Text>
              <Text style={s.emptyText}>
                {openCount > 0
                  ? `Hay ${openCount} con inscripción abierta. `
                  : ''}
                Si tu pareja ya te apuntó, mete su código y aparecerá aquí.
              </Text>
              <Pressable
                onPress={() => {
                  setStatus('open');
                  switchMode('explore');
                }}
                style={({ pressed }) => [s.primaryBtn, pressed && { opacity: 0.9 }]}
              >
                <Text style={s.primaryBtnText}>Ver torneos abiertos</Text>
              </Pressable>
              <Pressable onPress={() => setCodeOpen(true)} hitSlop={8}>
                <Text style={s.foldLink}>Tengo un código</Text>
              </Pressable>
            </View>
          ) : (
            mineSections.map((sec) => (
              <View key={sec.label} style={{ marginTop: 18 }}>
                <View style={s.groupHead}>
                  <Text style={s.groupLabel}>{sec.label.toUpperCase()}</Text>
                </View>
                <View style={s.groupCard}>
                  {sec.data.map((t, i) => (
                    <View key={t.id} style={i > 0 ? s.rowBorder : null}>
                      <Row t={t} onPress={() => openTournament(t)} s={s} c={c} digest={digests[t.id] ?? null} />
                    </View>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <BottomSheet open={codeOpen} onClose={() => setCodeOpen(false)}>
        <Text style={s.sheetEyebrow}>TENGO UN CÓDIGO</Text>
        <Text style={s.sheetTitle}>Escribe el código que te han pasado</Text>
        <View style={s.sheetInput}>
          <TextInput
            value={code}
            onChangeText={(v) => {
              setCode(v.toUpperCase().replace(/\s/g, ''));
              setCodeErr(null);
            }}
            placeholder="K7P2QX"
            placeholderTextColor={c.textFaint}
            style={s.sheetInputField}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={10}
            onSubmitEditing={submitCode}
          />
        </View>
        <Text style={s.sheetText}>
          Vale el del torneo (te lleva a apuntarte) y el de tu pareja (te une a su
          inscripción). No tienes que saber cuál es.
        </Text>
        {codeErr ? <Text style={s.sheetErr}>{codeErr}</Text> : null}
        <Pressable
          onPress={submitCode}
          disabled={codeBusy}
          style={({ pressed }) => [s.sheetBtn, pressed && { opacity: 0.85 }]}
        >
          {codeBusy ? <ActivityIndicator color={c.textInverse} /> : <Text style={s.sheetBtnText}>Continuar</Text>}
        </Pressable>
      </BottomSheet>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 8 },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '500' },
    title: { color: c.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.4, marginTop: 2 },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      marginBottom: 12,
    },
    modeTabs: {
      flex: 1,
      flexDirection: 'row',
      gap: 18,
      borderBottomWidth: 1,
      borderColor: c.hairStrong,
    },
    modeTab: { paddingTop: 8, paddingBottom: 9 },
    modeTabText: { fontSize: 14.5, letterSpacing: -0.2 },
    modeTabBar: { position: 'absolute', left: 0, right: 0, bottom: -1, height: 2, borderRadius: 1 },
    codeBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      height: 36,
      borderRadius: 10,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    codeBtnText: { color: c.accent, fontSize: 12.5, fontWeight: '800' },
    searchWrap: { paddingHorizontal: 20, paddingBottom: 10 },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14, fontWeight: '500', paddingVertical: 0 },
    chips: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 4 },
    chip: {
      paddingHorizontal: 12,
      height: 32,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipOn: { backgroundColor: c.text, borderColor: c.text },
    chipText: { color: c.textMuted, fontSize: 12.5, fontWeight: '700' },
    chipTextOn: { color: c.background },
    groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    groupLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      fontWeight: '700',
    },
    groupCount: { fontFamily: Fonts.mono, fontSize: 11, color: c.textFaint, fontWeight: '700' },
    groupCard: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      overflow: 'hidden',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11 },
    rowBorder: { borderTopWidth: 1, borderColor: c.hair },
    thumb: {
      width: 48,
      height: 48,
      borderRadius: 11,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbText: { color: c.text, fontFamily: Fonts.mono, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
    thumbLive: {
      position: 'absolute',
      top: 4,
      right: 4,
      width: 13,
      height: 13,
      borderRadius: 7,
      backgroundColor: c.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    thumbBadge: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingVertical: 1 },
    thumbBadgeText: { color: '#1a1300', fontFamily: Fonts.mono, fontSize: 8.5, fontWeight: '800', letterSpacing: 0.8 },
    rowName: { color: c.text, fontSize: 15, fontWeight: '800', letterSpacing: -0.3 },
    rowMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    rowLine: { fontSize: 12, fontWeight: '700', marginTop: 3 },
    foldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 22,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    foldLink: { color: c.accent, fontSize: 13, fontWeight: '800' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyBox: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 18, gap: 10 },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
    primaryBtn: {
      marginTop: 6,
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingHorizontal: 20,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    primaryBtnText: { color: c.textInverse, fontSize: 14, fontWeight: '800' },
    sheetEyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '500' },
    sheetTitle: { color: c.text, fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginTop: 4 },
    sheetText: { color: c.textMuted, fontSize: 13, lineHeight: 19, marginTop: 10 },
    sheetErr: { color: c.error, fontSize: 13, lineHeight: 18, marginTop: 8, fontWeight: '600' },
    sheetInput: {
      marginTop: 16,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: 12,
      paddingHorizontal: 14,
    },
    sheetInputField: {
      color: c.text,
      fontSize: 22,
      fontWeight: '700',
      fontFamily: Fonts.mono,
      letterSpacing: 5,
      paddingVertical: 14,
      textAlign: 'center',
    },
    sheetBtn: {
      marginTop: 14,
      backgroundColor: c.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    sheetBtnText: { color: c.textInverse, fontSize: 15.5, fontWeight: '800' },
  });
type Styles = ReturnType<typeof makeStyles>;
