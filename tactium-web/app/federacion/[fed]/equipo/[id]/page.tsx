import { FcpTeamView } from "@/components/federation/Federation";

export default async function FcpEquipoPage({
  params,
}: {
  params: Promise<{ fed: string; id: string }>;
}) {
  const { fed, id } = await params;
  return <FcpTeamView slug={fed} id={id} />;
}
