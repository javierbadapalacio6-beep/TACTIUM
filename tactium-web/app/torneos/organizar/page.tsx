import type { Metadata } from "next";

import { OrganizeTournament } from "@/components/tournaments/OrganizeTournament";

export const metadata: Metadata = {
  title: "Organizar un torneo de pádel",
  description:
    "Monta tu torneo de pádel con inscripción online, cuadros, horario por pistas y resultados en directo. Hasta 16 parejas gratis, seas club o no.",
  alternates: { canonical: "/torneos/organizar" },
};

export default function OrganizarTorneoPage() {
  return <OrganizeTournament />;
}
