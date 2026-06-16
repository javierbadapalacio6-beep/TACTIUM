import { Platform, Linking } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
  type PurchasesPackage,
  type PurchasesStoreProduct,
} from 'react-native-purchases';

import type { BillingPeriod, PlanTier } from '@core/subscriptions/plans';
import {
  REVENUECAT_ANDROID_API_KEY,
  REVENUECAT_IOS_API_KEY,
} from './config';

// Identificadores de los packages en el offering `default` de RC. Tienen
// que coincidir EXACTAMENTE con los creados en el dashboard. Si añades
// o renombras alguno, actualízalo aquí.
export type PackageId =
  | 'captain_monthly'
  | 'captain_yearly'
  | 'starter_monthly'
  | 'starter_yearly'
  | 'pro_monthly'
  | 'pro_yearly'
  | 'elite_monthly'
  | 'elite_yearly';

// Identificadores de los entitlements en RC. El cliente NO lee product
// IDs; consulta entitlements (= "el user tiene acceso a captain?").
export type EntitlementId =
  | 'captain'
  | 'club_starter'
  | 'club_pro'
  | 'club_elite';

// Mapping plan_tier × billing_period → identifier del package en RC.
// Mantenerlo en sync con los packages del offering `default`. El cliente
// resuelve el package que tiene que comprar via este lookup en vez de
// hardcodearlo en cada screen.
export const PKG_ID_BY_TIER_BILLING: Record<
  PlanTier,
  Record<BillingPeriod, PackageId>
> = {
  captain: { monthly: 'captain_monthly', yearly: 'captain_yearly' },
  club_starter: { monthly: 'starter_monthly', yearly: 'starter_yearly' },
  club_pro: { monthly: 'pro_monthly', yearly: 'pro_yearly' },
  club_elite: { monthly: 'elite_monthly', yearly: 'elite_yearly' },
};

/**
 * Localiza el `PurchasesPackage` del offering que corresponde al tier +
 * billing pedido. Devuelve `null` si RC no expone ese package (típico en
 * sandbox sin Sandbox Tester logueado, o si renombraron mal el package
 * en el dashboard). El caller decide qué hacer (fallback / error).
 */
export function resolvePackage(
  offering: PurchasesOffering,
  tier: PlanTier,
  billing: BillingPeriod,
): PurchasesPackage | null {
  const pkgId = PKG_ID_BY_TIER_BILLING[tier][billing];
  return (
    offering.availablePackages.find((p) => p.identifier === pkgId) ?? null
  );
}

/**
 * Setea atributos custom que viajan con TODOS los eventos del webhook RC
 * → Supabase (`subscriber_attributes` en el payload). El webhook los lee
 * vía `resolveSubject(event)` y decide si la sub es del propio user o de
 * un club concreto.
 *
 * Importante: tiene que llamarse ANTES de `purchasePackage`. RC envía los
 * attrs en el INITIAL_PURCHASE; si los setteamos después, llegan en el
 * próximo evento (renewal, etc.) — demasiado tarde para resolver subject
 * en la primera fila de `subscriptions`.
 */
export async function setSubjectAttributes(
  subjectType: 'user' | 'club',
  subjectId: string,
): Promise<void> {
  await Purchases.setAttributes({
    $target_subject_type: subjectType,
    $target_subject_id: subjectId,
  });
}

let configured = false;

/**
 * Inicializa el SDK de RevenueCat. Idempotente — re-llamar con el mismo
 * `userId` no rompe nada. Re-llamar con `userId` distinto hace un login
 * que asocia las compras del nuevo user (Purchases.logIn).
 *
 * `userId` debe ser el `auth.uid()` de Supabase. Eso permite:
 *   · Asociar la sub al user concreto en el backend de RC.
 *   · Que el webhook RC→Supabase sepa qué fila de `subscriptions`
 *     crear/actualizar (subject_type='user' o 'club' resuelto via
 *     metadata extra en el evento).
 *   · Restaurar compras tras reinstalar la app.
 */
export async function configurePurchases(userId: string): Promise<void> {
  if (Platform.OS === 'android' && !REVENUECAT_ANDROID_API_KEY) {
    console.warn(
      'RevenueCat Android API key vacía — Purchases NO se inicializa. ' +
        'Configura REVENUECAT_ANDROID_API_KEY en core/purchases/config.ts',
    );
    return;
  }
  const apiKey =
    Platform.OS === 'ios'
      ? REVENUECAT_IOS_API_KEY
      : REVENUECAT_ANDROID_API_KEY;

  if (!configured) {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey, appUserID: userId });
    configured = true;
    return;
  }
  // Ya configurado: si el userId cambió (re-login con otra cuenta),
  // delegamos al SDK con logIn para que rote el customer id sin
  // perder histórico de compras anónimas previas.
  try {
    const current = await Purchases.getAppUserID();
    if (current !== userId) {
      await Purchases.logIn(userId);
    }
  } catch (e) {
    console.warn('Purchases.logIn failed', e);
  }
}

/**
 * Cierra la sesión en RC (vuelve a un appUserID anónimo). Llamar tras
 * el logOut de Supabase para que el siguiente user que entre en este
 * device no herede las compras del anterior.
 */
export async function logOutPurchases(): Promise<void> {
  if (!configured) return;
  try {
    await Purchases.logOut();
  } catch (e) {
    // Si el SDK no estaba autenticado, logOut tira AlreadyAnonymous.
    // Es inofensivo — silenciar.
  }
}

