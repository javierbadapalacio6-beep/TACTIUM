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
  IconPlus,
  IconCheck,
  IconX,
  IconArrowRight,
  Toggle,
} from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import type { TeamGender } from '@core/services/teams';

import type { OnboardingStackScreenProps } from '@navigation/types';

const CATS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª'];
const GROUPS = ['A', 'B', 'C', 'D'];
const GENDERS: { id: TeamGender; label: string }[] = [
  { id: 'masculino', label: 'Masc.' },
  { id: 'femenino', label: 'Fem.' },
  { id: 'mixto', label: 'Mixto' },
];

export const CreateTeamsForClubScreen = ({
  navigation,
}: OnboardingStackScreenProps<'CreateTeamsForClub'>) => {
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((s) => s.teams);
  const createTeam = useTeamStore((s) => s.createTeam);
  const finishOnboarding = useTeamStore((s) => s.finishOnboarding);

  const clubTeams = club ? teams.filter((t) => t.club_id === club.id) : [];

  const [adding, setAdding] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLeague, setNewLeague] = useState('');
  const [newGender, setNewGender] = useState<TeamGender>('masculino');
  const [newCat, setNewCat] = useState('2ª');
  const [newHasGroup, setNewHasGroup] = useState(false);
  const [newGroup, setNewGroup] = useState('A');

  const canAdd = newName.trim().length > 0 && newLeague.trim().length > 0;

  const onAdd = async () => {
    if (!canAdd || submitting || !club) return;
    setSubmitting(true);
    try {
      await createTeam({
        name: newName.trim(),
        federation: club.federation ?? undefined,
        league: newLeague.trim(),
        category: newCat,
        group: newHasGroup ? newGroup : undefined,
        gender: newGender,
        clubId: club.id,
      });
      setNewName('');
      setNewLeague('');
      setNewGender('masculino');
      setNewCat('2ª');
      setNewHasGroup(false);
      setNewGroup('A');
    } catch (e: any) {
      Alert.alert('Error al crear equipo', e?.message ?? '');
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinish = () => {
    if (clubTeams.length === 0) {
      Alert.alert(
        'Crea al menos un equipo',
        'Tu club necesita al menos un equipo para empezar.',
      );
      return;
    }
    finishOnboarding();
  };

  if (!club) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={styles.empty}>Sin club activo.</Text>
      </View>
    );
  }

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
          <View style={[styles.bar, styles.barDone]} />
          <View style={[styles.bar, styles.barActive]} />
        </View>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.intro}>
        <Text style={styles.eyebrow}>PASO 02 · EQUIPOS DEL CLUB</Text>
        <Text style={styles.title}>Crea tus equipos</Text>
        <Text style={styles.lede}>
          Añade todos los equipos que tendrá {club.name}. Podrás invitar al
          capitán de cada equipo más tarde.
        </Text>
      </View>

      <View style={styles.counter}>
        <Text style={styles.counterText}>
          {String(clubTeams.length).padStart(2, '0')} equipos
        </Text>
        <Text style={styles.counterSum}>{club.federation ?? '—'}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.list}>
          {clubTeams.map((t, i) => (
            <View
              key={t.id}
              style={[
                styles.row,
                i < clubTeams.length - 1 && styles.rowDivider,
              ]}
            >
              <View style={styles.idChip}>
                <Text style={styles.idChipText}>
                  {String(i + 1).padStart(2, '0')}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {t.name}
                </Text>
                <Text style={styles.rowMeta} numberOfLines={1}>
                  {[t.gender, t.category, t.group_name && `Grupo ${t.group_name}`]
                    .filter(Boolean)
                    .join(' · ') || 'Sin configurar'}
                </Text>
              </View>
              <View style={styles.tickPill}>
                <IconCheck size={12} color={Colors.accent} />
              </View>
            </View>
          ))}

          {adding ? (
            <View style={styles.addInline}>
              <View style={styles.addRow}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nombre del equipo"
                  placeholderTextColor={Colors.textFaint}
                  autoFocus
                  style={[styles.addField, { flex: 1 }]}
                />
                <Pressable
                  onPress={onAdd}
                  disabled={submitting || !canAdd}
                  style={[
                    styles.confirm,
                    (!canAdd || submitting) && { opacity: 0.4 },
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <IconCheck size={16} color="#000" />
                  )}
                </Pressable>
              </View>

              <TextInput
                value={newLeague}
                onChangeText={setNewLeague}
                placeholder="Liga (ej. Liga Andaluza por equipos absoluta)"
                placeholderTextColor={Colors.textFaint}
                style={styles.addField}
              />

              <Text style={styles.miniLabel}>GÉNERO</Text>
              <View style={styles.chipRow}>
                {GENDERS.map((g) => {
                  const sel = newGender === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => setNewGender(g.id)}
                      style={[
                        styles.chip,
                        sel && {
                          backgroundColor: Colors.accent,
                          borderColor: Colors.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: sel ? '#000' : Colors.text },
                        ]}
                      >
                        {g.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Text style={styles.miniLabel}>CATEGORÍA</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipScrollContent}
              >
                {CATS.map((c) => {
                  const sel = newCat === c;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setNewCat(c)}
                      style={[
                        styles.chipFixed,
                        sel && {
                          backgroundColor: Colors.accent,
                          borderColor: Colors.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: sel ? '#000' : Colors.text },
                        ]}
                      >
                        {c}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.groupHeader}>
                <Text style={styles.miniLabel}>GRUPO</Text>
                <View style={styles.groupToggle}>
                  <Toggle
                    value={newHasGroup}
                    onChange={setNewHasGroup}
                    size="sm"
                  />
                  <Text style={styles.groupToggleText}>
                    {newHasGroup ? 'Sí' : 'Sin grupos'}
                  </Text>
                </View>
              </View>
              {newHasGroup ? (
                <View style={styles.chipRow}>
                  {GROUPS.map((g) => {
                    const sel = newGroup === g;
                    return (
                      <Pressable
                        key={g}
                        onPress={() => setNewGroup(g)}
                        style={[
                          styles.chip,
                          sel && {
                            backgroundColor: Colors.accent,
                            borderColor: Colors.accent,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: sel ? '#000' : Colors.text },
                          ]}
                        >
                          {g}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}

              {clubTeams.length > 0 ? (
                <Pressable
                  onPress={() => setAdding(false)}
                  hitSlop={6}
                  style={styles.cancelInline}
                >
                  <IconX size={12} color={Colors.textFaint} />
                  <Text style={styles.cancelInlineText}>Cancelar</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <Pressable onPress={() => setAdding(true)} style={styles.addRowBtn}>
              <View style={styles.idChip}>
                <IconPlus size={14} color={Colors.accent} />
              </View>
              <Text style={styles.addRowText}>Añadir equipo</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 22 }]}>
        <Pressable
          onPress={handleFinish}
          disabled={clubTeams.length === 0}
          style={({ pressed }) => [
            styles.ctaBtn,
            clubTeams.length === 0 && { opacity: 0.4 },
            pressed && clubTeams.length > 0 && { opacity: 0.85 },
          ]}
        >
          <Text style={styles.ctaLabel}>Entrar al club</Text>
          <IconArrowRight size={18} color="#000" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  empty: { color: Colors.textFaint, fontSize: 14 },

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
  progress: { flexDirection: 'row', gap: 6 },
  bar: { width: 22, height: 3, borderRadius: 2 },
  barDone: { backgroundColor: Colors.accent50 },
  barActive: {
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },

  intro: { paddingHorizontal: 24, paddingTop: 22 },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    fontWeight: '500',
    marginBottom: 10,
  },
  title: {
    color: Colors.text,
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.7,
    lineHeight: 32,
    marginBottom: 6,
  },
  lede: { color: Colors.textMuted, fontSize: 14, lineHeight: 20 },

  counter: {
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  counterText: {
    fontFamily: Fonts.mono,
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  counterSum: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textFaint,
    letterSpacing: 1,
  },

  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
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
  rowDivider: { borderBottomWidth: 1, borderColor: Colors.hair },
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
  rowMeta: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.4,
  },
  tickPill: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addInline: {
    padding: 14,
    backgroundColor: Colors.bgCard2,
    gap: 10,
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
  miniLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '500',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupToggleText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipScrollContent: {
    gap: 6,
    paddingRight: 4,
  },
  chipFixed: {
    minWidth: 56,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  cancelInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 4,
    marginTop: 2,
  },
  cancelInlineText: {
    color: Colors.textFaint,
    fontSize: 12,
    fontWeight: '500',
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

  cta: { paddingHorizontal: 20, paddingTop: 12 },
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
