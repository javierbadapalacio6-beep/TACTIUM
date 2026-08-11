import type { Metadata } from "next";
import { AddPlayers } from "@/components/entry/start";

export const metadata: Metadata = { title: "Añadir jugadores" };

export default function JugadoresPage() {
  return <AddPlayers />;
}
