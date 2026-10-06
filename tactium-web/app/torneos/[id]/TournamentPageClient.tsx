"use client";

import { useSession } from "@/lib/session";
import { TournamentDetail } from "@/components/tournaments/TournamentDetail";

/** Sólo el club organiza: los demás ven la ficha de espectador. */
export function TournamentPageClient({ id }: { id: string }) {
  const { role } = useSession();
  return <TournamentDetail id={id} spectator={role !== "club"} />;
}
