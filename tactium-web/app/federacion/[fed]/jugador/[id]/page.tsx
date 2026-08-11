import { FcpPlayerView } from "@/components/federation/Federation";

export default async function FcpJugadorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <FcpPlayerView id={id} />;
}
