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
import type { FederacionStackScreenProps } from '@navigation/types';

// De momento solo la Cántabra tiene datos scrapeados (tablas fcp_*). El resto
// se listan como "Próximamente" para que se vea que existen y se puedan explorar
// cuando se integren.
const AVAILABLE = new Set(['FCantP']);

export const FederacionPickerScreen = ({
  navigation,
}: FederacionStackScreenProps<'FederacionRoot'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  // La federación "propia" depende del rol: el club_admin la hereda del CLUB
  // activo (no tiene equipo activo), el capitán/jugador del EQUIPO. Así el
  // mismo picker sirve para el tab del capitán y para el ClubStack.
  const activeRole = useTeamStore((s) => s.activeRole);
  const teamFed = useTeamStore((s) => s.team?.federation ?? null);
  const clubFed = useClubStore(selectActiveClub)?.federation ?? null;
  const myFed = activeRole === 'club_admin' ? clubFed : teamFed;

  // La federación del equipo primero; luego el resto por región.
  const list = useMemo(() => {
    const arr = [...FEDERATIONS];
    arr.sort((a, b) => {
      if (a.code === myFed) return -1;
      if (b.code === myFed) return 1;
      return a.region.localeCompare(b.region);
    });
    return arr;
  }, [myFed]);

  return (
    <View style={styles.root}>
      {/* Back solo cuando se puede volver (empujado desde el ClubStack). Como
          raíz del tab del capitán, canGoBack() es false → no se pinta. */}
      {navigation.canGoBack() ? (
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
          paddingTop: navigation.canGoBack() ? 8 : insets.top + 16,
          paddingBottom: insets.bottom + 64 + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>FEDERACIONES</Text>
        <Text style={styles.title}>Explorar</Text>
        <Text style={styles.lede}>
          Consulta las clasificaciones, jornadas y actas de tu federación.
        </Text>

        <View style={{ gap: 8, marginTop: 22 }}>
          {list.map((f) => {
            const available = AVAILABLE.has(f.code);
            const mine = f.code === myFed;
            const logo = federationLogo(f.code);
            return (
              <Pressable
                key={f.code}
                disabled={!available}
                onPress={() => navigation.navigate('Federacion')}
                style={({ pressed }) => [
                  styles.row,
                  mine && styles.rowMine,
                  !available && { opacity: 0.55 },
                  pressed && available && { opacity: 0.85 },
                ]}
              >
                {/* Avatar: logo de la federación si lo tenemos, si no sus siglas. */}
                {logo ? (
                  <Image source={logo} style={styles.avatar} resizeMode="contain" />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials} numberOfLines={1}>
                      {f.shortName}
                    </Text>
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={1}>
                    {f.name}
                  </Text>
                  <Text style={styles.region} numberOfLines={1}>
                    {f.region}
                    {mine ? ' · tu federación' : ''}
                  </Text>
                </View>
                {available ? (
                  <IconChevron size={15} color={c.textFaint} />
                ) : (
                  <Text style={styles.soon}>Próximamente</Text>
                )}
              </Pressable>
            );
          })}
        </View>
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
    soon: {
      fontFamily: Fonts.mono,
      color: c.textFaint,
      fontSize: 10,
      letterSpacing: 0.5,
      fontWeight: '700',
    },
  });
