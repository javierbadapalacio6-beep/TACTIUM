import { CasualDetail } from "@/components/social/Casual";

export default async function AmistosoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <CasualDetail id={id} />;
}
