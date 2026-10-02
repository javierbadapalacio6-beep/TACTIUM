import type { Metadata } from "next";
import { Compete } from "@/components/compete/Compete";

export const metadata: Metadata = { title: "Competir" };

export default function CompetirPage() {
  return <Compete />;
}
