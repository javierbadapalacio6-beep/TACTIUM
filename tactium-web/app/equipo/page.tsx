import type { Metadata } from "next";
import { Roster } from "@/components/team/Roster";

export const metadata: Metadata = { title: "Plantilla" };

export default function EquipoPage() {
  return <Roster />;
}
