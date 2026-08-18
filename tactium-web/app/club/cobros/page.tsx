import type { Metadata } from "next";
import { ClubCobros } from "@/components/club/ClubCobros";

export const metadata: Metadata = { title: "Cobros del club" };

export default function ClubCobrosPage() {
  return <ClubCobros />;
}
