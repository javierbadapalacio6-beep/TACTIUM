import { SignupForm } from "@/components/tournaments/SignupForm";

export default async function InscripcionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SignupForm id={id} />;
}
