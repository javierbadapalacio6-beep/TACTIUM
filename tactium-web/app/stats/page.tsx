import type { Metadata } from "next";
import { MyStats } from "@/components/social/social";
import { PairStats } from "@/components/team/PairStats";

export const metadata: Metadata = { title: "Mis estadísticas" };

export default function StatsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <MyStats />
      {/* Solo aparece si hay equipo activo con partidos jugados. */}
      <PairStats />
    </div>
  );
}
