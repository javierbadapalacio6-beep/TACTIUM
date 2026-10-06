import type { Metadata } from "next";
import { ExploreTournaments } from "@/components/tournaments/ExploreTournaments";

export const metadata: Metadata = {
  title: "Torneos de pádel",
  description:
    "Torneos de pádel con inscripción abierta y en juego: cuadros, horarios y resultados en directo, sin cuenta. Y si organizas uno, móntalo aquí.",
  alternates: { canonical: "/torneos" },
};

export default function TorneosPage() {
  return <ExploreTournaments />;
}
