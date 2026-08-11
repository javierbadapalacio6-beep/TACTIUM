import { FcpGroupView } from "@/components/federation/Federation";

export default async function GrupoPage({
  params,
}: {
  params: Promise<{ fed: string; id: string }>;
}) {
  const { fed, id } = await params;
  return <FcpGroupView slug={fed} id={id} />;
}
