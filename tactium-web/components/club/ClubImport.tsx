"use client";

import { fetchSubscription, fetchClub } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card } from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import { IconBuilding } from "@/components/Icon";
import { ClubFcpImport } from "@/components/entry/start";
import { Paywall } from "@/components/subscription/Paywall";

/**
 * Importar de la Federación desde el panel del club.
 *
 * Espejo de la app (`ClubDashboardScreen` → `openFcpImport`): el VOLCADO
 * federativo es una función PREMIUM. Con suscripción activa se abre el
 * importador multi-equipo; sin ella se muestra el paywall (intent club), igual
 * que la app manda a la pantalla Paywall en vez de importar.
 */
export function ClubImport() {
  const { clubId } = useSession();

  const { data, loading } = useAsync(
    async () => {
      const [sub, club] = await Promise.all([
        fetchSubscription(),
        fetchClub(clubId!),
      ]);
      return { hasSub: !!sub, club };
    },
    [clubId],
    !!clubId,
  );

  if (!clubId) {
    return (
      <div className="tw-page">
        <Card>
          <EmptyState
            icon={<IconBuilding size={24} />}
            title="Sin club activo"
            body="Necesitas gestionar un club para importar equipos de la Federación."
          />
        </Card>
      </div>
    );
  }
  if (loading) return <SkeletonPage />;

  // Sin suscripción → paywall (la acción de más valor va tras el plan).
  if (!data?.hasSub) {
    return <Paywall motivo="club_import" para="club" />;
  }

  // Con suscripción → importador multi-equipo (mismo componente del onboarding).
  return (
    <ClubFcpImport clubId={clubId} clubName={data.club?.name ?? "tu club"} />
  );
}
