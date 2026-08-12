import { create } from 'zustand';

import * as ClubsApi from '@core/services/clubs';

export type Club = ClubsApi.Club;
export type ClubMember = ClubsApi.ClubMember;

interface ClubState {
  clubs: Club[];
  activeClubId: string | null;
  isLoading: boolean;
  hasLoadedOnce: boolean;
  error: string | null;

  loadForUser: () => Promise<void>;
  reset: () => void;
  setActiveClub: (clubId: string | null) => void;
  createClub: (input: {
    name: string;
    federation?: string;
    tournamentsOnly?: boolean;
  }) => Promise<Club>;
  // Desbloquea la gestión de equipos en un club creado en modo "solo torneos":
  // pone `tournaments_only=false` y el menú del club pasa a completo. Puede fijar
  // de paso la federación del club (los equipos la heredan; sin ella solo hay
  // ligas privadas). `federation === undefined` la deja como estaba.
  unlockTeamManagement: (
    clubId: string,
    federation?: string | null,
  ) => Promise<void>;
  deleteClub: (clubId: string) => Promise<void>;
}

export const useClubStore = create<ClubState>()((set, get) => ({
  clubs: [],
  activeClubId: null,
  isLoading: false,
  hasLoadedOnce: false,
  error: null,

  loadForUser: async () => {
    set({ isLoading: true, error: null });
    try {
      const clubs = await ClubsApi.fetchMyClubs();
      const activeClubId = get().activeClubId ?? clubs[0]?.id ?? null;
      set({
        clubs,
        activeClubId,
        isLoading: false,
        hasLoadedOnce: true,
      });
    } catch (e: any) {
      set({ error: e.message, isLoading: false, hasLoadedOnce: true });
    }
  },

  reset: () =>
    set({
      clubs: [],
      activeClubId: null,
      isLoading: false,
      hasLoadedOnce: false,
      error: null,
    }),

  setActiveClub: (clubId) => set({ activeClubId: clubId }),

  createClub: async (input) => {
    const club = await ClubsApi.createClub(input);
    set((s) => ({ clubs: [...s.clubs, club], activeClubId: club.id }));
    return club;
  },

  unlockTeamManagement: async (clubId, federation) => {
    const patch: ClubsApi.ClubUpdate = { tournaments_only: false };
    if (federation !== undefined) patch.federation = federation;
    const updated = await ClubsApi.updateClub(clubId, patch);
    set((s) => ({
      clubs: s.clubs.map((c) => (c.id === clubId ? updated : c)),
    }));
  },

  deleteClub: async (clubId) => {
    await ClubsApi.deleteClub(clubId);
    set((s) => {
      const clubs = s.clubs.filter((c) => c.id !== clubId);
      const activeClubId =
        s.activeClubId === clubId ? (clubs[0]?.id ?? null) : s.activeClubId;
      return { clubs, activeClubId };
    });
  },
}));

// Selectores derivados
export const selectActiveClub = (s: ClubState): Club | null =>
  s.clubs.find((c) => c.id === s.activeClubId) ?? null;

export const selectIsClubAdmin = (s: ClubState): boolean =>
  s.clubs.length > 0;
