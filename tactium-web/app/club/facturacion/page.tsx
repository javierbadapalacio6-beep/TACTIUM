import type { Metadata } from "next";

import { ClubBilling } from "@/components/club/ClubBilling";

export const metadata: Metadata = { title: "Facturación del club" };

export default function FacturacionClubPage() {
  return <ClubBilling />;
}
