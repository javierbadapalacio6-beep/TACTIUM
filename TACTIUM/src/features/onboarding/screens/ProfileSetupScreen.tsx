import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconChevron } from '@components/ui/Icon';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import {
  completeProfileOnboarding,
  type PlayerSide,
} from '@core/services/profile';
import { VenuePicker } from '@features/onboarding/components/VenuePicker';

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round2 = (n: number) => Math.round(n * 4) / 4; // pasos de 0.25

const SIDES: { key: PlayerSide; label: string }[] = [
  { key: 'drive', label: 'Drive' },
  { key: 'reves', label: 'Revés' },
  { key: 'ambos', label: 'Ambos' },
];

// ── Cuestionario "No sé mi nivel" → estima un 0-7 ────────────────────
type Q = { q: string; opts: { label: string; v: number }[] };
const QUIZ: Q[] = [
  {
    q: '¿Cuánto llevas jugando?',
    opts: [
      { label: 'Menos de 1 año', v: 1.5 },
      { label: '1 a 3 años', v: 3 },
      { label: 'Más de 3 años', v: 4.5 },
    ],
  },
  {
    q: '¿Cada cuánto juegas?',
    opts: [
      { label: 'De vez en cuando', v: 0 },
      { label: 'Cada semana', v: 0.5 },
      { label: 'Varias veces/semana', v: 1 },
    ],
  },
  {
    q: '¿Cómo te ves en pista?',
    opts: [
      { label: 'Empezando', v: -0.5 },
      { label: 'Me defiendo', v: 0 },
      { label: 'Competitivo', v: 1 },
    ],
  },
];

const Segmented: React.FC<{
  options: { key: string; label: string }[];
  value: string | null;
  onChange: (k: string) => void;
}> = ({ options, value, onChange }) => (
  <View style={styles.segRow}>
    {options.map((o) => (
      <Pressable
        key={o.key}
        onPress={() => onChange(o.key)}
        style={[styles.segBtn, value === o.key && styles.segBtnActive]}
      >
        <Text style={[styles.segTxt, value === o.key && styles.segTxtActive]}>
          {o.label}
        </Text>
      </Pressable>
    ))}
  </View>
);

