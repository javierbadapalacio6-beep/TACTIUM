import type { Metadata } from "next";
import { ClubSchedule } from "@/components/club/ClubSchedule";

export const metadata: Metadata = { title: "Horarios de local" };

export default function ClubHorariosPage() {
  return <ClubSchedule />;
}
