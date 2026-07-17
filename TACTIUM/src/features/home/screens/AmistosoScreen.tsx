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

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack, IconLink, IconGift, IconCamera } from '@components/ui';
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
import {
  PhotoShareCard,
  sharePhotoCard,
  pickMatchPhoto,
} from '@components/share/PhotoShareCard';
import { DOWNLOAD_URL } from '@core/config/referral';

// Amistoso EQUIPO vs EQUIPO (F4 · plan de escalado): registro rápido de
// 1–5 partidos de dobles contra otro equipo. Cada partido se persiste como
// un casual_match (RPC create_casual_match). Estrategia: los amistosos no
// son ingresos, son adquisición — el resumen compartido por WhatsApp lleva
// la marca y alcanza al equipo rival.

type SetPair = [string, string]; // [nuestros juegos, juegos rival]
// Cada jugador en su propio SLOT (sin escribir "Nombre / Nombre"):
// a1/a2 = nuestra pareja · b1/b2 = pareja rival.
type PartidoInput = {
  a1: string;
  a2: string;
  b1: string;
  b2: string;
  sets: SetPair[];
};

const emptySets = (): SetPair[] => [
  ['', ''],
  ['', ''],
  ['', ''],
];
const emptyPartido = (): PartidoInput => ({
  a1: '',
  a2: '',
  b1: '',
  b2: '',
  sets: emptySets(),
});

const ourStr = (p?: PartidoInput) =>
  [p?.a1, p?.a2].filter(Boolean).join(' / ');
const rivalStr = (p?: PartidoInput) =>
  [p?.b1, p?.b2].filter(Boolean).join(' / ');

const clean = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 1);

const setsToNumeric = (sets: SetPair[]): [number, number][] =>
  sets
    .filter(([a, b]) => a !== '' && b !== '')
    .map(([a, b]) => [Number(a), Number(b)] as [number, number]);

const setsResult = (sets: SetPair[]) => {
  let us = 0;
  let them = 0;
  for (const [a, b] of sets) {
    if (a === '' || b === '') continue;
    if (+a > +b) us++;
    else if (+b > +a) them++;
  }
  return { us, them, decided: us !== them, won: us > them };
};

const setsToString = (sets: SetPair[]) =>
  sets
    .filter(([a, b]) => a !== '' && b !== '')
    .map(([a, b]) => `${a}-${b}`)
    .join(' ');

// ── Casillas numéricas por set ──────────────────────────────────────
const ScoreSlots: React.FC<{
  sets: SetPair[];
  onChange: (sets: SetPair[]) => void;
}> = ({ sets, onChange }) => {
  const setCell = (si: number, side: 0 | 1, v: string) => {
    const next = sets.map((s) => [...s] as SetPair);
    next[si][side] = clean(v);
    onChange(next);
  };
  return (
    <View style={styles.slotsRow}>
      {sets.map((s, si) => (
        <View key={si} style={styles.setGroup}>
          <Text style={styles.setLabel}>SET {si + 1}</Text>
          <View style={styles.setBoxes}>
            <TextInput
              style={styles.box}
              value={s[0]}
              onChangeText={(v) => setCell(si, 0, v)}
              keyboardType="number-pad"
              maxLength={1}
              placeholder="–"
              placeholderTextColor={Colors.textFaint}
            />
            <TextInput
              style={styles.box}
              value={s[1]}
              onChangeText={(v) => setCell(si, 1, v)}
              keyboardType="number-pad"
              maxLength={1}
              placeholder="–"
              placeholderTextColor={Colors.textFaint}
            />
          </View>
        </View>
      ))}
    </View>
  );
};

const Field: React.FC<{
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}> = ({ label, value, onChangeText, placeholder }) => (
  <View style={{ marginBottom: 10 }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textFaint}
    />
  </View>
);

