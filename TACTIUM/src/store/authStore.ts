import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@core/supabase/client';

interface AuthState {
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  hasSeenWelcome: boolean;
  authError: string | null;

  hydrate: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithPassword: (
    email: string,
    password: string,
    fullName?: string,
  ) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  markWelcomeSeen: () => void;
  setAuthError: (msg: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      user: null,
      isAuthenticated: false,
      isHydrating: true,
      hasSeenWelcome: false,
      authError: null,

      hydrate: async () => {
        if (__DEV__) {
          // En dev: no restauramos sesión y forzamos volver a ver el onboarding.
          // Si hay una sesión previa guardada (de antes de desactivar persist),
          // la limpiamos para que el siguiente arranque sea consistente.
          try {
            await supabase.auth.signOut();
          } catch {
            /* sin sesión previa, sigue */
          }
          set({
            session: null,
            user: null,
            isAuthenticated: false,
            isHydrating: false,
            hasSeenWelcome: false,
          });
          supabase.auth.onAuthStateChange((_event, session) => {
            set({
              session,
              user: session?.user ?? null,
              isAuthenticated: !!session,
            });
          });
          return;
        }

        const { data } = await supabase.auth.getSession();
        set({
          session: data.session,
          user: data.session?.user ?? null,
          isAuthenticated: !!data.session,
          isHydrating: false,
        });

        supabase.auth.onAuthStateChange((_event, session) => {
          set({
            session,
            user: session?.user ?? null,
            isAuthenticated: !!session,
          });
        });
      },

      signInWithPassword: async (email, password) => {
        set({ authError: null });
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          set({ authError: error.message });
          return { error: error.message };
        }
        return {};
      },

      signUpWithPassword: async (email, password, fullName) => {
        set({ authError: null });
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: fullName ? { full_name: fullName } : undefined },
        });
        if (error) {
          set({ authError: error.message });
          return { error: error.message };
        }
        return {};
      },

      signOut: async () => {
        await supabase.auth.signOut();
        set({ session: null, user: null, isAuthenticated: false });
      },

      markWelcomeSeen: () => set({ hasSeenWelcome: true }),
      setAuthError: (msg) => set({ authError: msg }),
    }),
    {
      name: 'tactium-auth-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      // En dev no persistimos nada para que el splash/onboarding aparezca siempre.
      partialize: __DEV__
        ? () => ({} as Partial<AuthState>)
        : (s) => ({ hasSeenWelcome: s.hasSeenWelcome }),
    },
  ),
);
