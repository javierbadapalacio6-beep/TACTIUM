import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { TeamScreen } from '@features/team/screens/TeamScreen';

// Stack wrapper de un solo screen para Team. La razón NO es que necesitemos
// sub-pantallas hoy (Team es plano), sino que en @react-navigation/bottom-tabs
// v7.x los Tab.Screens montados como componente directo (sin Stack interno)
// se quedan mid-mount al primer focus — verde oscuro sin contenido — mientras
// que los Tab.Screens envueltos en Stack montan limpio porque el Stack
// absorbe el mount cycle. Patrón observado: HomeStack/SeasonsStack/ClubStack
// funcionan, TeamScreen/ProfileScreen directos no.
//
// Si en el futuro Team tiene sub-pantallas (TeamDetail, PlayerEdit, etc.),
// se añaden aquí como Stack.Screen extra.

const Stack = createNativeStackNavigator();

export const TeamStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: Colors.background },
      // `animation: 'none'`: el TabNavigator ya hace fade entre tabs, no
      // duplicamos aquí (dos fades superpuestos en nav rápida dejan un
      // frame opacity 0). El wrapper Stack sigue cumpliendo su función
      // (absorber el mount cycle) sin animación propia.
      animation: 'none',
    }}
  >
    <Stack.Screen name="TeamRoot" component={TeamScreen} />
  </Stack.Navigator>
);
