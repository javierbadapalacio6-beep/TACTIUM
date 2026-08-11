import type { Metadata } from "next";
import { Feed } from "@/components/social/social";

export const metadata: Metadata = { title: "Novedades" };

export default function NovedadesPage() {
  return <Feed />;
}
