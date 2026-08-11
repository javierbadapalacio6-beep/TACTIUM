import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Animated,
  Easing,
  AccessibilityInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import {
  AmbientBackdrop,
  IconSearch,
  IconTrophy,
  IconTeam,
  IconLogIn,
  IconSun,
  IconMoon,
  IconChevron,
  IconStar,
  IconStarFilled,
} from '@components/ui';
import { FEDERATIONS } from '@core/data/federations';
import { federationLogo } from '@core/data/federationLogos';
import {
  exploreTournaments,
  formatFee,
  tournamentBucket,
  tournamentStatusLabel,
  type ExploreTournament,
} from '@core/services/tournaments';
import { useThemeStore } from '@store/themeStore';
import { useFavoritesStore } from '@store/favoritesStore';
import { toggleFavorite } from '@core/services/favorites';

import type { AuthStackScreenProps } from '@navigation/types';

/**
 * Home PÚBLICA — lo primero que ve quien abre la app sin cuenta.
 *
 * El orden importa: antes lo primero era el login, o sea que la app pedía
 * identificarse para dejarte mirar nada. Un club comparte su torneo por
 * WhatsApp y quien abre el enlace no tiene por qué tener cuenta; si lo
 * primero que ve es un formulario, se va.
 *
 * Aquí se enseña producto — torneos y federación, con datos reales de las
 * RPC públicas — y la cuenta se pide cuando hace falta saber quién eres: al
 * inscribirte, al seguir a alguien o al gestionar tu equipo.
 *
 * (Además, la guideline 5.1.1(v) de Apple dice que una app no puede exigir
 * registro para funciones que no lo necesitan.)
 */

/**
 * Federaciones con datos scrapeados. El resto se enseñan atenuadas y con
 * «Próximamente». Al añadir una nueva, basta con meter su código aquí.
 */
const ACTIVE_FEDS = new Set(['FCantP']);

/**
 * Primero las que tienen datos y luego el resto, cada grupo en su orden
 * alfabético. Sin esto, la única que hoy funciona salía sexta y la lista
 * abría con cinco «Próximamente» seguidos, que es la peor primera impresión
 * posible. `sort` es estable, así que el alfabético de origen se conserva.
 */
const ORDERED_FEDS = [...FEDERATIONS].sort(
  (a, b) => Number(ACTIVE_FEDS.has(b.code)) - Number(ACTIVE_FEDS.has(a.code)),
);

type Role = 'equipo' | 'torneos';

/**
 * Los dos perfiles que abren la app. El copy dice lo que la app hace de
 * verdad: se siembra por puntos y nivel de la federación cántabra, no por
 * ranking FEP.
 */
const LANE_BY_KEY = {
  equipo: {
    label: 'Llevo un equipo',
    Icon: IconTeam,
    benefit:
      'Alineaciones ordenadas por puntos, disponibilidad de la plantilla y el acta de cada jornada sin chats de 80 mensajes.',
    cta: 'Ver planes de equipo',
    note: '14 días de prueba al crear tu primer equipo',
  },
  torneos: {
    label: 'Monto torneos',
    Icon: IconTrophy,
    benefit:
      'Cuadros, grupos y horarios en minutos. Inscripción con código, resultados en directo y las plazas controladas.',
    cta: 'Ver precios de torneo',
    note: 'Hasta 16 parejas el torneo es gratis',
  },
} as const;
const LANES = Object.entries(LANE_BY_KEY) as [Role, (typeof LANE_BY_KEY)[Role]][];

/** Cuántas federaciones se listan antes de "ver todas". */
const FED_PREVIEW = 6;

/**
 * Filtros del carrusel. Se apoyan en `tournamentBucket`, que es el mismo
 * criterio que usa "Mis torneos" — un torneo `in_progress` cuya fecha aún no
 * ha llegado cuenta como próximo, no como en juego.
 */
