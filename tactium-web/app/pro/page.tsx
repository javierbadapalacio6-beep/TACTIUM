import type { Metadata } from "next";

import { Paywall } from "@/components/subscription/Paywall";

export const metadata: Metadata = {
  title: "TACTIUM Pro",
  description:
    "Alineaciones, actas, torneos y federación en un sitio hecho para capitanes. 14 días de prueba.",
};

export default function ProPage() {
  return <Paywall />;
}
