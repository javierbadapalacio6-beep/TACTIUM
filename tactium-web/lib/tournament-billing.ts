// Cobro por torneo — mirror de `TACTIUM/src/core/entitlements/tournamentBilling.ts`.
// Sincronizado MANUALMENTE con la app y la landing. El importe SIEMPRE se
// calcula en el servidor (aquí), nunca se confía en el cliente.

export interface TournamentTier {
  pairs: number;
  priceEur: number;
}
// Capacidad igualada a Xporty, 8 € por debajo en cada tramo (ver la app).
export const TOURNAMENT_TIERS: TournamentTier[] = [
  { pairs: 16, priceEur: 0 },
  { pairs: 40, priceEur: 25 },
  { pairs: 90, priceEur: 67 },
  { pairs: 150, priceEur: 117 },
  { pairs: 200, priceEur: 160 },
];
export const TOURNAMENT_EXTRA_PAIR_EUR = 2;
export const TOURNAMENT_FREE_PAIRS = 16;

// Topes de torneo incluidos por plan de club (mirror de plans.ts).
export const PLAN_TOURNAMENT_PAIR_CAP: Record<string, number | null> = {
  captain: null,
  club_starter: 32,
  club_pro: 64,
  club_elite: 128,
};

// Precio por PAREJAS INSCRITAS (antes eran las plazas fijadas al crear el
// torneo). Espejo de TACTIUM/src/core/entitlements/tournamentBilling.ts.
export function perTournamentPriceEur(pairs: number): number {
  for (const t of TOURNAMENT_TIERS) {
    if (pairs <= t.pairs) return t.priceEur;
  }
  const top = TOURNAMENT_TIERS[TOURNAMENT_TIERS.length - 1];
  return top.priceEur + (pairs - top.pairs) * TOURNAMENT_EXTRA_PAIR_EUR;
}

export type TournamentBilling =
  | { kind: "included" }
  | { kind: "free" }
  | { kind: "payable"; amountEur: number; reason: "overage" | "per_tournament" };

export function computeTournamentBilling(input: {
  pairs: number;
  planPairCap: number | null;
  hasActiveSub: boolean;
}): TournamentBilling {
  const { pairs, planPairCap, hasActiveSub } = input;
  if (hasActiveSub && planPairCap != null) {
    if (pairs <= planPairCap) return { kind: "included" };
    return {
      kind: "payable",
      amountEur: (pairs - planPairCap) * TOURNAMENT_EXTRA_PAIR_EUR,
      reason: "overage",
    };
  }
  if (pairs <= TOURNAMENT_FREE_PAIRS) return { kind: "free" };
  return {
    kind: "payable",
    amountEur: perTournamentPriceEur(pairs),
    reason: "per_tournament",
  };
}
