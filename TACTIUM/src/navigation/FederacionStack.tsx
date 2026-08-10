import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { FederacionScreen } from '@features/seasons/screens/FederacionScreen';
import { FederacionPickerScreen } from '@features/seasons/screens/FederacionPickerScreen';
import { FcpTeamScreen } from '@features/seasons/screens/FcpTeamScreen';
import { FcpPlayerScreen } from '@features/seasons/screens/FcpPlayerScreen';
import { FcpGroupScreen } from '@features/seasons/screens/FcpGroupScreen';

import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { FCP_FEDERATION_CODE } from '@core/services/fcpOnboarding';
import type { FederacionStackParamList } from './types';

const Stack = createNativeStackNavigator<FederacionStackParamList>();

// Pestaña Federación, compartida por el CAPITÁN y el CLUB. El root es el
// explorador directo si se hereda una federación con datos (FCantP); si no, el
// selector de federaciones. La federación "propia" viene del CLUB para el
// club_admin (no tiene equipo activo) y del EQUIPO para el capitán/jugador.
export const FederacionStack = () => {
  const c = useColors();
  const activeRole = useTeamStore((s) => s.activeRole);
  const teamFed = useTeamStore((s) => s.team?.federation ?? null);
  const clubFed = useClubStore(selectActiveClub)?.federation ?? null;
  const federation = activeRole === 'club_admin' ? clubFed : teamFed;
  const isCantabra = federation === FCP_FEDERATION_CODE;
  // FederacionScreen está tipado para el SeasonsStack; como raíz de esta stack
  // lo tratamos como componente genérico (mismos params: undefined).
  const RootComponent: React.ComponentType<any> = isCantabra
    ? FederacionScreen
    : FederacionPickerScreen;
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
      <Stack.Screen name="FederacionRoot" component={RootComponent} />
      {/* El explorador Cántabro, empujado desde el selector (equipos no-FCantP). */}
      <Stack.Screen name="Federacion" component={FederacionScreen} />
      <Stack.Screen name="FcpTeam" component={FcpTeamScreen} />
      <Stack.Screen name="FcpPlayer" component={FcpPlayerScreen} />
      <Stack.Screen name="FcpGroup" component={FcpGroupScreen} />
    </Stack.Navigator>
  );
};
