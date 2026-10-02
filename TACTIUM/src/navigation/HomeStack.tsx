import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { HomeScreen } from '@features/home/screens/HomeScreen';
import { SoloHomeScreen } from '@features/home/screens/SoloHomeScreen';
import { JornadaScreen } from '@features/home/screens/JornadaScreen';
import { LineupScreen } from '@features/home/screens/LineupScreen';
import { ResultsScreen } from '@features/home/screens/ResultsScreen';
import { AvailabilityScreen } from '@features/home/screens/AvailabilityScreen';
import { AmistosoScreen } from '@features/home/screens/AmistosoScreen';
import { FederacionScreen } from '@features/seasons/screens/FederacionScreen';
import { FcpTeamScreen } from '@features/seasons/screens/FcpTeamScreen';
import { FcpPlayerScreen } from '@features/seasons/screens/FcpPlayerScreen';
import { FcpGroupScreen } from '@features/seasons/screens/FcpGroupScreen';
import { ClubDashboardScreen } from '@features/club/screens/ClubDashboardScreen';
import { ClubScheduleScreen } from '@features/club/screens/ClubScheduleScreen';
import { CreateTeamFromClubScreen } from '@features/club/screens/CreateTeamFromClubScreen';
import { ClubTournamentsScreen } from '@features/tournaments/screens/ClubTournamentsScreen';
import { TournamentDetailScreen } from '@features/tournaments/screens/TournamentDetailScreen';

import { useNavRole } from './navRole';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

/**
 * Pestaña INICIO. El root cambia por rol:
 *   · organizador (club «solo torneos») → sus torneos (ClubTournamentsScreen)
 *   · club_admin → panel del club (ClubDashboardScreen) + «TU GENTE»
 *   · capitán / jugador con equipo → HomeScreen + «TU GENTE»
 *   · suelto (sin equipo) → SoloHomeScreen + «TU GENTE»
 * Registra los detalles a los que llevan esas raíces (jornada, federación,
 * gestión del club y del torneo) para que «atrás» vuelva a Inicio.
 */
export const HomeStack = () => {
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
    role === 'organizer'
      ? ClubTournamentsScreen
      : role === 'club'
        ? ClubDashboardScreen
        : role === 'solo'
          ? SoloHomeScreen
          : HomeScreen;
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="HomeRoot" component={Root} />
      <Stack.Screen name="Jornada" component={JornadaScreen} />
      <Stack.Screen name="Lineup" component={LineupScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
      <Stack.Screen name="Amistoso" component={AmistosoScreen} />
      {/* Explorar Federación desde el atajo de Home → "atrás" vuelve a Inicio. */}
      <Stack.Screen name="Federacion" component={FederacionScreen} />
      <Stack.Screen name="FcpTeam" component={FcpTeamScreen} />
      <Stack.Screen name="FcpPlayer" component={FcpPlayerScreen} />
      <Stack.Screen name="FcpGroup" component={FcpGroupScreen} />
      {/* Gestión del club, empujada desde su panel o desde el botón ＋. */}
      <Stack.Screen name="ClubSchedule" component={ClubScheduleScreen} />
      <Stack.Screen
        name="CreateTeamFromClub"
        component={CreateTeamFromClubScreen}
      />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    </Stack.Navigator>
  );
};
