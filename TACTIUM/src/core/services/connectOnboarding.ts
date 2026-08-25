import { supabase } from '@core/supabase/client';
import { TACTIUM_WEB_BASE_URL } from '@core/entitlements/tournamentBilling';

// Alta de cobros online del club (Stripe Connect Express).
//
// El club es un COMERCIANTE que se da de alta para RECIBIR dinero (payouts de
// inscripciones), no un usuario comprando contenido dentro de la app: por eso
// esto NO cae bajo IAP (a diferencia del pago de torneos, que sí es una compra
// y va por email — ver tournamentCheckout.ts).
//
// La app ya tiene la sesión, así que en vez de mandar al club a la web (login +
// buscar el botón), pedimos el Account Link directamente con el token Bearer y
// devolvemos la URL de alta HOSPEDADA POR STRIPE, lista para abrir. El endpoint
// /api/connect/onboard valida que el usuario sea admin/owner del club.
export async function requestConnectOnboarding(clubId: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const res = await fetch(`${TACTIUM_WEB_BASE_URL}/api/connect/onboard`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ clubId }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!res.ok || !body.url) {
    throw new Error(body.error ?? 'No se pudo iniciar el alta de cobros.');
  }
  return body.url;
}
