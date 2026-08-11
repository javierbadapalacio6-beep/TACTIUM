import type { Metadata } from "next";

import { MiSuscripcion } from "@/components/subscription/MiSuscripcion";

export const metadata: Metadata = { title: "Mi suscripción" };

export default function SuscripcionPage() {
  return <MiSuscripcion />;
}
