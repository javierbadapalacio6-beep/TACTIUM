import React, { useMemo, useState } from 'react';
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

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import {
  AmbientBackdrop,
  BottomSheet,
  IconBack,
  IconChevron,
  IconCheck,
  NeonDot,
} from '@components/ui';
import {
  FEDERATIONS,
  type Federation,
} from '@core/data/federations';
import { useClubStore } from '@store/clubStore';

import type { OnboardingStackScreenProps } from '@navigation/types';

export const CreateClubScreen = ({
  navigation,
}: OnboardingStackScreenProps<'CreateClub'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const createClub = useClubStore((s) => s.createClub);

  const [name, setName] = useState('');
  const [federation, setFederation] = useState<Federation | null>(null);
  const [federationPickerOpen, setFederationPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // La federación es OPCIONAL: hay clubs cuyos equipos juegan solo ligas
  // privadas (SNP, LAPI, interempresas). Cada equipo elige después su
  // competición en el selector.
  const valid = useMemo(() => Boolean(name.trim()), [name]);

  const handleNext = async () => {
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      await createClub({
        name: name.trim(),
        federation: federation?.code,
      });
      // Reverse trial: entramos directos a crear el primer equipo del club
      // (gratis, 1 equipo). El paywall se disparará al añadir equipos extra
      // o al ejecutar acciones productivas (jornada, alineación, etc.).
      navigation.replace('CreateTeamsForClub');
    } catch (e: any) {
      Alert.alert('Error al crear club', e?.message ?? 'Inténtalo de nuevo.');
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
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.headerBtn}
        >
          <IconBack size={18} color={c.text} />
        </Pressable>
        <View style={styles.progress}>
          <View style={[styles.bar, styles.barActive]} />
          <View style={styles.bar} />
        </View>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>PASO 01 · CLUB</Text>
        <Text style={styles.title}>Crea tu club</Text>
        <Text style={styles.lede}>
          Empieza por la entidad. Después podrás añadir equipos y asignar capitanes.
        </Text>

        <Section label="Nombre del club">
          <View style={styles.nameInput}>
            <View style={styles.accentBar} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Padel Club"
              placeholderTextColor={c.textFaint}
              maxLength={60}
              autoCapitalize="words"
              style={styles.nameInputField}
              autoFocus
            />
          </View>
        </Section>

        <Section label="Federación · Opcional">
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
                <Text style={styles.selectorPlaceholder}>
                  Sin federación · SNP, LAPI, ligas privadas
                </Text>
              )}
            </View>
            <IconChevron size={14} color={c.textFaint} />
          </Pressable>
        </Section>

        <View style={styles.preview}>
          <View style={styles.previewRow}>
            <TactiumMark size={36} gradient />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.previewName} numberOfLines={1}>
                {name || 'Sin nombre'}
              </Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {federation
                  ? `${federation.shortName} · ${federation.region}`
                  : 'Sin federación'}
              </Text>
            </View>
            <NeonDot size={7} />
          </View>
          <View style={styles.previewFooter}>
            <Text style={styles.previewFooterText}>
              Después: tus capitanes alinean en 90 segundos.
            </Text>
          </View>
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
  onPick: (f: Federation | null) => void;
}> = ({ open, selected, onClose, onPick }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.sheetEyebrow}>FEDERACIÓN</Text>
      <Text style={styles.sheetTitle}>Selecciona federación</Text>
      <View style={{ gap: 6 }}>
        <Pressable
          onPress={() => onPick(null)}
          style={[
            styles.fedRow,
            !selected && {
              backgroundColor: c.accent10,
              borderColor: c.accent50,
            },
          ]}
        >
          <View style={styles.fedBadge}>
            <Text style={styles.fedBadgeText}>—</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.fedName} numberOfLines={1}>
              Sin federación
            </Text>
            <Text style={styles.fedRegion}>
              SNP, LAPI, interempresas, ligas de club…
            </Text>
          </View>
          {!selected ? <IconCheck size={16} color={c.accent} /> : null}
        </Pressable>
        {FEDERATIONS.map((f) => {
          const sel = selected?.code === f.code;
          return (
            <Pressable
              key={f.code}
              onPress={() => onPick(f)}
              style={[
                styles.fedRow,
                sel && {
                  backgroundColor: c.accent10,
                  borderColor: c.accent50,
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
              {sel ? <IconCheck size={16} color={c.accent} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
};

const Section: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
  <View style={{ marginTop: 18 }}>
    <Text style={styles.sectionLabel}>{label}</Text>
    <View style={{ height: 8 }} />
    {children}
  </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
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
  bar: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: c.hairStrong,
  },
  barActive: {
    width: 28,
    backgroundColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  scroll: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 18 },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: c.accent,
    fontWeight: '500',
    marginBottom: 10,
  },
  title: {
    color: c.text,
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.7,
    lineHeight: 30,
    marginBottom: 6,
  },
  lede: { color: c.textMuted, fontSize: 14, lineHeight: 20 },
  nameInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  accentBar: {
    width: 5,
    height: 22,
    borderRadius: 3,
    backgroundColor: c.accent,
  },
  nameInputField: {
    flex: 1,
    color: c.text,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 0,
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 54,
  },
  selectorValue: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  selectorMeta: {
    color: c.textFaint,
    fontFamily: Fonts.mono,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  selectorPlaceholder: { color: c.textFaint, fontSize: 14 },
  sectionLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: c.textFaint,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  preview: {
    marginTop: 22,
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hairStrong,
    padding: 14,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewName: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  previewMeta: {
    fontFamily: Fonts.mono,
    color: c.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  previewFooter: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: c.hair,
  },
  previewFooterText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: c.textFaint,
    letterSpacing: 0.5,
  },
  cta: { paddingHorizontal: 20, paddingTop: 8 },
  ctaBtn: {
    height: 54,
    borderRadius: Radius.lg,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: c.accent,
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
  sheetEyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },
  sheetTitle: {
    color: c.text,
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
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  fedBadge: {
    minWidth: 56,
    paddingHorizontal: 8,
    height: 32,
    borderRadius: 8,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fedBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.accent,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  fedName: {
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  fedRegion: { color: c.textFaint, fontSize: 11, marginTop: 2 },
});
