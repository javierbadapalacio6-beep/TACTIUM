import type { Metadata } from "next";

import { FcpPlayerView } from "@/components/federation/Federation";
import { loadFcpPlayerName, playerMetadata } from "@/lib/seo/fcp";

type Params = Promise<{ fed: string; id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const idJugador = decodeURIComponent(id);
  return playerMetadata(idJugador, await loadFcpPlayerName(idJugador));
}

export default async function FcpJugadorPage({ params }: { params: Params }) {
  const { id } = await params;
  return <FcpPlayerView id={id} />;
}
