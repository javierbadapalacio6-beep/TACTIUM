import type { Metadata } from "next";
import { FederationPicker } from "@/components/federation/Federation";

export const metadata: Metadata = {
  title: "Pádel federado",
  description:
    "Clasificaciones, jornadas, actas y rankings de la competición federada de pádel, sin cuenta. Hoy, la Federación Cántabra; el resto irán entrando.",
  alternates: { canonical: "/federacion" },
};

export default function FederacionPage() {
  return <FederationPicker />;
}
