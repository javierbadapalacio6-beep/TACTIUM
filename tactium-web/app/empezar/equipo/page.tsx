import type { Metadata } from "next";
import { CreateTeam } from "@/components/entry/start";

export const metadata: Metadata = { title: "Crear equipo" };

export default function CrearEquipoPage() {
  return <CreateTeam />;
}
