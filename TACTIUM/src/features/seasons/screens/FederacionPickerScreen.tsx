import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconChevron, IconBack } from '@components/ui';
import { FEDERATIONS } from '@core/data/federations';
import { federationLogo } from '@core/data/federationLogos';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import type { CompetirStackScreenProps } from '@navigation/types';

// Solo la Cántabra tiene datos (tablas fcp_*). El selector ya no lista una a
// una las federaciones sin datos («Próximamente» daba a entender un alcance que
// no hay): dice cuál es la tuya, que aún no está, y lleva a la que sí.
const AVAILABLE_CODE = 'FCantP';

export const FederacionPickerScreen = ({
  navigation,
  embedded,
}: CompetirStackScreenProps<'CompetirRoot'> & {
  /** Raíz del segmento Federación de Competir: sin «Atrás». */
  embedded?: boolean;
}) => {
  const showBack = !embedded && navigation.canGoBack();
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  // La federación "propia" depende del rol: el club_admin la hereda del CLUB
  // activo (no tiene equipo activo), el capitán/jugador del EQUIPO. Así el
  // mismo picker sirve a todos los roles en Competir › Federación.
  const activeRole = useTeamStore((s) => s.activeRole);
  const teamFed = useTeamStore((s) => s.team?.federation ?? null);
  const clubFed = useClubStore(selectActiveClub)?.federation ?? null;
  const myFed = activeRole === 'club_admin' ? clubFed : teamFed;

  const mine = useMemo(
    () => (myFed && myFed !== AVAILABLE_CODE ? FEDERATIONS.find((f) => f.code === myFed) ?? null : null),
    [myFed],
  );
  const fcp = FEDERATIONS.find((f) => f.code === AVAILABLE_CODE)!;
  const fcpLogo = federationLogo(AVAILABLE_CODE);

  return (
    <View style={styles.root}>
      {/* Back solo si se puede volver y NO va embebido en Competir. Como
          raíz del segmento, `embedded` lo oculta. */}
      {showBack ? (
        <View style={[styles.nav, { paddingTop: insets.top + 10 }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.navBtn, pressed && { opacity: 0.7 }]}
          >
            <IconBack size={16} color={c.text} />
            <Text style={styles.navBtnLabel}>Atrás</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: showBack ? 8 : insets.top + 16,
          paddingBottom: insets.bottom + 64 + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>FEDERACIONES</Text>
        <Text style={styles.title}>
          {mine ? 'Tu federación aún no está' : 'Explorar'}
        </Text>
        <Text style={styles.lede}>
          {mine
            ? `${mine.name}: de momento leemos los datos de la Cántabra. El resto de federaciones irán entrando.`
            : 'Consulta las clasificaciones, jornadas y actas de la federación.'}
        </Text>

        <Text style={styles.section}>DISPONIBLE</Text>
        <Pressable
          onPress={() => navigation.navigate('Federacion')}
          accessibilityRole="button"
          accessibilityLabel={`Abrir ${fcp.name}`}
          style={({ pressed }) => [styles.row, styles.rowMine, pressed && { opacity: 0.85 }]}
        >
          {fcpLogo ? (
            <Image source={fcpLogo} style={styles.avatar} resizeMode="contain" />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitials}>FCP</Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.name} numberOfLines={1}>
              {fcp.name}
            </Text>
            <Text style={styles.region} numberOfLines={1}>
              Clasificaciones, equipos y jugadores
            </Text>
          </View>
          <IconChevron size={15} color={c.textFaint} />
        </Pressable>
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    nav: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 },
    navBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    navBtnLabel: { color: c.text, fontSize: 15, fontWeight: '600' },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 3,
      color: c.accent,
      fontWeight: '500',
    },
    title: { color: c.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6, marginTop: 4 },
    lede: { color: c.textMuted, fontSize: 13.5, lineHeight: 20, marginTop: 8 },
    section: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      letterSpacing: 2.4,
      color: c.textFaint,
      fontWeight: '600',
      marginTop: 26,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      borderRadius: Radius.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    rowMine: { borderColor: c.accent40, backgroundColor: c.accent10 },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 10,
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: c.hairStrong,
    },
    avatarFallback: {
      width: 42,
      height: 42,
      borderRadius: 10,
      backgroundColor: c.bgRaised,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    avatarInitials: {
      fontFamily: Fonts.mono,
      fontSize: 10.5,
      fontWeight: '800',
      color: c.textMuted,
    },
    name: { color: c.text, fontSize: 14.5, fontWeight: '700' },
    region: { fontFamily: Fonts.mono, color: c.textFaint, fontSize: 11, marginTop: 2 },
  });
