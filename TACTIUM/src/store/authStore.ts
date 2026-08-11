import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@core/supabase/client';
import {
  signInWithApple as svcSignInWithApple,
  signInWithGoogle as svcSignInWithGoogle,
  CANCELLED,
} from '@core/services/socialAuth';
import { unregisterPushToken } from '@core/push';

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
  ) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  sendPasswordReset: (email: string) => Promise<{ error?: string }>;
  signInWithApple: () => Promise<{ error?: string; cancelled?: boolean }>;
  signInWithGoogle: () => Promise<{ error?: string; cancelled?: boolean }>;
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

        // Recuperamos lo persistido por Supabase en AsyncStorage. Esto NO
        // hace red — solo lee el blob local.
        const { data } = await supabase.auth.getSession();

        // Verificación servidor-side: el refresh token persistido puede
        // apuntar a una sesión que ya no existe (típico cuando borras al
        // usuario del dashboard de Supabase Auth mientras la app aún tenía
        // cacheada su sesión). `getUser()` hace round-trip al servidor y
        // devuelve error si la sesión ya no es válida. Si lo es, limpiamos
        // localmente para que la próxima auto-renovación no lance
        // `AuthApiError: Invalid Refresh Token: Refresh Token Not Found`.
        let validSession = data.session;
        if (validSession) {
          const { error: userError } = await supabase.auth.getUser();
          if (userError) {
            await supabase.auth.signOut().catch(() => {});
            validSession = null;
          }
        }

        set({
          session: validSession,
          user: validSession?.user ?? null,
          isAuthenticated: !!validSession,
          isHydrating: false,
        });

        // Favoritos marcados como invitado: al entrar se suben y se fusionan
        // con los de la cuenta. Import diferido para no cargar el servicio
        // (ni su cadena) en el arranque de quien no ha marcado nada.
        const syncFavs = (uid: string) => {
          void import('@core/services/favorites')
            .then((m) => m.syncFavorites(uid))
            .catch(() => {});
        };
        if (validSession?.user?.id) syncFavs(validSession.user.id);

        supabase.auth.onAuthStateChange((_event, session) => {
          const prevId = get().user?.id ?? null;
          set({
            session,
            user: session?.user ?? null,
            isAuthenticated: !!session,
          });
          // Solo al pasar de sin-sesión (o de otra cuenta) a esta.
          const nextId = session?.user?.id ?? null;
          if (nextId && nextId !== prevId) syncFavs(nextId);
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
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: fullName ? { full_name: fullName } : undefined },
        });
        if (error) {
          set({ authError: error.message });
          return { error: error.message };
        }
        // Si la confirmación de email está DESACTIVADA en Supabase, signUp ya
        // devuelve sesión y onAuthStateChange mete al usuario directo. Solo
        // hace falta el aviso "revisa tu email" cuando NO hay sesión (= la
        // confirmación está activada). Así el mensaje se ajusta solo a la
        // config de Supabase sin tocar la app.
        return { needsConfirmation: !data.session };
      },

      sendPasswordReset: async (email) => {
        // El link del email apunta a la página web de reset en la landing,
        // donde el usuario fija nueva contraseña y vuelve a la app a entrar.
        // Cuando montemos deep linking nativo, esto pasará a `tactium://`.
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://tactium.io/auth/reset-password',
        });
        if (error) return { error: error.message };
        return {};
      },

      signInWithApple: async () => {
        set({ authError: null });
        const { error } = await svcSignInWithApple();
        if (error === CANCELLED) return { cancelled: true };
        if (error) {
          set({ authError: error });
          return { error };
        }
        return {};
      },

      signInWithGoogle: async () => {
        set({ authError: null });
        const { error } = await svcSignInWithGoogle();
        if (error === CANCELLED) return { cancelled: true };
        if (error) {
          set({ authError: error });
          return { error };
        }
        return {};
      },

      signOut: async () => {
        // Borrar el push token de este device ANTES de cerrar sesión (la RLS
        // exige auth.uid()); si no, el usuario seguiría recibiendo avisos aquí.
        await unregisterPushToken().catch(() => {});
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
