import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { WelcomeScreen } from '@features/auth/screens/WelcomeScreen';
import { LoginScreen } from '@features/auth/screens/LoginScreen';
import { useAuthStore } from '@store/authStore';

import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthStack = () => {
  const hasSeenWelcome = useAuthStore((s) => s.hasSeenWelcome);
  return (
    <Stack.Navigator
      initialRouteName={hasSeenWelcome ? 'Login' : 'Welcome'}
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
    </Stack.Navigator>
  );
};
