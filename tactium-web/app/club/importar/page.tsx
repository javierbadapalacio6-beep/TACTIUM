import type { Metadata } from "next";
import { ClubImport } from "@/components/club/ClubImport";

export const metadata: Metadata = { title: "Importar de la Federación" };

export default function ClubImportarPage() {
  return <ClubImport />;
}
