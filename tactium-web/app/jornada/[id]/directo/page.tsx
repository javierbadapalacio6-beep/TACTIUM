import { LiveCourtScorer } from "@/components/matchday/LiveCourtScorer";

export const metadata = {
  title: "Marcar en directo",
  robots: { index: false, follow: false },
};

export default async function DirectoJornadaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ pista?: string }>;
}) {
  const { id } = await params;
  const { pista } = await searchParams;
  const n = Number(pista);
  const court = Number.isInteger(n) && n >= 1 && n <= 12 ? n : 1;
  return <LiveCourtScorer key={id} id={id} court={court} />;
}
