import { create } from 'zustand';

import { getMyVenue, type MyVenue } from '@core/services/venues';

// Estado global de la sede que posee el usuario (cuenta de negocio). Permite
// que el TabNavigator adapte las tabs (Equipo → Mi sede) sin que cada pantalla
// tenga que consultar getMyVenue. Se carga en App.tsx al autenticar.
interface VenueState {
  venue: MyVenue | null;
  hasLoaded: boolean;
  load: (ownerId?: string | null) => Promise<void>;
  setVenue: (v: MyVenue | null) => void;
  reset: () => void;
}

export const useVenueStore = create<VenueState>((set) => ({
  venue: null,
  hasLoaded: false,
  load: async (ownerId) => {
    try {
      const v = await getMyVenue(ownerId);
      set({ venue: v, hasLoaded: true });
    } catch {
      set({ venue: null, hasLoaded: true });
    }
  },
  setVenue: (v) => set({ venue: v }),
  reset: () => set({ venue: null, hasLoaded: false }),
}));
