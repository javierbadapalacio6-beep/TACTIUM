import { Linking } from 'react-native';
import { supabase } from '@core/supabase/client';
import { TACTIUM_WEB_BASE_URL } from '@core/entitlements/tournamentBilling';

// Cobro por torneo (Fase 2): pide a la web la sesión de Stripe Checkout y abre
// el pago en el navegador. La confirmación real la hace el webhook (fuente de
// verdad); al pagar, el torneo queda con `billing_status='paid'` y se puede
// publicar. DORMIDO tras `TOURNAMENT_BILLING_ENABLED` hasta activar Stripe.

export interface CheckoutResult {
  paid?: boolean; // incluido/gratis: no hace falta pagar
  opened?: boolean; // se abrió el checkout de Stripe
}

export async function startTournamentCheckout(
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
    },
  );

  const body = (await res.json().catch(() => ({}))) as {
    url?: string;
    paid?: boolean;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error ?? 'No se pudo iniciar el pago del torneo.');
  }
  if (body.paid) return { paid: true };
  if (body.url) {
    await Linking.openURL(body.url);
    return { opened: true };
  }
  throw new Error('Respuesta de pago inesperada.');
}
