import type { Metadata } from "next";
import { ClubTeams } from "@/components/club/ClubTeams";

export const metadata: Metadata = { title: "Equipos del club" };

export default function ClubEquiposPage() {
  return <ClubTeams />;
}
