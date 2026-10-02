import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { IconTeam } from '@components/ui';
import { TabEmptyState } from '@components/ui/TabEmptyState';
import type { RootStackParamList } from '@navigation/types';

/**
 * Pestaña Equipo del ORGANIZADOR (club «solo torneos»): aún no gestiona
 * equipos. CTA a la activación (elige federación → desbloquea → paywall).
 */
export const OrganizerTeamsScreen = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const rootNav =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.eyebrow}>EQUIPOS</Text>
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 64 + 12 + 32 }}
        showsVerticalScrollIndicator={false}
      >
        <TabEmptyState
          icon={<IconTeam size={24} color={c.accent} />}
          eyebrow="GESTIÓN DE EQUIPOS"
          title="¿También gestionas equipos?"
          text="Actívalo y tendrás alineaciones, jornadas y plantillas de tus equipos — sin perder tus torneos."
          primary={{
            label: 'Activar gestión de equipos',
            onPress: () => rootNav.navigate('ActivateTeamManagement'),
          }}
        />
      </ScrollView>
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: { paddingHorizontal: 22, paddingBottom: 4 },
    eyebrow: {
      fontFamily: Fonts.mono,
      color: c.accent,
      fontSize: 11,
      letterSpacing: 2.4,
      fontWeight: '500',
    },
  });