type Bucket = 'all' | 'live' | 'upcoming' | 'finished';
const BUCKETS: [Bucket, string][] = [
  ['all', 'Todos'],
  ['live', 'En juego'],
  ['upcoming', 'Próximamente'],
  ['finished', 'Finalizados'],
];

/**
 * Color del chip de estado, por el MISMO criterio que el filtro: manda la
 * fecha, no el estado crudo de la fila.
 */
const chipColor = (
  t: ExploreTournament,
  c: Palette,
  part: 'border' | 'text',
): string => {
  const b = tournamentBucket(t.status, t.starts_on);
  if (b === 'live') return c.warning;
  if (b === 'upcoming') return c.accent;
  return part === 'border' ? c.hairStrong : c.textFaint;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return 'Sin fecha';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
};

export const PublicHomeScreen = ({
  navigation,
}: AuthStackScreenProps<'PublicHome'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();

  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);

  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [rows, setRows] = useState<ExploreTournament[]>([]);
  const [loading, setLoading] = useState(true);

  // Una consulta por tecla es una consulta de más.
  useEffect(() => {
    const id = setTimeout(() => setTerm(query.trim()), 320);
    return () => clearTimeout(id);
  }, [query]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    exploreTournaments(term)
      .then((r) => alive && setRows(r))
      .catch(() => alive && setRows([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [term]);

  const goLogin = () => navigation.navigate('Login');
  const openTournament = (id: string) =>
    navigation.getParent()?.navigate('TournamentFollow', { tournamentId: id });

  const favorites = useFavoritesStore((s) => s.items);
  const [allFeds, setAllFeds] = useState(false);
  const feds = allFeds ? ORDERED_FEDS : ORDERED_FEDS.slice(0, FED_PREVIEW);
  const searching = term.length > 0;

  const [bucket, setBucket] = useState<Bucket>('all');
  const [role, setRole] = useState<Role>('equipo');

  // ── Animación del CTA ───────────────────────────────────────────────
  // Dos gestos, los dos al servicio del contenido y ninguno decorativo:
  //  · el beneficio hace fundido al cambiar de carril, para que se vea QUE
  //    ha cambiado (si aparece de golpe, mucha gente no lo registra);
  //  · el botón late muy despacio, lo justo para que el ojo vuelva a él.
  // Ambos se apagan si el sistema pide menos movimiento.
  const [reduceMotion, setReduceMotion] = useState(false);
  const benefitOpacity = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      benefitOpacity.setValue(1);
      return;
    }
    benefitOpacity.setValue(0);
    Animated.timing(benefitOpacity, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [role, reduceMotion, benefitOpacity]);

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, pulse]);

  // Filtra por estado y deja SIEMPRE los más recientes delante. Sin fecha van
  // al final: un torneo sin fechar no es más nuevo, es que no se sabe.
  const shown = useMemo(() => {
    const list =
      bucket === 'all'
        ? rows
        : rows.filter((t) => tournamentBucket(t.status, t.starts_on) === bucket);
    return [...list].sort((a, b) =>
      (b.starts_on ?? '').localeCompare(a.starts_on ?? ''),
    );
  }, [rows, bucket]);

  /** Cuántos hay en cada filtro, para no ofrecer uno que da vacío. */
  const counts = useMemo(() => {
    const acc: Record<Bucket, number> = {
      all: rows.length,
      live: 0,
      upcoming: 0,
      finished: 0,
    };
    for (const t of rows) acc[tournamentBucket(t.status, t.starts_on)] += 1;
    return acc;
  }, [rows]);

  return (
    <View style={styles.root}>
      <AmbientBackdrop />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Cabecera ─────────────────────────────────────────────── */}
        <View style={styles.topbar}>
          <TactiumMark size={28} />
          <Text style={styles.brand}>TACTIUM</Text>

          <View style={styles.topActions}>
            <Pressable
              onPress={() => setMode(mode === 'dark' ? 'light' : 'dark')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={
                mode === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'
              }
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              {mode === 'dark' ? (
                <IconSun size={18} color={c.textMuted} />
              ) : (
                <IconMoon size={18} color={c.textMuted} />
              )}
            </Pressable>

            <Pressable
              onPress={goLogin}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Iniciar sesión"
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <IconLogIn size={19} color={c.accent} />
            </Pressable>
          </View>
        </View>

        <Text style={styles.eyebrow}>EXPLORAR</Text>
        <Text style={styles.title}>El pádel federado,{'\n'}sin crear cuenta</Text>


        {/* ── Buscador ─────────────────────────────────────────────── */}
        <View style={styles.search}>
          <IconSearch size={16} color={c.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Busca un torneo, club o lugar"
            placeholderTextColor={c.textFaint}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>

        {/* ── Favoritos ────────────────────────────────────────────────
            Solo aparece cuando hay alguno: una sección vacía en la primera
            pantalla es ruido. Vive en el dispositivo, así que un invitado
            puede marcar su federación y encontrársela mañana. */}
        {favorites.length > 0 && !searching ? (
          <>
            <View style={styles.secHead}>
              <Text style={styles.secLabel}>TUS FAVORITOS</Text>
            </View>
            <View style={styles.favWrap}>
              {favorites.slice(0, 8).map((f) => (
                <Pressable
                  key={`${f.kind}:${f.refId}`}
                  onPress={() => {
                    if (f.kind === 'federation') navigation.navigate('Federacion');
                    else if (f.kind === 'team')
                      navigation.navigate('FcpTeam', {
                        idEquipo: Number(f.refId),
                        name: f.label,
                      });
                    else
                      navigation.navigate('FcpPlayer', {
                        idJugador: f.refId,
                        name: f.label,
                      });
                  }}
                  style={({ pressed }) => [
                    styles.favChip,
                    pressed && { opacity: 0.8 },
                  ]}
                >
                  <IconStarFilled size={12} color={c.accent} />
                  <Text style={styles.favChipText} numberOfLines={1}>
                    {f.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {/* ── Torneos ──────────────────────────────────────────────── */}
        <View style={styles.secHead}>
          <Text style={styles.secLabel}>
            {searching ? 'RESULTADOS' : 'TORNEOS'}
          </Text>
          {rows.length > 0 && (
            <Pressable
              onPress={() => navigation.getParent()?.navigate('ExploreTournaments')}
              hitSlop={8}
            >
              <Text style={styles.secMore}>Ver todos</Text>
            </Pressable>
          )}
        </View>

        {/* Filtros por estado. Solo se ofrece el que tiene algo detrás: un
            chip que devuelve una lista vacía es una promesa incumplida. */}
        {rows.length > 0 && (
          <View style={styles.filterRow}>
            {BUCKETS.filter(([k]) => k === 'all' || counts[k] > 0).map(
              ([k, label]) => {
                const on = bucket === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setBucket(k)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [
                      styles.filterChip,
                      on && styles.filterChipOn,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text
                      style={[styles.filterText, on && styles.filterTextOn]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              },
            )}
          </View>
        )}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {searching
                ? 'Ningún torneo con esa búsqueda.'
                : 'Todavía no hay torneos publicados.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.rail}
            style={styles.railOuter}
          >
            {shown.slice(0, 12).map((t) => (
              <Pressable
                key={t.id}
                onPress={() => openTournament(t.id)}
                style={({ pressed }) => [styles.tCard, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.chipRow}>
                <View
                  style={[
                    styles.chip,
                    { borderColor: chipColor(t, c, 'border') },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: chipColor(t, c, 'text') },
                    ]}
                  >
                    {/* Etiqueta POR FECHA, no por estado crudo: un torneo
                        `in_progress` que empieza la semana que viene decía
                        "En juego" en la tarjeta y caía bajo "Próximamente"
                        en el filtro. Ahora los dos usan el mismo criterio. */}
                    {tournamentStatusLabel(t.status, t.starts_on)}
                  </Text>
                </View>

                {/* La cuota es de lo primero que se pregunta el jugador. */}
                {t.entry_fee ? (
                  <View style={[styles.chip, { borderColor: c.hairStrong }]}>
                    <Text style={[styles.chipText, { color: c.textMuted }]}>
                      {formatFee(t.entry_fee, t.fee_currency)}
                    </Text>
                  </View>
                ) : null}
                </View>

                <Text style={styles.tName} numberOfLines={2}>
                  {t.name}
                </Text>
                <Text style={styles.tClub} numberOfLines={1}>
                  {[t.club_name, t.location].filter(Boolean).join(' · ').toUpperCase()}
                </Text>

                <View style={styles.tFoot}>
                  <Text style={styles.tFootText}>{fmtDate(t.starts_on)}</Text>
                  <Text style={styles.tFootText}>
                    <Text style={styles.tFootStrong}>{t.players}</Text>
                    {t.pair_based ? ' jug.' : ' jug.'}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* ── Federaciones ─────────────────────────────────────────── */}
        <View style={styles.secHead}>
          <Text style={styles.secLabel}>FEDERACIONES</Text>
          {ORDERED_FEDS.length > FED_PREVIEW && (
            <Pressable onPress={() => setAllFeds(!allFeds)} hitSlop={8}>
              <Text style={styles.secMore}>
                {allFeds ? 'Ver menos' : 'Ver todas'}
              </Text>
            </Pressable>
          )}
        </View>

        {feds.map((f) => {
          const active = ACTIVE_FEDS.has(f.code);
          const logo = federationLogo(f.code);
          const isFav = favorites.some(
            (x) => x.kind === 'federation' && x.refId === f.code,
          );
          return (
            <Pressable
              key={f.code}
              disabled={!active}
              onPress={() => navigation.navigate('Federacion')}
              style={({ pressed }) => [
                styles.fed,
                !active && styles.fedSoon,
                pressed && active && { opacity: 0.85 },
              ]}
            >
              {/* Escudo real si lo tenemos; si no, las siglas. */}
              {logo ? (
                <Image source={logo} style={styles.fedLogo} resizeMode="contain" />
              ) : (
                <View style={[styles.fedBadge, !active && styles.fedBadgeSoon]}>
                  <Text
                    style={[styles.fedBadgeText, !active && { color: c.textFaint }]}
                    numberOfLines={1}
                  >
                    {f.shortName.slice(0, 5)}
                  </Text>
                </View>
              )}

              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fedName} numberOfLines={1}>
                  {f.name}
                </Text>
                <Text style={styles.fedRegion} numberOfLines={1}>
                  {f.region.toUpperCase()}
                </Text>
              </View>

              {/* La estrella funciona SIN cuenta: se guarda en el
                  dispositivo y sube al registrarse. */}
              {active ? (
                <>
                  <Pressable
                    onPress={() =>
                      toggleFavorite({
                        kind: 'federation',
                        refId: f.code,
                        label: f.name,
                        meta: f.region,
                      })
                    }
                    hitSlop={10}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isFav ? 'Quitar de favoritos' : 'Añadir a favoritos'
                    }
                  >
                    {isFav ? (
                      <IconStarFilled size={17} color={c.accent} />
                    ) : (
                      <IconStar size={17} color={c.textFaint} />
                    )}
                  </Pressable>
                  <IconChevron size={16} color={c.accent} />
                </>
              ) : (
                <Text style={styles.fedSoonText}>PRÓXIMAMENTE</Text>
              )}
            </Pressable>
          );
        })}

        {/* ── Para clubes y capitanes ──────────────────────────────────
            El cierre de la pantalla: hasta aquí todo era mirar. Va al final
            a propósito — quien ha llegado hasta abajo ya ha visto de qué va
            esto, y es cuando la propuesta tiene sentido. */}
        {/* ── TACTIUM PRO · la pista dividida ──────────────────────────
            La pregunta segmenta y los dos carriles son la pista vista desde
            arriba, partida por la red. El beneficio y el botón cambian con
            el carril, así que el visitante lee lo suyo y no un cajón de
            sastre para los dos perfiles. */}
        <View style={styles.ctaCard}>
          <View style={styles.proPill}>
            <View style={styles.proDot} />
            <Text style={styles.proPillText}>TACTIUM PRO</Text>
          </View>

          <Text style={styles.ctaTitle}>
            ¿Llevas un equipo{' '}
            <Text style={{ color: c.accent }}>o montas torneos?</Text>
          </Text>

          <View style={styles.lanes} accessibilityRole="radiogroup">
            {LANES.map(([key, lane], i) => {
              const on = role === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setRole(key)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[
                    styles.lane,
                    on && styles.laneOn,
                    // La red: sólo la línea que parte las dos mitades.
                    i === 1 && styles.laneNet,
                  ]}
                >
                  <lane.Icon size={20} color={on ? c.textInverse : c.textFaint} />
                  <Text style={[styles.laneText, on && styles.laneTextOn]}>
                    {lane.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Animated.Text style={[styles.ctaBody, { opacity: benefitOpacity }]}>
            {LANE_BY_KEY[role].benefit}
          </Animated.Text>

          <Animated.View
            style={{
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 1.022],
                  }),
                },
              ],
            }}
          >
            <Pressable
              onPress={() =>
                navigation.navigate('Plans', {
                  focus: role === 'equipo' ? 'teams' : 'tournaments',
                })
              }
              style={({ pressed }) => [
                styles.ctaPrimary,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.ctaPrimaryText}>{LANE_BY_KEY[role].cta}</Text>
            </Pressable>
          </Animated.View>

          <Text style={styles.ctaNote}>{LANE_BY_KEY[role].note}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    content: { paddingHorizontal: 18 },

    topbar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      marginBottom: 24,
    },
    brand: {
      color: c.text,
      fontSize: 14,
      fontWeight: '900',
      letterSpacing: 2.6,
    },
    topActions: {
      marginLeft: 'auto',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 18,
    },

    eyebrow: {
      color: c.accent,
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 2.2,
      marginBottom: 8,
    },
    title: {
      color: c.text,
      fontSize: 25,
      lineHeight: 29,
      fontWeight: '900',
      letterSpacing: -0.5,
      marginBottom: 18,
    },

    search: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
      paddingHorizontal: 15,
      height: 46,
      borderRadius: 999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      marginBottom: 26,
    },
    searchInput: {
      flex: 1,
      color: c.text,
      fontSize: 14,
      padding: 0,
    },

    secHead: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 11,
    },
    secLabel: {
      color: c.textFaint,
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 2,
    },
    secMore: { color: c.accent, fontSize: 11.5, fontWeight: '700' },

    ctaCard: {
      marginTop: 20,
      padding: 20,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.accent25,
    },
    proPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 7,
      alignSelf: 'flex-start',
      paddingHorizontal: 11,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: c.accent10,
      borderWidth: 1,
      borderColor: c.accent,
      marginBottom: 14,
    },
    proDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.accent },
    proPillText: {
      color: c.accent,
      fontFamily: Fonts.mono,
      fontSize: 9,
      letterSpacing: 2,
    },

    // Los dos carriles = la pista vista desde arriba, partida por la red.
    lanes: {
      flexDirection: 'row',
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: c.hairStrong,
      marginTop: 16,
      marginBottom: 14,
    },
    lane: {
      flex: 1,
      alignItems: 'center',
      gap: 7,
      paddingVertical: 14,
      paddingHorizontal: 8,
      backgroundColor: c.bgCard2,
    },
    laneOn: { backgroundColor: c.accent },
    laneNet: { borderLeftWidth: 2, borderLeftColor: c.text },
    laneText: { color: c.textFaint, fontSize: 12.5, fontWeight: '700' },
    laneTextOn: { color: c.textInverse },

    ctaEyebrow: {
      color: c.accent,
      fontFamily: Fonts.mono,
      fontSize: 9.5,
      letterSpacing: 2.2,
      marginBottom: 8,
    },
    ctaTitle: {
      color: c.text,
      fontSize: 18,
      lineHeight: 23,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    ctaBody: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      marginTop: 8,
    },
    ctaRow: { flexDirection: 'row', gap: 9, marginTop: 16 },
    ctaPrimary: {
      flex: 1,
      height: 46,
      borderRadius: 999,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaPrimaryText: { color: c.textInverse, fontSize: 14, fontWeight: '700' },
    ctaGhost: {
      flex: 1,
      height: 46,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaGhostText: { color: c.text, fontSize: 14, fontWeight: '700' },
    ctaNote: {
      color: c.textFaint,
      fontSize: 11.5,
      lineHeight: 16,
      marginTop: 12,
      textAlign: 'center',
    },

    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginBottom: 14,
    },
    filterChip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    filterChipOn: { borderColor: c.accent, backgroundColor: c.accent10 },
    filterText: { color: c.textMuted, fontSize: 12, fontWeight: '500' },
    filterTextOn: { color: c.accent, fontWeight: '700' },

    favWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 26,
    },
    favChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      maxWidth: 200,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    favChipText: { color: c.text, fontSize: 12.5, fontWeight: '600', flexShrink: 1 },

    loading: { paddingVertical: 34, alignItems: 'center' },
    empty: {
      paddingVertical: 26,
      paddingHorizontal: 16,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      marginBottom: 26,
    },
    emptyText: { color: c.textMuted, fontSize: 13, textAlign: 'center' },

    // El carrusel se sale del padding del scroll para que las tarjetas
    // asomen por el borde y se lea que hay más a la derecha.
    railOuter: { marginHorizontal: -18, marginBottom: 26 },
    rail: { paddingHorizontal: 18, gap: 11 },
    tCard: {
      width: 208,
      padding: 15,
      borderRadius: Radius.lg,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
    },
    chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    chip: {
      alignSelf: 'flex-start',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      borderWidth: 1,
    },
    chipText: {
      fontFamily: Fonts.mono,
      fontSize: 8.5,
      letterSpacing: 1.2,
    },
    tName: {
      color: c.text,
      fontSize: 14.5,
      fontWeight: '700',
      lineHeight: 18,
      marginTop: 11,
    },
    tClub: {
      color: c.textFaint,
      fontFamily: Fonts.mono,
      fontSize: 8.5,
      letterSpacing: 1.1,
      marginTop: 6,
    },
    tFoot: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 13,
      paddingTop: 11,
      borderTopWidth: 1,
      borderTopColor: c.hair,
    },
    tFootText: { color: c.textMuted, fontSize: 11.5 },
    tFootStrong: { color: c.text, fontWeight: '700' },

    fed: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 11,
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: 13,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hair,
      marginBottom: 8,
    },
    // Atenuadas, no ocultas: enseñar las que faltan comunica hacia dónde va
    // esto y evita el «¿y la mía?», pero sin parecer un enlace roto.
    fedSoon: { opacity: 0.5 },
    fedBadge: {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundColor: c.primaryDim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fedBadgeSoon: { backgroundColor: c.bgCard2 },
    fedLogo: { width: 32, height: 32, borderRadius: 10 },
    fedBadgeText: {
      color: c.accent,
      fontFamily: Fonts.mono,
      fontSize: 8.5,
      fontWeight: '700',
    },
    fedName: { color: c.text, fontSize: 13, fontWeight: '700' },
    fedRegion: {
      color: c.textFaint,
      fontFamily: Fonts.mono,
      fontSize: 8.5,
      letterSpacing: 1.1,
      marginTop: 3,
    },
    fedSoonText: {
      color: c.textFaint,
      fontFamily: Fonts.mono,
      fontSize: 8.5,
      letterSpacing: 1.1,
    },
  });
