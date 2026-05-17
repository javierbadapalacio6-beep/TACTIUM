import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useScrollToTop } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  IconPlus,
  IconChevron,
  NeonDot,
  BottomSheet,
} from '@components/ui';
import * as SeasonsApi from '@core/services/seasons';
import { useTeamStore } from '@store/teamStore';
import { toast } from '@store/toastStore';
import { usePremiumGate } from '@core/hooks/usePremiumGate';

import type { SeasonsStackScreenProps } from '@navigation/types';

export const SeasonsScreen = ({
  navigation,
}: SeasonsStackScreenProps<'SeasonsRoot'>) => {
  const insets = useSafeAreaInsets();
  const team = useTeamStore((s) => s.team);
  const gate = usePremiumGate();

  const [seasons, setSeasons] = useState<SeasonsApi.Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  // Marcamos cuando la última carga falló para mostrar empty-state con
  // botón "Reintentar" en lugar de pintar como si no hubiera temporadas
  // (que es semánticamente distinto).
  const [loadError, setLoadError] = useState(false);

  // CTA "crear temporada" envuelto en gate premium.
  const startCreating = gate(() => setCreating(true), 'season_create');

  const reload = React.useCallback(async () => {
    if (!team) return;
    setLoading(true);
    setLoadError(false);
    try {
      const list = await SeasonsApi.fetchSeasons(team.id);
      setSeasons(list);
    } catch (e: any) {
      console.warn('fetchSeasons', e);
      setLoadError(true);
      toast.error(
        'No se pudieron cargar las temporadas',
        e?.message ?? 'Comprueba tu conexión.',
      );
    } finally {
      setLoading(false);
    }
  }, [team]);

  useEffect(() => {
    reload();
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  // Scroll-to-top al pulsar la pestaña activa + al recuperar el foco
  // desde otra pantalla (tab o stack nested).
  const scrollRef = useRef<ScrollView | null>(null);
  useScrollToTop(scrollRef);
  const didMountRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (didMountRef.current) {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      } else {
        didMountRef.current = true;
      }
    }, []),
  );

  const active = seasons.filter((s) => s.active);
  const past = seasons.filter((s) => !s.active);

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>
          {team ? `${team.name.toUpperCase()} · ${team.category ?? ''}` : 'TEMPORADAS'}
        </Text>
        <Pressable
          onPress={startCreating}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Crear temporada"
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.7 }]}
        >
          <IconPlus size={16} color={Colors.accent} />
        </Pressable>
      </View>

      <View style={styles.intro}>
        <Text style={styles.title}>Temporadas</Text>
        <Text style={styles.lede}>
          Organiza ligas, playoffs y temporadas pasadas.
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scroll,
          // Reserva el alto del tab bar flotante (~64) + offset (12) + colchón (32)
          // para que el último item no quede pegado al pill cristal.
          { paddingBottom: insets.bottom + 64 + 12 + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={{ paddingVertical: 60, alignItems: 'center' }}>
            <ActivityIndicator color={Colors.accent} />
          </View>
        ) : loadError && seasons.length === 0 ? (
          // Fallo en la primera carga (sin caché previa) — distinguimos del
          // empty-state "Sin temporadas" para dejar claro que es un error
          // de red, no que no haya datos.
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No se pudieron cargar</Text>
            <Text style={styles.emptyText}>
              Comprueba tu conexión y vuelve a intentarlo.
            </Text>
            <Pressable
              onPress={reload}
              style={({ pressed }) => [
                styles.emptyCta,
                pressed && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Reintentar cargar temporadas"
            >
              <Text style={styles.emptyCtaLabel}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {active.map((s) => (
              <ActiveSeasonCard
                key={s.id}
                season={s}
                onPress={() => navigation.navigate('SeasonDetail', { id: s.id })}
              />
            ))}

            {seasons.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Sin temporadas</Text>
                <Text style={styles.emptyText}>
                  Crea la primera temporada para empezar a planificar jornadas.
                </Text>
                <Pressable
                  onPress={startCreating}
                  style={({ pressed }) => [
                    styles.emptyCta,
                    pressed && { opacity: 0.85 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Crear primera temporada"
                >
                  <IconPlus size={14} color={Colors.textInverse} />
                  <Text style={styles.emptyCtaLabel}>Crear temporada</Text>
                </Pressable>
              </View>
            ) : null}

            {past.length > 0 ? (
              <>
                <View style={styles.histHeader}>
                  <Text style={styles.histLabel}>HISTÓRICO</Text>
                  <Text style={styles.histCount}>{past.length} temp.</Text>
                </View>
                <View style={{ gap: 8 }}>
                  {past.map((s) => (
                    <PastSeasonCard
                      key={s.id}
                      season={s}
                      onPress={() => navigation.navigate('SeasonDetail', { id: s.id })}
                    />
                  ))}
                </View>
              </>
            ) : null}

            {/* Dashed "Crear nueva temporada" sólo cuando ya hay alguna —
                si la lista está vacía, la card empty ya tiene su CTA y
                duplicar botones distrae. */}
            {seasons.length > 0 ? (
              <Pressable
                onPress={startCreating}
                style={({ pressed }) => [
                  styles.dashed,
                  pressed && { opacity: 0.7 },
                ]}
              >
                <IconPlus size={14} color={Colors.accent} />
                <Text style={styles.dashedText}>Crear nueva temporada</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      <CreateSeasonSheet
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          reload();
        }}
      />
    </View>
  );
};

const ActiveSeasonCard: React.FC<{ season: SeasonsApi.Season; onPress: () => void }> = ({
  season,
  onPress,
}) => {
  const pct = season.total_matchdays
    ? Math.round((1 / season.total_matchdays) * 100)
    : 0;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.activeCard, pressed && { opacity: 0.95 }]}
    >
      <LinearGradient
        colors={[Colors.primary, Colors.bgCard2]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.activeRow}>
        <NeonDot size={6} />
        <Text style={styles.activeBadge}>ACTIVA · {season.phase.toUpperCase()}</Text>
      </View>
      <Text style={styles.activeName}>{season.name}</Text>
      <Text style={styles.activeMeta}>
        {season.category ?? '—'}
        {season.total_matchdays != null
          ? ` · ${season.total_matchdays} jornadas`
          : ''}
      </Text>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
    </Pressable>
  );
};

