"use client";

import { CreateTeam } from "@/components/entry/start";
import { useSession } from "@/lib/session";
import { SkeletonCard } from "@/components/states";

/**
 * Alta de equipo DESDE el panel del club: reutiliza el formulario de creación
 * (botones + import federativo) inyectándole el `clubId` de la sesión, de modo
 * que el equipo nace vinculado al club (no como equipo independiente).
 */
export function ClubCreateTeam() {
  const { clubId } = useSession();
  if (!clubId) return <SkeletonCard />;
  return <CreateTeam clubId={clubId} />;
}
