import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabase } from "@/lib/supabase-server";
import { sendWelcomeWaitlist } from "@/lib/email/send";

// Schema server-side. NO confiar en lo que validó el cliente — un bot
// puede saltarse zodResolver fácilmente.
const bodySchema = z.object({
  email: z.string().email().min(5).max(320),
  source: z.string().max(40).optional(),
  locale: z.string().max(8).optional(),
  referrer: z.string().max(2000).optional(),
});

// Rate-limit ultra básico en memoria. Si la landing recibe tráfico real,
// migrar a Upstash/Redis. Por ahora protege contra el bot promedio.
const requests = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requests.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) return true;
  recent.push(now);
  requests.set(ip, recent);
  return false;
}

export async function POST(req: NextRequest) {
  // IP via headers de Vercel/Cloudflare. Fallback "unknown" para dev.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Inténtalo en un minuto." },
      { status: 429 },
    );
  }

  let parsed;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Email inválido" }, { status: 400 });
  }

  const supabase = createServerSupabase();
  const userAgent = req.headers.get("user-agent") ?? null;

  // Intentamos INSERT. Si email ya existe, citext + unique lanza error de
  // duplicate key. En ese caso devolvemos 200 con `alreadySubscribed: true`
  // — UX amistosa, evita que un user reenviando el form vea un error rojo
  // cuando en realidad ya está dentro.
  const { error } = await supabase.from("waitlist").insert({
    email: parsed.email,
    source: parsed.source ?? null,
    referrer: parsed.referrer ?? null,
    locale: parsed.locale ?? "es",
    user_agent: userAgent,
    accepts_privacy: true,
  });

  if (error) {
    if (error.code === "23505") {
      // Duplicate key — ya estaba.
      return NextResponse.json({ ok: true, alreadySubscribed: true });
    }
    console.error("waitlist insert failed", error);
    return NextResponse.json(
      { error: "No se pudo guardar. Inténtalo de nuevo." },
      { status: 500 },
    );
  }

  // Welcome email · best-effort. Si Resend falla (sandbox sin dominio,
  // sin API key, rate limit), NO bloqueamos la respuesta — el INSERT ya
  // está hecho y el usuario ya está en la lista. El error solo va al log.
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    req.nextUrl.origin.replace(/\/$/, "");
  sendWelcomeWaitlist({ to: parsed.email, siteUrl })
    .then((res) => {
      if (!res.ok) {
        console.warn("[waitlist] welcome email no enviado", res.error);
      } else if (res.skipped) {
        console.log("[waitlist] welcome email skipped (no API key)");
      }
    })
    .catch((e) => {
      console.error("[waitlist] welcome email threw", e);
    });

  return NextResponse.json({ ok: true, alreadySubscribed: false });
}
