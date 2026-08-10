import React, { useCallback, useMemo, useState } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconSearch, IconTrophy, IconChevron, BottomSheet } from '@components/ui';
import { toast } from '@store/toastStore';
import {
  exploreTournaments,
  myTournaments,
  tournamentBucket,
  tournamentStatusLabel,
  formatFee,
  claimPartnerByCode,
  type ExploreTournament,
} from '@core/services/tournaments';

import type { RootStackScreenProps } from '@navigation/types';

const GENDER_LABEL: Record<string, string> = {
  masculino: 'Masc',
  femenino: 'Fem',
  mixto: 'Mixto',
};
const STATUS_LABEL: Record<string, string> = {
  open: 'Inscripción abierta',
  in_progress: 'En juego',
  finished: 'Finalizado',
};
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const formatStartsOn = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
};

const TournamentCard: React.FC<{
  t: ExploreTournament;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
  c: Palette;
}> = ({ t, onPress, styles, c }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}>
    {t.cover_url ? (
      <Image source={{ uri: t.cover_url }} style={styles.cover} />
    ) : (
      <LinearGradient
        colors={[c.accent15, c.bgCard]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.cover, styles.coverPlaceholder]}
      >
        <IconTrophy size={26} color={c.accent} />
      </LinearGradient>
    )}
    <View style={styles.cardBody}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.cardName} numberOfLines={1}>{t.name}</Text>
        <Text style={styles.cardClub} numberOfLines={1}>{t.club_name}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {[formatStartsOn(t.starts_on), t.location].filter(Boolean).join(' · ') || 'Fecha por confirmar'}
        </Text>
        <View style={styles.chips}>
          {(t.genders ?? []).map((g) => (
            <View key={g} style={styles.chip}>
              <Text style={styles.chipText}>{GENDER_LABEL[g] ?? g}</Text>
            </View>
          ))}
          {(t.categories ?? []).slice(0, 3).map((cat) => (
            <View key={cat} style={styles.chip}>
              <Text style={styles.chipText}>{cat}</Text>
            </View>
          ))}
        </View>
      </View>
      <IconChevron size={16} color={c.textFaint} />
    </View>
    <View style={styles.cardFooter}>
      <Text style={styles.statusText}>{tournamentStatusLabel(t.status, t.starts_on)}</Text>
      <Text style={styles.playersText}>
        {t.entry_fee ? `${formatFee(t.entry_fee, t.fee_currency)} · ` : ''}
        {t.players} {t.pair_based ? (t.players === 1 ? 'pareja' : 'parejas') : t.players === 1 ? 'jugador' : 'jugadores'}
      </Text>
    </View>
  </Pressable>
);

