import type { Metadata } from "next";

import { ClubCoverTeams } from "@/components/club/ClubCoverTeams";

export const metadata: Metadata = { title: "Elige qué equipos cubre" };

export default function CubrirEquiposPage() {
  return <ClubCoverTeams />;
}
