import type { Metadata } from "next";
import { Community } from "@/components/social/social";

export const metadata: Metadata = { title: "Comunidad" };

export default function ComunidadPage() {
  return <Community />;
}