export const ExploreTournamentsScreen = ({
  navigation,
}: RootStackScreenProps<'ExploreTournaments'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<'explore' | 'mine'>('explore');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<ExploreTournament[]>([]);
  const [mine, setMine] = useState<ExploreTournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Sheet "Tengo un código de compañero".
  const [partnerOpen, setPartnerOpen] = useState(false);
  const [partnerCode, setPartnerCode] = useState('');
  const [claiming, setClaiming] = useState(false);

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

  const loadMine = useCallback(async () => {
    try {
      setMine(await myTournaments());
    } catch (e: any) {
      toast.error('No se pudieron cargar', e?.message ?? '');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    loadExplore();
  }, [loadExplore]);

  // Búsqueda con debounce (solo en modo explorar).
  React.useEffect(() => {
    if (mode !== 'explore') return;
    const id = setTimeout(() => loadExplore(search), 300);
    return () => clearTimeout(id);
  }, [search, mode, loadExplore]);

  const switchMode = (m: 'explore' | 'mine') => {
    setMode(m);
    setLoading(true);
    if (m === 'mine') loadMine();
    else loadExplore(search);
  };

  const openTournament = (t: ExploreTournament) => {
    navigation.navigate('TournamentFollow', { tournamentId: t.id });
  };

  const claimPartner = async () => {
    const code = partnerCode.trim().toUpperCase();
    if (code.length < 4) {
      toast.error('Introduce el código de compañero');
      return;
    }
    setClaiming(true);
    try {
      const tournamentId = await claimPartnerByCode(code);
      setPartnerOpen(false);
      setPartnerCode('');
      toast.success('¡Vinculado!', 'Ya puedes ver el torneo en Mis torneos.');
      navigation.navigate('TournamentFollow', { tournamentId });
    } catch (e: any) {
      toast.error('No se pudo vincular', e?.message ?? 'Revisa el código.');
    } finally {
      setClaiming(false);
    }
  };

  // "Mis torneos" agrupados por estado.
  const mineSections = useMemo(() => {
    const bucket = (t: ExploreTournament) => tournamentBucket(t.status, t.starts_on);
    const live = mine.filter((t) => bucket(t) === 'live');
    const upcoming = mine
      .filter((t) => bucket(t) === 'upcoming')
      .sort((a, b) => (a.starts_on ?? 'z').localeCompare(b.starts_on ?? 'z'));
    const done = mine.filter((t) => bucket(t) === 'finished');
    return [
      { label: 'En juego', data: live },
      { label: 'Próximos', data: upcoming },
      { label: 'Jugados', data: done },
    ].filter((s) => s.data.length);
  }, [mine]);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <IconBack size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>TORNEOS</Text>
          <Text style={styles.title}>{mode === 'mine' ? 'Mis torneos' : 'Explorar'}</Text>
        </View>
      </View>

      {/* Toggle Explorar / Mis torneos */}
      <View style={styles.modeTabs}>
        {(['explore', 'mine'] as const).map((m) => {
          const sel = mode === m;
          return (
            <Pressable
              key={m}
              onPress={() => switchMode(m)}
              style={[styles.modeTab, sel && { backgroundColor: c.text }]}
            >
              <Text style={[styles.modeTabText, { color: sel ? c.background : c.textMuted }]}>
                {m === 'explore' ? 'Explorar' : 'Mis torneos'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        onPress={() => setPartnerOpen(true)}
        hitSlop={6}
        style={({ pressed }) => [styles.partnerLink, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.partnerLinkText}>
          ¿Te ha apuntado tu pareja? <Text style={{ color: c.accent, fontWeight: '800' }}>Tengo un código de compañero</Text>
        </Text>
      </Pressable>

      {mode === 'explore' ? (
        <View style={styles.searchWrap}>
          <View style={styles.searchBox}>
            <IconSearch size={16} color={c.textFaint} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Busca por nombre, club o lugar"
              placeholderTextColor={c.textFaint}
              style={styles.searchInput}
              autoCapitalize="none"
              returnKeyType="search"
            />
          </View>
          <Pressable
            onPress={() => navigation.navigate('TournamentSignup')}
            style={({ pressed }) => [styles.codeBtn, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.codeBtnText}>Tengo código</Text>
          </Pressable>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingBottom: insets.bottom + 24,
            paddingTop: 4,
          }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                if (mode === 'mine') loadMine();
                else loadExplore(search);
              }}
              tintColor={c.accent}
            />
          }
        >
          {mode === 'explore' ? (
            items.length === 0 ? (
              <View style={styles.emptyBox}>
                <IconTrophy size={26} color={c.textFaint} />
                <Text style={styles.emptyTitle}>No hay torneos abiertos</Text>
                <Text style={styles.emptyText}>
                  {search
                    ? 'Prueba con otra búsqueda.'
                    : 'Cuando un club abra inscripciones, aparecerá aquí. Si tienes un código, apúntate directamente.'}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {items.map((t) => (
                  <TournamentCard key={t.id} t={t} onPress={() => openTournament(t)} styles={styles} c={c} />
                ))}
              </View>
            )
          ) : mineSections.length === 0 ? (
            <View style={styles.emptyBox}>
              <IconTrophy size={26} color={c.textFaint} />
              <Text style={styles.emptyTitle}>Aún no te has apuntado a ningún torneo</Text>
              <Text style={styles.emptyText}>
                Apúntate desde “Explorar” y aquí verás tus torneos en juego, próximos
                y jugados.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 4 }}>
              {mineSections.map((s) => (
                <View key={s.label} style={{ marginTop: 8 }}>
                  <Text style={styles.sectionLabel}>{s.label.toUpperCase()}</Text>
                  <View style={{ gap: 12, marginTop: 8 }}>
                    {s.data.map((t) => (
                      <TournamentCard key={t.id} t={t} onPress={() => openTournament(t)} styles={styles} c={c} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <BottomSheet open={partnerOpen} onClose={() => setPartnerOpen(false)}>
        <Text style={styles.sheetEyebrow}>COMPAÑERO/A</Text>
        <Text style={styles.sheetTitle}>Tengo un código</Text>
        <Text style={styles.sheetText}>
          Si tu pareja te ha apuntado a un torneo, introduce el código que te ha
          pasado (o que te llegó por email) para vincular tu cuenta y ver el torneo.
        </Text>
        <View style={styles.sheetInput}>
          <TextInput
            value={partnerCode}
            onChangeText={(v) => setPartnerCode(v.toUpperCase().replace(/\s/g, ''))}
            placeholder="Ej. K7P2QX"
            placeholderTextColor={c.textFaint}
            style={styles.sheetInputField}
            autoCapitalize="characters"
            maxLength={8}
          />
        </View>
        <Pressable
          onPress={claimPartner}
          disabled={claiming}
          style={({ pressed }) => [styles.sheetBtn, pressed && { opacity: 0.85 }]}
        >
          {claiming ? (
            <ActivityIndicator color={c.textInverse} />
          ) : (
            <Text style={styles.sheetBtnText}>Vincular</Text>
          )}
        </Pressable>
      </BottomSheet>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    partnerLink: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 6 },
    partnerLinkText: { color: c.textMuted, fontSize: 12.5, fontWeight: '600' },
    sheetEyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 3, color: c.accent, fontWeight: '500' },
    sheetTitle: { color: c.text, fontSize: 22, fontWeight: '800', letterSpacing: -0.4, marginTop: 2 },
    sheetText: { color: c.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8 },
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
      fontSize: 20,
      fontWeight: '700',
      fontFamily: Fonts.mono,
      letterSpacing: 4,
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
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 18,
      paddingBottom: 12,
    },
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
    modeTabs: {
      flexDirection: 'row',
      gap: 6,
      marginHorizontal: 20,
      marginBottom: 12,
      padding: 4,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    modeTab: { flex: 1, height: 38, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
    modeTabText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
    sectionLabel: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      fontWeight: '600',
    },
    searchWrap: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 20,
      paddingBottom: 12,
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 12,
      height: 46,
    },
    searchInput: { flex: 1, color: c.text, fontSize: 14, fontWeight: '500', paddingVertical: 0 },
    codeBtn: {
      paddingHorizontal: 14,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    codeBtnText: { color: c.accent, fontSize: 13, fontWeight: '700' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
    emptyBox: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 24, gap: 10 },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      overflow: 'hidden',
    },
    cover: { width: '100%', height: 130 },
    coverPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    cardBody: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: 14,
      paddingTop: 12,
    },
    cardName: { color: c.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
    cardClub: { color: c.accent, fontSize: 13, fontWeight: '700', marginTop: 2 },
    cardMeta: { color: c.textMuted, fontSize: 12, marginTop: 3 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    chip: {
      paddingHorizontal: 9,
      height: 24,
      borderRadius: 7,
      justifyContent: 'center',
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    chipText: { color: c.textMuted, fontSize: 11, fontWeight: '700' },
    cardFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 11,
      marginTop: 10,
      borderTopWidth: 1,
      borderColor: c.hair,
    },
    statusText: { color: c.accent, fontSize: 12, fontWeight: '700' },
    playersText: { color: c.textFaint, fontSize: 12, fontWeight: '600' },
  });
