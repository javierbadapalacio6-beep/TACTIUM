import type { Metadata } from "next";

import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = { title: "Perfil" };

/** «Perfil» de la navegación única: el perfil social, como en la app. */
export default function PerfilPage() {
  return <ProfileView />;
}
