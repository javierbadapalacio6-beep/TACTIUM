import type { Metadata } from "next";
import { SeasonsList } from "@/components/seasons/SeasonsList";

export const metadata: Metadata = { title: "Temporadas" };

export default function TemporadasPage() {
  return <SeasonsList />;
}
