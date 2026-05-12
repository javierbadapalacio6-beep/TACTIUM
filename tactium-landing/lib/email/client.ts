import { Resend } from "resend";

// Singleton del SDK Resend. Reutilizamos la instancia entre requests para
// que el connection pool de Node se mantenga caliente. La key se lee SOLO
// en server (nunca expuesta al cliente).
//
// Si la key no está, exportamos null y los `send*` lo detectan y no
// rompen: hacen log warning y devuelven { skipped: true }. Esto evita que
// un envío en local sin RESEND_API_KEY rompa flujos críticos (waitlist).

let cached: Resend | null = null;

export function getResend(): Resend | null {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(
      "[email] RESEND_API_KEY no definida — los envíos se omitirán",
    );
    return null;
  }
  cached = new Resend(key);
  return cached;
}

// Sender por defecto. Sin dominio verificado usamos el sandbox de Resend
// (onboarding@resend.dev) que sólo permite enviar a tu propia cuenta.
// Cuando registremos tactium.io, sólo cambiamos EMAIL_FROM y desbloquea
// envíos a cualquier destinatario.
export function getEmailFrom(): string {
  return process.env.EMAIL_FROM ?? "TACTIUM <onboarding@resend.dev>";
}

// Email sandbox de pruebas. En modo dev sin dominio, los envíos a
// destinatarios distintos al de tu cuenta Resend son rechazados. Para
// previsualizar templates contra tu propia bandeja, usar este getter.
export function getTestRecipient(): string | null {
  return process.env.RESEND_TEST_TO ?? null;
}

// Resultado normalizado de un envío. `skipped` indica que no hubo key
// (modo dev sin Resend) — no es un error, sólo un no-op. `error` lleva
// el mensaje del SDK si falló.
export interface EmailSendResult {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}
