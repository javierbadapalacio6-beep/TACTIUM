"use client";

import { fetchSubscription, fetchClub } from "@/lib/queries";
import { useSession } from "@/lib/session";
import { useAsync } from "@/lib/use-async";
import { Card, Eyebrow } from "@/components/ui";
import { EmptyState, SkeletonCard } from "@/components/states";
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
      <Card>
        <EmptyState
          icon={<IconBuilding size={34} />}
          title="Sin club activo"
          body="Necesitas gestionar un club para importar equipos de la Federación."
        />
      </Card>
    );
  }
  if (loading) return <SkeletonCard />;

  // Sin suscripción → paywall (la acción de más valor va tras el plan).
  if (!data?.hasSub) {
    return (
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <Card
          style={{
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              width: 46,
              height: 46,
              borderRadius: 12,
              background: "var(--primary-dim)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
            }}
          >
            <IconFlag size={22} />
          </span>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Eyebrow>FUNCIÓN PREMIUM</Eyebrow>
            <h1 style={{ margin: "8px 0 6px", fontSize: 24 }}>
              Importar de la Federación es premium
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                color: "var(--text-muted)",
                textWrap: "pretty",
              }}
            >
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
