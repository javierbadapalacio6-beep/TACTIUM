import type { Metadata } from "next";

import { OrganizeTournament } from "@/components/tournaments/OrganizeTournament";

export const metadata: Metadata = {
  title: "Organizar un torneo",
  description: "Monta un torneo de pádel aunque no seas un club.",
};

export default function OrganizarTorneoPage() {
  return <OrganizeTournament />;
}
