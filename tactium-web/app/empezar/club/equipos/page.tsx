import type { Metadata } from "next";
import { CreateClubTeams } from "@/components/entry/start";

export const metadata: Metadata = { title: "Equipos del club" };

export default function EquiposClubPage() {
  return <CreateClubTeams />;
}
