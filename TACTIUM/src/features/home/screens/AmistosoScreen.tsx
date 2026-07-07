import React, { useMemo, useState } from 'react';
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
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import {
  createCasualMatch,
  type CasualParticipant,
} from '@core/services/casualMatches';

// Amistoso EQUIPO vs EQUIPO (F4 · plan de escalado): registro rápido de
// 1–5 partidos de dobles contra otro equipo. Cada partido se persiste como
// un casual_match (RPC create_casual_match). Estrategia: los amistosos no
// son ingresos, son adquisición — el resumen compartido por WhatsApp lleva
// la marca y alcanza al equipo rival.

type SetPair = [string, string]; // [nuestros juegos, juegos rival]
type PartidoInput = { pair: string; opp: string; sets: SetPair[] };

const emptySets = (): SetPair[] => [
  ['', ''],
  ['', ''],
  ['', ''],
];
const emptyPartido = (): PartidoInput => ({ pair: '', opp: '', sets: emptySets() });

const clean = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 1);

const splitPair = (s: string): [string, string] => {
  const parts = s.split('/').map((x) => x.trim());
  return [parts[0] ?? '', parts[1] ?? ''];
};

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

  const [rivalTeam, setRivalTeam] = useState('');
  const [partidos, setPartidos] = useState<PartidoInput[]>([emptyPartido()]);
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  const setCount = (n: number) =>
    setPartidos((prev) => {
      const next = prev.slice(0, n);
      while (next.length < n) next.push(emptyPartido());
      return next;
    });

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
    const lines = [
      `🎾 *TACTIUM · Amistoso*`,
      `${team?.name ?? 'Nuestro equipo'} ${marcador.us} – ${marcador.them} ${
        rivalTeam || 'Rival'
      } (${marcador.unit})`,
      ``,
      ...partidos
        .map((p, i) => {
          const r = setsResult(p.sets);
          const score = setsToString(p.sets);
          if (!score) return null;
          return `P${i + 1} — ${p.pair || '—'} vs ${p.opp || '—'}: ${score} ${
            r.decided ? (r.won ? '✅' : '❌') : ''
          }`;
        })
        .filter(Boolean),
      ``,
      `Organiza tus amistosos con TACTIUM · tactium.io`,
    ];
    return lines.join('\n');
  }, [team, rivalTeam, partidos, marcador]);

  const validPartidos = partidos.filter(
    (p) => setsToNumeric(p.sets).length > 0,
  );

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
      for (const p of validPartidos) {
        const [a0, a1] = splitPair(p.pair);
        const [b0, b1] = splitPair(p.opp);
        const participants: CasualParticipant[] = [
          { side: 0, slot: 0, name: a0 || (team?.name ?? 'Nosotros') },
          { side: 0, slot: 1, name: a1 },
          { side: 1, slot: 0, name: b0 || (rivalTeam || 'Rival') },
          { side: 1, slot: 1, name: b1 },
        ];
        await createCasualMatch({
          type: 'amistoso',
          sets: setsToNumeric(p.sets),
          participants,
          visibility: 'public',
        });
        ok++;
      }
      setSavedCount(ok);
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

  const shareWhatsapp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
    const can = await Linking.canOpenURL(url);
    if (can) await Linking.openURL(url);
    else await Linking.openURL(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
  };

  const shareNative = async () => {
    try {
      await Share.share({ message: shareText });
    } catch {
      // cancelado por el usuario
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 60 },
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

        <Text style={styles.eyebrow}>AMISTOSO · EQUIPO VS EQUIPO</Text>
        <Text style={styles.title}>Registrar amistoso</Text>
        <Text style={styles.lede}>
          Se juega hoy, cuenta como amistoso y no afecta a tu liga. Comparte el
          resumen con el equipo rival al terminar.
        </Text>

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

        {partidos.map((p, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.partidoLabel}>PARTIDO {i + 1}</Text>
            <Field
              label="NUESTRA PAREJA"
              value={p.pair}
              onChangeText={(t) => update(i, { pair: t })}
              placeholder="Nombre / Nombre"
            />
            <Field
              label="PAREJA RIVAL"
              value={p.opp}
              onChangeText={(t) => update(i, { opp: t })}
              placeholder="Nombre / Nombre"
            />
            <Text style={styles.fieldLabel}>RESULTADO</Text>
            <ScoreSlots sets={p.sets} onChange={(s) => update(i, { sets: s })} />
          </View>
        ))}

        {/* Marcador global */}
        <View style={styles.scoreCard}>
          <Text style={styles.scoreTeams} numberOfLines={1}>
            {team?.name ?? 'Nosotros'} · {rivalTeam || 'Rival'}
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
            <Pressable
              onPress={shareWhatsapp}
              style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaLabel}>Compartir por WhatsApp</Text>
            </Pressable>
            <Pressable
              onPress={shareNative}
              style={({ pressed }) => [
                styles.ctaGhost,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.ctaGhostLabel}>Otras apps</Text>
            </Pressable>
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
  ctaGhostLabel: { color: Colors.textMuted, fontSize: 14, fontWeight: '600' },
});
