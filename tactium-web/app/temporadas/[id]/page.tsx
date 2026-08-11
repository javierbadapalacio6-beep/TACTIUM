import { SeasonDetail } from "@/components/seasons/SeasonDetail";

export default async function TemporadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SeasonDetail id={id} />;
}