/**
 * Devuelve el offering "current" del dashboard (`default` en TACTIUM).
 * Si no hay current configurado en RC, devuelve null y el paywall se
 * queda sin packages para mostrar (estado de error que conviene
 * vigilar en producción con un toast).
 */
export async function getCurrentOffering(): Promise<PurchasesOffering | null> {
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current;
  } catch (e) {
    console.warn('Purchases.getOfferings failed', e);
    return null;
  }
}

/**
 * DIAGNÓSTICO temporal: devuelve un string legible con el estado real de los
 * offerings (o el error exacto), para depurar "Productos no disponibles" en
 * dispositivo sin tener que mirar logcat. Quitar cuando esté resuelto.
 */
export async function diagnoseOfferings(): Promise<string> {
  try {
    const configured = await Purchases.getAppUserID().catch(() => null);
    const offerings = await Purchases.getOfferings();
    const all = Object.keys(offerings.all ?? {});
    const cur = offerings.current;
    const pkgs = cur ? cur.availablePackages.length : 0;
    const prods = cur
      ? cur.availablePackages
          .map((p) => `${p.identifier}:${p.product?.priceString ?? 'NO_PRICE'}`)
          .join(' | ')
      : '';
    return `appUserID=${configured ? 'OK' : 'NULL'}\ncurrent=${
      cur?.identifier ?? 'NULL'
    } · pkgs=${pkgs}\nall=[${all.join(', ')}]\n${prods}`;
  } catch (e: any) {
    return [
      'ERROR getOfferings:',
      `code=${e?.code ?? '?'}`,
      `readable=${e?.readableErrorCode ?? '?'}`,
      `msg=${e?.message ?? ''}`,
      `underlying=${e?.underlyingErrorMessage ?? '—'}`,
    ].join('\n');
  }
}

/**
 * Dispara la compra de un package. iOS muestra el sheet nativo de
 * StoreKit; tras éxito devuelve el `CustomerInfo` actualizado con los
 * entitlements activos. Si el user cancela, Purchases lanza
 * `userCancelled=true` — el caller debe distinguirlo de error real.
 */
export interface AndroidPlanChange {
  /** Producto Android de la sub ACTUAL a reemplazar (`productId:basePlanId`). */
  oldProductIdentifier: string;
  /** true = downgrade → se aplica a la renovación (DEFERRED); false = upgrade
   *  → inmediato con proración. */
  isDowngrade: boolean;
}

export async function purchasePackage(
  pkg: PurchasesPackage,
  androidChange?: AndroidPlanChange | null,
): Promise<CustomerInfo> {
  // En Android los planes son suscripciones SEPARADAS (no un grupo como iOS),
  // así que cambiar de plan exige REEMPLAZAR la sub existente; si no, Google
  // rechaza con "ya tienes una suscripción activa". Pasamos el producto viejo
  // + el proration mode (upgrade inmediato / downgrade diferido). iOS no lo
  // necesita: StoreKit gestiona el grupo de suscripción solo.
  if (Platform.OS === 'android' && androidChange) {
    const result = await Purchases.purchasePackage(pkg, null, {
      oldProductIdentifier: androidChange.oldProductIdentifier,
      prorationMode: androidChange.isDowngrade
        ? Purchases.PRORATION_MODE.DEFERRED
        : Purchases.PRORATION_MODE.IMMEDIATE_WITH_TIME_PRORATION,
    });
    return result.customerInfo;
  }
  const result = await Purchases.purchasePackage(pkg);
  return result.customerInfo;
}

/**
 * Restaura compras del usuario actual (busca en su Apple ID cualquier
 * IAP previo y reasocia entitlements). Útil tras reinstalar la app o
 * cambiar de device. Devuelve el `CustomerInfo` actualizado.
 */
export async function restorePurchases(): Promise<CustomerInfo> {
  return Purchases.restorePurchases();
}

/**
 * Abre el flujo de canje de Offer Codes / códigos promocionales.
 *  · iOS: hoja nativa de StoreKit (`presentCodeRedemptionSheet`). Tras
 *    canjear, el webhook RC → Supabase crea/actualiza la sub; el caller
 *    debe refrescar el store al volver.
 *  · Android: RC no expone hoja nativa → abrimos la página de canje de
 *    Google Play, donde el usuario introduce el código.
 * Sostiene la estrategia de 30 días para el top-100 de la waitlist.
 */
export async function presentCodeRedemption(): Promise<void> {
  if (Platform.OS === 'ios') {
    await Purchases.presentCodeRedemptionSheet();
    return;
  }
  await Linking.openURL('https://play.google.com/redeem');
}

/**
 * Lee el estado actual del customer (entitlements activos, sub más
 * reciente, etc.) sin disparar fetches a Apple. Apto para chequeos
 * rápidos al renderizar pantallas.
 */
export async function getCustomerInfo(): Promise<CustomerInfo> {
  return Purchases.getCustomerInfo();
}

/**
 * Helper para chequear entitlement activo. Devuelve true si el user
 * tiene el entitlement vivo (trialing, active o en grace period según
 * RC). El cliente lo usa para gating local antes de consultar el store.
 */
export function hasActiveEntitlement(
  info: CustomerInfo,
  id: EntitlementId,
): boolean {
  return info.entitlements.active[id] !== undefined;
}

export type { CustomerInfo, PurchasesOffering, PurchasesPackage, PurchasesStoreProduct };
