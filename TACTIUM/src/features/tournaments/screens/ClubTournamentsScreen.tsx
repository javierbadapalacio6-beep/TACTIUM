import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconPlus, IconChevron, IconTrophy, IconCamera, BottomSheet } from '@components/ui';
import { DateField, dateToIsoDate } from '@components/ui/DateTimeField';
import { NotificationBell } from '@features/notifications/components/NotificationBell';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { toast } from '@store/toastStore';
import {
  listTournaments,
  createTournament,
  uploadTournamentCover,
  togglePhaseDay,
  koRoundNameFromEnd,
  tournamentBucket,
  formatFee,
  type Tournament,
  isSocialFormat,
  type MatchFormat,
  type TournamentGender,
  type TournamentFormat,
  type SeedingMode,
  type PrizeEntry,
  type InfoRow,
} from '@core/services/tournaments';
import { PrizeInfoEditor } from '../components/PrizeInfoEditor';

import type { TournamentsStackScreenProps } from '@navigation/types';

const CATS = ['1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª'];

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const formatStartsOn = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
};

const GENDERS: { id: TournamentGender; label: string }[] = [
  { id: 'masculino', label: 'Masculino' },
  { id: 'femenino', label: 'Femenino' },
  { id: 'mixto', label: 'Mixto' },
];
const GENDER_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  mixto: 'Mixto',
};

const TYPES: {
  id: TournamentFormat;
  label: string;
  sub: string;
  disabled?: boolean;
}[] = [
  { id: 'ko', label: 'Eliminación directa', sub: 'Cuadro a una vida hasta la final, con cabezas de serie' },
  { id: 'ko_consolation', label: 'Eliminación + consolación', sub: 'Todos juegan ≥2: quien pierde la 1ª ronda pasa al cuadro de consolación' },
  { id: 'round_robin', label: 'Liga · todos contra todos', sub: 'Clasificación por puntos, sets y juegos' },
  { id: 'groups_ko', label: 'Grupos + eliminatorias', sub: 'Liguillas y luego cuadros oro/plata/bronce' },
  { id: 'americano', label: 'Americano', sub: 'Individual · compañeros rotan · ranking por puntos' },
  { id: 'mexicano', label: 'Mexicano', sub: 'Individual · emparejamientos por ranking cada ronda' },
];

const MATCH_FORMATS: { id: MatchFormat; label: string; sub: string }[] = [
  { id: 'bo3_stb', label: 'Mejor de 3 · super tie-break', sub: '2 sets; si 1-1, super TB a 11 (dif. 2)' },
  { id: 'bo3_full', label: 'Mejor de 3 sets', sub: '2 sets; 3º set completo si 1-1' },
  { id: 'bo1', label: '1 set', sub: 'Un solo set decide' },
];

// Cuadros que llevan formato de partido propio según el tipo de torneo
// (feedback Smash: la consolación se juega más corta que el principal). La
// clave casa con `phaseFormatGroup` del servicio: main | consol | groups.
const MATCH_FORMAT_CUADROS: Record<string, { key: string; label: string }[]> = {
  ko: [{ key: 'main', label: '' }],
  ko_consolation: [
    { key: 'main', label: 'Cuadro principal' },
    { key: 'consol', label: 'Cuadro de consolación' },
  ],
  groups_ko: [
    { key: 'groups', label: 'Fase de grupos' },
    { key: 'main', label: 'Cuadros eliminatorios' },
  ],
  round_robin: [{ key: 'groups', label: '' }],
};
const cuadrosForFormat = (f: string) => MATCH_FORMAT_CUADROS[f] ?? [{ key: 'main', label: '' }];

const STATUS_LABEL: Record<string, string> = {
  draft: 'Borrador',
  open: 'Inscripción abierta',
  in_progress: 'En juego',
  finished: 'Finalizado',
  canceled: 'Cancelado',
};

// Pasos del asistente de creación de torneo (onboarding). Formato va antes de
// Fechas para que el planificador de "días de cada fase" ya conozca las fases.
const CREATE_STEPS: { key: string; title: string; sub: string }[] = [
  { key: 'basic', title: 'Lo básico', sub: 'Portada, nombre y lugar del torneo.' },
  { key: 'format', title: 'Formato', sub: 'Tipo de torneo, formato de partido y siembra.' },
  { key: 'cats', title: 'Categorías', sub: 'Género, categorías y sus límites de nivel/puntos.' },
  { key: 'dates', title: 'Fechas', sub: 'Cuándo se juega. Si dura varios días, reparte las fases.' },
  { key: 'signup', title: 'Inscripción', sub: 'Plazas, disponibilidad horaria y cuota.' },
  { key: 'prizes', title: 'Premios e info', sub: 'Premios, datos del evento y observaciones.' },
];

