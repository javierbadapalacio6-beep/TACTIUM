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
//
// NOTAS DE MAQUETACIÓN (un correo no es una página web):
// · Todo va en TABLAS y con estilos EN LÍNEA: Outlook usa el motor de Word y
//   se come flex, grid y casi todo el CSS de <head>.
// · El botón es "bulletproof" (tabla + <a> de bloque) y siempre lleva debajo la
//   URL en texto, porque hay clientes que no pintan el fondo del botón.
// · Nada de SVG ni webfonts: Gmail los descarta. Logo en PNG alojado y stack de
//   fuentes del sistema.
// · Preheader oculto: es la línea que la bandeja enseña junto al asunto.

const BRAND = {
  black: "#030F0F", // TACTIUM Black
  surface: "#102322", // Neutral 20
  border: "#35504A", // Neutral 40
  text: "#E8F5EF", // Soft White
  muted: "#A9BBB4", // Neutral 80
  faint: "#6E827B", // Neutral 60
  accent: "#00DF82", // TACTIUM Green
  onAccent: "#001810", // texto sobre relleno verde
} as const;

const SANS =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO =
  "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,Courier,monospace";

/** Logo alojado en Storage público (Gmail no pinta SVG ni data: URIs). */
const LOGO_URL =
  process.env.EMAIL_LOGO_URL ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/brand/email/logo-240.png`;

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

/** Envoltorio de marca: cabecera con logo, cuerpo y pie. */
function shell(preheader: string, body: string): string {
  return `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>TACTIUM</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.black};">
  <!-- Preheader: lo que se lee en la bandeja junto al asunto. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;height:0;width:0">${esc(preheader)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.black};">
    <tr><td align="center" style="padding:32px 16px 40px">

      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%">

        <!-- Cabecera -->
        <tr><td style="padding:0 0 28px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:14px" valign="middle">
                <img src="${esc(LOGO_URL)}" width="48" height="48" alt="TACTIUM"
                     style="display:block;width:48px;height:48px;border:0;border-radius:11px">
              </td>
              <td valign="middle">
                <span style="font-family:${SANS};font-size:19px;font-weight:700;letter-spacing:3px;color:${BRAND.text}">TACTIUM</span>
              </td>
            </tr>
          </table>
        </td></tr>

        ${body}

        <!-- Pie -->
        <tr><td style="padding:34px 0 0;border-top:1px solid ${BRAND.surface}">
          <p style="margin:18px 0 0;font-family:${SANS};font-size:12px;line-height:18px;color:${BRAND.faint}">
            Este correo se ha enviado automáticamente desde TACTIUM porque
            gestionas un club. Si no esperabas recibirlo, puedes ignorarlo.
          </p>
        </td></tr>

      </table>

    </td></tr>
  </table>
</body></html>`;
}

/** Botón bulletproof (tabla + ancla de bloque) para que Outlook lo pinte. */
function button(url: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto">
    <tr><td align="center" bgcolor="${BRAND.accent}" style="border-radius:9999px">
      <a href="${esc(url)}"
         style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:15px;font-weight:700;color:${BRAND.onAccent};text-decoration:none;border-radius:9999px">${esc(label)}</a>
    </td></tr>
  </table>`;
}

export interface TournamentPaymentEmail {
  tournamentName: string;
  maxPairs: number | null;
  amountEur: number;
  isTopUp: boolean;
  url: string;
}

