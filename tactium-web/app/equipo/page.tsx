import type { Metadata } from "next";
import { TeamSwitch } from "@/components/team/TeamSwitch";

export const metadata: Metadata = { title: "Plantilla" };

export default function EquipoPage() {
  return <TeamSwitch />;
}
