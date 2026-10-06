import type { Metadata } from "next";

import { loadTournamentHead, tournamentMetadata } from "@/lib/seo/tournament";
import { TournamentPageClient } from "./TournamentPageClient";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  return tournamentMetadata(id, await loadTournamentHead(id));
}

export default async function TorneoPage({ params }: { params: Params }) {
  const { id } = await params;
  return <TournamentPageClient id={id} />;
}
