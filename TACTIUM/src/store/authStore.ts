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
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
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
        // Restaura la sesión persistida por Supabase (AsyncStorage) y
        // suscribe cambios. Idéntico en dev y prod: el splash/onboarding
        // sólo debe verse la PRIMERA vez (controlado por `hasSeenWelcome`).
        //
        // Esperamos también la hidratación de zustand-persist para que
        // `hasSeenWelcome` esté ya cargado antes de quitar el loader,
        // si no AuthStack vería false momentáneamente y montaría Welcome
        // en vez de Login.
        if (!useAuthStore.persist.hasHydrated()) {
          await new Promise<void>((resolve) => {
            const unsub = useAuthStore.persist.onFinishHydration(() => {
              unsub();
              resolve();
            });
          });
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

      sendPasswordReset: async (email) => {
        // Dispara el email de reset de Supabase. Sin redirectTo: el usuario
        // recibe un link que abre la consola web de Supabase para fijar
        // nueva contraseña. Más adelante podemos usar deep links + un
        // ResetPasswordScreen propio si se quiere flujo 100% in-app.
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) return { error: error.message };
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
      // Persistimos `hasSeenWelcome` para que el splash/onboarding sólo
      // aparezca la primera vez que el usuario abre la app. Sesión (token)
      // la gestiona Supabase directamente vía su propio storage adapter.
      partialize: (s) => ({ hasSeenWelcome: s.hasSeenWelcome }),
    },
  ),
);
