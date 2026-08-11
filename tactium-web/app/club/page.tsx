import type { Metadata } from "next";
import { ClubDashboard } from "@/components/club/ClubDashboard";

export const metadata: Metadata = { title: "Club" };

export default function ClubPage() {
  return <ClubDashboard />;
}
