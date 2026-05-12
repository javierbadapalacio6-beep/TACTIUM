import { supabase } from '@core/supabase/client';
import type { Database } from '@core/supabase/database.types';
import type { BillingPeriod, PlanTier, SubjectType } from '@core/subscriptions/plans';
import { PLAN_BY_TIER, PREMIUM_STATUSES, TRIAL_DURATION_DAYS } from '@core/subscriptions/plans';
import { useSubscriptionStore } from '@store/subscriptionStore';

export type Subscription = Database['public']['Tables']['subscriptions']['Row'];
export type SubscriptionInsert = Database['public']['Tables']['subscriptions']['Insert'];

// ── Lectura ─────────────────────────────────────────────────────────────────

/**
 * Trae todas las subs visibles para el user actual (RLS filtra por payer
 * o club admin). Incluye expiradas/canceladas para mostrar histórico en
 * SubscriptionScreen; el filtrado de "activa" se hace en cliente.
 */
export async function fetchMySubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Sub activa de un club (la más reciente con estado premium). Útil para
 * `ClubBillingScreen` cuando un admin quiere ver qué tier tiene contratado.
 */
export async function fetchActiveClubSubscription(
  clubId: string,
): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('subject_type', 'club')
    .eq('subject_id', clubId)
    .in('status', ['trialing', 'active', 'grace_period'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Compra MOCK (sólo dev hasta integrar RevenueCat SDK real) ───────────────

export interface MockPurchaseArgs {
  tier: PlanTier;
  billingPeriod: BillingPeriod;
  // Para clubs, el club_id que recibe el entitlement. Para captain, ignorar.
  clubId?: string | null;
  // Si se solicita arrancar trial en lugar de compra inmediata.
  startTrial?: boolean;
}

/**
 * Simula una compra creando una fila en `subscriptions` directamente.
 * Solo para desarrollo / testing del flujo UI antes de integrar el SDK
 * de RevenueCat. Cuando se conecte el SDK real, esta función se elimina
 * y el webhook hace el insert.
 *
 * Nota: en producción esta función NO funciona porque RLS impide writes
 * desde el cliente. Solo se permite porque en dev la migración no añade
 * policy de INSERT/UPDATE — devolverá error 403. Para testing local
 * usaríamos el SQL editor o el dashboard.
 *
 * TEMPORAL: en dev creamos la fila vía RPC que veremos en otra migración.
 * Por ahora deja la función expuesta y el caller usa toast para feedback
 * cuando el RPC esté listo. Mientras tanto, devuelve la fila que se
 * crearía sin escribir en DB (UI ve la sub "optimistic", no persiste).
 */
export async function mockPurchasePlan(
  userId: string,
  args: MockPurchaseArgs,
): Promise<Subscription> {
  const plan = PLAN_BY_TIER[args.tier];
  if (!plan) throw new Error(`Plan desconocido: ${args.tier}`);

  const isClub = args.tier !== 'captain';
  if (isClub && !args.clubId) {
    throw new Error('clubId requerido para compras de plan club_*');
  }

  const now = new Date();
  const periodMs =
    args.billingPeriod === 'yearly'
      ? 365 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;

  // ─── Preservar periodo existente (PRODUCT_CHANGE-like) ──────────────────
  // Si ya hay una sub premium activa para este subject, conservamos:
  //   - status (trialing/active/grace_period — no degradamos)
  //   - current_period_start / current_period_end
  //   - trial_end (si estaba en trial)
  // y sólo actualizamos plan_tier, billing_period y product_id. Esto es lo
  // que hace RevenueCat al recibir PRODUCT_CHANGE: mantiene el reloj del
  // trial y prorratea el cambio. Sin esto, cambiar de plan durante el
  // trial regalaría un trial nuevo.
  const subjectType: 'user' | 'club' = isClub ? 'club' : 'user';
  const subjectId = isClub ? (args.clubId as string) : userId;
  const existing = useSubscriptionStore
    .getState()
    .subscriptions.find(
      (s) =>
        s.subject_type === subjectType &&
        s.subject_id === subjectId &&
        PREMIUM_STATUSES.includes(s.status),
    );

  // Estado final: si hay sub existente la respetamos; si no, depende del
  // flag startTrial pasado por el caller.
  const status = existing
    ? existing.status
    : args.startTrial
      ? 'trialing'
      : 'active';

  const currentPeriodStart = existing?.current_period_start
    ? new Date(existing.current_period_start)
    : now;

  const trialMs =
    !existing && args.startTrial
      ? TRIAL_DURATION_DAYS * 24 * 60 * 60 * 1000
      : 0;

  const currentPeriodEnd = existing
    ? new Date(existing.current_period_end)
    : new Date(now.getTime() + periodMs + trialMs);

  const trialEnd = existing
    ? existing.trial_end
      ? new Date(existing.trial_end)
      : null
    : args.startTrial
      ? new Date(now.getTime() + trialMs)
      : null;

  const insertPayload: SubscriptionInsert = {
    subject_type: subjectType,
    subject_id: subjectId,
    payer_user_id: userId,
    plan_tier: args.tier,
    billing_period: args.billingPeriod,
    status,
    current_period_start: currentPeriodStart.toISOString(),
    current_period_end: currentPeriodEnd.toISOString(),
    trial_end: trialEnd ? trialEnd.toISOString() : null,
    revenuecat_customer_id: userId,
    // Idempotencia: si hay sub existente reusamos su transaction_id (es lo
    // que haría App Store/Play en un PRODUCT_CHANGE). Si no, generamos
    // uno mock único para esta primera compra.
    original_transaction_id:
      existing?.original_transaction_id ??
      `mock_${userId}_${subjectType}_${subjectId}_${Date.now()}`,
    product_id:
      args.billingPeriod === 'yearly'
        ? plan.productIdYearly
        : plan.productIdMonthly,
    platform: existing?.platform ?? 'ios',
  };

  // Esta inserción FALLARÁ por RLS (no hay policy de INSERT a authenticated).
  // Eso es correcto en prod. En dev, la migración del paso siguiente añadirá
  // una RPC `mock_purchase_subscription` SECURITY DEFINER restringida a
  // `__DEV__` ambient. Por ahora devolvemos la fila construida para que la
  // UI pueda hacer optimistic update vía el store y el usuario vea el
  // gating funcionando end-to-end sin tocar Supabase.
  const { data, error } = await supabase
    .from('subscriptions')
    .insert(insertPayload)
    .select()
    .single();

  if (error) {
    // En dev sin RPC mock, devolvemos optimistic local con un id sintético.
    // Esto permite probar UI sin DB, pero las subs se pierden al recargar.
    if (__DEV__) {
      return {
        id: `optimistic_${Date.now()}`,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
        cancel_at_period_end: false,
        ...insertPayload,
      } as Subscription;
    }
    throw error;
  }
  return data;
}

/**
 * Cancela una sub a fin de periodo (sólo marca el flag; el provider real
 * la migrará a `expired` cuando expire). Para mock dev solo updatea el row.
 */
export async function mockCancelAtPeriodEnd(
  subscriptionId: string,
): Promise<void> {
  const { error } = await supabase
    .from('subscriptions')
    .update({ cancel_at_period_end: true })
    .eq('id', subscriptionId);
  if (error) throw error;
}
