import type { Metadata } from "next";
import { ClubCreateTeam } from "@/components/club/ClubCreateTeam";

export const metadata: Metadata = { title: "Nuevo equipo del club" };

export default function ClubNuevoEquipoPage() {
  return <ClubCreateTeam />;
}
