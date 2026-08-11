"use client";

import { useSession } from "@/lib/session";
import { AvailabilityView } from "@/components/team/Availability";

export default function DisponibilidadPage() {
  const { role } = useSession();
  return <AvailabilityView isCaptain={role === "capitan" || role === "club"} />;
}