/** Compone el correo (separado del envío para poder previsualizarlo/testearlo). */
export function renderTournamentPaymentEmail(input: TournamentPaymentEmail): {
  subject: string;
  html: string;
  text: string;
} {
  const amount = input.amountEur.toLocaleString("es-ES", {
    style: "currency",
    currency: "EUR",
  });
  const tName = input.tournamentName || "tu torneo";
  const concepto = input.isTopUp
    ? `Ampliación a ${input.maxPairs} plazas`
    : `Cuota de organización · ${input.maxPairs} plazas`;
  const subject = `Completa el pago de "${tName}" · ${amount}`;
  const preheader = input.isTopUp
    ? `Has ampliado las plazas: queda por abonar la diferencia, ${amount}.`
    : `Tu torneo se publica en cuanto se confirme el pago de ${amount}.`;

  const body = `
    <tr><td style="padding:0 0 8px">
      <div style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:${BRAND.accent};text-transform:uppercase">Pendiente de pago</div>
    </td></tr>

    <tr><td style="padding:0 0 14px">
      <h1 style="margin:0;font-family:${SANS};font-size:26px;line-height:32px;font-weight:700;color:${BRAND.text}">
        ${esc(tName)}
      </h1>
    </td></tr>

    <tr><td style="padding:0 0 26px">
      <p style="margin:0;font-family:${SANS};font-size:15px;line-height:23px;color:${BRAND.muted}">
        ${
          input.isTopUp
            ? "Has ampliado las plazas del torneo. Solo se cobra la diferencia sobre lo que ya habías pagado."
            : "Tu torneo aún no admite inscripciones ni tiene código para compartir. En cuanto se confirme el pago se publica automáticamente."
        }
      </p>
    </td></tr>

    <!-- Tarjeta de importe -->
    <tr><td style="padding:0 0 22px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:16px">
        <tr><td align="center" style="padding:28px 24px">
          <div style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:${BRAND.faint};text-transform:uppercase">${esc(concepto)}</div>
          <div style="font-family:${SANS};font-size:40px;line-height:48px;font-weight:700;color:${BRAND.accent};padding:6px 0 20px">${esc(amount)}</div>
          ${button(input.url, "Completar el pago")}
        </td></tr>
      </table>
    </td></tr>

    <!-- Enlace en texto: hay clientes que no pintan el botón -->
    <tr><td style="padding:0 0 6px">
      <p style="margin:0;font-family:${SANS};font-size:12px;line-height:19px;color:${BRAND.faint}">
        ¿No funciona el botón? Copia esta dirección en tu navegador:<br>
        <a href="${esc(input.url)}" style="color:${BRAND.accent};text-decoration:underline;word-break:break-all">${esc(input.url)}</a>
      </p>
    </td></tr>

    <tr><td style="padding:16px 0 0">
      <p style="margin:0;font-family:${SANS};font-size:13px;line-height:20px;color:${BRAND.muted}">
        El enlace vale solo para este torneo y caduca en unas horas. Si expira,
        pídenos otro desde el aviso del torneo en la app.
      </p>
    </td></tr>`;

  const text = [
    `TACTIUM · Pendiente de pago`,
    ``,
    `${tName}`,
    input.isTopUp
      ? `Has ampliado las plazas del torneo. Solo se cobra la diferencia sobre lo ya pagado.`
      : `Tu torneo aun no admite inscripciones ni tiene codigo para compartir. En cuanto se confirme el pago se publica automaticamente.`,
    ``,
    `${concepto}: ${amount}`,
    ``,
    `Completa el pago aqui:`,
    input.url,
    ``,
    `El enlace vale solo para este torneo y caduca en unas horas.`,
  ].join("\n");

  return { subject, html: shell(preheader, body), text };
}

export async function sendTournamentPaymentEmail(
  input: TournamentPaymentEmail & { to: string },
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[email] RESEND_API_KEY ausente en el entorno");
    return { ok: false, error: "RESEND_API_KEY ausente" };
  }
  const from = process.env.EMAIL_FROM ?? "TACTIUM <onboarding@resend.dev>";
  const { subject, html, text } = renderTournamentPaymentEmail(input);

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
    if (r.ok) return { ok: true };
    const body = (await r.json().catch(() => null)) as { message?: string } | null;
    const error = `Resend ${r.status}: ${body?.message ?? "sin detalle"} (from=${from})`;
    console.error("[email] fallo al enviar:", error);
    return { ok: false, error };
  } catch (e) {
    const error = `excepción: ${(e as Error).message}`;
    console.error("[email] excepción al enviar:", error);
    return { ok: false, error };
  }
}

/* ── Confirmación de INSCRIPCIÓN a un torneo ──────────────────────── */

export type SignupPaymentMethod = "stripe" | "club" | "free";

export interface SignupConfirmationEmail {
  tournamentName: string;
  p1Name: string;
  p2Name: string;
  category?: string | null;
  gender?: string | null;
  method: SignupPaymentMethod;
  /** Total (2 jugadores) pagado o por pagar. Null = sin cuota. */
  amountEur?: number | null;
}

