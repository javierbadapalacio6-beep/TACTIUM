import { supabase } from '@core/supabase/client';
import { getCustomerInfo, type CustomerInfo } from '@core/purchases';
import type { PlanTier } from '@core/subscriptions/plans';

/**
 * Puente entre lo que dice la TIENDA (App Store / Google Play) y nuestra tabla
 * `subscriptions`.
 *
 * Una compra no pertenece al correo de TACTIUM sino a la cuenta de la tienda
 * del dispositivo: si alguien borra su cuenta y se da de alta otra vez, la fila
 * de `subscriptions` desaparece pero la compra sigue viva. Hasta ahora eso solo
 * se arreglaba si el usuario pulsaba «Restaurar compras» a mano, así que la app
 * le enseñaba la pasarela por algo que ya había pagado.
 *
 * OJO: aquí se usa `getCustomerInfo()`, que es SILENCIOSO. `restorePurchases()`
 * puede pedir la contraseña de la cuenta de la tienda, y eso no se le hace al
 * usuario en cada arranque — ese sigue siendo el botón manual.
 */

/** Una compra activa según la tienda. El entitlement de RevenueCat se llama
 *  igual que el tier, así que la clave ya es el plan. */
export interface StorePurchase {
  tier: PlanTier;
  productId: string;
  /** ms desde epoch; null si la tienda no lo informa. */
  expiresAtMs: number | null;
  purchasedAtMs: number;
  periodType: string;
  /** id estable para que sincronizar N veces no duplique filas. */
  transactionId: string;
}

const CLUB_TIERS: PlanTier[] = ['club_starter', 'club_pro', 'club_elite'];
export const isClubTier = (t: PlanTier): boolean => CLUB_TIERS.includes(t);

/** Compras activas que ve la tienda en este dispositivo. Nunca lanza: si el
 *  SDK no está disponible (simulador, sin tienda) devuelve lista vacía. */
export async function readStorePurchases(
  info?: CustomerInfo,
): Promise<StorePurchase[]> {
  let customer = info;
  if (!customer) {
    try {
      customer = await getCustomerInfo();
    } catch (e) {
      console.warn('getCustomerInfo failed', e);
      return [];
    }
  }
  return Object.entries(customer.entitlements.active).map(([id, ent]) => {
    const purchasedAtMs = ent.originalPurchaseDate
      ? new Date(ent.originalPurchaseDate).getTime()
      : Date.now();
    return {
      tier: id as PlanTier,
      productId: ent.productIdentifier,
      expiresAtMs: ent.expirationDate
        ? new Date(ent.expirationDate).getTime()
        : null,
      purchasedAtMs,
      periodType: ent.periodType,
      // Mismo criterio que el botón de restaurar: (producto, fecha de compra)
      // da un id estable y el UPSERT de la RPC lo hace idempotente.
      transactionId: `restore_${ent.productIdentifier}_${purchasedAtMs}`,
    };
  });
}

/**
 * Vuelca en la BD las compras activas de la tienda. Idempotente: la RPC hace
 * UPSERT por `original_transaction_id`. Devuelve cuántas sincronizó.
 */
export async function syncStorePurchases(
  info?: CustomerInfo,
): Promise<{ synced: number; purchases: StorePurchase[] }> {
  const purchases = await readStorePurchases(info);
  let synced = 0;
  for (const p of purchases) {
    const { error } = await supabase.rpc('sync_subscription_from_revenuecat', {
      p_product_id: p.productId,
      p_original_transaction_id: p.transactionId,
      p_period_type: p.periodType,
      p_purchased_at_ms: p.purchasedAtMs,
      p_expiration_at_ms: p.expiresAtMs as number,
    });
    if (error) {
      console.warn('sync_subscription_from_revenuecat failed', p.tier, error);
      continue;
    }
    synced++;
  }
  return { synced, purchases };
}

/**
 * Aplica al club indicado la suscripción de club que ya tiene pagada quien
 * llama. Es lo que se ofrece en vez de la pasarela cuando alguien rehace su
 * cuenta o crea un club nuevo teniendo ya un plan comprado.
 */
export async function applySubscriptionToClub(clubId: string): Promise<void> {
  const rpc = supabase.rpc.bind(supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ error: { message: string } | null }>;
  const { error } = await rpc('apply_subscription_to_club', {
    p_club_id: clubId,
  });
  if (error) throw new Error(error.message);
}
