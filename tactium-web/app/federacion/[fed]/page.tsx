import { FederationExplore } from "@/components/federation/Federation";

export default async function FedPage({
  params,
}: {
  params: Promise<{ fed: string }>;
}) {
  const { fed } = await params;
  return <FederationExplore slug={fed} />;
}
