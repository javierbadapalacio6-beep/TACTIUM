/**
 * Stripe Connect (Express) — cobro de inscripciones de torneo al club.
 *
 * TACTIUM es la plataforma; cada club una cuenta conectada Express. Las
 * inscripciones se cobran con destination charges hacia la cuenta del club, y
 * TACTIUM se queda una comisión (`application_fee`). Ver
 * TACTIUM/docs/plan-inscripciones-connect.md.
 */
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Comisión de TACTIUM por inscripción, en puntos básicos. 300 = 3%. */
export const INSCRIPTION_FEE_BPS = 300;

/** Comisión en céntimos para un importe dado (redondeo al céntimo). */
export function inscriptionFeeCents(amountCents: number): number {
  return Math.round((amountCents * INSCRIPTION_FEE_BPS) / 10000);
}

/**
 * Origen del WEB APP para los redirects de Stripe. `/club` y `/torneos` viven en
 * el subdominio `app.tactium.io`; el apex `tactium.io` (y `www`) es la LANDING y
 * no tiene esas rutas. Como las llamadas desde la app móvil no traen cabecera
 * `Origin`, se cae a `NEXT_PUBLIC_APP_URL`, que puede estar puesto al apex → aquí
 * lo normalizamos al subdominio para no mandar al usuario a la landing.
 */
export function webAppOrigin(req: Request): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    req.headers.get("origin") ??
    "https://app.tactium.io";
  try {
    const u = new URL(raw);
    // Local: se respeta. Todo lo demás (apex tactium.io, *.vercel.app, previews)
    // se fuerza al dominio canónico app.tactium.io — es el único que está en la
    // allowlist de Supabase y donde vive la web app.
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return u.origin;
    return "https://app.tactium.io";
  } catch {
    return "https://app.tactium.io";
  }
}

export type ConnectStatus = "none" | "onboarding" | "restricted" | "active";

/** Traduce el estado de una cuenta Express de Stripe al de TACTIUM. */
export function mapAccountStatus(account: Stripe.Account): ConnectStatus {
  if (account.charges_enabled && account.payouts_enabled) return "active";
  if (account.details_submitted) return "restricted";
  return "onboarding";
}

/**
 * Autoriza a un usuario como owner o admin de un club. Usa `admin`
 * (service_role) para leer con fiabilidad; la autorización es explícita.
 */
export async function isClubAdmin(
  admin: SupabaseClient,
  userId: string,
  clubId: string,
): Promise<boolean> {
  const { data: club } = await admin
    .from("clubs")
    .select("owner_id")
    .eq("id", clubId)
    .maybeSingle();
  if (club?.owner_id === userId) return true;
  const { data: mem } = await admin
    .from("club_members")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .maybeSingle();
  return mem?.role === "admin";
}

/**
 * Auth de la petición: token Bearer (app) o cookie (web). Devuelve el userId o
 * null. Espejo del patrón del checkout de torneos.
 */
export async function userIdFromRequest(
  req: Request,
  admin: SupabaseClient,
  cookieClient: () => Promise<SupabaseClient>,
): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const { data } = await admin.auth.getUser(authHeader.slice(7));
    return data.user?.id ?? null;
  }
  const supabase = await cookieClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}
