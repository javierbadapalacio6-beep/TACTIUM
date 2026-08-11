"use client";

import { use } from "react";

import { useSession } from "@/lib/session";
import { TournamentDetail } from "@/components/tournaments/TournamentDetail";

export default function TorneoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { role } = useSession();
  // Sólo el club organiza: los demás ven la ficha de espectador.
  return <TournamentDetail id={id} spectator={role !== "club"} />;
}
