import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import {
  NeonDot,
  Toggle,
  AmbientBackdrop,
  BottomSheet,
  IconChevron,
  IconCheck,
} from '@components/ui';
import {
  FEDERATIONS,
  type Federation,
  type TeamGender,
  getCourtsForCompetition,
} from '@core/data/federations';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import { useClubStore } from '@store/clubStore';

import type { OnboardingStackScreenProps } from '@navigation/types';

const CATS = ['1ª', '2ª', '3ª', '4ª'];
const GROUPS = ['A', 'B', 'C', 'D'];
const GENDERS: { id: TeamGender; label: string }[] = [
  { id: 'masculino', label: 'Masculino' },
  { id: 'femenino', label: 'Femenino' },
  { id: 'mixto', label: 'Mixto' },
];

export const CreateTeamScreen = ({
  navigation,
  route,
}: OnboardingStackScreenProps<'CreateTeam'>) => {
  const insets = useSafeAreaInsets();
  const createTeam = useTeamStore((s) => s.createTeam);
  const signOut = useAuthStore((s) => s.signOut);
  const clubId = route.params?.clubId;
  const parentClub = useClubStore((s) =>
    clubId ? s.clubs.find((c) => c.id === clubId) ?? null : null,
  );

  const [name, setName] = useState('');
  const [federation, setFederation] = useState<Federation | null>(null);
  const [federationPickerOpen, setFederationPickerOpen] = useState(false);
  const [league, setLeague] = useState('');
  const [cat, setCat] = useState('2ª');
  const [gender, setGender] = useState<TeamGender>('masculino');
  const [group, setGroup] = useState<string>('A');
  const [hasGroup, setHasGroup] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const courts = useMemo(
    () => getCourtsForCompetition(federation?.code, league, gender),
    [federation, league, gender],
  );

  const valid = useMemo(
    () =>
      Boolean(
        name.trim() &&
          federation &&
          league.trim() &&
          cat &&
          (!hasGroup || group),
      ),
    [name, federation, league, cat, group, hasGroup],
  );

  const handleNext = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await createTeam({
        name: name.trim(),
        federation: federation?.code,
        league: league.trim(),
        category: cat,
        group: hasGroup ? group : undefined,
        gender,
        clubId,
      });
      navigation.navigate('AddPlayers');
    } catch (e: any) {
      Alert.alert('Error al crear equipo', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <AmbientBackdrop intensity={0.6} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerBtn} />
        <View style={styles.progress}>
          {parentClub ? (
            <>
              <View style={[styles.bar, styles.barDone]} />
              <View style={[styles.bar, styles.barActive]} />
              <View style={styles.bar} />
            </>
          ) : (
            <>
              <View style={[styles.bar, styles.barActive]} />
              <View style={styles.bar} />
            </>
          )}
        </View>
        <Pressable
          onPress={() =>
            Alert.alert('Cerrar sesión', '¿Salir y volver a iniciar sesión?', [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Salir', style: 'destructive', onPress: () => signOut() },
            ])
          }
          hitSlop={10}
          style={{ paddingHorizontal: 6 }}
        >
          <Text style={styles.exitLink}>Salir</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>
          {parentClub ? 'PASO 02 · EQUIPO DEL CLUB' : 'PASO 01 · EQUIPO'}
        </Text>
        <Text style={styles.title}>
          {parentClub
            ? `Primer equipo de ${parentClub.name}`
            : 'Crea tu equipo'}
        </Text>
        <Text style={styles.lede}>
          Configura los datos de la competición. Lo podrás editar después.
        </Text>

        <Section label="Nombre del equipo">
          <View style={styles.nameInput}>
            <View style={styles.accentBar} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Padel Club"
              placeholderTextColor={Colors.textFaint}
              style={styles.nameInputField}
            />
          </View>
        </Section>

        <Section label="Federación">
          <Pressable
            onPress={() => setFederationPickerOpen(true)}
            style={({ pressed }) => [
              styles.selector,
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              {federation ? (
                <>
                  <Text style={styles.selectorValue} numberOfLines={1}>
                    {federation.name}
                  </Text>
                  <Text style={styles.selectorMeta}>
                    {federation.region} · {federation.shortName}
                  </Text>
                </>
              ) : (
                <Text style={styles.selectorPlaceholder}>Selecciona federación</Text>
              )}
            </View>
            <IconChevron size={14} color={Colors.textFaint} />
          </Pressable>
        </Section>

        <Section label="Liga">
          <PlainInput
            value={league}
            onChangeText={setLeague}
            placeholder="Liga por equipos absoluta"
          />
        </Section>

        <Section label="Categoría">
          <View style={styles.catGrid}>
            {CATS.map((c) => {
              const sel = cat === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCat(c)}
                  style={[
                    styles.catCell,
                    sel && {
                      backgroundColor: Colors.accent,
                      borderColor: Colors.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catCellText,
                      { color: sel ? '#000' : Colors.text },
                    ]}
                  >
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section label="Género">
          <View style={styles.catGrid}>
            {GENDERS.map((g) => {
              const sel = gender === g.id;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setGender(g.id)}
                  style={[
                    styles.catCell,
                    sel && {
                      backgroundColor: Colors.accent,
                      borderColor: Colors.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catCellText,
                      { fontSize: 14 },
                      { color: sel ? '#000' : Colors.text },
                    ]}
                  >
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section
          label="Grupo"
          right={
            <View style={styles.groupToggle}>
              <Toggle value={hasGroup} onChange={setHasGroup} size="sm" />
              <Text style={styles.groupToggleText}>
                {hasGroup ? 'Sí' : 'Sin grupos'}
              </Text>
            </View>
          }
        >
          {hasGroup ? (
            <View style={styles.catGrid}>
              {GROUPS.map((g) => {
                const sel = group === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => setGroup(g)}
                    style={[
                      styles.catCell,
                      sel && {
                        backgroundColor: Colors.accent,
                        borderColor: Colors.accent,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.catCellText,
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
        </Section>

        <View style={styles.preview}>
          <View style={styles.previewRow}>
            <TactiumMark size={36} gradient />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.previewName} numberOfLines={1}>
                {name || 'Sin nombre'}
              </Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {[cat, hasGroup && `Grupo ${group}`, league]
                  .filter(Boolean)
                  .join(' · ') || 'Configura categoría'}
              </Text>
            </View>
            <NeonDot size={7} />
          </View>
          {federation ? (
            <View style={styles.previewFooter}>
              <Text style={styles.previewFooterText}>
                {federation.shortName} · {federation.region} · {courts} pistas
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 22 }]}>
        <Pressable
          disabled={!valid || submitting}
          onPress={handleNext}
          style={({ pressed }) => [
            styles.ctaBtn,
            (!valid || submitting) && { opacity: 0.4 },
            pressed && valid && !submitting && { opacity: 0.85 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#001810" />
          ) : (
            <Text style={styles.ctaLabel}>Continuar</Text>
          )}
        </Pressable>
      </View>

      <FederationPickerSheet
        open={federationPickerOpen}
        selected={federation}
        onClose={() => setFederationPickerOpen(false)}
        onPick={(f) => {
          setFederation(f);
          setFederationPickerOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
};

const FederationPickerSheet: React.FC<{
  open: boolean;
  selected: Federation | null;
  onClose: () => void;
  onPick: (f: Federation) => void;
}> = ({ open, selected, onClose, onPick }) => {
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.sheetEyebrow}>FEDERACIÓN</Text>
      <Text style={styles.sheetTitle}>Selecciona federación</Text>

      <View style={{ gap: 6 }}>
        {FEDERATIONS.map((f) => {
          const sel = selected?.code === f.code;
          return (
            <Pressable
              key={f.code}
              onPress={() => onPick(f)}
              style={[
                styles.fedRow,
                sel && {
                  backgroundColor: Colors.accent10,
                  borderColor: Colors.accent50,
                },
              ]}
            >
              <View style={styles.fedBadge}>
                <Text style={styles.fedBadgeText}>{f.shortName}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fedName} numberOfLines={1}>
                  {f.name}
                </Text>
                <Text style={styles.fedRegion}>{f.region}</Text>
              </View>
              {sel ? <IconCheck size={16} color={Colors.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
};

const PlainInput: React.FC<{
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
}> = ({ value, onChangeText, placeholder }) => (
  <View style={styles.plainInput}>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={Colors.textFaint}
      style={styles.plainInputField}
    />
  </View>
);

const Section: React.FC<{
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, right, children }) => (
  <View style={{ marginTop: 18 }}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {right}
    </View>
    {children}
  </View>
);

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
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.hairStrong,
  },
  barActive: {
    width: 28,
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  barDone: {
    backgroundColor: Colors.accent50,
  },
  scroll: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
  },
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
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.7,
    lineHeight: 30,
    marginBottom: 6,
  },
  lede: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  nameInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  accentBar: {
    width: 5,
    height: 22,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  nameInputField: {
    flex: 1,
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 0,
  },
  plainInput: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  plainInputField: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  catGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  catCell: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCellText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.textFaint,
    textTransform: 'uppercase',
    fontWeight: '500',
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
  preview: {
    marginTop: 22,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 14,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  previewName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  previewMeta: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  previewFooter: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: Colors.hair,
  },
  previewFooterText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.textFaint,
    letterSpacing: 0.5,
  },
  cta: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  ctaBtn: {
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaLabel: {
    color: '#001810',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  exitLink: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 54,
  },
  selectorValue: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  selectorMeta: {
    color: Colors.textFaint,
    fontFamily: Fonts.mono,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  selectorPlaceholder: {
    color: Colors.textFaint,
    fontSize: 14,
  },
  sheetEyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  sheetTitle: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
    marginBottom: 12,
  },
  fedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  fedBadge: {
    minWidth: 56,
    paddingHorizontal: 8,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fedBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.accent,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  fedName: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  fedRegion: {
    color: Colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
});