const PastSeasonCard: React.FC<{ season: SeasonsApi.Season; onPress: () => void }> = ({
  season,
  onPress,
}) => {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pastCard, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.pastBadge}>
        <Text style={styles.pastBadgeText}>{season.phase.slice(0, 4).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.pastName}>{season.name}</Text>
        <Text style={styles.pastMeta}>{season.category ?? '—'}</Text>
      </View>
      <IconChevron size={14} color={Colors.textFaint} />
    </Pressable>
  );
};

const PHASE_OPTIONS: { id: SeasonsApi.SeasonPhase; label: string; sub: string }[] = [
  { id: 'liga', label: 'Liga regular', sub: 'Jornadas en orden' },
  { id: 'playoff', label: 'Playoff', sub: 'Eliminatorias' },
  { id: 'mixto', label: 'Liga + Playoff', sub: 'Formato completo' },
];

const CreateSeasonSheet: React.FC<{
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, onClose, onCreated }) => {
  const team = useTeamStore((s) => s.team);
  const [name, setName] = useState('');
  const [phase, setPhase] = useState<SeasonsApi.SeasonPhase>('liga');
  // Número de jornadas: vacío por defecto. El capitán lo introduce
  // explícito; algunas ligas son 14, otras 18, otras 22 o lo que sea.
  const [matchdaysStr, setMatchdaysStr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      const yr = new Date().getFullYear();
      setName(`Temporada ${String(yr).slice(2)}/${String(yr + 1).slice(2)}`);
      setPhase('liga');
      setMatchdaysStr('');
    }
  }, [open]);

  // Parse + validación del número de jornadas. AHORA OPCIONAL — si está
  // vacío se crea la temporada sin total (null en BD). Si se rellena,
  // tiene que ser un entero entre 1 y 99.
  const matchdaysNum =
    matchdaysStr.trim() === '' ? null : Number(matchdaysStr);
  const matchdaysValid =
    matchdaysStr.trim() === '' ||
    (matchdaysNum !== null &&
      Number.isFinite(matchdaysNum) &&
      matchdaysNum >= 1 &&
      matchdaysNum <= 99);

  const canSubmit = !!team && name.trim().length > 0 && matchdaysValid;

  // Helper: insert seasons + manejo de respuesta. Encapsulado para reusar
  // en el flow normal y en el "cerrar previa + reintentar".
  const performInsert = async () => {
    await SeasonsApi.createSeason(team!.id, {
      name: name.trim(),
      category: team!.category ?? undefined,
      phase,
      total_matchdays: matchdaysNum,
      active: true,
    });
  };

  const doCreate = async () => {
    if (!team || !canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await performInsert();
      // Éxito directo → cerramos sheet vía onCreated. Reset de submitting
      // no hace falta porque el sheet se desmonta.
      onCreated();
      return;
    } catch (e: any) {
      const msg = String(e?.message ?? '');
      const isActiveConflict =
        e?.code === '23505' ||
        msg.includes('one_active_season_per_team');

      // CRÍTICO: liberar submitting ANTES de abrir el Alert. Si dejamos
      // submitting=true mientras el Alert está abierto y el user cancela,
      // el sheet queda con el spinner para siempre — bug reportado.
      setSubmitting(false);

      if (!isActiveConflict) {
        Alert.alert('Error al crear temporada', msg || 'Inténtalo de nuevo.');
        return;
      }

      // Conflict: ofrecemos cerrar la previa y reintentar.
      let current: SeasonsApi.Season | null = null;
      try {
        current = await SeasonsApi.fetchActiveSeason(team.id);
      } catch {
        // Ignoramos — fallback al mensaje genérico abajo.
      }
      if (!current) {
        Alert.alert(
          'Ya hay una temporada activa',
          'Ciérrala desde el detalle de la temporada antes de crear otra.',
        );
        return;
      }
      Alert.alert(
        'Ya hay una temporada activa',
        `Tienes "${current.name}" en curso. ¿Quieres cerrarla y crear "${name.trim()}" como nueva temporada activa?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Cerrar y crear nueva',
            style: 'destructive',
            onPress: async () => {
              setSubmitting(true);
              try {
                await SeasonsApi.closeSeason(current!.id);
                await performInsert();
                onCreated();
              } catch (e2: any) {
                Alert.alert(
                  'No se pudo crear',
                  e2?.message ?? 'Inténtalo de nuevo.',
                );
                setSubmitting(false);
              }
            },
          },
        ],
      );
    }
  };

  const submit = doCreate;

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.sheetEyebrow}>NUEVA</Text>
      <Text style={styles.sheetTitle}>Crear temporada</Text>

      <Text style={styles.sheetLabel}>NOMBRE</Text>
      <View style={styles.sheetInputWrap}>
        <View style={styles.accentBar} />
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={60}
          autoCapitalize="words"
          style={styles.sheetInput}
          placeholderTextColor={Colors.textFaint}
        />
      </View>

      <Text style={styles.sheetLabel}>FORMATO</Text>
      <View style={{ gap: 6 }}>
        {PHASE_OPTIONS.map((p) => {
          const sel = phase === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPhase(p.id)}
              style={[
                styles.phaseOption,
                sel && {
                  backgroundColor: Colors.accent10,
                  borderColor: Colors.accent50,
                },
              ]}
            >
              <View
                style={[
                  styles.radioOuter,
                  sel && {
                    backgroundColor: Colors.accent,
                    borderColor: Colors.accent,
                  },
                ]}
              >
                {sel ? <View style={styles.radioInner} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.phaseLabel}>{p.label}</Text>
                <Text style={styles.phaseSub}>{p.sub}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sheetLabel}>
        {phase === 'playoff'
          ? 'NÚMERO DE ELIMINATORIAS · OPCIONAL'
          : 'NÚMERO DE JORNADAS · OPCIONAL'}
      </Text>
      <View style={styles.sheetInputWrap}>
        <View style={styles.accentBar} />
        <TextInput
          value={matchdaysStr}
          onChangeText={(v) =>
            setMatchdaysStr(v.replace(/[^0-9]/g, '').slice(0, 2))
          }
          keyboardType="number-pad"
          placeholder={phase === 'playoff' ? 'ej. 4' : 'ej. 18'}
          placeholderTextColor={Colors.textFaint}
          style={styles.sheetInput}
          maxLength={2}
        />
      </View>

      <Pressable
        disabled={submitting || !canSubmit}
        onPress={submit}
        style={({ pressed }) => [
          styles.sheetCta,
          (submitting || !canSubmit) && { opacity: 0.4 },
          pressed && !submitting && canSubmit && { opacity: 0.85 },
        ]}
      >
        {submitting ? (
          <ActivityIndicator color="#001810" />
        ) : (
          <Text style={styles.sheetCtaLabel}>Crear temporada</Text>
        )}
      </Pressable>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.accent,
    fontWeight: '500',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intro: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  title: {
    color: Colors.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 34,
  },
  lede: {
    color: Colors.textMuted,
    fontSize: 14,
    marginTop: 8,
  },
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },
  activeCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.accent40,
    paddingHorizontal: 22,
    paddingVertical: 18,
    overflow: 'hidden',
    marginBottom: 12,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  activeBadge: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  activeName: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.7,
    lineHeight: 28,
  },
  activeMeta: {
    color: Colors.textMuted,
    fontSize: 13,
    marginTop: 4,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.black35,
    marginTop: 18,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    shadowColor: Colors.accent,
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  histHeader: {
    marginTop: 28,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  histLabel: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 3,
    color: Colors.textFaint,
    fontWeight: '500',
  },
  histCount: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    color: Colors.textFaint,
  },
  pastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  pastBadge: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.bgRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastBadgeText: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: Colors.text,
  },
  pastName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  pastMeta: {
    color: Colors.textFaint,
    fontSize: 12,
    marginTop: 2,
  },
  dashed: {
    marginTop: 14,
    paddingVertical: 16,
    borderRadius: 14,
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: Colors.hairStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  dashedText: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.hair,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  emptyCta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    height: 42,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
  },
  emptyCtaLabel: {
    color: Colors.textInverse,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
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
    marginBottom: 8,
  },
  sheetLabel: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 8,
    marginBottom: 6,
    paddingLeft: 4,
  },
  sheetInputWrap: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  accentBar: {
    width: 5,
    height: 18,
    borderRadius: 3,
    backgroundColor: Colors.accent,
  },
  sheetInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 0,
  },
  phaseOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#000',
  },
  phaseLabel: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
  },
  phaseSub: {
    color: Colors.textFaint,
    fontSize: 11,
    marginTop: 2,
  },
  sheetCta: {
    height: 52,
    marginTop: 14,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  sheetCtaLabel: {
    color: '#001810',
    fontSize: 16,
    fontWeight: '700',
  },
});
