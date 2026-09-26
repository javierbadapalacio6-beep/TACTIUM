import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconShare, IconCheck, IconBack } from '@components/ui/Icon';
import { MatchCard, type MatchCardData } from '../components/MatchCard';
import { createCasualMatch, type CasualParticipant } from '@core/services/casualMatches';

// "Nombre / Compañero" → dos nombres.
const splitPair = (s: string): [string, string] => {
  const parts = s.split('/').map((x) => x.trim());
  return [parts[0] ?? '', parts[1] ?? ''];
};
// Casillas de sets → [[us,them]] numérico (solo sets completos).
const setsToNumeric = (sets: [string, string][]): [number, number][] =>
  sets
    .filter(([a, b]) => a !== '' && b !== '')
    .map(([a, b]) => [Number(a), Number(b)] as [number, number]);

// Tab central "Registrar": formulario de resultado con vista previa EN VIVO.
// El marcador se introduce con CASILLAS NUMÉRICAS por set (sin escribir
// guiones); el resultado (sets ganados, marcador global) se calcula solo.
// Maqueta funcional (estado local). Persistencia + captura/compartir → Fase 1a.

type SetPair = [string, string]; // [nuestros juegos, juegos rival]
type CourtInput = { pair: string; opp: string; sets: SetPair[] };
type MatchType = 'liga' | 'amistoso' | 'entreno' | 'torneo';

const TYPES: { key: MatchType; label: string }[] = [
  { key: 'liga', label: 'Liga' },
  { key: 'amistoso', label: 'Amistoso' },
  { key: 'entreno', label: 'Entreno' },
  { key: 'torneo', label: 'Torneo' },
];

const emptySets = (): SetPair[] => [
  ['', ''],
  ['', ''],
  ['', ''],
];

const clean = (v: string) => v.replace(/[^0-9]/g, '').slice(0, 1);

// Resultado a partir de las casillas: cuenta sets ganados por cada lado.
const setsResult = (sets: SetPair[]) => {
  let us = 0;
  let them = 0;
  for (const [a, b] of sets) {
    if (a === '' || b === '') continue;
    if (+a > +b) us++;
    else if (+b > +a) them++;
  }
  return { us, them, won: us > them };
};

const setsToString = (sets: SetPair[]) =>
  sets
    .filter(([a, b]) => a !== '' && b !== '')
    .map(([a, b]) => `${a}-${b}`)
    .join(' ');

// ── Casillas numéricas de sets ──────────────────────────────────────
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
  flex?: number;
  keyboardType?: 'default' | 'number-pad';
}> = ({ label, value, onChangeText, placeholder, flex, keyboardType }) => (
  <View style={{ flex: flex ?? undefined }}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textFaint}
      keyboardType={keyboardType}
    />
  </View>
);

