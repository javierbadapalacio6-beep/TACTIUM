import { AvailabilityView } from "@/components/team/Availability";

export default async function DisponibilidadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AvailabilityView id={id} />;
}
