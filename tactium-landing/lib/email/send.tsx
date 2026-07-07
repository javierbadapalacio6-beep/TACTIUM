import { render } from "@react-email/components";
import {
  getEmailFrom,
  getResend,
  getTestRecipient,
  type EmailSendResult,
} from "./client";
import { WelcomeWaitlist } from "./templates/WelcomeWaitlist";
import { LaunchIOS } from "./templates/LaunchIOS";
import { LaunchIOSPlain } from "./templates/LaunchIOSPlain";
import { WelcomeAppLive } from "./templates/WelcomeAppLive";
import { Newsletter } from "./templates/Newsletter";

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

// ─────────────────────────────────────────────────────────────────────────
// LANZAMIENTO iOS · envío masivo a la waitlist el día que la app sale en la
// App Store. Mismo patrón que sendWelcomeWaitlist. El link de la App Store
// se pasa por args (numeric App ID) para no hardcodearlo en la template.
// ─────────────────────────────────────────────────────────────────────────

interface LaunchArgs extends BaseArgs {
  appStoreUrl: string;
}

export async function sendLaunchIOS(
  args: LaunchArgs,
): Promise<EmailSendResult> {
  const resend = getResend();
  if (!resend) return { ok: true, skipped: true };

  const recipient = resolveRecipient(args.to);
  const html = await render(
    <LaunchIOS to={args.to} siteUrl={args.siteUrl} appStoreUrl={args.appStoreUrl} />,
  );
  const text = await render(
    <LaunchIOS to={args.to} siteUrl={args.siteUrl} appStoreUrl={args.appStoreUrl} />,
    { plainText: true },
  );

  try {
    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: recipient,
      subject: "Ya está aquí · TACTIUM en la App Store",
      html,
      text,
      headers: {
        "X-Entity-Ref-ID": `launch-ios-${Date.now()}`,
      },
      tags: [
        { name: "template", value: "launch-ios" },
        { name: "env", value: process.env.NODE_ENV ?? "development" },
      ],
    });
    if (error) {
      console.error("[email] sendLaunchIOS failed", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[email] sendLaunchIOS threw", message);
    return { ok: false, error: message };
  }
}

export async function sendLaunchIOSPlain(
  args: LaunchArgs,
): Promise<EmailSendResult> {
  const resend = getResend();
  if (!resend) return { ok: true, skipped: true };

  const recipient = resolveRecipient(args.to);
  const html = await render(
    <LaunchIOSPlain to={args.to} siteUrl={args.siteUrl} appStoreUrl={args.appStoreUrl} />,
  );
  const text = await render(
    <LaunchIOSPlain to={args.to} siteUrl={args.siteUrl} appStoreUrl={args.appStoreUrl} />,
    { plainText: true },
  );

  try {
    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: recipient,
      subject: "TACTIUM ya está en la App Store",
      html,
      text,
      headers: {
        "X-Entity-Ref-ID": `launch-ios-plain-${Date.now()}`,
      },
      tags: [
        { name: "template", value: "launch-ios-plain" },
        { name: "env", value: process.env.NODE_ENV ?? "development" },
      ],
    });
    if (error) {
      console.error("[email] sendLaunchIOSPlain failed", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[email] sendLaunchIOSPlain threw", message);
    return { ok: false, error: message };
  }
}

export async function sendWelcomeAppLive(
  args: LaunchArgs,
): Promise<EmailSendResult> {
  const resend = getResend();
  if (!resend) return { ok: true, skipped: true };

  const recipient = resolveRecipient(args.to);
  const html = await render(
    <WelcomeAppLive to={args.to} siteUrl={args.siteUrl} appStoreUrl={args.appStoreUrl} />,
  );
  const text = await render(
    <WelcomeAppLive to={args.to} siteUrl={args.siteUrl} appStoreUrl={args.appStoreUrl} />,
    { plainText: true },
  );

  try {
    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: recipient,
      subject: "Gracias por apuntarte · ya puedes descargar TACTIUM",
      html,
      text,
      headers: { "X-Entity-Ref-ID": `welcome-applive-${Date.now()}` },
      tags: [
        { name: "template", value: "welcome-applive" },
        { name: "env", value: process.env.NODE_ENV ?? "development" },
      ],
    });
    if (error) {
      console.error("[email] sendWelcomeAppLive failed", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[email] sendWelcomeAppLive threw", message);
    return { ok: false, error: message };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// NEWSLETTER · envío recurrente genérico. El contenido (asunto, titular,
// párrafos, CTA) se pasa por args desde un archivo editable.
// ─────────────────────────────────────────────────────────────────────────

export interface NewsletterArgs extends BaseArgs {
  subject: string;
  preview: string;
  heading: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
}

export async function sendNewsletter(
  args: NewsletterArgs,
): Promise<EmailSendResult> {
  const resend = getResend();
  if (!resend) return { ok: true, skipped: true };

  const recipient = resolveRecipient(args.to);
  const node = (
    <Newsletter
      to={args.to}
      siteUrl={args.siteUrl}
      preview={args.preview}
      heading={args.heading}
      paragraphs={args.paragraphs}
      ctaLabel={args.ctaLabel}
      ctaUrl={args.ctaUrl}
    />
  );
  const html = await render(node);
  const text = await render(node, { plainText: true });

  try {
    const { data, error } = await resend.emails.send({
      from: getEmailFrom(),
      to: recipient,
      subject: args.subject,
      html,
      text,
      headers: { "X-Entity-Ref-ID": `newsletter-${Date.now()}` },
      tags: [
        { name: "template", value: "newsletter" },
        { name: "env", value: process.env.NODE_ENV ?? "development" },
      ],
    });
    if (error) {
      console.error("[email] sendNewsletter failed", error);
      return { ok: false, error: error.message };
    }
    return { ok: true, id: data?.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[email] sendNewsletter threw", message);
    return { ok: false, error: message };
  }
}

// Placeholders tipados para los próximos templates. Se implementan a
// medida que se conectan flows (registro, recovery, convocatoria).
//
// export async function sendWelcomeRegister(args: ...): Promise<EmailSendResult> { ... }
// export async function sendPasswordRecovery(args: ...): Promise<EmailSendResult> { ... }
