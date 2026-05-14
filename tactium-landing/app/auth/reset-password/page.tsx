import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

// Página de reset password — accesible sólo via link del email de recovery
// de Supabase. No queremos que se indexe en Google ni que aparezca en
// sitemap (no aporta valor SEO y puede confundir).
export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Restablece la contraseña de tu cuenta TACTIUM.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
