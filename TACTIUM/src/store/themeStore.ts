import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Modo de tema elegido por el usuario. 'system' sigue el modo claro/oscuro
// del iPhone. Default 'dark' (la app nació en oscuro).
export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'tactium-theme',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
