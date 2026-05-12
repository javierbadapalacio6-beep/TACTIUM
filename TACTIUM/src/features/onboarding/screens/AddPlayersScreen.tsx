import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  AmbientBackdrop,
  IconBack,
  IconCamera,
  IconPlus,
  IconCheck,
  IconX,
  IconArrowRight,
  ScanSheet,
} from '@components/ui';
import { useTeamStore, type Side } from '@store/teamStore';
import type { ScannedPlayer } from '@core/services/imageRecognition';
import {
  NAME_MAX_LENGTH,
  isValidName,
  normalizeName,
  parsePts,
  sanitizePtsInput,
} from '@core/utils/validation';

import type { OnboardingStackScreenProps } from '@navigation/types';

const SIDES: Side[] = ['Drive', 'Revés', 'Ambos'];

export const AddPlayersScreen = ({
  navigation,
}: OnboardingStackScreenProps<'AddPlayers'>) => {
  const insets = useSafeAreaInsets();
  const players = useTeamStore((s) => s.players);
  const addPlayer = useTeamStore((s) => s.addPlayer);
  const removePlayer = useTeamStore((s) => s.removePlayer);
  const updatePlayer = useTeamStore((s) => s.updatePlayer);
  const team = useTeamStore((s) => s.team);
  const finishOnboarding = useTeamStore((s) => s.finishOnboarding);

  const [adding, setAdding] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPts, setNewPts] = useState('');
  const [newSide, setNewSide] = useState<Side>('Drive');

  // Inserción en bloque cuando el OCR devuelve la lista de jugadores. Misma
  // lógica que en TeamScreen: insertamos uno a uno para que addPlayer del
  // store mantenga sincronía con DB (y errores individuales no rompan todo).
  const handleBulkPlayers = async (scanned: ScannedPlayer[]) => {
    for (const p of scanned) {
      try {
        await addPlayer({
          name: p.name.trim(),
          pts: p.pts ?? 0,
          position: p.position ?? 'Ambos',
        });
      } catch (e) {
        // Continuamos con el resto si uno falla; el toast del store ya avisa.
        console.warn('AddPlayersScreen bulk player failed', e);
      }
    }
  };

  const total = players.reduce((a, p) => a + p.pts, 0);

  const onAdd = async () => {
    if (!isValidName(newName) || submittingAdd) return;
    setSubmittingAdd(true);
    try {
      await addPlayer({
        name: normalizeName(newName),
        // Si no introduce puntos, default 200 (es onboarding rápido).
        pts: newPts.trim() === '' ? 200 : parsePts(newPts),
        position: newSide,
      });
      setNewName('');
      setNewPts('');
      setNewSide('Drive');
      setAdding(false);
    } catch (e: any) {
      Alert.alert('Error al añadir', e?.message ?? '');
    } finally {
      setSubmittingAdd(false);
    }
  };

  const cycleSide = (id: string, current: Side) => {
    const idx = SIDES.indexOf(current);
    updatePlayer(id, { position: SIDES[(idx + 1) % SIDES.length] }).catch(() => {});
  };

  const remove = (id: string) => {
    removePlayer(id).catch((e) => Alert.alert('Error', e?.message ?? ''));
  };

  const handleFinish = () => {
    finishOnboarding();
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <AmbientBackdrop intensity={0.6} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.headerBtn}
        >
          <IconBack size={20} color={Colors.textMuted} />
        </Pressable>
        <View style={styles.progress}>
          <View style={[styles.bar, { backgroundColor: Colors.primary }]} />
          <View style={[styles.bar, styles.barActive]} />
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.eyebrow}>PASO 02 — PLANTILLA</Text>
        <Text style={styles.title}>Añade jugadores</Text>
        <Text style={styles.lede}>
          Mínimo 10 jugadores. Los puntos FEP determinan el orden de las parejas.
        </Text>

        {/* Atajo: escanear ranking FEP directamente desde onboarding.
            Mismo flow que en TeamScreen → ScanSheet con OCR. */}
        <Pressable
          onPress={() => setScanning(true)}
          accessibilityRole="button"
          accessibilityLabel="Escanear plantilla"
          style={({ pressed }) => [
            styles.scanShortcut,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={styles.scanShortcutIcon}>
            <IconCamera size={14} color={Colors.accent} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.scanShortcutTitle}>Escanear plantilla</Text>
            <Text style={styles.scanShortcutHint}>
              Importa varios jugadores de una captura del ranking
            </Text>
          </View>
          <IconArrowRight size={14} color={Colors.accent} />
        </Pressable>
      </View>

      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {String(players.length).padStart(2, '0')} / 10 mínimo
        </Text>
        <Text style={styles.counterSum}>Σ {total} pts</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.list}>
          {players.map((p, i) => (
            <View
              key={p.id}
              style={[
                styles.row,
                i < players.length - 1 && styles.rowDivider,
              ]}
            >
              <View style={styles.idChip}>
                <Text style={styles.idChipText}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowName}>{p.name}</Text>
                <Pressable
                  onPress={() => cycleSide(p.id, p.position)}
                  hitSlop={6}
                  style={styles.posBtn}
                >
                  <Text style={styles.posBtnText}>
                    {p.position.toUpperCase()}
                  </Text>
                </Pressable>
              </View>
              <View style={styles.ptsPill}>
                <Text style={styles.ptsPillText}>{p.pts}</Text>
              </View>
              <Pressable
                onPress={() => remove(p.id)}
                hitSlop={6}
                style={styles.rowBtn}
              >
                <IconX size={14} color={Colors.textFaint} />
              </Pressable>
            </View>
          ))}

          {adding ? (
            <View style={styles.addInline}>
              <View style={styles.addRow}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nombre"
                  placeholderTextColor={Colors.textFaint}
                  autoFocus
                  maxLength={NAME_MAX_LENGTH}
                  autoCapitalize="words"
                  style={[styles.addField, { flex: 1 }]}
                />
                <TextInput
                  value={newPts}
                  onChangeText={(v) => setNewPts(sanitizePtsInput(v))}
                  placeholder="Pts"
                  placeholderTextColor={Colors.textFaint}
                  keyboardType="number-pad"
                  maxLength={4}
                  style={[
                    styles.addField,
                    { width: 64, fontFamily: Fonts.mono, textAlign: 'center' },
                  ]}
                />
                <Pressable
                  onPress={onAdd}
                  disabled={submittingAdd}
                  style={styles.confirm}
                >
                  {submittingAdd ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <IconCheck size={16} color="#000" />
                  )}
                </Pressable>
              </View>
              <View style={styles.sideTabs}>
                {SIDES.map((s) => {
                  const sel = newSide === s;
                  return (
                    <Pressable
                      key={s}
                      onPress={() => setNewSide(s)}
                      style={[
                        styles.sideTab,
                        sel && { backgroundColor: Colors.accent },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sideTabText,
                          { color: sel ? '#000' : Colors.textMuted },
                        ]}
                      >
                        {s}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : (
            <Pressable onPress={() => setAdding(true)} style={styles.addRowBtn}>
              <View style={styles.idChip}>
                <IconPlus size={14} color={Colors.accent} />
              </View>
              <Text style={styles.addRowText}>Añadir jugador</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 22 }]}>
        <Pressable
          onPress={handleFinish}
          style={({ pressed }) => [styles.ctaBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.ctaLabel}>Entrar al equipo</Text>
          <IconArrowRight size={18} color="#000" />
        </Pressable>
      </View>

      <ScanSheet
        open={scanning}
        onClose={() => setScanning(false)}
        mode="ranking"
        teamName={team?.name}
        onConfirm={handleBulkPlayers}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    flexDirection: 'row',
    gap: 6,
  },
  bar: {
    width: 22,
    height: 3,
    borderRadius: 2,
  },
  barActive: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  intro: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    fontWeight: '500',
    marginBottom: 12,
  },
  title: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -0.8,
    lineHeight: 34,
    marginBottom: 8,
  },
  lede: {
    color: Colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
  },
  scanShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: Colors.accent10,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  scanShortcutIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.accent50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanShortcutTitle: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  scanShortcutHint: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  counter: {
    paddingHorizontal: 24,
    marginTop: 18,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  counterText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  counterSum: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textFaint,
    letterSpacing: 1,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  list: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderColor: Colors.hair,
  },
  idChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idChipText: {
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '500',
  },
  rowName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  posBtn: {
    alignSelf: 'flex-start',
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  posBtnText: {
    color: Colors.textFaint,
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
  },
  ptsPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: Colors.bgRaised,
  },
  ptsPillText: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Colors.text,
    letterSpacing: 0.4,
  },
  rowBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addInline: {
    padding: 14,
    backgroundColor: Colors.bgCard2,
    gap: 8,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addField: {
    backgroundColor: Colors.bgRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
    fontSize: 14,
  },
  confirm: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideTabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 3,
    borderRadius: 10,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  sideTab: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideTabText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  addRowText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  cta: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  ctaBtn: {
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaLabel: {
    color: '#000',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
