import React, { useMemo, useState, useEffect, useRef } from 'react';
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

import { useColors, type Palette } from '@core/theme';
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
import { useSubscriptionStore } from '@store/subscriptionStore';
import { PLAN_BY_TIER, PREMIUM_STATUSES } from '@core/subscriptions/plans';
import type { TeamGender } from '@core/services/teams';
import {
  COMPETITION_PRESETS,
  type CompetitionKind,
  getCompetitionPreset,
  composeCustomLeague,
  describeCompetitionFormat,
} from '@core/data/federations';

import { FcpImportSheet } from '@features/club/components/FcpImportSheet';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import { useHasActiveSub } from '@core/hooks/usePremiumGate';

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
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);
  const teams = useTeamStore((s) => s.teams);
  const createTeam = useTeamStore((s) => s.createTeam);
  const finishOnboarding = useTeamStore((s) => s.finishOnboarding);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  const clubTeams = club ? teams.filter((t) => t.club_id === club.id) : [];

  // Plan activo del club + cuántos equipos cubre. El paywall del onboarding
  // ya creó la sub justo antes de llegar aquí, así que esperamos encontrarla.
  // Mismo patrón que CreateTeamFromClubScreen post-onboarding — sin ello,
  // el usuario podía crear N equipos saltándose el quota del plan.
  const clubSub = useMemo(() => {
    if (!club) return null;
    return (
      subscriptions
        .filter(
          (s) =>
            s.subject_type === 'club' &&
            s.subject_id === club.id &&
            PREMIUM_STATUSES.includes(s.status),
        )
        .sort(
          (a, b) =>
            new Date(b.current_period_end).getTime() -
            new Date(a.current_period_end).getTime(),
        )[0] ?? null
    );
  }, [subscriptions, club]);
  const currentPlan = clubSub ? PLAN_BY_TIER[clubSub.plan_tier] : null;
  // Reverse trial: el club monta su estructura LIBRE (hasta 25, tope de
  // cordura). El tier es cobertura/pricing blanda; la monetización va por los
  // gates de operación (invitar, temporada, jornada, alineación, resultados).
  const MAX_CLUB_TEAMS = 25;
  const quotaReached = clubTeams.length >= MAX_CLUB_TEAMS;

  const [adding, setAdding] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  // Federación Cántabra: onboarding AUTOMÁTICO por importación (no manual).
  const isFcp = club?.federation === FCP_FEDERATION_CODE;
  const [fcpOpen, setFcpOpen] = useState(false);
  const fcpAutoOpened = useRef(false);
  // El volcado desde la Federación es premium. Con sub: se auto-abre (conveniencia
  // para clubes FCP). Sin sub: NO auto-abrimos ni soltamos un Alert sorpresa —
  // el usuario ve el banner y al tocarlo recibe el aviso con opción de omitir.
  const hasSub = useHasActiveSub();
  useEffect(() => {
    if (isFcp && hasSub && !fcpAutoOpened.current && clubTeams.length === 0) {
      fcpAutoOpened.current = true;
      setFcpOpen(true);
    }
  }, [isFcp, hasSub, clubTeams.length]);
  const requestFcpImport = () => {
    if (hasSub) {
      setFcpOpen(true);
      return;
    }
    Alert.alert(
      'Volcado automático',
      'Crea todos los equipos del club con la plantilla y los puntos oficiales de la Federación — es una función premium. Empieza tu prueba gratis para usarlo, o crea los equipos a mano ahora.',
      [
        { text: 'A mano', style: 'cancel' },
        {
          text: 'Empezar prueba',
          onPress: () =>
            navigation.navigate('Paywall', { intent: 'club', optional: true }),
        },
      ],
    );
  };
  const [newName, setNewName] = useState('');
  // Tipo de competición del equipo a añadir (mismo patrón client-side que
  // CreateTeamScreen: los presets escriben un valor canónico en league).
  const [newComp, setNewComp] = useState<CompetitionKind>(
    club?.federation ? 'federada' : 'snp',
  );
  // La elección del club manda: con federación, los equipos la heredan
  // (sin selector); sin federación, "Federada" no es una opción válida.
  useEffect(() => {
    if (club?.federation) setNewComp('federada');
    else setNewComp((c) => (c === 'federada' ? 'snp' : c));
  }, [club?.federation]);
  const [newCustomCourts, setNewCustomCourts] = useState(3);
  const [newCustomOrder, setNewCustomOrder] = useState(false);
  const [newLeague, setNewLeague] = useState('');
  const [newGender, setNewGender] = useState<TeamGender>('masculino');
  const [newCat, setNewCat] = useState('2ª');
  const [newHasGroup, setNewHasGroup] = useState(false);
  const [newGroup, setNewGroup] = useState('A');

  const newPreset = getCompetitionPreset(newComp);
  const effLeague =
    newComp === 'federada'
      ? newLeague.trim()
      : newPreset.leagueValue ??
        composeCustomLeague(newLeague, newCustomCourts, newCustomOrder);
  const effFederation =
    newComp === 'federada' ? club?.federation ?? undefined : undefined;
  const formatHint = describeCompetitionFormat(effFederation, effLeague, newGender);
  const canAdd =
    newName.trim().length > 0 &&
    (newComp !== 'federada' || newLeague.trim().length > 0);

  const onAdd = async () => {
    if (!canAdd || submitting || !club) return;
    // Estructura libre: solo frenamos en el tope de cordura (25 equipos/club).
    if (quotaReached) {
      Alert.alert(
        'Máximo de equipos alcanzado',
        'Un club puede tener hasta 25 equipos.',
      );
      return;
    }
    setSubmitting(true);
    try {
      await createTeam({
        name: newName.trim(),
        federation: effFederation,
        league: effLeague || undefined,
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
          <IconBack size={20} color={c.textMuted} />
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
          {currentPlan
            ? `${String(clubTeams.length).padStart(2, '0')} / ${String(
                currentPlan.teamQuota,
              ).padStart(2, '0')} equipos`
            : `${String(clubTeams.length).padStart(2, '0')} equipos`}
        </Text>
        <Text style={styles.counterSum}>
          {currentPlan
            ? currentPlan.shortLabel.toUpperCase()
            : club.federation ?? '—'}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {isFcp ? (
          <Pressable
            onPress={requestFcpImport}
            style={({ pressed }) => [styles.fcpBanner, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.fcpBannerTitle}>Importar de la Federación Cántabra</Text>
            <Text style={styles.fcpBannerText}>
              Busca tu club y crea todos sus equipos con la plantilla y los puntos ya
              cargados. Automático, sin teclear nada.
            </Text>
          </Pressable>
        ) : null}
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
                <IconCheck size={12} color={c.accent} />
              </View>
            </View>
          ))}

          {!isFcp && (adding ? (
            <View style={styles.addInline}>
              <View style={styles.addRow}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nombre del equipo"
                  placeholderTextColor={c.textFaint}
                  autoFocus
                  style={[styles.addField, { flex: 1 }]}
                />
                <Pressable
                  onPress={onAdd}
                  disabled={submitting || !canAdd || quotaReached}
                  style={[
                    styles.confirm,
                    (!canAdd || submitting || quotaReached) && { opacity: 0.4 },
                  ]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <IconCheck size={16} color="#000" />
                  )}
                </Pressable>
              </View>

              <Text style={styles.miniLabel}>COMPETICIÓN</Text>
              {club?.federation ? (
                /* Federación elegida en el paso 1 → los equipos la heredan */
                <View style={styles.inheritedComp}>
                  <Text style={styles.inheritedCompText} numberOfLines={1}>
                    Federada · {club.federation}
                  </Text>
                  <Text style={styles.inheritedCompHint}>
                    HEREDADA DEL CLUB
                  </Text>
                </View>
              ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipScrollContent}
              >
                {COMPETITION_PRESETS.filter((p) => p.id !== 'federada').map((p) => {
                  const sel = newComp === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => setNewComp(p.id)}
                      style={[
                        styles.chipFixed,
                        sel && {
                          backgroundColor: c.accent,
                          borderColor: c.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
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
              <Text style={styles.formatHint}>{formatHint}</Text>

              {newComp === 'federada' ? (
                <TextInput
                  value={newLeague}
                  onChangeText={setNewLeague}
                  placeholder="Liga (ej. Liga Andaluza por equipos absoluta)"
                  placeholderTextColor={c.textFaint}
                  style={styles.addField}
                />
              ) : null}

              {newComp === 'personalizada' ? (
                <>
                  <TextInput
                    value={newLeague}
                    onChangeText={setNewLeague}
                    placeholder="Nombre de la liga (opcional)"
                    placeholderTextColor={c.textFaint}
                    style={styles.addField}
                  />
                  <Text style={styles.miniLabel}>PARTIDOS POR JORNADA</Text>
                  <View style={styles.chipRow}>
                    {[2, 3, 4, 5].map((n) => {
                      const sel = newCustomCourts === n;
                      return (
                        <Pressable
                          key={n}
                          onPress={() => setNewCustomCourts(n)}
                          style={[
                            styles.chip,
                            sel && {
                              backgroundColor: c.accent,
                              borderColor: c.accent,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.chipText,
                              { color: sel ? '#000' : c.text },
                            ]}
                          >
                            {n}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View style={styles.groupHeader}>
                    <Text style={styles.miniLabel}>ORDEN DE FUERZA</Text>
                    <View style={styles.groupToggle}>
                      <Toggle
                        value={newCustomOrder}
                        onChange={setNewCustomOrder}
                        size="sm"
                      />
                      <Text style={styles.groupToggleText}>
                        {newCustomOrder ? 'Se valida' : 'Libre'}
                      </Text>
                    </View>
                  </View>
                </>
              ) : null}

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
                          backgroundColor: c.accent,
                          borderColor: c.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: sel ? '#000' : c.text },
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
                {CATS.map((catValue) => {
                  const sel = newCat === catValue;
                  return (
                    <Pressable
                      key={catValue}
                      onPress={() => setNewCat(catValue)}
                      style={[
                        styles.chipFixed,
                        sel && {
                          backgroundColor: c.accent,
                          borderColor: c.accent,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: sel ? '#000' : c.text },
                        ]}
                      >
                        {catValue}
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
                            backgroundColor: c.accent,
                            borderColor: c.accent,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.chipText,
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

              {clubTeams.length > 0 ? (
                <Pressable
                  onPress={() => setAdding(false)}
                  hitSlop={6}
                  style={styles.cancelInline}
                >
                  <IconX size={12} color={c.textFaint} />
                  <Text style={styles.cancelInlineText}>Cancelar</Text>
                </Pressable>
              ) : null}
            </View>
          ) : quotaReached ? (
            // Visualmente cerrado: el usuario ve por qué no puede añadir más
            // sin tener que pulsar nada y recibir un Alert sorpresa.
            <View style={styles.quotaLockedRow}>
              <Text style={styles.quotaLockedText}>
                Has alcanzado el máximo del plan
                {currentPlan ? ` ${currentPlan.shortLabel}` : ''}.
              </Text>
              <Text style={styles.quotaLockedHint}>
                Podrás mejorar el plan después desde Perfil.
              </Text>
            </View>
          ) : (
            <Pressable onPress={() => setAdding(true)} style={styles.addRowBtn}>
              <View style={styles.idChip}>
                <IconPlus size={14} color={c.accent} />
              </View>
              <Text style={styles.addRowText}>Añadir equipo</Text>
            </Pressable>
          ))}
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

      {club ? (
        <FcpImportSheet
          open={fcpOpen}
          clubId={club.id}
          onClose={() => setFcpOpen(false)}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  center: { alignItems: 'center', justifyContent: 'center' },
  empty: { color: c.textFaint, fontSize: 14 },

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
  barDone: { backgroundColor: c.accent50 },
  barActive: {
    backgroundColor: c.accent,
    shadowColor: c.accent,
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },

  intro: { paddingHorizontal: 24, paddingTop: 22 },
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
    fontSize: 30,
    fontWeight: '600',
    letterSpacing: -0.7,
    lineHeight: 32,
    marginBottom: 6,
  },
  lede: { color: c.textMuted, fontSize: 14, lineHeight: 20 },

  fcpBanner: {
    marginBottom: 14,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    borderRadius: Radius.md,
    padding: 14,
  },
  fcpBannerTitle: { color: c.text, fontSize: 14.5, fontWeight: '800' },
  fcpBannerText: { color: c.textMuted, fontSize: 12.5, lineHeight: 18, marginTop: 4 },

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
    color: c.textMuted,
    letterSpacing: 1,
  },
  counterSum: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: c.textFaint,
    letterSpacing: 1,
  },

  scroll: { paddingHorizontal: 20, paddingBottom: 20 },
  list: {
    backgroundColor: c.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: c.hair,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  rowDivider: { borderBottomWidth: 1, borderColor: c.hair },
  idChip: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: c.primaryDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idChipText: {
    color: c.accent,
    fontFamily: Fonts.mono,
    fontSize: 12,
    fontWeight: '500',
  },
  rowName: {
    color: c.text,
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  rowMeta: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 0.4,
  },
  tickPill: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: c.accent10,
    borderWidth: 1,
    borderColor: c.accent40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addInline: {
    padding: 14,
    backgroundColor: c.bgCard2,
    gap: 10,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addField: {
    backgroundColor: c.bgRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: c.text,
    fontSize: 14,
  },
  confirm: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniLabel: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 1.4,
    fontWeight: '500',
  },
  inheritedComp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: c.bgRaised,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.hairStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inheritedCompText: {
    flex: 1,
    color: c.text,
    fontSize: 13,
    fontWeight: '600',
  },
  inheritedCompHint: {
    color: c.textFaint,
    fontSize: 9,
    letterSpacing: 1,
    fontWeight: '700',
  },
  formatHint: {
    color: c.textFaint,
    fontSize: 11,
    lineHeight: 15,
    marginTop: -2,
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
    color: c.textMuted,
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
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hairStrong,
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
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hairStrong,
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
    color: c.textFaint,
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
    color: c.accent,
    fontSize: 15,
    fontWeight: '600',
  },
  quotaLockedRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: c.hair,
    borderRadius: Radius.md,
    borderStyle: 'dashed',
    gap: 4,
  },
  quotaLockedText: {
    color: c.textMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  quotaLockedHint: {
    color: c.textFaint,
    fontSize: 11,
    lineHeight: 15,
  },

  cta: { paddingHorizontal: 20, paddingTop: 12 },
  ctaBtn: {
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: c.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: c.accent,
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