export const ProfileSetupScreen = () => {
  const insets = useSafeAreaInsets();
  const email = useAuthStore((s) => s.user?.email ?? null);
  const existingName = useProfileStore((s) => s.fullName);
  const markOnboarded = useProfileStore((s) => s.markOnboarded);

  const defaultName = existingName ?? (email ? email.split('@')[0] : '');
  const [name, setName] = useState(defaultName);
  const [side, setSide] = useState<PlayerSide | null>(null);
  const [homeClub, setHomeClub] = useState('');
  const [venuePickerOpen, setVenuePickerOpen] = useState(false);

  // Nivel: dos caminos — "sé mi nivel" (stepper) o "no lo sé" (quiz).
  const [levelMode, setLevelMode] = useState<'known' | 'quiz'>('known');
  const [knownLevel, setKnownLevel] = useState(3);
  const [answers, setAnswers] = useState<(number | null)[]>([null, null, null]);
  const [saving, setSaving] = useState(false);

  const quizComplete = answers.every((a) => a !== null);
  const estimatedLevel = useMemo(
    () =>
      quizComplete
        ? round2(clamp(answers.reduce((s, a) => s + (a ?? 0), 0), 0.5, 6.5))
        : null,
    [answers, quizComplete],
  );

  const level = levelMode === 'known' ? knownLevel : estimatedLevel;
  const canSubmit = name.trim().length > 0 && side !== null && level != null;

  const submit = async () => {
    if (!canSubmit || side == null || level == null) return;
    try {
      setSaving(true);
      await completeProfileOnboarding({
        fullName: name.trim(),
        side,
        level,
        homeClub: homeClub.trim() || undefined,
      });
      markOnboarded(); // el RootNavigator saca esta pantalla y entra al feed
    } catch (e) {
      Alert.alert('No se pudo guardar', String((e as Error).message ?? e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TactiumMark size={40} gradient />
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>BIENVENIDO</Text>
            <Text style={styles.title}>Crea tu perfil</Text>
          </View>
        </View>
        <Text style={styles.lede}>
          Un par de datos para empezar. Podrás cambiarlos después; tu nivel se
          ajustará solo con cada partido.
        </Text>

        {/* Nombre */}
        <Text style={styles.label}>Nombre</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Tu nombre"
          placeholderTextColor={Colors.textFaint}
        />

        {/* Lado */}
        <Text style={styles.label}>¿En qué lado juegas?</Text>
        <Segmented
          options={SIDES}
          value={side}
          onChange={(k) => setSide(k as PlayerSide)}
        />

        {/* Nivel */}
        <Text style={styles.label}>Tu nivel</Text>
        <Segmented
          options={[
            { key: 'known', label: 'Sé mi nivel' },
            { key: 'quiz', label: 'No lo sé' },
          ]}
          value={levelMode}
          onChange={(k) => setLevelMode(k as 'known' | 'quiz')}
        />

        {levelMode === 'known' ? (
          <View style={styles.stepperWrap}>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setKnownLevel((l) => round2(clamp(l - 0.25, 0, 7)))}
            >
              <Text style={styles.stepTxt}>−</Text>
            </Pressable>
            <View style={styles.levelDisplay}>
              <Text style={styles.levelNum}>{knownLevel.toFixed(2)}</Text>
              <Text style={styles.levelScale}>escala 0–7</Text>
            </View>
            <Pressable
              style={styles.stepBtn}
              onPress={() => setKnownLevel((l) => round2(clamp(l + 0.25, 0, 7)))}
            >
              <Text style={styles.stepTxt}>+</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.quiz}>
            {QUIZ.map((item, qi) => (
              <View key={qi} style={{ marginBottom: 14 }}>
                <Text style={styles.quizQ}>{item.q}</Text>
                <View style={styles.quizOpts}>
                  {item.opts.map((o) => (
                    <Pressable
                      key={o.label}
                      onPress={() =>
                        setAnswers((prev) => {
                          const next = [...prev];
                          next[qi] = o.v;
                          return next;
                        })
                      }
                      style={[
                        styles.quizOpt,
                        answers[qi] === o.v && styles.quizOptActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.quizOptTxt,
                          answers[qi] === o.v && styles.quizOptTxtActive,
                        ]}
                      >
                        {o.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
            {estimatedLevel != null ? (
              <Text style={styles.estimate}>
                Nivel estimado: <Text style={styles.estimateNum}>{estimatedLevel.toFixed(2)}</Text>
              </Text>
            ) : (
              <Text style={styles.estimateHint}>Responde las 3 para estimar tu nivel.</Text>
            )}
          </View>
        )}
        <Text style={styles.hint}>
          Compatible con el nivel Playtomic (0–7). Empieza con fiabilidad baja y
          se afina con tus partidos reales.
        </Text>

        {/* Sede habitual (del directorio de clubes) */}
        <Text style={styles.label}>Sede donde sueles jugar (opcional)</Text>
        <Pressable
          style={[styles.input, styles.pickerRow]}
          onPress={() => setVenuePickerOpen(true)}
        >
          <Text style={homeClub ? styles.pickerValue : styles.pickerPlaceholder} numberOfLines={1}>
            {homeClub || 'Elige tu club'}
          </Text>
          <IconChevron size={16} color={Colors.textFaint} />
        </Pressable>

        <Pressable
          style={[styles.cta, (!canSubmit || saving) && styles.ctaDisabled]}
          onPress={submit}
          disabled={!canSubmit || saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <Text style={styles.ctaTxt}>Entrar a TACTIUM</Text>
          )}
        </Pressable>
      </ScrollView>

      <VenuePicker
        open={venuePickerOpen}
        onClose={() => setVenuePickerOpen(false)}
        onSelect={(v) => setHomeClub(v.name)}
        title="Tu sede habitual"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 22 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.4, color: Colors.accent, fontWeight: '500' },
  title: { color: Colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 2 },
  lede: { color: Colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 12 },

  label: { color: Colors.text, fontSize: 14, fontWeight: '700', marginTop: 24, marginBottom: 10 },
  input: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    color: Colors.text,
    fontSize: 15,
  },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pickerValue: { color: Colors.text, fontSize: 15, flex: 1 },
  pickerPlaceholder: { color: Colors.textFaint, fontSize: 15, flex: 1 },

  segRow: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
  },
  segBtnActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent + '66' },
  segTxt: { color: Colors.textMuted, fontSize: 14, fontWeight: '700' },
  segTxtActive: { color: Colors.accent },

  stepperWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  stepBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { color: Colors.accent, fontSize: 28, fontWeight: '600' },
  levelDisplay: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.accent + '44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNum: { color: Colors.text, fontSize: 24, fontWeight: '800', letterSpacing: 1 },
  levelScale: { color: Colors.textFaint, fontSize: 11, fontFamily: Fonts.mono, marginTop: 1 },

  quiz: { marginTop: 12 },
  quizQ: { color: Colors.textMuted, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  quizOpts: { flexDirection: 'row', gap: 6 },
  quizOpt: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 10,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
  },
  quizOptActive: { backgroundColor: Colors.accent + '22', borderColor: Colors.accent + '66' },
  quizOptTxt: { color: Colors.textMuted, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  quizOptTxtActive: { color: Colors.accent },
  estimate: { color: Colors.text, fontSize: 14, marginTop: 4 },
  estimateNum: { color: Colors.accent, fontWeight: '800' },
  estimateHint: { color: Colors.textFaint, fontSize: 13, marginTop: 4 },

  hint: { color: Colors.textFaint, fontSize: 12, lineHeight: 18, marginTop: 12 },

  cta: {
    marginTop: 28,
    height: 54,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.5 },
  ctaTxt: { color: Colors.textInverse, fontSize: 15, fontWeight: '700' },
});
