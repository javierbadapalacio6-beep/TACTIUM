import type { Metadata } from "next";
import { MyStats } from "@/components/social/social";

export const metadata: Metadata = { title: "Mis números" };

/** Liga · Amistosos · Plantilla en una sola barra; «Por pareja» va en Liga. */
export default function StatsPage() {
  return <MyStats />;
}
