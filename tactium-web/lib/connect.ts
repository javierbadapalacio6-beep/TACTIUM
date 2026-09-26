/**
 * Stripe Connect (Express) — cobro de inscripciones de torneo al club.
 *
 * TACTIUM es la plataforma; cada club una cuenta conectada Express. Las
 * inscripciones se cobran con destination charges hacia la cuenta del club, y
 * TACTIUM retiene por `application_fee` lo que le cuesta la pasarela. Ver
 * TACTIUM/docs/plan-inscripciones-connect.md.
 */
import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SITE_URL } from "@/lib/site";

/**
 * Recuperación del COSTE DE PASARELA, en puntos básicos + fijo. No es margen.
 *
 * En un destination charge el comerciante ante Stripe es TACTIUM: la tarjeta se
 * cobra en su cuenta, Stripe le factura a él y al club se le transfiere el
 * precio íntegro. Sin retener nada, cada inscripción salía del bolsillo de
 * TACTIUM — medido con un cobro real de 40 €: −0,31 €.
 *
 * 2% + 0,25 € cubre la tarifa estándar española (1,5% + 0,25 €) y deja un
 * colchón para las tarjetas de fuera del EEE, que Stripe cobra bastante más
 * caras y que no se pueden saber al crear el cobro. Decisión de producto
 * (2026-09-19): el club se lleva el máximo posible y TACTIUM queda a la par.
 */
export const INSCRIPTION_FEE_BPS = 200;
export const INSCRIPTION_FEE_FIXED_CENTS = 25;

/** Lo que se retiene, en céntimos, para un importe dado. */
export function inscriptionFeeCents(amountCents: number): number {
  if (amountCents <= 0) return 0;
  const fee =
    Math.round((amountCents * INSCRIPTION_FEE_BPS) / 10000) +
    INSCRIPTION_FEE_FIXED_CENTS;
  // Nunca por encima del importe: dejaría al club con una transferencia de 0
  // y a Stripe rechazando el cobro.
  return Math.min(fee, amountCents);
}

/**
 * Origen de la web para los redirects de Stripe. Como las llamadas desde la
 * app móvil no traen cabecera `Origin`, se cae a `NEXT_PUBLIC_APP_URL`. Todo lo
 * que no sea local (previews …vercel.app, dominios secundarios) se normaliza
 * al dominio canónico, que es el que está en la allowlist de Supabase.
 */
export function webAppOrigin(req: Request): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get("origin") ?? SITE_URL;
  try {
    const u = new URL(raw);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return u.origin;
    return SITE_URL;
  } catch {
    return SITE_URL;
  }
}

/**
 * Traduce un fallo de Stripe a un mensaje que el admin pueda accionar.
 *
 * Sin esto la excepción sube sin capturar, Next responde un 500 sin cuerpo y el
 * cliente solo puede enseñar su mensaje de reserva ("no se pudo conectar"): el
 * motivo real se queda enterrado en los logs del servidor.
 */
export function connectErrorMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  // El cuestionario de Connect lo responde la PLATAFORMA, no el club: mientras
  // falte, `accounts.create` falla en vivo y no se puede dar de alta a nadie.
  // Que el club no se vuelva loco buscando el fallo en su lado.
  if (raw.includes("complete your platform profile")) {
    return "Los cobros por Stripe todavía no están habilitados en TACTIUM. No es cosa de tu club: avísanos y lo activamos.";
  }
  return `Stripe no pudo completar la operación: ${raw}`;
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
