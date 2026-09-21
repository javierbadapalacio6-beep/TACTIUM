"use client";

import { fetchSubscription, fetchClub } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Chip, IconTile } from "@/components/ui";
import { EmptyState, SkeletonPage } from "@/components/states";
import { IconBuilding, IconFlag } from "@/components/Icon";
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
    return (
      <div className="tw-page">
        <Card
          style={{
            marginBottom: 16,
            display: "flex",
            alignItems: "center",
            gap: 14,
            flexWrap: "wrap",
          }}
        >
          <IconTile>
            <IconFlag size={17} />
          </IconTile>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 18 }}>Importar de la Federación es premium</h2>
              <Chip plain>Función premium</Chip>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 13.5, color: "var(--text-muted)" }}>
              Crea todos los equipos del club con su plantilla y sus puntos
              oficiales de la Federación en un clic. Con suscripción es
              automático; contrata un plan para desbloquearlo.
            </p>
          </div>
        </Card>
        <Paywall />
      </div>
    );
  }

  // Con suscripción → importador multi-equipo (mismo componente del onboarding).
  return (
    <ClubFcpImport clubId={clubId} clubName={data.club?.name ?? "tu club"} />
  );
}
