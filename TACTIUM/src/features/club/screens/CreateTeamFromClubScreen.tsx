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
  Share,
} from 'react-native';
import Animated, { ZoomIn, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  AmbientBackdrop,
  IconChevron,
  Toggle,
} from '@components/ui';
import * as InvitationsApi from '@core/services/invitations';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { FcpImportSheet } from '@features/club/components/FcpImportSheet';
import { TeamCrest } from '@features/team/components/TeamCrest';
import { lightTap } from '@features/team/components/TeamMotion';
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

import type { HomeStackScreenProps } from '@navigation/types';

const CATS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª'];
const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const GENDERS: { id: TeamGender; label: string }[] = [
  { id: 'masculino', label: 'Masculino' },
  { id: 'femenino', label: 'Femenino' },
  { id: 'mixto', label: 'Mixto' },
];

export const CreateTeamFromClubScreen = ({
  navigation,
}: HomeStackScreenProps<'CreateTeamFromClub'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
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
    else setComp((prev) => (prev === 'federada' ? 'snp' : prev));
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
  // Rediseño 2026-10: lo raro va plegado en «Más ajustes» (con sus valores
  // por defecto) y, tras crear, el paso 2 es lo que de verdad falta: un
  // capitán. Antes la pantalla volvía atrás sin más.
  const [moreOpen, setMoreOpen] = useState(false);
  const [fcpOpen, setFcpOpen] = useState(false);
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null);
  const [captainCode, setCaptainCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const reduced = useReducedMotion();
  const isFcpClub = club?.federation === FCP_FEDERATION_CODE;

  useEffect(() => {
    if (!created) return;
    let alive = true;
    setCodeError(null);
    InvitationsApi.createInvitation(created.id, 'captain')
      .then((inv) => alive && setCaptainCode(inv.code))
      .catch((e: any) => alive && setCodeError(e?.message ?? 'No se pudo generar el código'));
    return () => {
      alive = false;
    };
  }, [created]);

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('HomeRoot');
  };

  const shareCaptainCode = async () => {
    if (!created || !captainCode) return;
    try {
      await Share.share({
        message: InvitationsApi.buildInviteMessage(created.name, captainCode, 'captain'),
      });
    } catch {
      /* cancelado */
    }
  };

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
          cat &&
          gender &&
          (!hasGroup || group),
      ),
    [name, cat, gender, group, hasGroup],
  );

  const handleSave = async () => {
    if (!valid || submitting || !club) return;

    // Reverse trial: crear equipos del club es LIBRE (estructura, hasta 25 por
    // el trigger DB). El tope del tier limita CUBRIR/operar, no crear — el gate
    // de cobertura se encarga al gestionar cada equipo desde el ClubDashboard.
    setSubmitting(true);
    try {
      const team = await createTeam({
        name: name.trim(),
        federation: effFederation,
        league: effLeague || undefined,
        category: cat,
        group: hasGroup ? group : undefined,
        // Género OBLIGATORIO (garantizado por `valid`): la columna es NOT NULL
        // con default 'masculino', así que si no se pide, un equipo fem/mixto se
        // guardaría como masculino en silencio.
        gender: gender ?? undefined,
        clubId: club.id,
        // No tocar el flag de onboarding: estamos creando un equipo
        // adicional desde el ClubDashboard. Si lo tocásemos, el
        // RootNavigator desmontaría MainTabs por un instante y las pilas
        // (HomeStack/Jornada/Lineup) perderían historial al remontar.
        keepOnboardingState: true,
      });
      lightTap();
      setCreated({ id: team.id, name: team.name });
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

  if (created) {
    return (
      <View style={styles.root}>
        <AmbientBackdrop intensity={0.5} />
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.stepLabel}>PASO 2 DE 2</Text>
          <Pressable onPress={close} hitSlop={10} accessibilityRole="button">
            <Text style={styles.headerLink}>Lo haré luego</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.scroll, { alignItems: 'center' }]}>
          <Animated.View
            entering={reduced ? undefined : ZoomIn.springify().damping(11).mass(0.8)}
            style={{ marginTop: 24 }}
          >
            <TeamCrest name={created.name} size={76} />
          </Animated.View>
          <Text style={[styles.title, { textAlign: 'center', marginTop: 18 }]}>
            {created.name}, creado
          </Text>
          <Text style={[styles.lede, { textAlign: 'center' }]}>
            Ahora, ¿quién lo capitanea?
          </Text>

          <View style={styles.codeCard}>
            {captainCode ? (
              <Text style={styles.code} selectable>
                {captainCode}
              </Text>
            ) : codeError ? (
              <Text style={styles.codeError}>{codeError}</Text>
            ) : (
              <ActivityIndicator color={c.accent} />
            )}
            <Text style={styles.codeSub}>Código de capitán · un solo uso</Text>
          </View>

          <Pressable
            disabled={!captainCode}
            onPress={shareCaptainCode}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.ctaBtn,
              { alignSelf: 'stretch', marginTop: 18 },
              !captainCode && { opacity: 0.4 },
              pressed && !!captainCode && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaLabel}>Enviar al capitán por WhatsApp</Text>
          </Pressable>

          <Pressable
            onPress={close}
            accessibilityRole="button"
            style={({ pressed }) => [styles.moreRow, { alignSelf: 'stretch' }, pressed && { opacity: 0.85 }]}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.moreTitle}>Lo capitaneo yo</Text>
              <Text style={styles.moreSub}>El club ya te hace capitán de sus equipos</Text>
            </View>
            <IconChevron size={14} color={c.textFaint} />
          </Pressable>
        </ScrollView>
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
        <Text style={styles.stepLabel}>PASO 1 DE 2</Text>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button">
          <Text style={styles.headerLink}>Cancelar</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Nuevo equipo del club</Text>
        <Text style={styles.lede}>
          Pertenecerá a {club.name}. En el siguiente paso le pones capitán.
        </Text>

        {isFcpClub ? (
          <>
            <Pressable
              onPress={() => setFcpOpen(true)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.fcpCard, pressed && { opacity: 0.85 }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fcpTitle}>¿Ya juega en la Liga Cántabra?</Text>
                <Text style={styles.fcpText}>
                  Búscalo y rellenamos categoría, grupo y género.
                </Text>
              </View>
              <IconChevron size={14} color={c.accent} />
            </Pressable>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>o a mano</Text>
              <View style={styles.orLine} />
            </View>
          </>
        ) : null}

        <Section label="Nombre del equipo">
          <View style={styles.nameInput}>
            <View style={styles.accentBar} />
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Equipo A"
              placeholderTextColor={c.textFaint}
              style={styles.nameInputField}
              autoFocus
            />
          </View>
        </Section>

        <Section label="Categoría">
          {/* 10 categorías no caben con flex:1; pasamos a scroll horizontal
              con cells de ancho fijo. El usuario desliza para ver hasta
              la 10ª. Sin selección por defecto: el primer tap fija el valor. */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catRowScroll}
          >
            {CATS.map((catOption) => {
              const sel = cat === catOption;
              return (
                <Pressable
                  key={catOption}
                  onPress={() => setCat(catOption)}
                  style={[
                    styles.catCellFixed,
                    sel && {
                      backgroundColor: c.accent,
                      borderColor: c.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catCellText,
                      { color: sel ? '#000' : c.text },
                    ]}
                  >
                    {catOption}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>

        <Section
          label="Género"
          right={!gender ? <Text style={styles.reqTag}>obligatorio</Text> : undefined}
        >
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
                      backgroundColor: c.accent,
                      borderColor: c.accent,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catCellText,
                      { fontSize: 14, color: sel ? '#000' : c.text },
                    ]}
                  >
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>


        <Pressable
          onPress={() => setMoreOpen((v) => !v)}
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
          style={({ pressed }) => [styles.moreRow, pressed && { opacity: 0.85 }]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.moreTitle}>Más ajustes</Text>
            <Text style={styles.moreSub} numberOfLines={1}>
              Grupo, partidos por jornada, orden de fuerza
            </Text>
          </View>
          <View style={{ transform: [{ rotate: moreOpen ? '90deg' : '0deg' }] }}>
            <IconChevron size={14} color={c.textFaint} />
          </View>
        </Pressable>
        {moreOpen ? (
          <>
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
                          backgroundColor: c.accent,
                          borderColor: c.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.compCellText,
                          { color: sel ? '#000' : c.text },
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
                      placeholderTextColor={c.textFaint}
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
                      placeholderTextColor={c.textFaint}
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
                              backgroundColor: c.accent,
                              borderColor: c.accent,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.compCellText,
                              { color: sel ? '#000' : c.text },
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
                            backgroundColor: c.accent,
                            borderColor: c.accent,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.catCellText,
                            { color: sel ? '#000' : c.text },
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
          </>
        ) : null}
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

      <FcpImportSheet
        open={fcpOpen}
        clubId={club.id}
        onClose={() => setFcpOpen(false)}
        onImported={() => {
          setFcpOpen(false);
          close();
        }}
      />
    </KeyboardAvoidingView>
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
  root: { flex: 1, backgroundColor: c.background },
  stepLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: c.accent,
    fontWeight: '500',
  },
  headerLink: { color: c.textMuted, fontSize: 14, fontWeight: '600' },
  fcpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 18,
    padding: 16,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.accent40,
    backgroundColor: c.accent10,
  },
  fcpTitle: { color: c.text, fontSize: 15, fontWeight: '700' },
  fcpText: { color: c.textMuted, fontSize: 12.5, marginTop: 3, lineHeight: 18 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 },
  orLine: { flex: 1, height: 1, backgroundColor: c.hair },
  orText: { color: c.textFaint, fontSize: 12.5 },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 22,
    padding: 14,
    borderRadius: Radius.lg,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  moreTitle: { color: c.text, fontSize: 14.5, fontWeight: '700' },
  moreSub: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
  codeCard: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: 24,
    paddingVertical: 20,
    borderRadius: Radius.lg,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    gap: 8,
  },
  code: {
    fontFamily: Fonts.mono,
    color: c.text,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 4,
  },
  codeSub: { color: c.textFaint, fontSize: 12.5 },
  codeError: { color: c.error, fontSize: 13, textAlign: 'center', paddingHorizontal: 16 },
  reqTag: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    letterSpacing: 0.5,
    color: c.warning,
    fontWeight: '700',
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
  headerTitle: {
    color: c.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  scroll: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 18 },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 2.5,
    color: c.accent,
    fontWeight: '500',
    marginBottom: 8,
  },
  title: {
    color: c.text,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.6,
    lineHeight: 30,
    marginBottom: 6,
  },
  lede: { color: c.textMuted, fontSize: 13, lineHeight: 19 },
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
  catGrid: { flexDirection: 'row', gap: 6 },
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
  // Variante para scroll horizontal: ancho fijo en vez de flex:1, así
  // las 10 categorías se desplazan limpiamente.
  catRowScroll: { gap: 6, paddingRight: 8 },
  catCellFixed: {
    width: 64,
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
  federationReadonly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hair,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 54,
    opacity: 0.92,
  },
  federationLockedHint: {
    fontFamily: Fonts.mono,
    fontSize: 9,
    letterSpacing: 1.4,
    color: c.textFaint,
    fontWeight: '600',
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
  groupToggle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupToggleText: { color: c.textMuted, fontSize: 12 },
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
  empty: { color: c.textFaint, textAlign: 'center', fontSize: 14 },
});
