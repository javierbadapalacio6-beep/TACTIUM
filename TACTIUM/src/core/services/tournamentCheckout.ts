import { supabase } from '@core/supabase/client';
import { TACTIUM_WEB_BASE_URL } from '@core/entitlements/tournamentBilling';

// Cobro por torneo (Fase 2). El pago se hace SIEMPRE en la web (Stripe); la
// confirmación real la da el webhook, y al confirmarse el torneo pasa de
// 'draft' a 'open' (se publica).
//
// IMPORTANTE — por qué esto NO abre el navegador:
// La guideline 3.1.1(a) de Apple prohíbe que la app incluya botones, enlaces
// externos o cualquier call to action que lleve a un método de pago distinto
// de IAP (en todas las storefronts menos la de EE. UU.), y TACTIUM ya usa IAP
// para las suscripciones, así que el entitlement de enlaces externos está
// descartado. La 3.1.3 sí permite "send communications outside of the app to
// their user base about purchasing methods other than in-app purchase": por eso
// pedimos al servidor que mande el enlace POR CORREO y la respuesta ni siquiera
// incluye la URL. Mismo comportamiento en iOS y Android, a propósito.

export interface CheckoutResult {
  paid?: boolean; // incluido/gratis/ya cubierto: no hay nada que cobrar
  emailed?: boolean; // se ha enviado el enlace de pago por correo
  to?: string; // dirección a la que se envió (para el mensaje de la UI)
}

export async function requestTournamentPayment(
  tournamentId: string,
): Promise<CheckoutResult> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(
    `${TACTIUM_WEB_BASE_URL}/api/tournaments/${tournamentId}/checkout`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ deliver: 'email' }),
    },
  );

  const body = (await res.json().catch(() => ({}))) as {
    paid?: boolean;
    emailed?: boolean;
    to?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'No se pudo preparar el pago del torneo.');
  }
  if (body.paid) return { paid: true };
  return { emailed: body.emailed === true, to: body.to };
}
