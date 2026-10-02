import { createNavigationContainerRef } from '@react-navigation/native';

import type { RootStackParamList } from './types';

/**
 * Ref del NavigationContainer para navegar desde fuera de las pantallas
 * (p. ej. al tocar una notificación push).
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
