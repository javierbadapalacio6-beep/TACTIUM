import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import {
  AmbientBackdrop,
  IconSearch,
  IconLogIn,
  IconSun,
  IconMoon,
  IconChevron,
} from '@components/ui';
import { FEDERATIONS } from '@core/data/federations';
import { federationLogo } from '@core/data/federationLogos';
import {
  exploreTournaments,
  formatFee,
  type ExploreTournament,
} from '@core/services/tournaments';
import { useThemeStore } from '@store/themeStore';

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

/** Cuántas federaciones se listan antes de "ver todas". */
const FED_PREVIEW = 6;

const STATUS_LABEL: Record<string, string> = {
  open: 'Inscripción abierta',
  in_progress: 'En juego',
  finished: 'Finalizado',
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

  const [allFeds, setAllFeds] = useState(false);
  const feds = allFeds ? ORDERED_FEDS : ORDERED_FEDS.slice(0, FED_PREVIEW);
  const searching = term.length > 0;

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

        {/* ── Torneos ──────────────────────────────────────────────── */}
        <View style={styles.secHead}>
          <Text style={styles.secLabel}>
            {searching ? 'RESULTADOS' : 'TORNEOS PRÓXIMOS'}
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

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={c.accent} />
          </View>
        ) : rows.length === 0 ? (
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
            {rows.slice(0, 10).map((t) => (
              <Pressable
                key={t.id}
                onPress={() => openTournament(t.id)}
                style={({ pressed }) => [styles.tCard, pressed && { opacity: 0.85 }]}
              >
                <View style={styles.chipRow}>
                <View
                  style={[
                    styles.chip,
                    {
                      borderColor:
                        t.status === 'open'
                          ? c.accent
                          : t.status === 'in_progress'
                            ? c.warning
                            : c.hairStrong,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color:
                          t.status === 'open'
                            ? c.accent
                            : t.status === 'in_progress'
                              ? c.warning
                              : c.textFaint,
                      },
                    ]}
                  >
                    {STATUS_LABEL[t.status] ?? t.status}
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

              {active ? (
                <IconChevron size={16} color={c.accent} />
              ) : (
                <Text style={styles.fedSoonText}>PRÓXIMAMENTE</Text>
              )}
            </Pressable>
          );
        })}
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