export const ClubTournamentsScreen = ({
  navigation,
}: TournamentsStackScreenProps<'TournamentsRoot'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const club = useClubStore(selectActiveClub);

  const [items, setItems] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Agrupa los torneos del club por estado (calendario).
  const clubSections = useMemo(() => {
    const bucket = (t: Tournament) => tournamentBucket(t.status, t.starts_on);
    const live = items.filter((t) => bucket(t) === 'live');
    const soon = items
      .filter((t) => bucket(t) === 'upcoming')
      .sort((a, b) => (a.starts_on ?? 'z').localeCompare(b.starts_on ?? 'z'));
    const done = items
      .filter((t) => bucket(t) === 'finished')
      .sort((a, b) => (b.starts_on ?? '').localeCompare(a.starts_on ?? ''));
    return [
      { label: 'En juego', data: live },
      { label: 'Próximamente', data: soon },
      { label: 'Finalizados', data: done },
    ].filter((s) => s.data.length);
  }, [items]);

  const load = useCallback(async () => {
    if (!club) return;
    try {
      setItems(await listTournaments(club.id));
    } catch (e: any) {
      toast.error('No se pudieron cargar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [club]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <View style={styles.topbar}>
        <View style={styles.brandRow}>
          <TactiumMark size={34} gradient />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.eyebrow}>CLUB · TORNEOS</Text>
            <Text style={styles.brandName} numberOfLines={1}>
              {club?.name ?? 'Club'}
            </Text>
          </View>
        </View>
        <NotificationBell />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingBottom: insets.bottom + 64 + 12 + 32,
          }}
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => setCreating(true)}
            style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.9 }]}
          >
            <IconPlus size={16} color={c.textInverse} />
            <Text style={styles.createLabel}>Crear torneo</Text>
          </Pressable>

          {items.length === 0 ? (
            <View style={styles.empty}>
              <IconTrophy size={30} color={c.textFaint} />
              <Text style={styles.emptyTitle}>Aún no hay torneos</Text>
              <Text style={styles.emptyText}>
                Crea un torneo, comparte el código para que se apunten y la app
                arma el cuadro con las cabezas de serie.
              </Text>
            </View>
          ) : (
            <View style={{ marginTop: 10 }}>
              {clubSections.map((s) => (
                <View key={s.label} style={{ marginTop: 12 }}>
                  <Text style={styles.groupLabel}>{s.label.toUpperCase()}</Text>
                  <View style={{ gap: 10, marginTop: 8 }}>
                    {s.data.map((t) => (
                      <Pressable
                        key={t.id}
                        onPress={() =>
                          navigation.navigate('TournamentDetail', { tournamentId: t.id })
                        }
                        style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
                      >
                        {t.cover_url ? (
                          <Image source={{ uri: t.cover_url }} style={styles.cardCover} />
                        ) : null}
                        <View style={styles.cardRow}>
                          {t.cover_url ? null : (
                            <View style={styles.cardIcon}>
                              <IconTrophy size={18} color={c.accent} />
                            </View>
                          )}
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.cardName} numberOfLines={1}>
                              {t.name}
                            </Text>
                            <Text style={styles.cardMeta} numberOfLines={1}>
                              {[
                                formatStartsOn(t.starts_on),
                                t.location,
                                t.genders?.length
                                  ? t.genders.map((g) => GENDER_LABEL[g] ?? g).join(' / ')
                                  : null,
                                t.categories?.length ? t.categories.join(' / ') : null,
                                t.entry_fee ? formatFee(t.entry_fee, t.fee_currency) : null,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </Text>
                          </View>
                          <IconChevron size={16} color={c.textFaint} />
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <CreateTournamentSheet
        open={creating}
        clubId={club?.id ?? null}
        onClose={() => setCreating(false)}
        onCreated={load}
      />
    </View>
  );
};

const CreateTournamentSheet: React.FC<{
  open: boolean;
  clubId: string | null;
  onClose: () => void;
  onCreated: () => void;
}> = ({ open, clubId, onClose, onCreated }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  // Paso actual del asistente (0-indexado). Se reinicia al abrir la hoja.
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [cats, setCats] = useState<string[]>([]);
  const [genders, setGenders] = useState<TournamentGender[]>(['masculino']);
  const [format, setFormat] = useState<TournamentFormat>('ko');
  const [maxPairs, setMaxPairs] = useState('');
  const [minPairs, setMinPairs] = useState('');
  const [fee, setFee] = useState('');
  // Cuota total si el jugador se apunta a 2 categorías (solo si hay ≥2 cats).
  const [fee2, setFee2] = useState('');
  // Formato de partido por CUADRO (main | consol | groups). Cada uno por defecto
  // 'bo3_stb'; el club puede fijar la consolación más corta, etc.
  const [phaseFmt, setPhaseFmt] = useState<Record<string, MatchFormat>>({});
  const [seedingMode, setSeedingMode] = useState<SeedingMode>('points');
  // Reglas de elegibilidad por categoría (nivel/puntos).
  const [ruleMode, setRuleMode] = useState<'both' | 'points' | 'nivel'>('both');
  const [catThresh, setCatThresh] = useState<
    Record<string, { nivel: string; puntos: string }>
  >({});
  // Tope de franjas de 1h que un jugador puede quitar en la inscripción.
  const [maxRemovable, setMaxRemovable] = useState('');
  const [startsOn, setStartsOn] = useState<Date | null>(null);
  const [endsOn, setEndsOn] = useState<Date | null>(null);
  const [phasePlan, setPhasePlan] = useState<Record<string, string[]>>({});
  const [location, setLocation] = useState('');

  // Días del torneo (para el planificador de fases del formulario).
  const ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const planDays = useMemo(() => {
    if (!startsOn) return [] as { iso: string; label: string }[];
    // Normaliza a medianoche (el DateField trae hora → si no, se pierde el
    // último día cuando su hora es menor que la de inicio).
    const e0 = endsOn ?? startsOn;
    const d = new Date(startsOn.getFullYear(), startsOn.getMonth(), startsOn.getDate());
    const end = new Date(e0.getFullYear(), e0.getMonth(), e0.getDate());
    const out: { iso: string; label: string }[] = [];
    let g = 0;
    while (d.getTime() <= end.getTime() && g < 40) {
      out.push({ iso: dateToIsoDate(d), label: `${ABBR[d.getDay()]} ${d.getDate()}` });
      d.setDate(d.getDate() + 1);
      g++;
    }
    return out;
  }, [startsOn, endsOn]);
  // Fases genéricas según el formato.
  const planPhases = useMemo(() => {
    const out: { key: string; label: string }[] = [];
    if (format === 'groups_ko') out.push({ key: 'grp:0', label: 'Fase de grupos' });
    if (format === 'round_robin') out.push({ key: 'rr:0', label: 'Liga' });
    if (format === 'americano') out.push({ key: 'amer:0', label: 'Americano' });
    if (format === 'mexicano') out.push({ key: 'mex:0', label: 'Mexicano' });
    if (format === 'ko' || format === 'ko_consolation' || format === 'groups_ko')
      for (const fe of [3, 2, 1, 0]) out.push({ key: `ko:${fe}`, label: koRoundNameFromEnd(fe) });
    return out;
  }, [format]);
  const togglePlan = (key: string, iso: string) =>
    setPhasePlan((prev) => {
      const cur = prev[key] ?? [];
      const next = cur.includes(iso) ? cur.filter((x) => x !== iso) : [...cur, iso];
      const copy = { ...prev };
      if (next.length) copy[key] = next;
      else delete copy[key];
      return copy;
    });
  const [prizesJson, setPrizesJson] = useState<PrizeEntry[]>([]);
  const [infoRows, setInfoRows] = useState<InfoRow[]>([]);
  const [observations, setObservations] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Al abrir, siempre arrancar en el primer paso (los datos se conservan si se
  // cerró a medias; solo se limpian tras crear con éxito).
  React.useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const reset = () => {
    setStep(0);
    setName('');
    setCats([]);
    setGenders(['masculino']);
    setFormat('ko');
    setMaxPairs('');
    setMinPairs('');
    setFee('');
    setFee2('');
    setPhaseFmt({});
    setSeedingMode('points');
    setRuleMode('both');
    setCatThresh({});
    setMaxRemovable('');
    setStartsOn(null);
    setEndsOn(null);
    setPhasePlan({});
    setLocation('');
    setPrizesJson([]);
    setInfoRows([]);
    setObservations('');
    setCoverUri(null);
  };

  const pickCover = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Sin permiso', 'Da acceso a tus fotos para elegir una portada.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setCoverUri(result.assets[0].uri);
  };
  // Mantiene el orden canónico (CATS / GENDERS) al añadir: re-seleccionar una
  // categoría no debe mandarla al final de la lista de límites.
  const toggleCat = (v: string) =>
    setCats((prev) =>
      (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]).sort(
        (a, b) => CATS.indexOf(a) - CATS.indexOf(b),
      ),
    );
  const GENDER_ORDER = GENDERS.map((g) => g.id);
  const toggleGender = (g: TournamentGender) =>
    setGenders((prev) =>
      (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]).sort(
        (a, b) => GENDER_ORDER.indexOf(a) - GENDER_ORDER.indexOf(b),
      ),
    );

  const save = async () => {
    if (!clubId || !name.trim()) {
      toast.error('Ponle un nombre al torneo');
      return;
    }
    setSaving(true);
    try {
      let coverUrl: string | null = null;
      if (coverUri) {
        try {
          coverUrl = await uploadTournamentCover(clubId, coverUri);
        } catch (e: any) {
          toast.error('No se pudo subir la foto', e?.message ?? 'Se creará sin portada.');
        }
      }
      // Reglas de categoría (nivel/puntos). El servicio limpia las vacías.
      const byCategory: Record<
        string,
        { puntos: number | null; nivel: number | null } | null
      > = {};
      for (const cat of cats) {
        const th = catThresh[cat];
        const puntos = th?.puntos ? parseInt(th.puntos, 10) : null;
        const nivel = th?.nivel ? parseInt(th.nivel, 10) : null;
        byCategory[cat] = puntos || nivel ? { puntos: puntos || null, nivel: nivel || null } : null;
      }
      // Formato por cuadro según el tipo de torneo; el default del torneo
      // (match_format) es el del cuadro principal (o el primero si no hay 'main').
      const cuadros = cuadrosForFormat(format);
      const fmtOf = (k: string): MatchFormat => phaseFmt[k] ?? 'bo3_stb';
      const phaseFormats: Record<string, MatchFormat> = {};
      cuadros.forEach((cu) => {
        phaseFormats[cu.key] = fmtOf(cu.key);
      });
      const defaultFmt = fmtOf(phaseFormats.main ? 'main' : cuadros[0]?.key ?? 'main');
      const created = await createTournament({
        clubId,
        name: name.trim(),
        format,
        matchFormat: defaultFmt,
        phaseFormats,
        genders,
        categories: cats,
        categoryRules: { mode: ruleMode, byCategory },
        maxRemovableHours: maxRemovable ? parseInt(maxRemovable, 10) : null,
        maxPairs: maxPairs ? parseInt(maxPairs, 10) : null,
        minPairs: minPairs ? parseInt(minPairs, 10) : null,
        entryFee: fee ? parseFloat(fee) : null,
        entryFee2: fee2 ? parseFloat(fee2) : null,
        seedingMode,
        startsOn: startsOn ? dateToIsoDate(startsOn) : null,
        endsOn: endsOn ? dateToIsoDate(endsOn) : null,
        location,
        prizesJson,
        infoRows,
        observations,
        coverUrl,
      });
      // Guarda los días asignados a cada fase (si el club los eligió).
      const planEntries = Object.entries(phasePlan).flatMap(([key, isos]) => {
        const [b, r] = key.split(':');
        return isos.map((iso) => ({ b, r: parseInt(r, 10), iso }));
      });
      if (planEntries.length) {
        try {
          await Promise.all(
            planEntries.map((e) => togglePhaseDay(created.id, e.b, e.r, e.iso, true)),
          );
        } catch {
          /* no bloquea la creación; se puede reasignar en Horario */
        }
      }
      toast.success('Torneo creado', 'Comparte el código para las inscripciones.');
      reset();
      onCreated();
      onClose();
    } catch (e: any) {
      toast.error('No se pudo crear', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const lastStep = CREATE_STEPS.length - 1;
  // Validación mínima por paso para poder avanzar. Solo el nombre (paso 0) y al
  // menos un género (paso 2) son obligatorios; el resto es opcional.
  const canNext =
    step === 0 ? name.trim().length > 0 : step === 2 ? genders.length > 0 : true;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      footer={
        <View style={styles.wizFooter}>
          {step > 0 ? (
            <Pressable
              onPress={() => setStep((s) => Math.max(0, s - 1))}
              style={({ pressed }) => [styles.wizBack, pressed && { opacity: 0.7 }]}
            >
              <Text style={styles.wizBackText}>Atrás</Text>
            </Pressable>
          ) : null}
          {step < lastStep ? (
            <Pressable
              onPress={() => canNext && setStep((s) => Math.min(lastStep, s + 1))}
              disabled={!canNext}
              style={({ pressed }) => [
                styles.saveBtn,
                styles.wizNext,
                !canNext && { opacity: 0.5 },
                pressed && canNext && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.saveLabel}>Siguiente</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={save}
              disabled={saving || !name.trim()}
              style={({ pressed }) => [
                styles.saveBtn,
                styles.wizNext,
                (saving || !name.trim()) && { opacity: 0.5 },
                pressed && !saving && { opacity: 0.85 },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={c.textInverse} />
              ) : (
                <Text style={styles.saveLabel}>Crear torneo</Text>
              )}
            </Pressable>
          )}
        </View>
      }
    >
      <Text style={styles.sheetEyebrow}>
        NUEVO TORNEO · PASO {step + 1}/{CREATE_STEPS.length}
      </Text>
      <Text style={styles.sheetTitle}>{CREATE_STEPS[step].title}</Text>
      <Text style={styles.sheetSub}>{CREATE_STEPS[step].sub}</Text>

      {/* Barra de progreso por segmentos */}
      <View style={styles.progressRow}>
        {CREATE_STEPS.map((s, i) => (
          <View
            key={s.key}
            style={[styles.progressSeg, i <= step && { backgroundColor: c.accent }]}
          />
        ))}
      </View>

      {/* ── PASO 1 · LO BÁSICO ─────────────────────────────────────────── */}
      {step === 0 ? (
        <>
          <Text style={styles.label}>FOTO DE PORTADA · OPCIONAL</Text>
          <Pressable
            onPress={pickCover}
            style={({ pressed }) => [styles.coverPicker, pressed && { opacity: 0.85 }]}
          >
            {coverUri ? (
              <>
                <Image source={{ uri: coverUri }} style={styles.coverImg} />
                <View style={styles.coverEditBadge}>
                  <IconCamera size={14} color={c.textInverse} />
                  <Text style={styles.coverEditText}>Cambiar</Text>
                </View>
              </>
            ) : (
              <View style={styles.coverEmpty}>
                <IconCamera size={22} color={c.accent} />
                <Text style={styles.coverEmptyText}>Añadir foto del torneo</Text>
              </View>
            )}
          </Pressable>

          <Text style={styles.label}>NOMBRE</Text>
          <View style={styles.input}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Torneo de primavera"
              placeholderTextColor={c.textFaint}
              style={styles.inputField}
              maxLength={60}
              autoCapitalize="sentences"
            />
          </View>

          <Text style={styles.label}>LUGAR · OPCIONAL</Text>
          <View style={styles.input}>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="Club Smash · Santander"
              placeholderTextColor={c.textFaint}
              style={styles.inputField}
              maxLength={80}
              autoCapitalize="sentences"
            />
          </View>
        </>
      ) : null}

      {/* ── PASO 2 · FORMATO ───────────────────────────────────────────── */}
      {step === 1 ? (
        <>
          <Text style={styles.label}>TIPO DE TORNEO</Text>
          <View style={{ gap: 8 }}>
            {TYPES.map((ty) => {
              const sel = format === ty.id;
              return (
                <Pressable
                  key={ty.id}
                  disabled={ty.disabled}
                  onPress={() => setFormat(ty.id)}
                  style={[
                    styles.fmtRow,
                    sel && { borderColor: c.accent, backgroundColor: c.accent10 },
                    ty.disabled && { opacity: 0.5 },
                  ]}
                >
                  <View style={[styles.radio, sel && { borderColor: c.accent }]}>
                    {sel ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.fmtLabel}>{ty.label}</Text>
                    <Text style={styles.fmtSub}>{ty.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {!isSocialFormat(format) ? (
            <>
              {/* Formato de partido POR CUADRO: con consolación/grupos aparece
                  un selector por cada cuadro (p. ej. la consolación más corta);
                  con un solo cuadro, un único "FORMATO DE PARTIDO". */}
              {cuadrosForFormat(format).map((cuadro) => {
                const cur = phaseFmt[cuadro.key] ?? 'bo3_stb';
                return (
                  <View key={cuadro.key}>
                    <Text style={styles.label}>
                      {cuadro.label ? `FORMATO · ${cuadro.label.toUpperCase()}` : 'FORMATO DE PARTIDO'}
                    </Text>
                    <View style={{ gap: 8 }}>
                      {MATCH_FORMATS.map((f) => {
                        const sel = cur === f.id;
                        return (
                          <Pressable
                            key={f.id}
                            onPress={() =>
                              setPhaseFmt((prev) => ({ ...prev, [cuadro.key]: f.id }))
                            }
                            style={[
                              styles.fmtRow,
                              sel && { borderColor: c.accent, backgroundColor: c.accent10 },
                            ]}
                          >
                            <View style={[styles.radio, sel && { borderColor: c.accent }]}>
                              {sel ? <View style={styles.radioDot} /> : null}
                            </View>
                            <View style={{ flex: 1, minWidth: 0 }}>
                              <Text style={styles.fmtLabel}>{f.label}</Text>
                              <Text style={styles.fmtSub}>{f.sub}</Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </>
          ) : null}

          {format === 'ko' || format === 'ko_consolation' || format === 'groups_ko' ? (
            <>
              <Text style={styles.label}>SIEMBRA</Text>
              <View style={{ gap: 8 }}>
                {(
                  [
                    { id: 'points', label: 'Por puntos', sub: 'Orden estricto por puntos de la pareja (determinista).' },
                    { id: 'federative', label: 'Federativa (sorteo)', sub: 'Fija cabezas 1 y 2 y sortea las bandas (3-4, 5-8…). Sorteo reproducible.' },
                  ] as { id: SeedingMode; label: string; sub: string }[]
                ).map((s) => {
                  const sel = seedingMode === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      onPress={() => setSeedingMode(s.id)}
                      style={[styles.fmtRow, sel && { borderColor: c.accent, backgroundColor: c.accent10 }]}
                    >
                      <View style={[styles.radio, sel && { borderColor: c.accent }]}>
                        {sel ? <View style={styles.radioDot} /> : null}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.fmtLabel}>{s.label}</Text>
                        <Text style={styles.fmtSub}>{s.sub}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {/* ── PASO 3 · CATEGORÍAS ────────────────────────────────────────── */}
      {step === 2 ? (
        <>
          <Text style={styles.label}>GÉNERO · ELIGE UNO O VARIOS</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {GENDERS.map((g) => {
              const sel = genders.includes(g.id);
              return (
                <Pressable
                  key={g.id}
                  onPress={() => toggleGender(g.id)}
                  style={[
                    styles.genderCell,
                    sel && { backgroundColor: c.accent, borderColor: c.accent },
                  ]}
                >
                  <Text style={[styles.genderText, { color: sel ? c.textInverse : c.text }]}>
                    {g.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.label}>CATEGORÍAS · ELIGE UNA O VARIAS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 6, paddingRight: 4 }}
          >
            {CATS.map((v) => {
              const sel = cats.includes(v);
              return (
                <Pressable
                  key={v}
                  onPress={() => toggleCat(v)}
                  style={[
                    styles.catCell,
                    sel && { backgroundColor: c.accent, borderColor: c.accent },
                  ]}
                >
                  <Text style={[styles.catText, { color: sel ? c.textInverse : c.text }]}>
                    {v}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Text style={styles.catHint}>
            {cats.length > 1
              ? 'Cada categoría tendrá su propio cuadro.'
              : 'Puedes marcar varias; cada una jugará su cuadro.'}
          </Text>

          {cats.length > 0 ? (
            <>
              <Text style={styles.label}>LÍMITES POR CATEGORÍA · OPCIONAL</Text>
              <Text style={styles.catHint}>
                Restringe quién puede inscribirse. NIVEL = suma del nivel de liga de la
                pareja (mín. ≥). PUNTOS = suma de puntos (máx. ≤). Deja un campo en
                «Libre» para no limitarlo (p. ej. nivel libre pero con tope de puntos);
                una categoría con los dos en «Libre» es totalmente abierta.
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                {(
                  [
                    { id: 'both', label: 'Nivel y puntos' },
                    { id: 'points', label: 'Solo puntos' },
                    { id: 'nivel', label: 'Solo nivel' },
                  ] as { id: 'both' | 'points' | 'nivel'; label: string }[]
                ).map((m) => {
                  const sel = ruleMode === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      onPress={() => setRuleMode(m.id)}
                      style={[styles.ruleModeChip, sel && { backgroundColor: c.accent, borderColor: c.accent }]}
                    >
                      <Text style={[styles.ruleModeText, { color: sel ? c.textInverse : c.text }]}>
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={{ gap: 8, marginTop: 10 }}>
                {cats.map((cat) => {
                  const th = catThresh[cat] ?? { nivel: '', puntos: '' };
                  const setT = (patch: Partial<{ nivel: string; puntos: string }>) =>
                    setCatThresh((prev) => ({
                      ...prev,
                      [cat]: { ...(prev[cat] ?? { nivel: '', puntos: '' }), ...patch },
                    }));
                  return (
                    <View key={cat} style={styles.ruleRow}>
                      <Text style={styles.ruleCat}>{cat}</Text>
                      {ruleMode === 'nivel' || ruleMode === 'both' ? (
                        <View style={styles.ruleInputWrap}>
                          <Text style={styles.ruleInputLabel}>NIVEL ≥</Text>
                          <TextInput
                            value={th.nivel}
                            onChangeText={(v) => setT({ nivel: v.replace(/[^0-9]/g, '') })}
                            placeholder="Libre"
                            placeholderTextColor={c.accent}
                            keyboardType="number-pad"
                            style={[styles.ruleInput, !th.nivel && styles.ruleInputLibre]}
                            maxLength={3}
                          />
                        </View>
                      ) : null}
                      {ruleMode === 'points' || ruleMode === 'both' ? (
                        <View style={styles.ruleInputWrap}>
                          <Text style={styles.ruleInputLabel}>PUNTOS ≤</Text>
                          <TextInput
                            value={th.puntos}
                            onChangeText={(v) => setT({ puntos: v.replace(/[^0-9]/g, '') })}
                            placeholder="Libre"
                            placeholderTextColor={c.accent}
                            keyboardType="number-pad"
                            style={[styles.ruleInput, !th.puntos && styles.ruleInputLibre]}
                            maxLength={6}
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {/* ── PASO 4 · FECHAS ────────────────────────────────────────────── */}
      {step === 3 ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>FECHA INICIO · OPCIONAL</Text>
              <DateField
                value={startsOn}
                onChange={setStartsOn}
                placeholder="Inicio"
                allowClear
                label="INICIO DEL TORNEO"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>FECHA FIN · OPCIONAL</Text>
              <DateField
                value={endsOn}
                onChange={setEndsOn}
                placeholder="Fin (si dura varios días)"
                allowClear
                minimumDate={startsOn ?? undefined}
                label="FIN DEL TORNEO"
              />
            </View>
          </View>

          {planDays.length > 1 && planPhases.length > 0 ? (
            <>
              <Text style={styles.label}>DÍAS DE CADA FASE · OPCIONAL</Text>
              <Text style={styles.planHint}>
                Marca en qué días se juega cada fase (puedes elegir varios). Todos los
                cuadros comparten estos días. Sin marcar = cualquier día.
              </Text>
              <View style={{ gap: 10 }}>
                {planPhases.map((ph) => {
                  const sel = phasePlan[ph.key] ?? [];
                  return (
                    <View key={ph.key} style={{ gap: 6 }}>
                      <Text style={styles.planPhase}>{ph.label}</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {planDays.map((day) => {
                          const on = sel.includes(day.iso);
                          return (
                            <Pressable
                              key={day.iso}
                              onPress={() => togglePlan(ph.key, day.iso)}
                              style={[styles.planDayChip, on && { backgroundColor: c.accent, borderColor: c.accent }]}
                            >
                              <Text style={[styles.planDayChipText, { color: on ? c.textInverse : c.textMuted }]}>
                                {on ? '✓ ' : ''}{day.label}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.planHint}>
              Fechas opcionales. Si pones inicio y fin en días distintos, aquí podrás
              repartir cada fase por días.
            </Text>
          )}
        </>
      ) : null}

      {/* ── PASO 5 · INSCRIPCIÓN ───────────────────────────────────────── */}
      {step === 4 ? (
        <>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                MÁX. {isSocialFormat(format) ? 'JUGADORES' : 'PAREJAS'} · OPCIONAL
              </Text>
              <View style={styles.input}>
                <TextInput
                  value={maxPairs}
                  onChangeText={(t) => setMaxPairs(t.replace(/[^0-9]/g, ''))}
                  placeholder="16"
                  placeholderTextColor={c.textFaint}
                  style={styles.inputField}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                MÍN. POR CATEGORÍA · OPCIONAL
              </Text>
              <View style={styles.input}>
                <TextInput
                  value={minPairs}
                  onChangeText={(t) => setMinPairs(t.replace(/[^0-9]/g, ''))}
                  placeholder="—"
                  placeholderTextColor={c.textFaint}
                  style={styles.inputField}
                  keyboardType="number-pad"
                  maxLength={3}
                />
              </View>
            </View>
          </View>
          <Text style={styles.catHint}>
            El máximo y el mínimo son por categoría. Si al generar una categoría hay
            menos parejas que el mínimo, te avisamos (no bloquea).
          </Text>

          <Text style={styles.label}>HORAS QUE UN JUGADOR PUEDE QUITAR · OPCIONAL</Text>
          <View style={styles.input}>
            <TextInput
              value={maxRemovable}
              onChangeText={(t) => setMaxRemovable(t.replace(/[^0-9]/g, ''))}
              placeholder="sin límite"
              placeholderTextColor={c.textFaint}
              style={styles.inputField}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>
          <Text style={styles.catHint}>
            En la inscripción, cada jugador marca por franjas de 1h las horas que NO
            puede. Este es el máximo de franjas que puede quitar (en blanco = sin límite).
          </Text>

          {cats.length >= 2 ? (
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>CUOTA · 1 CATEGORÍA (€)</Text>
                <View style={styles.input}>
                  <TextInput
                    value={fee}
                    onChangeText={(t) => setFee(t.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                    placeholder="0 = gratis"
                    placeholderTextColor={c.textFaint}
                    style={styles.inputField}
                    keyboardType="decimal-pad"
                    maxLength={7}
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>CUOTA · 2 CATEGORÍAS (€)</Text>
                <View style={styles.input}>
                  <TextInput
                    value={fee2}
                    onChangeText={(t) => setFee2(t.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                    placeholder="total"
                    placeholderTextColor={c.textFaint}
                    style={styles.inputField}
                    keyboardType="decimal-pad"
                    maxLength={7}
                  />
                </View>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.label}>CUOTA DE INSCRIPCIÓN (€) · OPCIONAL</Text>
              <View style={styles.input}>
                <TextInput
                  value={fee}
                  onChangeText={(t) => setFee(t.replace(/[^0-9.,]/g, '').replace(',', '.'))}
                  placeholder="0 = gratis"
                  placeholderTextColor={c.textFaint}
                  style={styles.inputField}
                  keyboardType="decimal-pad"
                  maxLength={7}
                />
              </View>
            </>
          )}
          <Text style={styles.planHint}>
            {cats.length >= 2
              ? 'El jugador podrá apuntarse a 1 o 2 categorías; el precio de 2 es el TOTAL (p. ej. 1 cat 22€ · 2 cats 35€). Se muestra como información y se paga en el club.'
              : 'Por ahora la cuota se muestra como información y se paga en el club. El pago online llegará más adelante.'}
          </Text>
        </>
      ) : null}

      {/* ── PASO 6 · PREMIOS E INFO ────────────────────────────────────── */}
      {step === 5 ? (
        <View style={{ marginTop: 4 }}>
          <PrizeInfoEditor
            prizes={prizesJson}
            onPrizes={setPrizesJson}
            infoRows={infoRows}
            onInfoRows={setInfoRows}
            observations={observations}
            onObservations={setObservations}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    topbar: {
      paddingHorizontal: 22,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 4,
    },
    brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 3,
      color: c.accent,
      fontWeight: '500',
    },
    brandName: {
      color: c.text,
      fontSize: 18,
      fontWeight: '700',
      letterSpacing: -0.4,
      marginTop: 2,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    createBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      height: 50,
      marginTop: 16,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
    },
    createLabel: {
      color: c.textInverse,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
    empty: { alignItems: 'center', gap: 10, marginTop: 48, paddingHorizontal: 24 },
    emptyTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      textAlign: 'center',
      lineHeight: 19,
    },
    card: {
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      overflow: 'hidden',
    },
    cardCover: { width: '100%', height: 120 },
    cardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 14,
    },
    cardIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.accent15,
    },
    groupLabel: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2, color: c.textFaint, fontWeight: '600' },
    cardName: { color: c.text, fontSize: 15, fontWeight: '700' },
    cardMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    // Sheet
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
    },
    sheetSub: { color: c.textMuted, fontSize: 13, marginTop: 4, lineHeight: 19 },
    progressRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
    progressSeg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: c.hairStrong },
    wizFooter: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    wizBack: {
      height: 52,
      paddingHorizontal: 22,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
    },
    wizBackText: { color: c.text, fontSize: 15, fontWeight: '700' },
    wizNext: { flex: 1 },
    label: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 2,
      color: c.textFaint,
      textTransform: 'uppercase',
      fontWeight: '500',
      marginTop: 18,
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
    inputField: {
      color: c.text,
      fontSize: 15,
      fontWeight: '500',
      paddingVertical: 0,
    },
    inputMultiline: { minHeight: 84, alignItems: 'stretch', paddingVertical: 12 },
    planHint: { color: c.textMuted, fontSize: 12, marginTop: -2, marginBottom: 8, lineHeight: 17 },
    planPhase: { color: c.text, fontSize: 14, fontWeight: '700' },
    planDayChip: {
      paddingHorizontal: 12,
      height: 34,
      borderRadius: 9999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    planDayChipText: { fontSize: 13, fontWeight: '700' },
    inputFieldMultiline: {
      minHeight: 60,
      textAlignVertical: 'top',
      lineHeight: 20,
    },
    coverPicker: {
      height: 150,
      borderRadius: Radius.lg,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.bgCard,
    },
    coverImg: { width: '100%', height: '100%' },
    coverEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
    coverEmptyText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
    coverEditBadge: {
      position: 'absolute',
      right: 10,
      bottom: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 9999,
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    coverEditText: { color: c.textInverse, fontSize: 12, fontWeight: '700' },
    catCell: {
      width: 52,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    catText: { fontSize: 16, fontWeight: '600' },
    catHint: { color: c.textMuted, fontSize: 12, marginTop: 8, lineHeight: 17 },
    ruleModeChip: {
      flex: 1,
      height: 40,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    ruleModeText: { fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
    ruleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    ruleCat: { flex: 1, color: c.text, fontSize: 15, fontWeight: '700' },
    ruleInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    ruleInputLabel: { color: c.textMuted, fontSize: 11, fontWeight: '700' },
    ruleInput: {
      width: 62,
      height: 38,
      borderRadius: Radius.sm,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      color: c.text,
      fontSize: 15,
      fontWeight: '700',
      textAlign: 'center',
      paddingVertical: 0,
    },
    // Casilla vacía = "Libre": borde y fondo tintados de acento para que se
    // identifique como un estado elegido, no como un campo sin rellenar.
    ruleInputLibre: { borderColor: c.accent40, backgroundColor: c.accent10 },
    genderCell: {
      flex: 1,
      height: 46,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    genderText: { fontSize: 14, fontWeight: '600' },
    fmtRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      padding: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.accent },
    fmtLabel: { color: c.text, fontSize: 14, fontWeight: '600' },
    fmtSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    saveBtn: {
      height: 52,
      borderRadius: Radius.lg,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveLabel: {
      color: c.textInverse,
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: -0.2,
    },
  });
