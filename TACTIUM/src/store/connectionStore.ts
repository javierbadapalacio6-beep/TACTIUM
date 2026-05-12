import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface ConnectionState {
  // `isOnline` = `true` mientras tengamos conexión efectiva a internet.
  // Se actualiza vía NetInfo (Android: ConnectivityManager; iOS: NWPath).
  isOnline: boolean;
  // Marca de tiempo del último cambio. Útil si quieres lógica del tipo
  // "volvió hace <1s, no mostrar todavía".
  changedAt: number;
  // `initialized` previene registrar varios listeners.
  initialized: boolean;

  init: () => () => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
  isOnline: true,
  changedAt: 0,
  initialized: false,

  init: () => {
    if (get().initialized) {
      return () => {};
    }
    set({ initialized: true });
    // NetInfo emite el estado inicial inmediatamente al suscribirse.
    return NetInfo.addEventListener((state) => {
      const online =
        !!state.isConnected && state.isInternetReachable !== false;
      const prev = get().isOnline;
      if (online === prev) return;
      set({ isOnline: online, changedAt: Date.now() });
    });
  },
}));
