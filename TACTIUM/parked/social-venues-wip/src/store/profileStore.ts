import { create } from 'zustand';

import { fetchMyProfile } from '@core/services/profile';

// ── DEV: forzar el paso de ALTA DE PERFIL en cada recarga ────────────────
// Con esto en `true`, en desarrollo la app te muestra siempre la pantalla de
// crear perfil (como un usuario nuevo). ⚠️ Si le das a "Entrar", escribirá en
// TU perfil real. Pon a `false` cuando termines. Solo aplica en __DEV__.
const DEV_FORCE_PROFILE_SETUP = __DEV__ && false;

// Store mínimo para el gate de alta de perfil (Fase 1d). Solo necesita saber
// si el usuario ya completó su perfil (`onboarded`). Fail-open: ante cualquier
// duda (sin perfil, error), NO bloquea → onboarded=true.
interface ProfileState {
  onboarded: boolean | null; // null = aún no cargado
  fullName: string | null;
  load: () => Promise<void>;
  markOnboarded: () => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set) => ({
  onboarded: null,
  fullName: null,
  load: async () => {
    try {
      const p = await fetchMyProfile();
      set({
        onboarded: DEV_FORCE_PROFILE_SETUP
          ? false
          : p
            ? !!p.onboarded
            : true, // sin perfil → no bloquear
        fullName: p?.full_name ?? null,
      });
    } catch {
      set({ onboarded: true }); // fail-open ante error de red
    }
  },
  markOnboarded: () => set({ onboarded: true }),
  reset: () => set({ onboarded: null, fullName: null }),
}));
