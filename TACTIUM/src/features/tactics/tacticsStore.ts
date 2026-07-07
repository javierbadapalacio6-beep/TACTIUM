import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Action, Formation } from './actions';
import type { BallLeg, Frame, SavedPlay } from './plays';

interface TacticsState {
  savedPlays: SavedPlay[];
  savePlay: (input: {
    name: string;
    frames: Frame[];
    ballLegs: BallLeg[];
    assignedIds: (string | null)[];
    script?: Action[];
    formation?: Formation;
  }) => SavedPlay;
  deletePlay: (id: string) => void;
  renamePlay: (id: string, name: string) => void;
}

const newId = () =>
  `play_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`;

// Persiste localmente las jugadas creadas por el usuario. (La sincronización
// con Supabase llegará en una fase posterior — de momento todo es local, sin
// tocar la base de datos de producción.)
export const useTacticsStore = create<TacticsState>()(
  persist(
    (set) => ({
      savedPlays: [],

      savePlay: ({ name, frames, ballLegs, assignedIds, script, formation }) => {
        const play: SavedPlay = {
          id: newId(),
          name: name.trim() || 'Jugada',
          // Copia profunda para desacoplar de los shared values de la pizarra.
          frames: frames.map((f) => f.map((p) => ({ x: p.x, y: p.y }))),
          ballLegs: [...ballLegs],
          assignedIds: [...assignedIds],
          createdAt: Date.now(),
          script: script ? [...script] : undefined,
          formation,
        };
        set((s) => ({ savedPlays: [play, ...s.savedPlays] }));
        return play;
      },

      deletePlay: (id) =>
        set((s) => ({ savedPlays: s.savedPlays.filter((p) => p.id !== id) })),

      renamePlay: (id, name) =>
        set((s) => ({
          savedPlays: s.savedPlays.map((p) =>
            p.id === id ? { ...p, name: name.trim() || p.name } : p,
          ),
        })),
    }),
    {
      name: 'tactium-tactics-plays',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
