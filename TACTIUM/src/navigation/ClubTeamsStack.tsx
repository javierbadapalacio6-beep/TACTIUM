import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { ClubTeamsScreen } from '@features/club/screens/ClubTeamsScreen';
import { ClubTeamPreviewScreen } from '@features/club/screens/ClubTeamPreviewScreen';
import { JornadaScreen } from '@features/home/screens/JornadaScreen';
import { LineupScreen } from '@features/home/screens/LineupScreen';
import { ResultsScreen } from '@features/home/screens/ResultsScreen';

import type { ClubTeamsStackParamList } from './types';

const Stack = createNativeStackNavigator<ClubTeamsStackParamList>();

/**
 * Stack del tab "Equipos" para club_admin.
 *
 *   ClubTeamsRoot      → listado de equipos del club
 *   ClubTeamPreview    → dashboard READ-ONLY del team elegido (stats +
 *                        próxima jornada + lista de jornadas)
 *   Jornada/Lineup/Results → reusadas de home screens. Quedan read-only
 *                        porque selectIsCaptain devuelve false para
 *                        club_admin desde 2026-05-16.
 *
 * NO se reusan HomeScreen ni Availability ni nada que permita CREAR
 * temporadas, jornadas o cambiar disponibilidad. El gestor que necesite
 * editar cambia a Modo Capitán desde Profile.
 */
export const ClubTeamsStack = () => {
  const c = useColors();
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: c.background },
      animation: 'slide_from_right' as const,
    }),
    [c],
  );
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ClubTeamsRoot" component={ClubTeamsScreen} />
      <Stack.Screen name="ClubTeamPreview" component={ClubTeamPreviewScreen} />
      <Stack.Screen name="Jornada" component={JornadaScreen} />
      <Stack.Screen name="Lineup" component={LineupScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
    </Stack.Navigator>
  );
};
