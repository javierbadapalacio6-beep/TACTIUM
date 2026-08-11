import type { Metadata } from "next";
import { Welcome } from "@/components/entry/Welcome";

export const metadata: Metadata = { title: "Bienvenido" };

export default function BienvenidaPage() {
  return <Welcome />;
}
