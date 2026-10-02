"use client";

import { useSession } from "@/lib/session";
import { BtnLink } from "@/components/ui";
import { IconChart, IconCreditCard, IconReceipt, IconUser } from "@/components/Icon";

/**
 * Accesos del apartado «Perfil»: el récord (antes «Stats», que ya no es
 * apartado propio), la suscripción y el perfil público. El club añade su
 * facturación, que antes colgaba del menú.
 */
export function ProfileShortcuts() {
  const { user, role, clubs, clubId } = useSession();
  const tournamentsOnly =
    role === "club" && (clubs.find((c) => c.id === clubId)?.tournamentsOnly ?? false);

  return (
    <>
      <BtnLink href="/stats" size="sm" icon={<IconChart size={15} />}>
        Mi récord
      </BtnLink>
      <BtnLink href="/suscripcion" size="sm" icon={<IconCreditCard size={15} />}>
        Mi suscripción
      </BtnLink>
      {role === "club" && !tournamentsOnly && (
        <BtnLink href="/club/facturacion" size="sm" icon={<IconReceipt size={15} />}>
          Facturación del club
        </BtnLink>
      )}
      {user?.username && (
        <BtnLink href={`/u/${user.username}`} size="sm" variant="quiet" icon={<IconUser size={15} />}>
          Perfil público
        </BtnLink>
      )}
    </>
  );
}
