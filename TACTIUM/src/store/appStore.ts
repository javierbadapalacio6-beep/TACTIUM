import { create } from 'zustand';

interface AppState {
  isLoading: boolean;
  theme: 'light' | 'dark';
  // Actions
  setLoading: (loading: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>((set) => ({
  isLoading: false,
  theme: 'light',

  setLoading: (loading) => set({ isLoading: loading }),
  setTheme: (theme) => set({ theme }),
}));