export const RegistrarScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  const [type, setType] = useState<MatchType>('liga');
  const [date, setDate] = useState('25 de mayo de 2025');

  // Liga
  const [homeName, setHomeName] = useState('CD Tactium');
  const [away, setAway] = useState('Padel Río');
  const [jornada, setJornada] = useState('7');
  const [courts, setCourts] = useState<CourtInput[]>([
    { pair: 'M. García / A. López', opp: 'J. Pérez / D. Morales', sets: [['6', '4'], ['6', '3'], ['', '']] },
    { pair: 'P. Ruiz / J. Sánchez', opp: 'F. Castillo / R. Ortega', sets: [['4', '6'], ['6', '7'], ['', '']] },
    { pair: 'L. Martín / I. Navarro', opp: 'M. Vega / A. Salas', sets: [['6', '4'], ['6', '2'], ['', '']] },
    { pair: 'R. Díaz / S. Romero', opp: 'I. Méndez / B. Gil', sets: [['3', '6'], ['6', '2'], ['6', '4']] },
    { pair: 'A. Torres / C. Vega', opp: 'E. Noguera / P. Marín', sets: [['2', '6'], ['3', '6'], ['', '']] },
  ]);

  // Individual (amistoso/entreno/torneo)
  const [myPair, setMyPair] = useState('Bada / Marco');
  const [rivalPair, setRivalPair] = useState('Ruiz / Sanz');
  const [indivSets, setIndivSets] = useState<SetPair[]>([['6', '4'], ['6', '3'], ['', '']]);

  const [saving, setSaving] = useState(false);

  const updateCourt = (i: number, patch: Partial<CourtInput>) =>
    setCourts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  // Guarda un partido individual (casual). Nombres libres → user_id null (no
  // puntúa nivel hasta que se enlacen jugadores reales, fase siguiente).
  const handleSaveCasual = async () => {
    if (type === 'liga') return;
    const [a0, a1] = splitPair(myPair);
    const [b0, b1] = splitPair(rivalPair);
    const participants: CasualParticipant[] = [
      { side: 0, slot: 0, name: a0 },
      { side: 0, slot: 1, name: a1 },
      { side: 1, slot: 0, name: b0 },
      { side: 1, slot: 1, name: b1 },
    ];
    const sets = setsToNumeric(indivSets);
    if (sets.length === 0) {
      Alert.alert('Falta el resultado', 'Introduce al menos un set completo.');
      return;
    }
    try {
      setSaving(true);
      await createCasualMatch({ type, sets, participants, visibility: 'public' });
      Alert.alert('¡Guardado!', 'Tu partido se ha registrado.');
    } catch (e) {
      Alert.alert('No se pudo guardar', String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  let data: MatchCardData;
  if (type === 'liga') {
    const scoreFor = courts.filter((c) => setsResult(c.sets).won).length;
    data = {
      variant: 'league',
      jornada: `JORNADA ${jornada || '?'}`,
      home: homeName || 'Nuestro equipo',
      away: away || 'Rival',
      clubLogo: null,
      scoreFor,
      scoreAgainst: courts.length - scoreFor,
      won: scoreFor > courts.length - scoreFor,
      date,
      courts: courts.map((c) => ({
        pair: c.pair,
        opp: c.opp,
        score: setsToString(c.sets),
        won: setsResult(c.sets).won,
      })),
    };
  } else {
    data = {
      variant: 'individual',
      tag: type.toUpperCase(),
      clubLogo: null,
      pair: myPair || 'Nuestra pareja',
      opp: rivalPair || 'Rival',
      sets: setsToString(indivSets),
      won: setsResult(indivSets).won,
      date,
      // El nivel se calcula solo al guardar (TrueSkill) → aquí no se pide.
    };
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 120 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
          <IconBack size={20} color={Colors.text} />
        </Pressable>
        <Text style={styles.eyebrow}>REGISTRAR · BETA</Text>
        <Text style={styles.title}>Registrar resultado</Text>

        {/* Tipo de partido */}
        <View style={styles.typeRow}>
          {TYPES.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setType(t.key)}
              style={[styles.typeChip, type === t.key && styles.typeChipActive]}
            >
              <Text style={[styles.typeTxt, type === t.key && styles.typeTxtActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {type === 'liga' ? (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Partido</Text>
              <Field label="Nuestro equipo" value={homeName} onChangeText={setHomeName} />
              <View style={{ height: 12 }} />
              <Field label="Rival" value={away} onChangeText={setAway} />
              <View style={styles.rowGap}>
                <Field label="Jornada" value={jornada} onChangeText={setJornada} keyboardType="number-pad" flex={1} />
                <Field label="Fecha" value={date} onChangeText={setDate} flex={2} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pistas</Text>
              {courts.map((c, i) => (
                <View key={i} style={styles.courtBlock}>
                  <Text style={styles.courtLabel}>PISTA {i + 1}</Text>
                  <Field label="Nuestra pareja" value={c.pair} onChangeText={(t) => updateCourt(i, { pair: t })} placeholder="Nombre / Nombre" />
                  <Field label="Pareja rival" value={c.opp} onChangeText={(t) => updateCourt(i, { opp: t })} placeholder="Nombre / Nombre" />
                  <View>
                    <Text style={styles.fieldLabel}>Resultado</Text>
                    <ScoreSlots sets={c.sets} onChange={(s) => updateCourt(i, { sets: s })} />
                  </View>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Partido</Text>
            <Field label="Nuestra pareja" value={myPair} onChangeText={setMyPair} placeholder="Nombre / Nombre" />
            <View style={{ height: 12 }} />
            <Field label="Pareja rival" value={rivalPair} onChangeText={setRivalPair} placeholder="Nombre / Nombre" />
            <View style={{ height: 12 }} />
            <Field label="Fecha" value={date} onChangeText={setDate} />
            <View style={{ marginTop: 16 }}>
              <Text style={styles.fieldLabel}>Resultado</Text>
              <ScoreSlots sets={indivSets} onChange={setIndivSets} />
            </View>
            <Text style={styles.hint}>El nivel se calcula solo al guardar.</Text>
          </View>
        )}

        {/* Vista previa en vivo */}
        <Text style={styles.sectionTitle}>Vista previa</Text>
        <MatchCard data={data} />

        {type === 'liga' ? (
          <>
            <Pressable style={styles.shareBtn}>
              <IconShare size={16} color={Colors.textInverse} />
              <Text style={styles.shareTxt}>Compartir</Text>
            </Pressable>
            <Text style={styles.note}>
              Los partidos de liga se guardan desde la jornada. Compartir se
              activa con el próximo build nativo.
            </Text>
          </>
        ) : (
          <>
            <Pressable
              style={[styles.shareBtn, saving && styles.shareBtnDisabled]}
              onPress={handleSaveCasual}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <IconCheck size={16} color={Colors.textInverse} />
              )}
              <Text style={styles.shareTxt}>{saving ? 'Guardando…' : 'Guardar partido'}</Text>
            </Pressable>
            <Text style={styles.note}>
              Se guarda en tu historial. Compartir imagen se activa con el
              próximo build nativo.
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 18 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.4, color: Colors.accent, fontWeight: '500' },
  title: { color: Colors.text, fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginTop: 6 },

  typeRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  typeChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
  },
  typeChipActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent + '66' },
  typeTxt: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  typeTxtActive: { color: Colors.accent },

  section: { marginTop: 22 },
  sectionTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 12 },
  fieldLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    color: Colors.text,
    fontSize: 15,
  },
  rowGap: { flexDirection: 'row', gap: 12, marginTop: 12 },
  hint: { color: Colors.textFaint, fontSize: 12, marginTop: 12 },

  courtBlock: {
    backgroundColor: Colors.bgRaised,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  courtLabel: { fontFamily: Fonts.mono, fontSize: 12, letterSpacing: 1.5, color: Colors.accent, fontWeight: '600' },

  // casillas de sets
  slotsRow: { flexDirection: 'row', gap: 16 },
  setGroup: { alignItems: 'center', gap: 6 },
  setLabel: { fontFamily: Fonts.mono, fontSize: 9, letterSpacing: 1, color: Colors.textFaint },
  setBoxes: { flexDirection: 'row', gap: 6 },
  box: {
    width: 40,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },

  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 22,
    height: 52,
    borderRadius: 16,
    backgroundColor: Colors.accent,
  },
  shareBtnDisabled: { opacity: 0.6 },
  shareTxt: { color: Colors.textInverse, fontSize: 15, fontWeight: '700' },
  note: { color: Colors.textFaint, fontSize: 12, textAlign: 'center', marginTop: 10 },
});
