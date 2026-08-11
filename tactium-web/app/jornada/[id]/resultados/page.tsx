import { ResultsView } from "@/components/matchday/ResultsView";

export default async function ResultadosPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ResultsView id={id} />;
}
