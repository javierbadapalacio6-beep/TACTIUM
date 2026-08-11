import type { Metadata } from "next";
import { ExploreTournaments } from "@/components/tournaments/ExploreTournaments";

export const metadata: Metadata = { title: "Torneos" };

export default function TorneosPage() {
  return <ExploreTournaments />;
}
