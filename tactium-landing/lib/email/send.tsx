import { render } from "@react-email/components";
import {
  getEmailFrom,
  getResend,
  getTestRecipient,
  type EmailSendResult,
} from "./client";
import { WelcomeWaitlist } from "./templates/WelcomeWaitlist";

// Funciones de envío por template, tipadas. Cada una:
//   1. Renderiza el JSX a HTML (+ versión texto plana para clientes que no
//      soportan HTML, exigencia de buena reputación de envío).
//   2. Llama al SDK de Resend.
//   3. Devuelve { ok, id? } o { ok: false, error } normalizado.
//   4. Si no hay RESEND_API_KEY → devuelve { ok: true, skipped: true }.
//      Esto permite usar las funciones en serverless sin que un dev local
//      sin key vea errores en flows críticos (waitlist).
//
// Sandbox sin dominio: Resend rechaza envíos a destinatarios distintos a
// la cuenta. Para tests locales se redirige a RESEND_TEST_TO si está
// definido y `NODE_ENV !== 'production'`. En producción se respeta el
// `to` real — para entonces ya debe haber dominio verificado.

interface BaseArgs {
  to: string;
  siteUrl: string;
}

// El sandbox de Resend solo permite enviar al email de la cuenta. Para
// desarrollo, si RESEND_TEST_TO está configurado y no estamos en prod,
// redirigimos cualquier `to` a esa dirección — útil para probar el flow
// sin que el destinatario real reciba un email "de prueba".
function resolveRecipient(to: string): string {
  if (process.env.NODE_ENV === "production") return to;
  const testTo = getTestRecipient();
  if (testTo && testTo !== to) {
    console.log(`[email] redirigiendo ${to} → ${testTo} (dev sandbox)`);
    return testTo;
  }
  return to;
}

export async function sendWelcomeWaitlist(
  args: BaseArgs,
): Promise<EmailSendResult> {
  const resend = getResend();
  if (!resend) return { ok: true, skipped: true };

  const recipient = resolveRecipient(args.to);
  const html = await render(
    <WelcomeWaitlist to={args.to} siteUrl={args.siteUrl} />,
  );
  const text = await render(
    <WelcomeWaitlist to={args.to} siteUrl={args.siteUrl} />,
    { plainText: true },
  );

  try {
    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: recipient,
      subject: "Estás dentro · Esto es lo que viene",
      html,
      text,
      // Headers útiles para deliverability y debugging.
      headers: {
        "X-Entity-Ref-ID": `waitlist-${Date.now()}`,
      },
      tags: [
        { name: "template", value: "welcome-waitlist" },
        { name: "env", value: process.env.NODE_ENV ?? "development" },
      ],
    });
    if (error) {
      console.error("[email] sendWelcomeWaitlist failed", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[email] sendWelcomeWaitlist threw", message);
    return { ok: false, error: message };
  }
}

// Placeholders tipados para los próximos templates. Se implementan a
// medida que se conectan flows (registro, recovery, convocatoria).
// Dejarlos aquí declarados evita imports rotos cuando se referencien
// desde la app.
//
// export async function sendWelcomeRegister(args: ...): Promise<EmailSendResult> { ... }
// export async function sendPasswordRecovery(args: ...): Promise<EmailSendResult> { ... }
// export async function sendMatchdayConvocation(args: ...): Promise<EmailSendResult> { ... }
