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

import { useColors, type Palette } from '@core/theme';
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
  IconSearch,
} from '@components/ui';
import {
  FEDERATIONS,
  COMPETITION_PRESETS,
  type Federation,
  type TeamGender,
  type CompetitionKind,
  getCompetitionPreset,
  getCourtsForCompetition,
  composeCustomLeague,
  describeCompetitionFormat,
} from '@core/data/federations';
import { useTeamStore } from '@store/teamStore';
import { useAuthStore } from '@store/authStore';
import { useClubStore } from '@store/clubStore';
import { FcpImportSheet } from '@features/club/components/FcpImportSheet';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { startOnboardingTrial } from '@core/services/subscriptions';
import {
  OnboardingProgress,
  ProgressAction,
} from '@features/onboarding/components/OnboardingProgress';

import type { OnboardingStackScreenProps } from '@navigation/types';

const CATS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª'];
const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const GENDERS: { id: TeamGender; label: string }[] = [
  { id: 'masculino', label: 'Masculino' },
  { id: 'femenino', label: 'Femenino' },
  { id: 'mixto', label: 'Mixto' },
];

export const CreateTeamScreen = ({
  navigation,
  route,
}: OnboardingStackScreenProps<'CreateTeam'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const createTeam = useTeamStore((s) => s.createTeam);
  const beginOnboarding = useTeamStore((s) => s.beginOnboarding);
  const signOut = useAuthStore((s) => s.signOut);
  const [fcpOpen, setFcpOpen] = useState(false);
  const clubId = route.params?.clubId;

  // Importar de la Federación Cántabra AL CREAR el equipo es gratis: la prueba
  // sin tarjeta arranca en este mismo paso, y cobrar el volcado un minuto
  // antes era la peor primera impresión. Fuera del onboarding el volcado de
  // plantilla sigue siendo premium (usePremiumGate en Equipo).
  const openFcpImport = () => {
    setComp('federada');
    setFederation(FEDERATIONS.find((f) => f.code === FCP_FEDERATION_CODE) ?? null);
    // La importación crea el equipo por API y recarga con `loadForUser`: sin
    // esto la raíz saltaría a la app en cuanto aparece el equipo.
    beginOnboarding();
    setFcpOpen(true);
  };
  // Tras importar: arranca la prueba (equipo independiente) y sigue al paso 2
  // con la plantilla ya marcada como hecha.
  const onFcpImported = (_teams: number, players: number) => {
    if (!clubId) {
      const uid = useAuthStore.getState().user?.id ?? null;
      if (uid) void startOnboardingTrial('user', uid, 'captain', uid);
    }
    navigation.navigate('AddPlayers', { importedPlayers: players });
  };
  // «Más opciones» (solo liga propia): partidos por jornada y orden de fuerza.
  // Plegado por defecto con los mismos valores de siempre; no se pueden
  // cambiar después en los ajustes del equipo, por eso siguen aquí.
  const [moreOpen, setMoreOpen] = useState(false);
  const parentClub = useClubStore((s) =>
    clubId ? s.clubs.find((c) => c.id === clubId) ?? null : null,
  );

  const [name, setName] = useState('');
  // Tipo de competición: federada (default) / SNP / SNP Seniors / LAPI /
  // personalizada. Los presets no federados escriben un valor canónico
  // en team.league que el motor de reglas ya interpreta (sin migración).
  const [comp, setComp] = useState<CompetitionKind>('federada');
  const [federation, setFederation] = useState<Federation | null>(null);
  const [federationPickerOpen, setFederationPickerOpen] = useState(false);
  // league y group son OPCIONALES en onboarding: se pueden completar luego
  // desde TeamScreen → ajustes del equipo. Reduce el form de 6 campos a 4
  // requeridos (name, federation, cat, gender) y baja la fricción en el
  // momento más sensible del funnel.
  const [league, setLeague] = useState('');
  // Plantilla personalizada ("Otra liga"): formato definido por el capitán.
  const [customCourts, setCustomCourts] = useState(3);
  const [customOrder, setCustomOrder] = useState(false);
  // Sin categoría ni género preseleccionados: el usuario debe elegir a
  // propósito (antes salía "2ª" y "masculino" por defecto y se colaban sin querer).
  const [cat, setCat] = useState('');
  const [gender, setGender] = useState<TeamGender | ''>('');
  const [group, setGroup] = useState<string>('');
  const [hasGroup, setHasGroup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const preset = getCompetitionPreset(comp);
  const isFederada = comp === 'federada';
  const isFcp = isFederada && federation?.code === FCP_FEDERATION_CODE;

  // Valor efectivo de team.league según el tipo de competición.
  const effectiveLeague = useMemo(() => {
    if (isFederada) return league.trim();
    if (preset.leagueValue) return preset.leagueValue;
    return composeCustomLeague(league, customCourts, customOrder);
  }, [isFederada, preset, league, customCourts, customOrder]);

  const effectiveFederation = isFederada ? federation?.code : undefined;

  const courts = useMemo(
    () => getCourtsForCompetition(effectiveFederation, effectiveLeague, gender || 'masculino'),
    [effectiveFederation, effectiveLeague, gender],
  );

  const formatBlurb = useMemo(
    () => describeCompetitionFormat(effectiveFederation, effectiveLeague, gender || 'masculino'),
    [effectiveFederation, effectiveLeague, gender],
  );

  const valid = useMemo(
    () =>
      Boolean(
        name.trim() &&
          (!isFederada || federation) &&
          cat &&
          gender &&
          (!hasGroup || group),
      ),
    [name, isFederada, federation, cat, gender, group, hasGroup],
  );

  const handleNext = () => {
    if (!valid || submitting) return;

    const teamData = {
      name: name.trim(),
      federation: effectiveFederation,
      league: effectiveLeague || undefined,
      category: cat,
      group: hasGroup ? group : undefined,
      gender: gender as TeamGender, // `valid` garantiza que hay género elegido
    };

    // El 1er equipo es GRATIS: lo creamos directamente, sin paywall. Si es un
    // equipo INDEPENDIENTE, arrancamos además la prueba de 14 días sin tarjeta
    // (best-effort: si falla, el alta sigue). Los de un club existente heredan
    // la sub del club, no abren prueba propia.
    setSubmitting(true);
    (async () => {
      try {
        await createTeam(clubId ? { ...teamData, clubId } : teamData);
        if (!clubId) {
          const uid = useAuthStore.getState().user?.id ?? null;
          if (uid) void startOnboardingTrial('user', uid, 'captain', uid);
        }
        navigation.navigate('AddPlayers');
      } catch (e: any) {
        Alert.alert('Error al crear equipo', e?.message ?? 'Inténtalo de nuevo.');
      } finally {
        setSubmitting(false);
      }
    })();
  };

  // Chips de selección única (competición, categoría, grupo…): mismo aspecto
  // en todo el formulario.
  const chipSel = (sel: boolean) =>
    sel ? { backgroundColor: c.accent, borderColor: c.accent } : null;
  const chipText = (sel: boolean) => ({ color: sel ? c.textInverse : c.text });

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <AmbientBackdrop intensity={0.6} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <OnboardingProgress
          step={1}
          right={
            navigation.canGoBack() ? (
              <ProgressAction label="‹ Atrás" onPress={() => navigation.goBack()} />
            ) : (
              <ProgressAction
                label="Salir"
                onPress={() =>
                  Alert.alert('Cerrar sesión', '¿Salir y volver a iniciar sesión?', [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Salir', style: 'destructive', onPress: () => signOut() },
                  ])
                }
              />
            )
          }
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {parentClub ? `Primer equipo de ${parentClub.name}` : 'Tu equipo'}
        </Text>

        {/* Atajo destacado: búscate en la federación y nos ahorramos el
            formulario (categoría, grupo y plantilla con puntos oficiales). */}
        <Pressable
          onPress={openFcpImport}
          accessibilityRole="button"
          style={({ pressed }) => [styles.fcpCard, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.fcpCardTitle}>¿Juegas en la Liga Cántabra?</Text>
          <Text style={styles.fcpCardText}>
            Búscate y rellenamos categoría, grupo y plantilla con los puntos
            oficiales.
          </Text>
          <View style={styles.fcpSearch}>
            <IconSearch size={15} color={c.textFaint} />
            <Text style={styles.fcpSearchText}>Nombre del equipo o del club…</Text>
          </View>
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>o</Text>
          <View style={styles.orLine} />
        </View>

        <Section label="Nombre del equipo">
          <View style={styles.nameInput}>
            <View style={styles.accentBar} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Smash A"
              placeholderTextColor={c.textFaint}
              maxLength={50}
              autoCapitalize="words"
              style={styles.nameInputField}
            />
          </View>
        </Section>

        <Section label="Competición">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catScrollContent}
          >
            {COMPETITION_PRESETS.map((p) => {
              const sel = comp === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setComp(p.id)}
                  style={[styles.compCell, chipSel(sel)]}
                >
                  <Text style={[styles.compCellText, chipText(sel)]}>{p.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.compBlurb}>{preset.blurb}</Text>
        </Section>

        {isFederada ? (
          <>
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
                <IconChevron size={14} color={c.textFaint} />
              </Pressable>
            </Section>

            {!isFcp ? (
              <Section label="Liga · Opcional">
                <PlainInput
                  value={league}
                  onChangeText={setLeague}
                  placeholder="Liga por equipos absoluta"
                />
              </Section>
            ) : null}
          </>
        ) : null}

        {comp === 'personalizada' ? (
          <Section label="Nombre de la liga · Opcional">
            <PlainInput
              value={league}
              onChangeText={setLeague}
              placeholder="Liga interempresas, liga del club…"
            />
          </Section>
        ) : null}

        <Section label="Categoría">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catScrollContent}
          >
            {CATS.map((catValue) => {
              const sel = cat === catValue;
              return (
                <Pressable
                  key={catValue}
                  onPress={() => setCat(catValue)}
                  style={[styles.catCell, styles.catScrollCell, chipSel(sel)]}
                >
                  <Text style={[styles.catCellText, chipText(sel)]}>{catValue}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>

        <Section label="Género">
          <View style={styles.catGrid}>
            {GENDERS.map((g) => {
              const sel = gender === g.id;
              return (
                <Pressable
                  key={g.id}
                  onPress={() => setGender(g.id)}
                  style={[styles.catCell, chipSel(sel)]}
                >
                  <Text style={[styles.catCellText, { fontSize: 14 }, chipText(sel)]}>
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
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catScrollContent}
            >
              {GROUPS.map((g) => {
                const sel = group === g;
                return (
                  <Pressable
                    key={g}
                    onPress={() => setGroup(g)}
                    style={[styles.catCell, styles.catScrollCell, chipSel(sel)]}
                  >
                    <Text style={[styles.catCellText, chipText(sel)]}>{g}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
        </Section>

        {comp === 'personalizada' ? (
          <>
            <Pressable
              onPress={() => setMoreOpen((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: moreOpen }}
              style={styles.moreToggle}
            >
              <Text style={styles.moreToggleText}>Más opciones</Text>
              <View style={{ transform: [{ rotate: moreOpen ? '90deg' : '0deg' }] }}>
                <IconChevron size={13} color={c.textMuted} />
              </View>
            </Pressable>
            {moreOpen ? (
              <>
                <Section label="Partidos por jornada">
                  <View style={styles.catGrid}>
                    {[2, 3, 4, 5].map((n) => {
                      const sel = customCourts === n;
                      return (
                        <Pressable
                          key={n}
                          onPress={() => setCustomCourts(n)}
                          style={[styles.catCell, chipSel(sel)]}
                        >
                          <Text style={[styles.catCellText, chipText(sel)]}>{n}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </Section>

                <Section
                  label="Orden de fuerza"
                  right={
                    <View style={styles.groupToggle}>
                      <Toggle value={customOrder} onChange={setCustomOrder} size="sm" />
                      <Text style={styles.groupToggleText}>
                        {customOrder ? 'Se valida' : 'Libre'}
                      </Text>
                    </View>
                  }
                >
                  <Text style={styles.compHint}>
                    {customOrder
                      ? 'La pareja 1 deberá sumar más puntos que la 2, y así sucesivamente.'
                      : 'Podrás alinear las parejas en el orden que quieras.'}
                  </Text>
                </Section>
              </>
            ) : null}
          </>
        ) : null}

        <View style={styles.preview}>
          <View style={styles.previewRow}>
            <TactiumMark size={36} gradient />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.previewName} numberOfLines={1}>
                {name || 'Sin nombre'}
              </Text>
              <Text style={styles.previewMeta} numberOfLines={1}>
                {[cat, hasGroup && `Grupo ${group}`, isFederada ? league : effectiveLeague]
                  .filter(Boolean)
                  .join(' · ') || 'Configura categoría'}
              </Text>
            </View>
            <NeonDot size={7} />
          </View>
          {(isFederada ? federation : true) ? (
            <View style={styles.previewFooter}>
              <Text style={styles.previewFooterText}>
                {isFederada && federation
                  ? `${federation.shortName} · ${federation.region} · ${formatBlurb}`
                  : `${preset.label} · ${formatBlurb}`}
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
            <ActivityIndicator color={c.textInverse} />
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

      <FcpImportSheet
        open={fcpOpen}
        clubId={clubId ?? null}
        onClose={() => setFcpOpen(false)}
        onImported={onFcpImported}
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
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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

const PlainInput: React.FC<{
  value: string;
  onChangeText: (s: string) => void;
  placeholder?: string;
}> = ({ value, onChangeText, placeholder }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
  <View style={styles.plainInput}>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.textFaint}
      style={styles.plainInputField}
    />
  </View>
  );
};

const Section: React.FC<{
  label: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ label, right, children }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
  <View style={{ marginTop: 18 }}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {right}
    </View>
    {children}
  </View>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: c.background,
  },
  header: {
    paddingHorizontal: 20,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  title: {
    color: c.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 31,
  },
  // Tarjeta destacada «¿Juegas en la Liga Cántabra?»
  fcpCard: {
    marginTop: 16,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 6,
  },
  fcpCardTitle: { color: c.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  fcpCardText: { color: c.textMuted, fontSize: 13, lineHeight: 18 },
  fcpSearch: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hairStrong,
    backgroundColor: c.bgCard,
  },
  fcpSearchText: { color: c.textFaint, fontSize: 14 },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 18,
    marginBottom: 2,
  },
  orLine: { flex: 1, height: 1, backgroundColor: c.hairStrong },
  orText: { color: c.textFaint, fontSize: 12 },
  moreToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 18,
    paddingVertical: 4,
  },
  moreToggleText: { color: c.textMuted, fontSize: 13.5, fontWeight: '600' },
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
  plainInput: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  plainInputField: {
    color: c.text,
    fontSize: 14,
    fontWeight: '500',
    paddingVertical: 0,
  },
  catGrid: {
    flexDirection: 'row',
    gap: 6,
  },
  catScrollContent: {
    flexDirection: 'row',
    gap: 6,
    paddingRight: 4,
  },
  catScrollCell: {
    flex: 0,
    width: 56,
  },
  catCell: {
    flex: 1,
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  catCellText: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  compCell: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compCellText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  compBlurb: {
    color: c.textFaint,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  compHint: {
    color: c.textMuted,
    fontSize: 12,
    lineHeight: 17,
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
    color: c.textFaint,
    textTransform: 'uppercase',
    fontWeight: '500',
  },
  groupToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupToggleText: {
    color: c.textMuted,
    fontSize: 12,
  },
  preview: {
    marginTop: 22,
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hairStrong,
    padding: 14,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
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
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: c.hair,
  },
  previewFooterText: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: c.textFaint,
    letterSpacing: 0.5,
  },
  cta: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
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
    color: c.textInverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
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
  selectorPlaceholder: {
    color: c.textFaint,
    fontSize: 14,
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
  fedRegion: {
    color: c.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
});
