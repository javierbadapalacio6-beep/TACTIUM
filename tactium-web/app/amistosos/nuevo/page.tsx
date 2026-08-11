import type { Metadata } from "next";
import { NewCasual } from "@/components/social/Casual";

export const metadata: Metadata = { title: "Registrar amistoso" };

export default function NuevoAmistosoPage() {
  return <NewCasual />;
}
