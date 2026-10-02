import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { TeamScreen } from '@features/team/screens/TeamScreen';
import { NoTeamScreen } from '@features/team/screens/NoTeamScreen';
import { ClubTeamsScreen } from '@features/club/screens/ClubTeamsScreen';
import { ClubTeamPreviewScreen } from '@features/club/screens/ClubTeamPreviewScreen';
import { OrganizerTeamsScreen } from '@features/club/screens/OrganizerTeamsScreen';
import { JornadaScreen } from '@features/home/screens/JornadaScreen';
import { LineupScreen } from '@features/home/screens/LineupScreen';
import { ResultsScreen } from '@features/home/screens/ResultsScreen';
import { AvailabilityScreen } from '@features/home/screens/AvailabilityScreen';

import { useNavRole } from './navRole';
import type { TeamStackParamList } from './types';

const Stack = createNativeStackNavigator<TeamStackParamList>();

/**
 * Pestaña EQUIPO. El root cambia por rol:
 *   · capitán / jugador → TeamScreen (plantilla)
 *   · club_admin        → ClubTeamsScreen (equipos del club, solo lectura) →
 *                         ClubTeamPreview → Jornada/Lineup/Results (read-only
 *                         porque selectIsCaptain es false para club_admin)
 *   · organizador       → CTA «Activar gestión de equipos»
 *   · suelto            → «Crea o únete a un equipo»
 *
 * Nota histórica: las pestañas van SIEMPRE envueltas en un Stack. En
 * bottom-tabs v7, un Tab.Screen con un componente directo se quedaba
 * mid-mount al primer focus (pantalla vacía); el Stack absorbe ese ciclo.
 */
export const TeamStack = () => {
  const role = useNavRole();
  const c = useColors();
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: c.background },
      animation: 'slide_from_right' as const,
    }),
    [c],
  );
  const Root: React.ComponentType<any> =
    role === 'club'
      ? ClubTeamsScreen
      : role === 'organizer'
        ? OrganizerTeamsScreen
        : role === 'solo'
          ? NoTeamScreen
          : TeamScreen;
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="TeamRoot"
        component={Root}
        // El root no anima: el cambio entre pestañas ya es instantáneo y un
        // fade propio dejaba un frame vacío en navegación rápida.
        options={{ animation: 'none' }}
      />
      <Stack.Screen name="ClubTeamPreview" component={ClubTeamPreviewScreen} />
      <Stack.Screen name="Jornada" component={JornadaScreen} />
      <Stack.Screen name="Lineup" component={LineupScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
    </Stack.Navigator>
  );
};
