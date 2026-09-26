import type { Metadata } from "next";

import { ResetPasswordForm } from "./ResetPasswordForm";

// Solo se llega por el enlace del email de recuperación: fuera de buscadores.
export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Restablece la contraseña de tu cuenta TACTIUM.",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
