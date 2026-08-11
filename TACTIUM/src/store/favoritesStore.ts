import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Favoritos — equipos, jugadores y federaciones.
 *
 * Se guardan EN EL DISPOSITIVO y funcionan sin cuenta. Es deliberado: quien
 * llega sin registrarse puede marcar su club o su federación, volver al día
 * siguiente y encontrárselos. Eso le da un motivo para crear la cuenta en
 * lugar de pedírsela por adelantado.
 *
 * Al iniciar sesión, `syncFavorites()` los sube y los fusiona con los que ya
 * tuviera la cuenta (ver `core/services/favorites.ts`). Nada se pierde por
 * haber empezado como invitado.
 */

export type FavoriteKind = 'team' | 'player' | 'federation';

export interface Favorite {
  kind: FavoriteKind;
  /** Identificador dentro de su tipo: idEquipo, idJugador o código de federación. */
  refId: string;
  /** Qué enseñar sin tener que ir a buscarlo. */
  label: string;
  /** Segunda línea opcional (categoría, región, equipo…). */
  meta?: string | null;
  /** Marca de tiempo local; el servidor guarda la suya. */
  addedAt: number;
}

/** Clave única de un favorito: el mismo id puede existir en dos tipos. */
export const favKey = (kind: FavoriteKind, refId: string) => `${kind}:${refId}`;

interface FavoritesState {
  items: Favorite[];
  /** Marcados desde que se instaló la app y aún sin subir a ninguna cuenta. */
  pendingSync: boolean;
  has: (kind: FavoriteKind, refId: string) => boolean;
  toggle: (fav: Omit<Favorite, 'addedAt'>) => void;
  remove: (kind: FavoriteKind, refId: string) => void;
  /** Fusiona lo que devuelve el servidor sin perder lo local. */
  merge: (remote: Favorite[]) => void;
  markSynced: () => void;
  clear: () => void;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      items: [],
      pendingSync: false,

      has: (kind, refId) =>
        get().items.some((f) => f.kind === kind && f.refId === refId),

      toggle: (fav) => {
        const exists = get().has(fav.kind, fav.refId);
        set((s) => ({
          items: exists
            ? s.items.filter(
                (f) => !(f.kind === fav.kind && f.refId === fav.refId),
              )
            : [{ ...fav, addedAt: Date.now() }, ...s.items],
          pendingSync: true,
        }));
      },

      remove: (kind, refId) =>
        set((s) => ({
          items: s.items.filter((f) => !(f.kind === kind && f.refId === refId)),
          pendingSync: true,
        })),

      merge: (remote) =>
        set((s) => {
          const byKey = new Map<string, Favorite>();
          // El local va primero: si el usuario acaba de marcar algo, su
          // etiqueta es la más fresca.
          for (const f of [...s.items, ...remote]) {
            const k = favKey(f.kind, f.refId);
            if (!byKey.has(k)) byKey.set(k, f);
          }
          return {
            items: [...byKey.values()].sort((a, b) => b.addedAt - a.addedAt),
          };
        }),

      markSynced: () => set({ pendingSync: false }),
      clear: () => set({ items: [], pendingSync: false }),
    }),
    {
      name: 'tactium-favorites',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
