import type { Metadata } from "next";

import { FederationExplore } from "@/components/federation/Federation";
import { FCP_FED_NAME, FCP_SLUG } from "@/lib/seo/fcp";

type Params = Promise<{ fed: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { fed } = await params;
  if (fed !== FCP_SLUG) return { alternates: { canonical: `/federacion/${fed}` } };
  return {
    title: `${FCP_FED_NAME}: clasificaciones y resultados`,
    description: `Todos los grupos de la Liga Cántabra de Pádel: clasificaciones, jornadas, actas y rankings de la ${FCP_FED_NAME}, al día y sin cuenta.`,
    alternates: { canonical: `/federacion/${FCP_SLUG}` },
  };
}

export default async function FedPage({ params }: { params: Params }) {
  const { fed } = await params;
  return <FederationExplore slug={fed} />;
}
