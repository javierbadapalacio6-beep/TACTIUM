import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { CompetirScreen } from '@features/competir/screens/CompetirScreen';
import { SeasonDetailScreen } from '@features/seasons/screens/SeasonDetailScreen';
import { FcpTeamScreen } from '@features/seasons/screens/FcpTeamScreen';
import { FcpPlayerScreen } from '@features/seasons/screens/FcpPlayerScreen';
import { FederacionScreen } from '@features/seasons/screens/FederacionScreen';
import { FcpGroupScreen } from '@features/seasons/screens/FcpGroupScreen';
import { JornadaScreen } from '@features/home/screens/JornadaScreen';
import { LineupScreen } from '@features/home/screens/LineupScreen';
import { ResultsScreen } from '@features/home/screens/ResultsScreen';
import { AvailabilityScreen } from '@features/home/screens/AvailabilityScreen';
import { ClubScheduleScreen } from '@features/club/screens/ClubScheduleScreen';
import { ClubTournamentsScreen } from '@features/tournaments/screens/ClubTournamentsScreen';
import { TournamentDetailScreen } from '@features/tournaments/screens/TournamentDetailScreen';

import type { CompetirStackParamList } from './types';

const Stack = createNativeStackNavigator<CompetirStackParamList>();

// ClubTournamentsScreen está tipada como raíz de Inicio (organizador); aquí se
// empuja como «Gestionar torneos» del club. Mismos params (`createTournament`).
const ClubTournamentsRoute = ClubTournamentsScreen as React.ComponentType<any>;

/**
 * Pestaña COMPETIR. La raíz pinta el segmento activo (Liga · Federación ·
 * Torneos) y la stack registra TODAS las pantallas de detalle de esos tres
 * mundos, para que «atrás» vuelva siempre a Competir.
 */
export const CompetirStack = () => {
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
      <Stack.Screen name="CompetirRoot" component={CompetirScreen} />
      {/* Liga */}
      <Stack.Screen name="SeasonDetail" component={SeasonDetailScreen} />
      <Stack.Screen name="Jornada" component={JornadaScreen} />
      <Stack.Screen name="Lineup" component={LineupScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="Availability" component={AvailabilityScreen} />
      <Stack.Screen name="ClubSchedule" component={ClubScheduleScreen} />
      {/* Federación */}
      <Stack.Screen name="Federacion" component={FederacionScreen} />
      <Stack.Screen name="FcpGroup" component={FcpGroupScreen} />
      <Stack.Screen name="FcpTeam" component={FcpTeamScreen} />
      <Stack.Screen name="FcpPlayer" component={FcpPlayerScreen} />
      {/* Torneos (gestión del club) */}
      <Stack.Screen name="ClubTournaments" component={ClubTournamentsRoute} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} />
    </Stack.Navigator>
  );
};
