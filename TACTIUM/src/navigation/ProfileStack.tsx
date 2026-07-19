import React, { useMemo } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useColors } from '@core/theme';
import { ProfileScreen } from '@features/profile/screens/ProfileScreen';

// Stack wrapper de un solo screen para Profile. Ver nota en TeamStack.tsx
// — mismo motivo: los Tab.Screens directos sin Stack se quedaban
// mid-mount al primer focus en v7 bottom-tabs.

const Stack = createNativeStackNavigator();

export const ProfileStack = () => {
  const c = useColors();
  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: { backgroundColor: c.background },
      // `animation: 'none'`: el TabNavigator ya hace fade entre tabs. Si
      // este stack interno hace OTRO fade, en navegación rápida los dos
      // fade se superponen y queda un frame con opacity 0 = pantalla en
      // blanco. Como ProfileStack solo tiene 1 screen, no necesita
      // animación interna en absoluto.
      animation: 'none' as const,
    }),
    [c],
  );
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ProfileRoot" component={ProfileScreen} />
    </Stack.Navigator>
  );
};
