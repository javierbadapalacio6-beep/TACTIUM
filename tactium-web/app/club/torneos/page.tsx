import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateTournament } from "@/components/tournaments/CreateTournament";

export const metadata: Metadata = { title: "Torneos del club" };

// `CreateTournament` lee `?nuevo=1` con useSearchParams: necesita su Suspense.
export default function ClubTorneosPage() {
  return (
    <Suspense>
      <CreateTournament />
    </Suspense>
  );
}
