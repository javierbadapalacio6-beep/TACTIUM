import type { Metadata } from "next";
import { CreateClub } from "@/components/entry/start";

export const metadata: Metadata = { title: "Crear club" };

export default function CrearClubPage() {
  return <CreateClub />;
}