export const AmistosoScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const team = useTeamStore((s) => s.team);
  const players = useTeamStore((s) => s.players);
  const isPlayer = useTeamStore(selectIsPlayer);

  const userId = useAuthStore((s) => s.user?.id ?? null);

  // Tres modos:
  //  · 'colegas'  → partido con amigos; solo el creador tiene TACTIUM.
  //  · 'entreno'  → interno del equipo; los 4 son de la plantilla y sus
  //                 stats suman a ambos lados.
  //  · 'equipos'  → enfrentamiento 1-5 partidos contra otro club. Lo
  //                 registra el capitán/admin — los jugadores no lo ven.
  // Sin equipo (jugador suelto) solo existe el modo colegas.
  const [mode, setMode] = useState<'colegas' | 'entreno' | 'equipos'>(
    !team ? 'colegas' : isPlayer ? 'colegas' : 'equipos',
  );
  const isColegas = mode === 'colegas';
  const isEntreno = mode === 'entreno';
  const isEquipos = mode === 'equipos';
  const isSingle = !isEquipos; // colegas y entreno: un solo partido

  const [rivalTeam, setRivalTeam] = useState('');
  const [partidos, setPartidos] = useState<PartidoInput[]>([emptyPartido()]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  // Id del partido guardado (el primero, si son varios): la foto elegida en
  // el paso de compartir se persiste en ESE amistoso (portada estilo liga).
  const [savedMatchId, setSavedMatchId] = useState<string | null>(null);
  // Foto del partido (estilo Strava): se comparte compuesta con el
  // resultado y la marca. Opcional, se elige tras guardar.
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  // Código de reclamo del partido guardado: va en la invitación para que
  // el colega, al registrarse, canjee el partido en Stats.
  const [claimCode, setClaimCode] = useState<string | null>(null);
  // Colegas frecuentes: gente de tus amistosos anteriores (fuera de la
  // plantilla). Si reclamaron su cuenta, se vinculan solos al repetir.
  const [recent, setRecent] = useState<FrequentPartner[]>([]);
  const photoCardRef = React.useRef<View>(null);

  useEffect(() => {
    if (!userId) return;
    fetchMyFrequentPartners(userId)
      .then(setRecent)
      .catch(() => setRecent([]));
  }, [userId]);

  const setCount = (n: number) =>
    setPartidos((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(emptyPartido());
      return next;
    });

  const switchMode = (m: 'colegas' | 'entreno' | 'equipos') => {
    setMode(m);
    if (m !== 'equipos') setCount(1);
  };

  // En colegas/entreno, tu propio nombre va pre-rellenado en el primer
  // hueco (eres quien registra el partido → tu vínculo está garantizado).
  const authName = useAuthStore((s) => {
    const meta = (s.user?.user_metadata ?? {}) as {
      full_name?: string;
      username?: string;
    };
    // Preferimos el nombre de usuario (nombre corto) sobre el completo: es
    // más limpio en el partido y en la foto compartida.
    return (meta.username ?? meta.full_name ?? '').trim() || null;
  });
  const myName = useMemo(
    () =>
      players.find((pl) => pl.user_id === userId)?.name ?? authName ?? null,
    [players, userId, authName],
  );
  useEffect(() => {
    if (!myName || mode === 'equipos') return;
    setPartidos((prev) =>
      prev[0] && !prev[0].a1.trim()
        ? prev.map((p, i) => (i === 0 ? { ...p, a1: myName } : p))
        : prev,
    );
  }, [myName, mode]);

  const update = (i: number, patch: Partial<PartidoInput>) =>
    setPartidos((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );

  // Marcador global: con UN solo partido lo natural es el resultado en
  // SETS (2-0); con varios partidos, cuenta de partidos ganados (3-1).
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
      ? `${ourStr(partidos[0]) || 'Nosotros'} ${marcador.us} – ${marcador.them} ${
          rivalStr(partidos[0]) || 'Rival'
        } (${marcador.unit})`
      : `${team?.name ?? 'Nuestro equipo'} ${marcador.us} – ${marcador.them} ${
          rivalTeam || 'Rival'
        } (${marcador.unit})`;
    const lines = [
      `🎾 *TACTIUM · ${isEntreno ? 'Entreno' : 'Amistoso'}*`,
      headline,
      ``,
      ...partidos
        .map((p, i) => {
          const r = setsResult(p.sets);
          const score = setsToString(p.sets);
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

  const validPartidos = partidos.filter(
    (p) => setsToNumeric(p.sets).length > 0,
  );

  // Vínculo por nombre exacto con la plantilla: si el nombre coincide con
  // un jugador RECLAMADO (user_id), el amistoso cuenta en sus stats. Los
  // chips de abajo rellenan el nombre exacto para garantizar el match.
  const userIdByName = useMemo(() => {
    const m = new Map<string, string>();
    // Historial primero; la plantilla tiene prioridad si hay colisión.
    for (const fp of recent) {
      if (fp.user_id) m.set(fp.name.trim().toLowerCase(), fp.user_id);
    }
    for (const pl of players) {
      if (pl.user_id) m.set(pl.name.trim().toLowerCase(), pl.user_id);
    }
    return m;
  }, [players, recent]);

  // Chips: plantilla + colegas recientes (sin duplicar nombres ni a mí).
  const chipPeople = useMemo(() => {
    const seen = new Set<string>();
    const out: { key: string; name: string; linked: boolean }[] = [];
    for (const pl of players) {
      const k = pl.name.trim().toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ key: `pl-${pl.id}`, name: pl.name, linked: !!pl.user_id });
    }
    for (const fp of recent) {
      const k = fp.name.trim().toLowerCase();
      if (seen.has(k)) continue;
      if (myName && k === myName.trim().toLowerCase()) continue;
      seen.add(k);
      out.push({ key: `fp-${k}`, name: fp.name, linked: !!fp.user_id });
    }
    return out;
  }, [players, recent, myName]);
  const linkByName = (name: string): string | null => {
    const k = name.trim().toLowerCase();
    // Mi propio hueco SIEMPRE vinculado a mi cuenta: en una cuenta nueva
    // (jugador suelto) no hay plantilla ni historial de los que sacar el
    // user_id, y sin esto el partido se guarda sin contar en mis stats.
    if (userId && myName && k === myName.trim().toLowerCase()) return userId;
    return userIdByName.get(k) ?? null;
  };

  const fillOurSlot = (i: number, name: string) => {
    const p = partidos[i];
    if (!p) return;
    if (!p.a1.trim()) update(i, { a1: name });
    else if (!p.a2.trim()) update(i, { a2: name });
    else if (isEntreno && !p.b1.trim()) update(i, { b1: name });
    else if (isEntreno && !p.b2.trim()) update(i, { b2: name });
    else update(i, { a2: name }); // llenos → sustituye al 2º propio
  };

  const handleSave = async () => {
    if (validPartidos.length === 0) {
      Alert.alert(
        'Falta el resultado',
        'Introduce al menos un set completo en algún partido.',
      );
      return;
    }
    setSaving(true);
    let ok = 0;
    try {
      let firstMatchId: string | null = null;
      for (const p of validPartidos) {
        // El creador va SIEMPRE en side0/slot0 (hueco pre-rellenado con su
        // nombre). En colegas/entreno lo vinculamos a su cuenta pase lo que
        // pase con el texto: si edita su nombre por un apodo o lo acorta, el
        // partido debe seguir contando en SUS stats (si no, se guarda pero no
        // aparece en su historial). En equipos el capitán puede no jugar, así
        // que ahí seguimos vinculando por nombre exacto.
        const a1UserId = !isEquipos && userId ? userId : linkByName(p.a1);
        const participants: CasualParticipant[] = [
          {
            side: 0,
            slot: 0,
            name: p.a1.trim() || (team?.name ?? 'Nosotros'),
            user_id: a1UserId,
          },
          { side: 0, slot: 1, name: p.a2.trim(), user_id: linkByName(p.a2) },
          {
            side: 1,
            slot: 0,
            name: p.b1.trim() || (rivalTeam || 'Rival'),
            user_id: isEntreno ? linkByName(p.b1) : null,
          },
          {
            side: 1,
            slot: 1,
            name: p.b2.trim(),
            user_id: isEntreno ? linkByName(p.b2) : null,
          },
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
      // Código de reclamo (si la migración está aplicada) para 1 partido.
      if (firstMatchId && ok === 1) {
        fetchClaimCode(firstMatchId).then(setClaimCode);
      }
      Alert.alert(
        '¡Amistoso guardado!',
        `${ok} ${ok === 1 ? 'partido registrado' : 'partidos registrados'}. ¿Compartes el resumen con el otro equipo?`,
      );
    } catch (e) {
      Alert.alert(
        ok > 0 ? 'Guardado parcial' : 'No se pudo guardar',
        `${ok > 0 ? `Se guardaron ${ok} partidos. ` : ''}${String(
          (e as Error).message ?? e,
        )}`,
      );
    } finally {
      setSaving(false);
    }
  };

  const shareNative = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      // cancelado por el usuario
    }
  };

  // Nombres del partido SIN cuenta TACTIUM (ni vínculo de plantilla, ni
  // soy yo): son los objetivos de la invitación post-partido — el gancho
  // de adquisición del plan (cada partido guardado recluta jugadores).
  const unlinkedNames = useMemo(() => {
    const out: string[] = [];
    for (const p of partidos) {
      for (const n of [p.a1, p.a2, p.b1, p.b2]) {
        const name = n.trim();
        if (!name) continue;
        if (myName && name.toLowerCase() === myName.toLowerCase()) continue;
        if (linkByName(name)) continue;
        if (!out.some((x) => x.toLowerCase() === name.toLowerCase()))
          out.push(name);
      }
    }
    return out;
  }, [partidos, myName, linkByName]);

  const shareInvite = async () => {
    const quien = unlinkedNames.slice(0, 3).join(', ');
    const msg = [
      `🎾 ${quien}: he registrado nuestro partido en TACTIUM.`,
      ``,
      `Instálate la app y tus partidos contarán en tus estadísticas`,
      `(victorias, rachas, % y más): ${DOWNLOAD_URL}`,
      ...(claimCode
        ? [
            ``,
            `Al registrarte, canjea este código en la pestaña Stats y ESTE partido pasa a tu cuenta: ${claimCode}`,
          ]
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
    // Persistimos la foto como portada del amistoso guardado (estilo liga),
    // para que quede permanente y se vea en el detalle del partido.
    if (savedMatchId && userId) {
      uploadCasualPhoto(userId, savedMatchId, uri).catch((e) =>
        console.warn('casual photo upload', e),
      );
    }
  };

  // Marcador de la tarjeta (idéntico al del detalle del partido): pareja +
  // resultado sobre pareja + resultado, resaltando al ganador en verde.
  const photoHome = isSingle
    ? ourStr(partidos[0]) || 'Nosotros'
    : team?.name ?? 'Nosotros';
  const photoAway = isSingle
    ? rivalStr(partidos[0]) || 'Rival'
    : rivalTeam || 'Rival';
  const photoDecided = marcador.us !== marcador.them;
  const photoWon = marcador.us > marcador.them;
  const photoTitle = `${photoHome} ${marcador.us}–${marcador.them} ${photoAway}`;
  const photoSets = isSingle
    ? setsToString(partidos[0]?.sets ?? [])
    : `${validPartidos.length} ${
        validPartidos.length === 1 ? 'partido' : 'partidos'
      }`;
  const photoDetail =
    isSingle && photoDecided
      ? `${photoWon ? 'VICTORIA' : 'DERROTA'}${photoSets ? ` · ${photoSets}` : ''}`
      : photoSets;

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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.backBtn}
        >
          <IconBack size={20} color={Colors.text} />
        </Pressable>

        <Text style={styles.eyebrow}>
          {isEntreno
            ? 'AMISTOSO · ENTRENAMIENTO'
            : isColegas
              ? 'AMISTOSO · ENTRE COLEGAS'
              : 'AMISTOSO · EQUIPO VS EQUIPO'}
        </Text>
        <Text style={styles.title}>Registrar amistoso</Text>
        <Text style={styles.lede}>
          {isEntreno
            ? 'Partido interno del equipo: los cuatro son de la plantilla y suma en las stats de todos los vinculados.'
            : isColegas
              ? team
                ? 'Un partido entre amigos: cuenta como amistoso y no afecta a tu liga.'
                : 'Un partido entre amigos: se guarda con su marcador y suma en tus estadísticas.'
              : 'Se juega hoy, cuenta como amistoso y no afecta a tu liga. Comparte el resumen con el equipo rival al terminar.'}
        </Text>

        <View style={styles.countRow}>
          {(team
            ? [
                { id: 'colegas' as const, label: 'Colegas' },
                { id: 'entreno' as const, label: 'Entreno' },
                ...(isPlayer
                  ? []
                  : [{ id: 'equipos' as const, label: 'Equipos' }]),
              ]
            : []
          ).map((m) => {
            const sel = mode === m.id;
            return (
              <Pressable
                key={m.id}
                onPress={() => switchMode(m.id)}
                style={[
                  styles.countChip,
                  { marginTop: 16 },
                  sel && {
                    backgroundColor: Colors.accent,
                    borderColor: Colors.accent,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.countChipText,
                    { fontSize: 13 },
                    { color: sel ? '#000' : Colors.text },
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {isEquipos ? (
          <View style={styles.section}>
            <Field
              label="EQUIPO RIVAL"
              value={rivalTeam}
              onChangeText={setRivalTeam}
              placeholder="CD Rival Pádel"
            />

            <Text style={styles.fieldLabel}>PARTIDOS</Text>
            <View style={styles.countRow}>
              {[1, 2, 3, 4, 5].map((n) => {
                const sel = partidos.length === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setCount(n)}
                    style={[
                      styles.countChip,
                      sel && {
                        backgroundColor: Colors.accent,
                        borderColor: Colors.accent,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.countChipText,
                        { color: sel ? '#000' : Colors.text },
                      ]}
                    >
                      {n}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {partidos.map((p, i) => (
          <View key={i} style={styles.section}>
            {isEquipos ? (
              <Text style={styles.partidoLabel}>PARTIDO {i + 1}</Text>
            ) : null}
            <Text style={styles.fieldLabel}>
              {isEntreno
                ? 'PAREJA A'
                : isColegas
                  ? 'TU PAREJA (TÚ Y TU COMPAÑERO)'
                  : 'NUESTRA PAREJA'}
            </Text>
            <View style={styles.slotPairRow}>
              {/* En colegas/entreno el primer hueco eres TÚ: se vincula a tu
                  cuenta pase lo que pase con el texto (ver handleSave). El
                  badge lo deja claro para que el partido cuente en tus stats. */}
              <View style={styles.slotInput}>
                <TextInput
                  style={[
                    styles.input,
                    !isEquipos && i === 0 ? styles.meInput : null,
                  ]}
                  value={p.a1}
                  onChangeText={(t) => update(i, { a1: t })}
                  placeholder={!isEquipos && i === 0 ? 'Tú' : 'Jugador 1'}
                  placeholderTextColor={Colors.textFaint}
                />
                {!isEquipos && i === 0 ? (
                  <View style={styles.meBadge} pointerEvents="none">
                    <View style={styles.mePill}>
                      <Text style={styles.meBadgeText}>TÚ</Text>
                    </View>
                  </View>
                ) : null}
              </View>
              <TextInput
                style={[styles.input, styles.slotInput]}
                value={p.a2}
                onChangeText={(t) => update(i, { a2: t })}
                placeholder="Jugador 2"
                placeholderTextColor={Colors.textFaint}
              />
            </View>
            {chipPeople.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.rosterRow}
              >
                {chipPeople.map((cp) => (
                  <Pressable
                    key={cp.key}
                    onPress={() => fillOurSlot(i, cp.name)}
                    style={styles.rosterChip}
                  >
                    {cp.linked ? (
                      <IconLink size={11} color={Colors.accent} />
                    ) : null}
                    <Text style={styles.rosterChipText}>{cp.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            <Text style={styles.guestHint}>
              {isEntreno
                ? 'El primer hueco eres tú. Toca los chips para colocar a los cuatro: rellenan Pareja A y luego Pareja B. Los vinculados suman en sus stats.'
                : 'El primer hueco eres tú (cuenta en tus stats aunque cambies el nombre por tu apodo). Los chips son tu plantilla y colegas habituales; el eslabón = suma en sus stats.'}
            </Text>
            <Text style={styles.fieldLabel}>
              {isEntreno ? 'PAREJA B' : 'PAREJA RIVAL'}
            </Text>
            <View style={styles.slotPairRow}>
              <TextInput
                style={[styles.input, styles.slotInput]}
                value={p.b1}
                onChangeText={(t) => update(i, { b1: t })}
                placeholder="Rival 1"
                placeholderTextColor={Colors.textFaint}
              />
              <TextInput
                style={[styles.input, styles.slotInput]}
                value={p.b2}
                onChangeText={(t) => update(i, { b2: t })}
                placeholder="Rival 2"
                placeholderTextColor={Colors.textFaint}
              />
            </View>
            <Text style={styles.fieldLabel}>RESULTADO</Text>
            <ScoreSlots sets={p.sets} onChange={(s) => update(i, { sets: s })} />
          </View>
        ))}

        {/* Marcador global */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTeams} numberOfLines={1}>
            {isSingle
              ? `${ourStr(partidos[0]) || 'Nosotros'} · ${rivalStr(partidos[0]) || 'Rival'}`
              : `${team?.name ?? 'Nosotros'} · ${rivalTeam || 'Rival'}`}
          </Text>
          <Text style={styles.scoreBig}>
            {marcador.us} <Text style={styles.scoreSep}>–</Text> {marcador.them}
          </Text>
          <Text style={styles.scoreUnit}>
            {marcador.unit === 'sets' ? 'SETS' : 'PARTIDOS'}
          </Text>
        </View>

        {savedCount == null ? (
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.cta,
              (saving || validPartidos.length === 0) && { opacity: 0.5 },
              pressed && !saving && { opacity: 0.85 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#001810" />
            ) : (
              <Text style={styles.ctaLabel}>Guardar amistoso</Text>
            )}
          </Pressable>
        ) : (
          <View style={{ gap: 8 }}>
            {photoUri ? (
              <View style={{ alignItems: 'center', marginBottom: 6 }}>
                <PhotoShareCard
                  ref={photoCardRef}
                  photoUri={photoUri}
                  title={photoTitle}
                  subtitle={`${isEntreno ? 'Entreno' : 'Amistoso'} · ${new Date().toLocaleDateString(
                    'es-ES',
                    { day: 'numeric', month: 'short' },
                  )}`}
                  detail={photoDetail}
                  homeName={photoHome}
                  homeScore={marcador.us}
                  awayName={photoAway}
                  awayScore={marcador.them}
                  highlight={
                    photoDecided ? (photoWon ? 'home' : 'away') : 'home'
                  }
                />
              </View>
            ) : null}
            {photoUri ? (
              <Pressable
                onPress={() => sharePhotoCard(photoCardRef, photoUri, shareText)}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={styles.ctaLabel}>Compartir foto + resultado</Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={pickPhoto}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.ctaGhostRow}>
                  <IconCamera size={15} color="#001810" />
                  <Text style={styles.ctaLabel}>Añadir foto del partido</Text>
                </View>
              </Pressable>
            )}
            <Pressable
              onPress={shareNative}
              style={({ pressed }) => [
                styles.ctaGhost,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.ctaGhostLabel}>
                Compartir sólo el texto
              </Text>
            </Pressable>
            {unlinkedNames.length > 0 ? (
              <Pressable
                onPress={shareInvite}
                style={({ pressed }) => [
                  styles.inviteBtn,
                  pressed && { opacity: 0.85 },
                ]}
              >
                <View style={styles.inviteBtnRow}>
                  <IconGift size={16} color={Colors.accent} />
                  <Text style={styles.inviteBtnLabel}>
                    Invita a {unlinkedNames.length}{' '}
                    {unlinkedNames.length === 1 ? 'jugador' : 'jugadores'} sin
                    TACTIUM
                  </Text>
                </View>
                <Text style={styles.inviteBtnHint}>
                  Si se instalan la app, sus partidos contarán en sus stats
                </Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

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
  lede: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  section: {
    marginTop: 18,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    padding: 14,
  },
  partidoLabel: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '600',
    marginBottom: 10,
  },
  slotPairRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  slotInput: { flex: 1 },
  meInput: { paddingRight: 46 },
  meBadge: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  mePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  meBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.accent,
  },
  rosterRow: { gap: 6, paddingVertical: 4, paddingRight: 8 },
  rosterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    minHeight: 34,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    justifyContent: 'center',
  },
  rosterChipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  guestHint: {
    color: Colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
    marginBottom: 10,
  },
  fieldLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '500',
    marginBottom: 6,
  },
  input: {
    backgroundColor: Colors.bgRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
  },
  countRow: { flexDirection: 'row', gap: 6 },
  countChip: {
    flex: 1,
    height: 42,
    borderRadius: 10,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countChipText: { fontSize: 15, fontWeight: '700' },
  slotsRow: { flexDirection: 'row', gap: 10 },
  setGroup: { flex: 1 },
  setLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 9,
    letterSpacing: 1.2,
    marginBottom: 4,
    textAlign: 'center',
  },
  setBoxes: { flexDirection: 'row', gap: 4 },
  box: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreCard: {
    marginTop: 18,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.accent40,
    padding: 16,
    alignItems: 'center',
  },
  scoreTeams: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.6,
  },
  scoreBig: {
    color: Colors.text,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1,
    marginTop: 4,
  },
  scoreSep: { color: Colors.textFaint },
  scoreUnit: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 2,
  },
  cta: {
    marginTop: 18,
    height: 52,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaLabel: { color: '#001810', fontSize: 15, fontWeight: '700' },
  ctaGhost: {
    height: 46,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaGhostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  ctaGhostLabel: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
  inviteBtn: {
    marginTop: 4,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.accent40,
    backgroundColor: Colors.accent15,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  inviteBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  inviteBtnLabel: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  inviteBtnHint: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 3,
    textAlign: 'center',
  },
});
