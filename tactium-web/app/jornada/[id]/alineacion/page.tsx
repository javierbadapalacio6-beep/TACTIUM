import { LineupBoard } from "@/components/lineup/LineupBoard";

export default async function AlineacionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LineupBoard id={id} />;
}
