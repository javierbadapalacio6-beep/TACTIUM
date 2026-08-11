import { PublicProfileView } from "@/components/social/social";

export default async function PerfilPublicoPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <PublicProfileView username={username} />;
}
