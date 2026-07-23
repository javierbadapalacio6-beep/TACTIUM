import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { displayNameOf } from '@core/utils/format';
import { toast } from '@store/toastStore';
import { signupByCode } from '@core/services/tournaments';

import type { RootStackScreenProps } from '@navigation/types';

// Disponibilidad: rejilla día × franja horaria. El jugador marca todas las
// casillas (día + hora) en las que puede jugar, para que el club vea cuándo
// encajar sus partidos. Se guarda como texto legible: "Sáb 18:00–21:00".
const DOW = [1, 2, 3, 4, 5, 6, 7];
const DOW_SHORT = ['', 'L', 'M', 'X', 'J', 'V', 'S', 'D'];
const DOW_FULL = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const FRANJAS = [
  '9:00–12:00',
  '12:00–15:00',
  '15:00–18:00',
  '18:00–21:00',
  '21:00–00:00',
];
const slotStr = (dow: number, franja: string) => `${DOW_FULL[dow]} ${franja}`;

export const TournamentSignupScreen = ({
  navigation,
  route,
}: RootStackScreenProps<'TournamentSignup'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);

  const [code, setCode] = useState(route.params?.code ?? '');
  const [p1, setP1] = useState(user ? displayNameOf(user) : '');
  const [p1Email, setP1Email] = useState(
    (user?.email as string | undefined) ?? '',
  );
  const [p1Phone, setP1Phone] = useState('');
  const [p2, setP2] = useState('');
  const [avail, setAvail] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const toggleSlot = (dow: number, franja: string) => {
    const s = slotStr(dow, franja);
    setAvail((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };
  const toggleFranjaWeek = (franja: string) => {
    const all = DOW.map((d) => slotStr(d, franja));
    const allSel = all.every((s) => avail.includes(s));
    setAvail((prev) =>
      allSel
        ? prev.filter((s) => !all.includes(s))
        : Array.from(new Set([...prev, ...all])),
    );
  };

  const valid = code.trim().length >= 4 && p1.trim() && p2.trim();

  const save = async () => {
    if (!valid) {
      toast.error('Rellena código, tu nombre y el de tu compañero');
      return;
    }
    setSaving(true);
    try {
      await signupByCode({
        code,
        p1Name: p1,
        p1Email: p1Email || undefined,
        p1Phone: p1Phone || undefined,
        p2Name: p2,
        availability: avail,
      });
      toast.success('¡Inscripción hecha!', 'El club te confirmará el cuadro.');
      navigation.goBack();
    } catch (e: any) {
      toast.error('No se pudo inscribir', e?.message ?? 'Revisa el código.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.6 }]}
        >
          <IconBack size={20} color={c.text} />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>TORNEO</Text>
          <Text style={styles.title}>Apuntarme</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.label}>CÓDIGO DEL TORNEO</Text>
        <View style={styles.input}>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/\s/g, ''))}
            placeholder="ABC123"
            placeholderTextColor={c.textFaint}
            style={[styles.inputField, { fontFamily: Fonts.mono, letterSpacing: 3 }]}
            autoCapitalize="characters"
            maxLength={8}
          />
        </View>

        <Text style={styles.label}>TU NOMBRE</Text>
        <View style={styles.input}>
          <TextInput value={p1} onChangeText={setP1} placeholder="Tu nombre" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={40} />
        </View>

        <View style={styles.two}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>TU EMAIL</Text>
            <View style={styles.input}>
              <TextInput value={p1Email} onChangeText={setP1Email} placeholder="opcional" placeholderTextColor={c.textFaint} style={styles.inputField} keyboardType="email-address" autoCapitalize="none" />
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>TU TELÉFONO</Text>
            <View style={styles.input}>
              <TextInput value={p1Phone} onChangeText={setP1Phone} placeholder="opcional" placeholderTextColor={c.textFaint} style={styles.inputField} keyboardType="phone-pad" />
            </View>
          </View>
        </View>

        <Text style={styles.label}>TU COMPAÑERO/A</Text>
        <View style={styles.input}>
          <TextInput value={p2} onChangeText={setP2} placeholder="Nombre de tu pareja" placeholderTextColor={c.textFaint} style={styles.inputField} maxLength={40} />
        </View>

        <Text style={styles.label}>DISPONIBILIDAD</Text>
        <Text style={styles.availHint}>
          Marca cuándo puedes jugar. Toca la franja para marcar toda la semana.
        </Text>
        {FRANJAS.map((franja) => {
          const all = DOW.map((d) => slotStr(d, franja));
          const allSel = all.every((s) => avail.includes(s));
          return (
            <View key={franja} style={styles.franjaBlock}>
              <Pressable onPress={() => toggleFranjaWeek(franja)} hitSlop={6}>
                <Text
                  style={[styles.franjaLabel, allSel && { color: c.accent }]}
                >
                  {franja}
                </Text>
              </Pressable>
              <View style={styles.dayRow}>
                {DOW.map((d) => {
                  const sel = avail.includes(slotStr(d, franja));
                  return (
                    <Pressable
                      key={d}
                      onPress={() => toggleSlot(d, franja)}
                      style={[
                        styles.dayCell,
                        sel && { backgroundColor: c.accent, borderColor: c.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayCellText,
                          { color: sel ? c.textInverse : c.text },
                        ]}
                      >
                        {DOW_SHORT[d]}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={save}
          disabled={!valid || saving}
          style={({ pressed }) => [
            styles.saveBtn,
            (!valid || saving) && { opacity: 0.5 },
            pressed && { opacity: 0.85 },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={c.textInverse} />
          ) : (
            <Text style={styles.saveLabel}>Apuntarme al torneo</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
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
    label: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
      marginTop: 16,
      marginBottom: 8,
    },
    input: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingHorizontal: 14,
      minHeight: 50,
      justifyContent: 'center',
    },
    inputField: { color: c.text, fontSize: 15, fontWeight: '500', paddingVertical: 0 },
    two: { flexDirection: 'row', gap: 12 },
    availHint: { color: c.textMuted, fontSize: 12, marginTop: -2, marginBottom: 10, lineHeight: 17 },
    franjaBlock: { marginBottom: 12 },
    franjaLabel: {
      fontFamily: Fonts.mono,
      fontSize: 13,
      fontWeight: '700',
      color: c.text,
      marginBottom: 6,
    },
    dayRow: { flexDirection: 'row', gap: 6 },
    dayCell: {
      flex: 1,
      height: 40,
      borderRadius: Radius.sm,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayCellText: { fontFamily: Fonts.mono, fontSize: 13, fontWeight: '700' },
    footer: {
      paddingHorizontal: 22,
      paddingTop: 10,
      borderTopWidth: 1,
      borderColor: c.hair,
      backgroundColor: c.background,
    },
    saveBtn: { height: 52, borderRadius: Radius.lg, backgroundColor: c.accent, alignItems: 'center', justifyContent: 'center' },
    saveLabel: { color: c.textInverse, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  });
