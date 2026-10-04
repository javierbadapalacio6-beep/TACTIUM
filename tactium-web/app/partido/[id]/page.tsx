import { PublicMatchday } from "@/components/matchday/PublicMatchday";

export const metadata = {
  title: "Partido de liga · TACTIUM",
  description: "Resultado de una jornada de liga, pista a pista.",
};

export default async function PartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PublicMatchday id={id} />;
}
