import type { Metadata } from "next";
import { CreateTournament } from "@/components/tournaments/CreateTournament";

export const metadata: Metadata = { title: "Torneos del club" };

export default function ClubTorneosPage() {
  return <CreateTournament />;
}