export function renderSignupConfirmationEmail(input: SignupConfirmationEmail): {
  subject: string;
  html: string;
  text: string;
} {
  const tName = input.tournamentName || "el torneo";
  const amount =
    input.amountEur != null
      ? input.amountEur.toLocaleString("es-ES", {
          style: "currency",
          currency: "EUR",
        })
      : null;

  const estado =
    input.method === "stripe"
      ? "Pago confirmado"
      : input.method === "club"
        ? "Pendiente de pago en el club"
        : "Inscripción registrada";
  const estadoDetalle =
    input.method === "stripe"
      ? `Hemos recibido el pago${amount ? ` de ${amount}` : ""}. ¡Todo listo!`
      : input.method === "club"
        ? `Queda pendiente pagar la cuota${amount ? ` de ${amount}` : ""} en el club (2 jugadores).`
        : "Tu plaza queda registrada.";

  const meta = [
    input.category ? `Categoría ${input.category}` : null,
    input.gender ? capitalizeEs(input.gender) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const subject = `Inscripción confirmada · ${tName}`;
  const preheader = `${input.p1Name} y ${input.p2Name} · ${estado}.`;

  const body = `
    <tr><td style="padding:0 0 8px">
      <div style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:${BRAND.accent};text-transform:uppercase">Inscripción confirmada</div>
    </td></tr>

    <tr><td style="padding:0 0 14px">
      <h1 style="margin:0;font-family:${SANS};font-size:26px;line-height:32px;font-weight:700;color:${BRAND.text}">
        ${esc(tName)}
      </h1>
    </td></tr>

    <tr><td style="padding:0 0 22px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
             style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:16px">
        <tr><td style="padding:22px 24px">
          <div style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:${BRAND.faint};text-transform:uppercase">Pareja</div>
          <div style="font-family:${SANS};font-size:18px;font-weight:700;color:${BRAND.text};padding:4px 0 14px">${esc(input.p1Name)} &nbsp;·&nbsp; ${esc(input.p2Name)}</div>
          ${
            meta
              ? `<div style="font-family:${SANS};font-size:14px;color:${BRAND.muted}">${esc(meta)}</div>`
              : ""
          }
          <div style="margin-top:14px;padding-top:14px;border-top:1px solid ${BRAND.border}">
            <div style="font-family:${MONO};font-size:11px;letter-spacing:2px;color:${BRAND.accent};text-transform:uppercase">${esc(estado)}</div>
            <div style="font-family:${SANS};font-size:14px;line-height:21px;color:${BRAND.muted};padding-top:4px">${esc(estadoDetalle)}</div>
          </div>
        </td></tr>
      </table>
    </td></tr>

    <tr><td style="padding:0">
      <p style="margin:0;font-family:${SANS};font-size:14px;line-height:21px;color:${BRAND.muted}">
        Te avisaremos en cuanto el club publique el cuadro y tu horario. Si has
        recibido este correo por error, ignóralo.
      </p>
    </td></tr>`;

  const text = [
    `TACTIUM · Inscripción confirmada`,
    ``,
    `${tName}`,
    `Pareja: ${input.p1Name} · ${input.p2Name}`,
    meta ? meta : ``,
    `${estado}. ${estadoDetalle}`,
    ``,
    `Te avisaremos cuando el club publique el cuadro y tu horario.`,
  ]
    .filter((l) => l !== "")
    .join("\n");

  return { subject, html: shell(preheader, body), text };
}

/** Mayúscula inicial (para género "masculino" → "Masculino"). */
function capitalizeEs(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Envía la confirmación a una dirección. Degrada con elegancia si no hay
 *  proveedor o la dirección no es válida (no rompe la inscripción). */
export async function sendSignupConfirmationEmail(
  input: SignupConfirmationEmail & { to: string },
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, error: "RESEND_API_KEY ausente" };
  const to = input.to.trim();
  if (!/.+@.+\..+/.test(to)) return { ok: false, error: "email inválido" };

  const from = process.env.EMAIL_FROM ?? "TACTIUM <onboarding@resend.dev>";
  const { subject, html, text } = renderSignupConfirmationEmail(input);

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject,
        html,
        text,
        tags: [{ name: "template", value: "signup-confirmation" }],
      }),
    });
    if (r.ok) return { ok: true };
    const b = (await r.json().catch(() => null)) as { message?: string } | null;
    const error = `Resend ${r.status}: ${b?.message ?? "sin detalle"}`;
    console.error("[email] fallo confirmación inscripción:", error);
    return { ok: false, error };
  } catch (e) {
    const error = `excepción: ${(e as Error).message}`;
    console.error("[email] excepción confirmación inscripción:", error);
    return { ok: false, error };
  }
}
