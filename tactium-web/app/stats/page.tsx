import type { Metadata } from "next";
import { MyStats } from "@/components/social/social";

export const metadata: Metadata = { title: "Mis estadísticas" };

export default function StatsPage() {
  return <MyStats />;
}
