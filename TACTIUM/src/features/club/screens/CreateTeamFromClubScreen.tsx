import React, { useMemo, useState, useEffect } from 'react';
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
import {
  AmbientBackdrop,
  IconBack,
  Toggle,
} from '@components/ui';
import {
  FEDERATIONS,
  COMPETITION_PRESETS,
  type TeamGender,
  type CompetitionKind,
  getCompetitionPreset,
  composeCustomLeague,
  describeCompetitionFormat,
} from '@core/data/federations';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';

import type { ClubStackScreenProps } from '@navigation/types';

const CATS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª'];
const GROUPS = ['A', 'B', 'C', 'D'];
const GENDERS: { id: TeamGender; label: string }[] = [
  { id: 'masculino', label: 'Masculino' },
  { id: 'femenino', label: 'Femenino' },
  { id: 'mixto', label: 'Mixto' },
];

export const CreateTeamFromClubScreen = ({
  navigation,
}: ClubStackScreenProps<'CreateTeamFromClub'>) => {
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const createTeam = useTeamStore((s) => s.createTeam);

  // La federación se hereda del club: un club pertenece a una federación
  // concreta y todos sus equipos juegan bajo ella. No tiene sentido pedirla
  // de nuevo aquí. Se muestra como info readonly.
  const clubFederation = useMemo(
    () => FEDERATIONS.find((f) => f.code === club?.federation) ?? null,
    [club?.federation],
  );

  const [name, setName] = useState('');
  // Tipo de competición (F1): federada hereda la federación del club;
  // SNP/Seniors/LAPI/personalizada escriben un valor canónico en league.
  const [comp, setComp] = useState<CompetitionKind>(
    club?.federation ? 'federada' : 'snp',
  );
  // La elección del club manda (igual que en el onboarding del club).
  useEffect(() => {
    if (club?.federation) setComp('federada');
    else setComp((c) => (c === 'federada' ? 'snp' : c));
  }, [club?.federation]);
  const [customCourts, setCustomCourts] = useState(3);
  const [customOrder, setCustomOrder] = useState(false);
  const [league, setLeague] = useState('');
  // Sin valores por defecto: el usuario debe marcar conscientemente.
  // Evita errores tipo "creé el equipo en 2ª masculino porque me lo dio
  // ya seleccionado y no me di cuenta".
  const [cat, setCat] = useState<string>('');
  const [gender, setGender] = useState<TeamGender | null>(null);
  const [group, setGroup] = useState<string>('');
  // Grupo oculto por defecto. El usuario activa el toggle si su liga
  // tiene grupos (A/B/C/D). La mayoría de ligas amateurs no.
  const [hasGroup, setHasGroup] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const preset = getCompetitionPreset(comp);
  const isFederada = comp === 'federada';
  const effLeague = isFederada
    ? league.trim()
    : preset.leagueValue ??
      composeCustomLeague(league, customCourts, customOrder);
  const effFederation = isFederada ? club?.federation ?? undefined : undefined;
  const formatHint = describeCompetitionFormat(
    effFederation,
    effLeague,
    gender,
  );

  const valid = useMemo(
    () =>
      Boolean(
        name.trim() &&
          (!isFederada || league.trim()) &&
          cat &&
          (!hasGroup || group),
      ),
    [name, isFederada, league, cat, group, hasGroup],
  );

  const handleSave = async () => {
    if (!valid || submitting || !club) return;

    // Reverse trial: crear equipos del club es LIBRE (estructura, hasta 25 por
    // el trigger DB). El tope del tier limita CUBRIR/operar, no crear — el gate
    // de cobertura se encarga al gestionar cada equipo desde el ClubDashboard.
    setSubmitting(true);
    try {
      await createTeam({
        name: name.trim(),
        federation: effFederation,
        league: effLeague || undefined,
        category: cat,
        group: hasGroup ? group : undefined,
        // gender es opcional: si el usuario no marcó ninguno, no enviamos
        // el campo (createTeam lo trata como undefined).
        gender: gender ?? undefined,
        clubId: club.id,
        // No tocar el flag de onboarding: estamos creando un equipo
        // adicional desde el ClubDashboard. Si lo tocásemos, el
        // RootNavigator desmontaría MainTabs por un instante y las pilas
        // (HomeStack/Jornada/Lineup) perderían historial al remontar.
        keepOnboardingState: true,
      });
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error al crear equipo', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!club) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 18 }]}>
        <Text style={styles.empty}>Sin club activo.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <AmbientBackdrop intensity={0.5} />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('ClubRoot');
          }}
          hitSlop={10}
          style={styles.headerBtn}
        >
          <IconBack size={18} color={Colors.text} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Nuevo equipo
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>CLUB · {club.name.toUpperCase()}</Text>
        <Text style={styles.title}>Configura el equipo</Text>
        <Text style={styles.lede}>
          Pertenecerá a {club.name}. Podrás asignarle capitán después.
        </Text>

        <Section label="Nombre del equipo">
          <View style={styles.nameInput}>
            <View style={styles.accentBar} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Equipo A"
              placeholderTextColor={Colors.textFaint}
              style={styles.nameInputField}
              autoFocus
            />
          </View>
        </Section>

        <Section label="Competición">
          {club?.federation ? (
            <View style={styles.federationReadonly}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.selectorValue} numberOfLines={1}>
                  Federada{clubFederation ? ` · ${clubFederation.shortName}` : ''}
                </Text>
              </View>
              <Text style={styles.federationLockedHint}>
                HEREDADA DEL CLUB
              </Text>
            </View>
          ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRowScroll}
          >
            {COMPETITION_PRESETS.filter((p) => p.id !== 'federada').map((p) => {
              const sel = comp === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => setComp(p.id)}
                  style={[
                    styles.compCell,
                    sel && {
                      backgroundColor: Colors.accent,
                      borderColor: Colors.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.compCellText,
                      { color: sel ? '#000' : Colors.text },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          )}
          <Text style={styles.compBlurb}>
            {preset.blurb} · {formatHint}
          </Text>
        </Section>

        {isFederada ? (
          <>
            <Section label="Federación">
              <View style={styles.federationReadonly}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {clubFederation ? (
                    <>
                      <Text style={styles.selectorValue} numberOfLines={1}>
                        {clubFederation.name}
                      </Text>
                      <Text style={styles.selectorMeta}>
                        {clubFederation.region} · {clubFederation.shortName}
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.selectorPlaceholder}>
                      El club no tiene federación asignada
                    </Text>
                  )}
                </View>
                <Text style={styles.federationLockedHint}>
                  HEREDADA DEL CLUB
                </Text>
              </View>
            </Section>

            <Section label="Liga">
              <View style={styles.plainInput}>
                <TextInput
                  value={league}
                  onChangeText={setLeague}
                  placeholder="Liga por equipos absoluta"
                  placeholderTextColor={Colors.textFaint}
                  style={styles.plainInputField}
                />
              </View>
            </Section>
          </>
        ) : null}

        {comp === 'personalizada' ? (
          <>
            <Section label="Nombre de la liga · Opcional">
              <View style={styles.plainInput}>
                <TextInput
                  value={league}
                  onChangeText={setLeague}
                  placeholder="Liga interempresas, liga del club…"
                  placeholderTextColor={Colors.textFaint}
                  style={styles.plainInputField}
                />
              </View>
            </Section>

            <Section label="Partidos por jornada">
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[2, 3, 4, 5].map((n) => {
                  const sel = customCourts === n;
                  return (
                    <Pressable
                      key={n}
                      onPress={() => setCustomCourts(n)}
                      style={[
                        styles.compCell,
                        { flex: 1, paddingHorizontal: 0 },
                        sel && {
                          backgroundColor: Colors.accent,
                          borderColor: Colors.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.compCellText,
                          { color: sel ? '#000' : Colors.text },
                        ]}
                      >
                        {n}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            <Section
              label="Orden de fuerza"
              right={
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Toggle
                    value={customOrder}
                    onChange={setCustomOrder}
                    size="sm"
                  />
                  <Text style={styles.compBlurb}>
                    {customOrder ? 'Se valida' : 'Libre'}
                  </Text>
                </View>
              }
            >
              <Text style={styles.compBlurb}>
                {customOrder
                  ? 'La pareja 1 deberá sumar más puntos que la 2, y así sucesivamente.'
                  : 'Podrás alinear las parejas en el orden que quieras.'}
              </Text>
            </Section>
          </>
        ) : null}

        <Section label="Categoría">
          {/* 10 categorías no caben con flex:1; pasamos a scroll horizontal
              con cells de ancho fijo. El usuario desliza para ver hasta
              la 10ª. Sin selección por defecto: el primer tap fija el valor. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRowScroll}
          >
            {CATS.map((c) => {
              const sel = cat === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCat(c)}
                  style={[
                    styles.catCellFixed,
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
                      { fontSize: 14, color: sel ? '#000' : Colors.text },
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
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + 22 }]}>
        <Pressable
          disabled={!valid || submitting}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.ctaBtn,
            (!valid || submitting) && { opacity: 0.4 },
            pressed && valid && !submitting && { opacity: 0.85 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color="#001810" />
          ) : (
            <Text style={styles.ctaLabel}>Crear equipo</Text>
          )}
        </Pressable>
      </View>

    </KeyboardAvoidingView>
  );
};

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
  root: { flex: 1, backgroundColor: Colors.background },
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
  headerTitle: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  scroll: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18 },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2.5,
    color: Colors.accent,
    fontWeight: '500',
    marginBottom: 8,
  },
  title: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 30,
    marginBottom: 6,
  },
  lede: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
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
  catGrid: { flexDirection: 'row', gap: 6 },
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
  // Variante para scroll horizontal: ancho fijo en vez de flex:1, así
  // las 10 categorías se desplazan limpiamente.
  catRowScroll: { gap: 6, paddingRight: 8 },
  catCellFixed: {
    width: 64,
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
  compCell: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compCellText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  compBlurb: {
    color: Colors.textFaint,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 16,
  },
  federationReadonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 54,
    opacity: 0.92,
  },
  federationLockedHint: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: Colors.textFaint,
    fontWeight: '600',
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
  selectorPlaceholder: { color: Colors.textFaint, fontSize: 14 },
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
  groupToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupToggleText: { color: Colors.textMuted, fontSize: 12 },
  cta: { paddingHorizontal: 20, paddingTop: 8 },
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
  empty: { color: Colors.textFaint, textAlign: 'center', fontSize: 14 },
});
