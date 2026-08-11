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
  club_starter: 40,
  club_pro: 90,
  club_elite: 150,
};

export function perTournamentPriceEur(maxPairs: number): number {
  for (const t of TOURNAMENT_TIERS) {
    if (maxPairs <= t.pairs) return t.priceEur;
  }
  const top = TOURNAMENT_TIERS[TOURNAMENT_TIERS.length - 1];
  return top.priceEur + (maxPairs - top.pairs) * TOURNAMENT_EXTRA_PAIR_EUR;
}

export type TournamentBilling =
  | { kind: "included" }
  | { kind: "free" }
  | { kind: "payable"; amountEur: number; reason: "overage" | "per_tournament" }
  | { kind: "needs_size" };

export function computeTournamentBilling(input: {
  maxPairs: number | null;
  planPairCap: number | null;
  hasActiveSub: boolean;
}): TournamentBilling {
  const { maxPairs, planPairCap, hasActiveSub } = input;
  if (hasActiveSub && planPairCap != null) {
    if (maxPairs == null) return { kind: "needs_size" };
    if (maxPairs <= planPairCap) return { kind: "included" };
    return {
      kind: "payable",
      amountEur: (maxPairs - planPairCap) * TOURNAMENT_EXTRA_PAIR_EUR,
      reason: "overage",
    };
  }
  if (maxPairs == null) return { kind: "needs_size" };
  if (maxPairs <= TOURNAMENT_FREE_PAIRS) return { kind: "free" };
  return {
    kind: "payable",
    amountEur: perTournamentPriceEur(maxPairs),
    reason: "per_tournament",
  };
}
