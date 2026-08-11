// Correo transaccional vía Resend (REST). Mismo proveedor que la edge function
// `send-email` de Supabase, pero enviado desde el servidor web porque aquí es
// donde se genera el enlace de pago y donde sabemos a quién hay que cobrar.
//
// POR QUÉ EL PAGO VA POR EMAIL: la guideline 3.1.1(a) de Apple prohíbe que la
// app incluya botones o enlaces que lleven a un método de pago que no sea IAP
// (en todas las storefronts salvo EE. UU.). Pero la 3.1.3 permite literalmente
// "send communications outside of the app to their user base about purchasing
// methods other than in-app purchase". Por eso el enlace de Stripe viaja por
// correo y NUNCA se le devuelve a la app.

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/** ¿Hay proveedor de correo configurado? (para degradar con elegancia). */
export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendTournamentPaymentEmail(input: {
  to: string;
  tournamentName: string;
  maxPairs: number | null;
  amountEur: number;
  isTopUp: boolean;
  url: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const from = process.env.EMAIL_FROM ?? "TACTIUM <onboarding@resend.dev>";

  const amount = input.amountEur.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
  const tName = input.tournamentName || "tu torneo";
  const concepto = input.isTopUp
    ? `ampliación a ${input.maxPairs} plazas`
    : `cuota de organización (${input.maxPairs} plazas)`;
  const subject = `Completa el pago de "${tName}" · ${amount}`;

  const html = `<!doctype html><html><body style="margin:0;background:#0b0f14;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#e7edf3">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px">
    <div style="font-size:13px;letter-spacing:3px;color:#39d98a;font-weight:600">TACTIUM</div>
    <h1 style="font-size:22px;margin:14px 0 6px">Tu torneo está pendiente de pago</h1>
    <p style="font-size:15px;line-height:22px;color:#b6c2cf;margin:0 0 20px">
      <b style="color:#e7edf3">"${esc(tName)}"</b> no admite inscripciones todavía.
      En cuanto completes el pago se publica y podrás compartir el código.
    </p>
    <div style="background:#121821;border:1px solid #223041;border-radius:14px;padding:20px;text-align:center">
      <div style="font-size:12px;letter-spacing:2px;color:#7f8ea0">${esc(concepto.toUpperCase())}</div>
      <div style="font-size:34px;font-weight:800;color:#39d98a;margin-top:8px">${esc(amount)}</div>
      <a href="${esc(input.url)}" style="display:inline-block;margin-top:18px;padding:13px 26px;border-radius:9999px;background:#39d98a;color:#0b0f14;font-size:15px;font-weight:800;text-decoration:none">Completar el pago</a>
    </div>
    <p style="font-size:13px;line-height:20px;color:#7f8ea0;margin:20px 0 0">
      El enlace es de un solo torneo y caduca en unas horas. Si expira, vuelve a
      guardar el torneo desde TACTIUM y te enviaremos uno nuevo.
    </p>
    <p style="font-size:12px;color:#6b7888;margin-top:28px">Si no esperabas este correo, puedes ignorarlo.</p>
  </div></body></html>`;

  const text = `Tu torneo "${tName}" está pendiente de pago.\n\n${concepto}: ${amount}\n\nCompleta el pago aquí:\n${input.url}\n\nEn cuanto se confirme, el torneo se publica y podrás compartir el código de inscripción.`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject,
        html,
        text,
        tags: [{ name: "template", value: "tournament-payment" }],
      }),
    });
    return r.ok;
  } catch {
    return false;
  }
}
