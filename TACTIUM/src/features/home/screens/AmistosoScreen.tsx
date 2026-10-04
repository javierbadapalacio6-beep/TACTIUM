import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconBack, IconLink, IconGift, IconCamera, IconX, IconPlus } from '@components/ui';
import { useTeamStore, selectIsPlayer } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import {
  createCasualMatch,
  fetchClaimCode,
  fetchMyFrequentPartners,
  uploadCasualPhoto,
  type CasualParticipant,
  type FrequentPartner,
} from '@core/services/casualMatches';
import { PhotoShareCard, sharePhotoCard, pickMatchPhoto } from '@components/share/PhotoShareCard';
import { DOWNLOAD_URL } from '@core/config/referral';

import { SetsEditor } from '../components/match/GamesPicker';
import { CourtSlots, type CourtSlotData, type SlotKey } from '../components/match/CourtSlots';
import { MatchRow, MatchScoreboard } from '../components/match/MatchScoreboard';
import { Confetti } from '../components/match/Confetti';
import { notifySuccess } from '../components/match/haptics';
import { emptySets, summarize, setsLine, type SetScore } from '../components/match/setsLogic';

// Amistosos (rediseño bloque «Partido», 2026-10): la pista dibujada con cuatro
// huecos, la botonera de juegos y la tarjeta de guardado primero. Cada
// partido se persiste como un casual_match (RPC create_casual_match, sin
// cambios). Los amistosos son adquisición: el resumen lleva la marca y la
// invitación con el código de reclamo a quien no tiene cuenta.

type Mode = 'colegas' | 'entreno' | 'equipos';

type PartidoInput = {
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  sets: SetScore[];
};

const emptyPartido = (): PartidoInput => ({ a1: '', a2: '', b1: '', b2: '', sets: emptySets() });

const ourStr = (p?: PartidoInput) => [p?.a1, p?.a2].filter(Boolean).join(' / ');
const rivalStr = (p?: PartidoInput) => [p?.b1, p?.b2].filter(Boolean).join(' / ');

const setsToNumeric = (sets: SetScore[]): [number, number][] =>
  sets
    .filter((s) => s.us !== null && s.them !== null)
    .map((s) => [s.us as number, s.them as number] as [number, number]);

const setsResult = (sets: SetScore[]) => {
  const s = summarize(sets);
  return { us: s.usSets, them: s.themSets, decided: s.usSets !== s.themSets, won: s.usSets > s.themSets };
};

