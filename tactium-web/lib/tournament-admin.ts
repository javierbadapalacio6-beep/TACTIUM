"use client";

import { supabaseBrowser } from "./supabase/client";

/**
 * Alta manual de una pareja por el organizador.
 *
 * Copia de `addRegistration` de la app (TACTIUM/src/core/services/tournaments.ts):
 * insert directo en `tournament_registrations`, que la RLS solo deja al club
 * organizador. El nombre del jugador 2 es opcional (en americano/mexicano se
 * apunta a una persona) y los puntos sirven para la siembra.
 *
 * No pasa por `guardedWrite`: quien llama lo envuelve.
 */
export async function addTournamentRegistration(input: {
  tournamentId: string;
  gender?: string | null;
  category?: string | null;
  p1Name: string;
  p2Name?: string;
  p1Email?: string;
  p1Phone?: string;
  seedPoints?: number | null;
}): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("tournament_registrations")
    .insert({
      tournament_id: input.tournamentId,
      gender: input.gender ?? null,
      category: input.category ?? null,
      p1_name: input.p1Name.trim(),
      p2_name: input.p2Name?.trim() || null,
      p1_email: input.p1Email?.trim() || null,
      p1_phone: input.p1Phone?.trim() || null,
      seed_points: input.seedPoints ?? null,
      availability: [],
    });
  if (error) throw error;
}
