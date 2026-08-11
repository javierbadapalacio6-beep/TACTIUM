import { MatchdayView } from "@/components/matchday/MatchdayView";

export default async function JornadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchdayView id={id} />;
}