export const AmistosoScreen = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const team = useTeamStore((s) => s.team);
  const players = useTeamStore((s) => s.players);
  const isPlayer = useTeamStore(selectIsPlayer);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  //  · 'colegas' → partido con amigos.
  //  · 'entreno' → interno del equipo; los 4 de la plantilla.
  //  · 'equipos' → 1-5 partidos contra otro club (capitán/club).
  // Sin equipo solo existe «colegas» (y no se pinta el selector).
  const [mode, setMode] = useState<Mode>(!team ? 'colegas' : isPlayer ? 'colegas' : 'equipos');
  const isColegas = mode === 'colegas';
  const isEntreno = mode === 'entreno';
  const isEquipos = mode === 'equipos';
  const isSingle = !isEquipos;

  const [rivalTeam, setRivalTeam] = useState('');
  const [partidos, setPartidos] = useState<PartidoInput[]>([emptyPartido()]);
  const [openPartido, setOpenPartido] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [savedMatchId, setSavedMatchId] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [claimCode, setClaimCode] = useState<string | null>(null);
  const [recent, setRecent] = useState<FrequentPartner[]>([]);
  // Hoja para elegir a alguien.
  const [picking, setPicking] = useState<{ i: number; key: SlotKey } | null>(null);
  const [query, setQuery] = useState('');
  const photoCardRef = React.useRef<View>(null);

  useEffect(() => {
    if (!userId) return;
    fetchMyFrequentPartners(userId)
      .then(setRecent)
      .catch(() => setRecent([]));
  }, [userId]);

  const switchMode = (m: Mode) => {
    setMode(m);
    if (m !== 'equipos') {
      setPartidos((prev) => [prev[0] ?? emptyPartido()]);
      setOpenPartido(0);
    }
  };

  // Tu nombre (preferimos el de usuario, corto) va en el primer hueco.
  const authName = useAuthStore((s) => {
    const meta = (s.user?.user_metadata ?? {}) as { full_name?: string; username?: string };
    return (meta.username ?? meta.full_name ?? '').trim() || null;
  });
  const rosterName = (pl: (typeof players)[number]) => pl.profile_username?.trim() || pl.name;
  const myName = useMemo(
    () =>
      authName ??
      (players.find((pl) => pl.user_id === userId)
        ? rosterName(players.find((pl) => pl.user_id === userId)!)
        : null),
    [players, userId, authName],
  );
  useEffect(() => {
    if (!myName || mode === 'equipos') return;
    setPartidos((prev) =>
      prev[0] && !prev[0].a1.trim() ? prev.map((p, i) => (i === 0 ? { ...p, a1: myName } : p)) : prev,
    );
  }, [myName, mode]);

  const update = (i: number, patch: Partial<PartidoInput>) =>
    setPartidos((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));

  // Marcador global: con UN partido, en sets (2-0); con varios, en partidos.
  const marcador = useMemo(() => {
    if (partidos.length === 1) {
      const r = setsResult(partidos[0].sets);
      return { us: r.us, them: r.them, unit: 'sets' as const };
    }
    let us = 0;
    let them = 0;
    for (const p of partidos) {
      const r = setsResult(p.sets);
      if (!r.decided) continue;
      if (r.won) us++;
      else them++;
    }
    return { us, them, unit: 'partidos' as const };
  }, [partidos]);

  const shareText = useMemo(() => {
    const headline = isSingle
      ? `${ourStr(partidos[0]) || 'Nosotros'} ${marcador.us} – ${marcador.them} ${rivalStr(partidos[0]) || 'Rival'} (${marcador.unit})`
      : `${team?.name ?? 'Nuestro equipo'} ${marcador.us} – ${marcador.them} ${rivalTeam || 'Rival'} (${marcador.unit})`;
    const lines = [
      `🎾 *TACTIUM · ${isEntreno ? 'Entreno' : 'Amistoso'}*`,
      headline,
      ``,
      ...partidos
        .map((p, i) => {
          const r = setsResult(p.sets);
          const score = setsLine(p.sets);
          if (!score) return null;
          return `P${i + 1} — ${ourStr(p) || '—'} vs ${rivalStr(p) || '—'}: ${score} ${
            r.decided ? (r.won ? '✅' : '❌') : ''
          }`;
        })
        .filter(Boolean),
      ``,
      claimCode
        ? `Este partido ya vive en TACTIUM. Con el código ${claimCode} lo sumas a tus stats: victorias, rachas y cara a cara. 🏆`
        : 'Organiza tus amistosos con TACTIUM: victorias, rachas y cara a cara. 🏆',
      DOWNLOAD_URL,
    ];
    return lines.join('\n');
  }, [team, rivalTeam, partidos, marcador, isSingle, isEntreno, claimCode]);

  const validPartidos = partidos.filter((p) => setsToNumeric(p.sets).length > 0);

  // Vínculo por nombre exacto: si coincide con alguien RECLAMADO (user_id),
  // el amistoso cuenta en sus stats. Elegir de la lista garantiza el nombre.
  const userIdByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const fp of recent) {
      if (fp.user_id) m.set(fp.name.trim().toLowerCase(), fp.user_id);
    }
    for (const pl of players) {
      if (!pl.user_id) continue;
      m.set(pl.name.trim().toLowerCase(), pl.user_id);
      m.set(rosterName(pl).trim().toLowerCase(), pl.user_id);
    }
    return m;
  }, [players, recent]);

  const linkByName = (name: string): string | null => {
    const k = name.trim().toLowerCase();
    if (!k) return null;
    // Tu hueco SIEMPRE vinculado a tu cuenta.
    if (userId && myName && k === myName.trim().toLowerCase()) return userId;
    return userIdByName.get(k) ?? null;
  };

  const handleSave = async () => {
    if (validPartidos.length === 0) {
      Alert.alert('Falta el resultado', 'Apunta al menos un set completo.');
      return;
    }
    setSaving(true);
    let ok = 0;
    try {
      let firstMatchId: string | null = null;
      for (const p of validPartidos) {
        // El creador va SIEMPRE en side0/slot0 y, en colegas/entreno, se
        // vincula a su cuenta aunque cambie su nombre por un apodo.
        const a1UserId = !isEquipos && userId ? userId : linkByName(p.a1);
        const participants: CasualParticipant[] = [
          { side: 0, slot: 0, name: p.a1.trim() || (team?.name ?? 'Nosotros'), user_id: a1UserId },
          { side: 0, slot: 1, name: p.a2.trim(), user_id: linkByName(p.a2) },
          { side: 1, slot: 0, name: p.b1.trim() || (rivalTeam || 'Rival'), user_id: isEntreno ? linkByName(p.b1) : null },
          { side: 1, slot: 1, name: p.b2.trim(), user_id: isEntreno ? linkByName(p.b2) : null },
        ];
        const createdId = await createCasualMatch({
          type: isEntreno ? 'entreno' : 'amistoso',
          sets: setsToNumeric(p.sets),
          participants,
          visibility: 'public',
        });
        if (!firstMatchId) firstMatchId = createdId;
        ok++;
      }
      setSavedCount(ok);
      setSavedMatchId(firstMatchId);
      if (firstMatchId && ok === 1) fetchClaimCode(firstMatchId).then(setClaimCode);
      notifySuccess();
    } catch (e) {
      Alert.alert(
        ok > 0 ? 'Guardado parcial' : 'No se pudo guardar',
        `${ok > 0 ? `Se guardaron ${ok} partidos. ` : ''}${String((e as Error).message ?? e)}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const shareNative = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      // cancelado
    }
  };

  // Quien jugó y NO tiene cuenta: a quien va la invitación.
  const unlinkedNames = useMemo(() => {
    const out: string[] = [];
    for (const p of partidos) {
      for (const n of [p.a1, p.a2, p.b1, p.b2]) {
        const name = n.trim();
        if (!name) continue;
        if (myName && name.toLowerCase() === myName.toLowerCase()) continue;
        if (linkByName(name)) continue;
        if (!out.some((x) => x.toLowerCase() === name.toLowerCase())) out.push(name);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partidos, myName, userIdByName]);

  const shareInvite = async () => {
    const quien = unlinkedNames.slice(0, 3).join(', ');
    const msg = [
      `🎾 ${quien}: he registrado nuestro partido en TACTIUM.`,
      ``,
      `Instálate la app y tus partidos contarán en tus estadísticas`,
      `(victorias, rachas, % y más): ${DOWNLOAD_URL}`,
      ...(claimCode
        ? [``, `Al registrarte, canjea este código en Perfil › Mi récord y ESTE partido pasa a tu cuenta: ${claimCode}`]
        : []),
    ].join('\n');
    try {
      await Share.share({ message: msg });
    } catch {
      // cancelado
    }
  };

  const pickPhoto = async () => {
    const uri = await pickMatchPhoto();
    if (!uri) return;
    setPhotoUri(uri);
    // La foto queda como portada del amistoso guardado.
    if (savedMatchId && userId) {
      uploadCasualPhoto(userId, savedMatchId, uri).catch((e) => console.warn('casual photo upload', e));
    }
  };

  // ── Hoja de elegir persona ───────────────────────────────────────
  const pickTarget = picking ? partidos[picking.i] : null;
  const pickIsMe = !!picking && isSingle && picking.i === 0 && picking.key === 'a1';
  const taken = useMemo(() => {
    const s = new Set<string>();
    if (pickTarget) {
      for (const k of ['a1', 'a2', 'b1', 'b2'] as SlotKey[]) {
        if (picking && k === picking.key) continue;
        const n = pickTarget[k].trim().toLowerCase();
        if (n) s.add(n);
      }
    }
    return s;
  }, [pickTarget, picking]);

  const q = query.trim().toLowerCase();
  const habituales = useMemo(
    () =>
      isEntreno
        ? []
        : recent
            .filter((fp) => !myName || fp.name.trim().toLowerCase() !== myName.trim().toLowerCase())
            .filter((fp) => !taken.has(fp.name.trim().toLowerCase()))
            .filter((fp) => !q || fp.name.toLowerCase().includes(q)),
    [recent, isEntreno, myName, taken, q],
  );
  const plantilla = useMemo(
    () =>
      players
        .filter((pl) => pl.user_id !== userId || isEquipos)
        .filter((pl) => !taken.has(rosterName(pl).trim().toLowerCase()))
        .filter((pl) => !q || rosterName(pl).toLowerCase().includes(q) || pl.name.toLowerCase().includes(q)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, userId, isEquipos, taken, q],
  );

  const openPicker = (i: number, key: SlotKey) => {
    const cur = partidos[i]?.[key] ?? '';
    setQuery(isSingle && i === 0 && key === 'a1' ? cur : '');
    setPicking({ i, key });
  };
  const choose = (name: string) => {
    if (!picking) return;
    update(picking.i, { [picking.key]: name.trim() } as Partial<PartidoInput>);
    setPicking(null);
    setQuery('');
  };

  const slotState = (p: PartidoInput, key: SlotKey, i: number): CourtSlotData['state'] => {
    const n = p[key].trim();
    if (!n) return 'empty';
    if (isSingle && i === 0 && key === 'a1') return 'me';
    return linkByName(n) ? 'linked' : 'guest';
  };
  const courtFor = (p: PartidoInput, i: number) => (
    <CourtSlots
      topLabel={isEntreno ? 'PAREJA A' : isColegas ? 'TU PAREJA' : 'NUESTRA PAREJA'}
      bottomLabel={isEntreno ? 'PAREJA B' : 'RIVALES'}
      onPress={(key) => openPicker(i, key)}
      slots={(['a1', 'a2', 'b1', 'b2'] as SlotKey[]).map((key) => ({
        key,
        name: p[key],
        state: slotState(p, key, i),
        placeholder:
          key === 'a1' ? (isEquipos ? 'Jugador 1' : 'Tú') : key === 'a2' ? (isEquipos ? 'Jugador 2' : 'Pareja') : key === 'b1' ? 'Rival 1' : 'Rival 2',
      }))}
    />
  );

  const setsFor = (p: PartidoInput, i: number) => (
    <SetsEditor
      sets={p.sets}
      usLabel={isEntreno ? 'Pareja A' : isEquipos ? 'Nosotros' : 'Nosotros'}
      themLabel={isEntreno ? 'Pareja B' : 'Rivales'}
      onChange={(si, side, v) =>
        setPartidos((prev) =>
          prev.map((pp, idx) =>
            idx !== i ? pp : { ...pp, sets: pp.sets.map((s, j) => (j === si ? { ...s, [side]: v } : s)) },
          ),
        )
      }
    />
  );

  // ¿Qué falta para guardar? (pádel es siempre de dobles)
  const missingLabel = (() => {
    if (isSingle) {
      const p = partidos[0];
      if (!p.a2.trim()) return isEntreno ? 'Falta un jugador de la pareja A' : 'Falta tu pareja';
      if (!p.b1.trim() || !p.b2.trim()) return !p.b1.trim() && !p.b2.trim() ? 'Faltan los rivales' : 'Falta un rival';
    }
    if (validPartidos.length === 0) return 'Falta el resultado';
    return null;
  })();

  // ── Tarjeta del guardado ─────────────────────────────────────────
  const soloPartido = validPartidos.length === 1 ? validPartidos[0] : null;
  const soloRes = soloPartido ? setsResult(soloPartido.sets) : null;
  const photoHome = soloPartido ? ourStr(soloPartido) || 'Nosotros' : team?.name ?? 'Nosotros';
  const photoAway = soloPartido ? rivalStr(soloPartido) || 'Rival' : rivalTeam || 'Rival';
  const photoUsScore = soloRes ? soloRes.us : marcador.us;
  const photoThemScore = soloRes ? soloRes.them : marcador.them;
  const photoDecided = soloRes ? soloRes.decided : marcador.us !== marcador.them;
  const photoWon = soloRes ? soloRes.won : marcador.us > marcador.them;
  const photoTitle = `${photoHome} ${photoUsScore}–${photoThemScore} ${photoAway}`;
  const photoSets = soloPartido
    ? setsLine(soloPartido.sets)
    : `${validPartidos.length} ${validPartidos.length === 1 ? 'partido' : 'partidos'}`;
  const photoDetail =
    soloPartido && photoDecided ? `${photoWon ? 'VICTORIA' : 'DERROTA'}${photoSets ? ` · ${photoSets}` : ''}` : photoSets;
  const todayLabel = new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

  if (savedCount != null) {
    const firstUnlinked = unlinkedNames[0];
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 64 + 12 + 32 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={10}
            accessibilityRole="button"
            style={styles.closeBtn}
          >
            <IconX size={14} color={c.text} />
            <Text style={styles.closeLabel}>Cerrar</Text>
          </Pressable>

          <Animated.View entering={ZoomIn.duration(260)} style={{ alignItems: 'center' }}>
            {photoUri ? (
              <PhotoShareCard
                ref={photoCardRef}
                photoUri={photoUri}
                title={photoTitle}
                subtitle={`${isEntreno ? 'Entreno' : 'Amistoso'} · ${todayLabel}`}
                detail={photoDetail}
                homeName={photoHome}
                homeScore={photoUsScore}
                awayName={photoAway}
                awayScore={photoThemScore}
                highlight={photoDecided ? (photoWon ? 'home' : 'away') : 'home'}
              />
            ) : (
              <View style={styles.photoCard}>
                <LinearGradient
                  colors={['#1d5a4c', '#0b2a27', '#2a4a3a']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={['rgba(3,15,15,0.1)', 'rgba(3,15,15,0.92)']}
                  style={StyleSheet.absoluteFill}
                />
                <Text style={styles.photoEyebrow}>
                  {(isEntreno ? 'Entreno' : 'Amistoso').toUpperCase()} · {todayLabel.toUpperCase()}
                </Text>
                <Text style={styles.photoTitle} numberOfLines={2}>
                  {photoHome} <Text style={styles.photoScore}>{soloPartido ? setsLine(soloPartido.sets) : `${marcador.us}–${marcador.them}`}</Text>
                </Text>
                <Text style={styles.photoSub} numberOfLines={1}>
                  vs {photoAway}
                  {photoDecided ? ` · ${photoWon ? 'VICTORIA' : 'DERROTA'}` : ''}
                </Text>
              </View>
            )}
          </Animated.View>

          <View style={{ gap: 10, marginTop: 14 }}>
            {photoUri ? (
              <>
                <Pressable
                  onPress={() => sharePhotoCard(photoCardRef, photoUri, shareText)}
                  style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.ctaLabel}>Compartir foto y resultado</Text>
                </Pressable>
                <Pressable onPress={pickPhoto} style={({ pressed }) => [styles.ctaGhost, pressed && { opacity: 0.7 }]}>
                  <Text style={styles.ctaGhostLabel}>Cambiar foto</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={shareNative} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
                  <Text style={styles.ctaLabel}>Compartir resultado</Text>
                </Pressable>
                <Pressable onPress={pickPhoto} style={({ pressed }) => [styles.ctaGhost, pressed && { opacity: 0.7 }]}>
                  <View style={styles.row6}>
                    <IconCamera size={15} color={c.text} />
                    <Text style={styles.ctaGhostLabel}>Añadir foto del partido</Text>
                  </View>
                </Pressable>
              </>
            )}

            {unlinkedNames.length > 0 ? (
              <Pressable
                onPress={shareInvite}
                style={({ pressed }) => [styles.invite, pressed && { opacity: 0.85 }]}
              >
                <IconGift size={18} color={c.accent} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.inviteTitle}>
                    {unlinkedNames.length === 1 ? `Invita a ${firstUnlinked}` : `Invita a ${unlinkedNames.length} jugadores`}
                  </Text>
                  <Text style={styles.inviteBody}>
                    {unlinkedNames.length === 1 ? 'No tiene TACTIUM.' : 'No tienen TACTIUM.'}
                    {claimCode
                      ? ` Con el código ${claimCode}, el partido contará en sus estadísticas.`
                      : ' Si se instalan la app, sus partidos contarán en sus estadísticas.'}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {photoUri ? (
              <Pressable onPress={shareNative} style={styles.linkWrap}>
                <Text style={styles.linkMuted}>Compartir solo el texto</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
        <Confetti run={photoDecided && photoWon} />
      </View>
    );
  }

  // ── Formulario ───────────────────────────────────────────────────
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Volver">
          <IconBack size={20} color={c.text} />
        </Pressable>

        {team ? (
          <View style={styles.tabs}>
            {([
              { id: 'colegas', label: 'Colegas' },
              { id: 'entreno', label: 'Entreno' },
              ...(isPlayer ? [] : [{ id: 'equipos', label: 'Equipos' }]),
            ] as { id: Mode; label: string }[]).map((m) => {
              const on = mode === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => switchMode(m.id)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  style={[styles.tab, on && styles.tabOn]}
                >
                  <Text style={[styles.tabText, on && { color: c.text }]}>{m.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.eyebrow}>
          {isEntreno ? 'AMISTOSO · ENTRENAMIENTO' : isColegas ? 'AMISTOSO · ENTRE COLEGAS' : 'AMISTOSO · EQUIPO CONTRA EQUIPO'}
        </Text>
        <Text style={styles.title}>
          {isEquipos ? '¿Contra qué equipo?' : isEntreno ? '¿Quién ha jugado?' : '¿Con quién has jugado?'}
        </Text>

        {isSingle ? (
          <View style={{ gap: 10 }}>
            {courtFor(partidos[0], 0)}
            {setsFor(partidos[0], 0)}
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            <TextInput
              style={styles.input}
              value={rivalTeam}
              onChangeText={setRivalTeam}
              placeholder="Equipo rival (p. ej. Club Bezana)"
              placeholderTextColor={c.textFaint}
              accessibilityLabel="Equipo rival"
            />
            <MatchScoreboard
              left={team?.name ?? 'Nosotros'}
              right={rivalTeam || 'Rival'}
              us={marcador.us}
              them={marcador.them}
              status="partidos"
              tint={marcador.us > marcador.them ? c.accent : c.text}
            />
            {partidos.map((p, i) => {
              const r = setsResult(p.sets);
              const line = setsLine(p.sets);
              const open = openPartido === i;
              return (
                <View key={i} style={{ gap: 8 }}>
                  <MatchRow
                    badge={String(i + 1)}
                    title={ourStr(p) || 'Elige la pareja'}
                    sub={line || 'Sin resultado'}
                    right={r.decided ? (r.won ? 'Ganado' : 'Perdido') : open ? 'Cerrar' : 'Apuntar ›'}
                    rightTone={r.decided ? (r.won ? 'win' : 'loss') : 'todo'}
                    onPress={() => setOpenPartido(open ? null : i)}
                  />
                  {open ? (
                    <Animated.View entering={FadeIn.duration(180)} style={styles.partidoPanel}>
                      {courtFor(p, i)}
                      {setsFor(p, i)}
                      {partidos.length > 1 ? (
                        <Pressable
                          onPress={() => {
                            setPartidos((prev) => prev.filter((_, idx) => idx !== i));
                            setOpenPartido(null);
                          }}
                          style={styles.linkWrap}
                        >
                          <Text style={[styles.linkMuted, { color: c.error }]}>Quitar partido</Text>
                        </Pressable>
                      ) : null}
                    </Animated.View>
                  ) : null}
                </View>
              );
            })}
            {partidos.length < 5 ? (
              <Pressable
                onPress={() => {
                  setPartidos((prev) => [...prev, emptyPartido()]);
                  setOpenPartido(partidos.length);
                }}
                style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.8 }]}
              >
                <IconPlus size={14} color={c.accent} />
                <Text style={styles.addText}>Añadir partido</Text>
                <Text style={styles.addHint}>hasta 5</Text>
              </Pressable>
            ) : null}
          </View>
        )}

        <Text style={styles.footNote}>
          {team ? 'Cuenta como amistoso · no afecta a ninguna liga' : 'Se guarda con su marcador y suma en tus estadísticas'}
        </Text>
      </ScrollView>

      <View style={[styles.foot, { paddingBottom: insets.bottom + 64 + 12 + 8 }]}>
        <Pressable
          onPress={handleSave}
          disabled={saving || !!missingLabel}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.cta,
            (saving || !!missingLabel) && styles.ctaDisabled,
            pressed && !saving && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={c.textInverse} />
          ) : (
            <Text style={[styles.ctaLabel, !!missingLabel && { color: c.textFaint }]}>
              {missingLabel ??
                (isEquipos && validPartidos.length > 1 ? `Guardar ${validPartidos.length} partidos` : 'Guardar amistoso')}
            </Text>
          )}
        </Pressable>
      </View>

      <BottomSheet open={!!picking} onClose={() => setPicking(null)}>
        {picking ? (
          <View style={{ gap: 10 }}>
            <Text style={styles.sheetEyebrow}>
              {pickIsMe
                ? 'TU NOMBRE EN EL PARTIDO'
                : picking.key === 'a1'
                  ? 'JUGADOR 1'
                  : picking.key === 'a2'
                    ? isEquipos
                      ? 'JUGADOR 2'
                      : 'TU PAREJA'
                    : picking.key === 'b1'
                      ? 'RIVAL 1'
                      : 'RIVAL 2'}
            </Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus={pickIsMe}
              placeholder={pickIsMe ? 'Tu nombre o apodo' : 'Escribe un nombre…'}
              placeholderTextColor={c.textFaint}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={() => query.trim() && choose(query)}
            />
            {pickIsMe ? (
              <Text style={styles.pickHint}>Cuenta en tus estadísticas aunque uses un apodo.</Text>
            ) : null}
            {query.trim() ? (
              <Pressable onPress={() => choose(query)} style={({ pressed }) => [styles.pick, pressed && { opacity: 0.8 }]}>
                <View style={styles.pickAv}>
                  <Text style={styles.pickAvText}>{query.trim().slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickName}>Usar «{query.trim()}»</Text>
                  <Text style={styles.pickSub}>
                    {linkByName(query) ? 'En TACTIUM · cuenta en sus estadísticas' : 'Sin cuenta: podrás invitarle al guardar'}
                  </Text>
                </View>
                <Text style={styles.pickPlus}>＋</Text>
              </Pressable>
            ) : null}

            {!pickIsMe && habituales.length > 0 ? (
              <>
                <Text style={styles.sheetSub}>HABITUALES</Text>
                {habituales.slice(0, 8).map((fp) => (
                  <Pressable key={`fp-${fp.name}`} onPress={() => choose(fp.name)} style={({ pressed }) => [styles.pick, pressed && { opacity: 0.8 }]}>
                    <View style={styles.pickAv}>
                      <Text style={styles.pickAvText}>{fp.name.trim().slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickName}>{fp.name}</Text>
                      <View style={styles.row4}>
                        <Text style={styles.pickSub}>
                          {fp.times} {fp.times === 1 ? 'partido contigo' : 'partidos contigo'} ·{' '}
                        </Text>
                        {fp.user_id ? (
                          <>
                            <IconLink size={10} color={c.accent} />
                            <Text style={[styles.pickSub, { color: c.accent }]}> en TACTIUM</Text>
                          </>
                        ) : (
                          <Text style={styles.pickSub}>sin cuenta</Text>
                        )}
                      </View>
                    </View>
                    <Text style={styles.pickPlus}>＋</Text>
                  </Pressable>
                ))}
              </>
            ) : null}

            {!pickIsMe && plantilla.length > 0 ? (
              <>
                <Text style={styles.sheetSub}>TU EQUIPO</Text>
                {plantilla.slice(0, 20).map((pl) => (
                  <Pressable key={pl.id} onPress={() => choose(rosterName(pl))} style={({ pressed }) => [styles.pick, pressed && { opacity: 0.8 }]}>
                    <View style={styles.pickAv}>
                      <Text style={styles.pickAvText}>{rosterName(pl).slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickName}>{rosterName(pl)}</Text>
                      <View style={styles.row4}>
                        <Text style={styles.pickSub}>
                          {team?.name ?? ''} · {pl.pts} pts{pl.user_id ? ' · ' : ''}
                        </Text>
                        {pl.user_id ? <IconLink size={10} color={c.accent} /> : null}
                      </View>
                    </View>
                    <Text style={styles.pickPlus}>＋</Text>
                  </Pressable>
                ))}
              </>
            ) : null}

            {!pickIsMe && pickTarget && pickTarget[picking.key].trim() ? (
              <Pressable onPress={() => choose('')} style={styles.linkWrap}>
                <Text style={[styles.linkMuted, { color: c.error }]}>Vaciar este hueco</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
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
      marginBottom: 4,
    },
    closeBtn: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 36,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      marginBottom: 6,
    },
    closeLabel: { color: c.text, fontSize: 14, fontWeight: '500' },
    tabs: {
      flexDirection: 'row',
      gap: 4,
      padding: 3,
      borderRadius: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9 },
    tabOn: { backgroundColor: c.bgCard2 },
    tabText: { color: c.textMuted, fontSize: 13, fontWeight: '700' },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2.4,
      color: c.accent,
      fontWeight: '500',
      marginTop: 6,
    },
    title: { color: c.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.6, marginBottom: 4 },
    input: {
      height: 48,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      color: c.text,
      paddingHorizontal: 14,
      fontSize: 15,
    },
    partidoPanel: {
      gap: 10,
      padding: 10,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.bgRaised,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: 14,
      height: 46,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.accent40,
    },
    addText: { color: c.accent, fontSize: 14, fontWeight: '700' },
    addHint: { marginLeft: 'auto', color: c.textFaint, fontSize: 12 },
    footNote: { color: c.textFaint, fontSize: 12, textAlign: 'center', marginTop: 4 },
    foot: {
      paddingHorizontal: 16,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.hair,
      backgroundColor: c.bgRaised,
    },
    cta: {
      height: 50,
      borderRadius: Radius.md,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaDisabled: { backgroundColor: c.bgCard2 },
    ctaLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700' },
    ctaGhost: {
      height: 48,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaGhostLabel: { color: c.text, fontSize: 14.5, fontWeight: '600' },
    row6: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    row4: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    linkWrap: { alignSelf: 'center', paddingVertical: 8 },
    linkMuted: { color: c.textMuted, fontSize: 13.5, fontWeight: '600' },
    photoCard: {
      width: '100%',
      height: 190,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      padding: 14,
      justifyContent: 'flex-end',
      gap: 4,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    photoEyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10,
      letterSpacing: 2,
      color: '#E8F5EF',
    },
    photoTitle: { color: '#E8F5EF', fontSize: 18, fontWeight: '700' },
    photoScore: { fontFamily: Fonts.mono, color: '#00DF82' },
    photoSub: { color: 'rgba(232,245,239,0.75)', fontSize: 13 },
    invite: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent40,
    },
    inviteTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    inviteBody: { color: c.textMuted, fontSize: 12.5, marginTop: 2, lineHeight: 17 },
    sheetEyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2.2,
      color: c.accent,
      fontWeight: '500',
    },
    sheetSub: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2,
      color: c.textFaint,
      marginTop: 6,
    },
    pickHint: { color: c.textFaint, fontSize: 12 },
    pick: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 9,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.hair,
    },
    pickAv: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: c.bgCard2,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pickAvText: { fontFamily: Fonts.mono, fontSize: 11, fontWeight: '700', color: c.textMuted },
    pickName: { color: c.text, fontSize: 14, fontWeight: '600' },
    pickSub: { color: c.textFaint, fontSize: 11.5 },
    pickPlus: { color: c.accent, fontSize: 18, fontWeight: '700' },
  });
