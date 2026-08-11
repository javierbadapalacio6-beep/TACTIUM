import { ClubTeamView } from "@/components/club/ClubTeamView";

export default async function ClubEquipoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClubTeamView id={id} />;
}
