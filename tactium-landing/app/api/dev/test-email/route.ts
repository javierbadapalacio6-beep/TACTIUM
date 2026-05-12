import { NextRequest, NextResponse } from "next/server";
import { sendWelcomeWaitlist } from "@/lib/email/send";
import { getTestRecipient } from "@/lib/email/client";

// Endpoint LOCAL-ONLY para previsualizar/disparar templates contra
// RESEND_TEST_TO. Bloqueado fuera de development para no exponer un
// disparador anónimo de emails en producción (sería una herramienta
// estupenda para abusar de tu cuota de Resend).
//
// Uso:
//   curl "http://localhost:3000/api/dev/test-email?template=welcome-waitlist"
//
// Templates disponibles:
//   - welcome-waitlist

const ALLOWED_TEMPLATES = ["welcome-waitlist"] as const;
type Template = (typeof ALLOWED_TEMPLATES)[number];

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const template = req.nextUrl.searchParams.get("template") as Template | null;
  if (!template || !ALLOWED_TEMPLATES.includes(template)) {
    return NextResponse.json(
      {
        error: "Falta ?template=",
        allowed: ALLOWED_TEMPLATES,
      },
      { status: 400 },
    );
  }

  const to = getTestRecipient();
  if (!to) {
    return NextResponse.json(
      {
        error:
          "Define RESEND_TEST_TO en .env.local (el email de tu cuenta Resend) para enviar tests",
      },
      { status: 400 },
    );
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    req.nextUrl.origin.replace(/\/$/, "");

  let result;
  switch (template) {
    case "welcome-waitlist":
      result = await sendWelcomeWaitlist({ to, siteUrl });
      break;
  }

  return NextResponse.json({ template, to, result });
}
