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
// Columnas que el cliente tiene permiso de leer. `revenuecat_customer_id`
// y `original_transaction_id` están REVOKE a nivel DB para `authenticated`
// — solo service_role las ve. Si añades campo nuevo, edita SOLO esta
// constante; el store la importa.
export const SUB_VISIBLE_COLS =
  'id, subject_type, subject_id, payer_user_id, plan_tier, billing_period, ' +
  'status, current_period_start, current_period_end, trial_end, ' +
  'cancel_at_period_end, scheduled_plan_tier, product_id, platform, ' +
  'created_at, updated_at';

export async function fetchMySubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select(SUB_VISIBLE_COLS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  // Cast vía `unknown` porque supabase-js no infiere el shape de
  // `Subscription` cuando se pasa una string de columnas; los dos
  // campos PII no aparecerán en runtime (revoke a nivel DB), pero el
  // resto del código del cliente ya está auditado para no leerlos.
  return ((data ?? []) as unknown) as Subscription[];
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
    .select(SUB_VISIBLE_COLS)
    .eq('subject_type', 'club')
    .eq('subject_id', clubId)
    .in('status', ['trialing', 'active', 'grace_period'])
    .order('current_period_end', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown) as Subscription | null;
}

// ── Polling tras compra RC ──────────────────────────────────────────────────

/**
 * Espera a que el webhook RC → Supabase escriba la sub recién comprada.
 *
 * Importante: buscamos por `payer_user_id + plan_tier`, NO por
 * `subject_type + subject_id`. Razón: el webhook puede insertar la fila
 * con `subject_type='user'` aunque el plan sea club_*, porque RC no
 * propaga subscriber_attributes a tiempo en el primer evento. El cliente
 * arregla el subject vía `link_subscription_to_club` justo después; pero
 * primero tiene que ENCONTRAR la fila. Filtrar por payer+tier la encuentra
 * sin importar cómo viniera el subject.
 *
 * Devuelve `null` si pasa el timeout sin ver fila en DB — el caller debe
 * mostrar warning "compra OK, sincronizando" pero no bloquear al user.
 */
export async function pollForRecentSubscription(args: {
  payerUserId: string;
  expectedTier: PlanTier;
  /** sub activa que YA existía antes de la compra (para descartarla). */
  previousSubId?: string | null;
  timeoutMs?: number;
  intervalMs?: number;
}): Promise<Subscription | null> {
  const timeout = args.timeoutMs ?? 10000;
  const interval = args.intervalMs ?? 1000;
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const { data } = await supabase
      .from('subscriptions')
      .select(SUB_VISIBLE_COLS)
      .eq('payer_user_id', args.payerUserId)
      .eq('plan_tier', args.expectedTier)
      .in('status', ['trialing', 'active', 'grace_period'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const row = (data as unknown) as Subscription | null;
    if (row && row.id !== args.previousSubId) {
      return row;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return null;
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

  // ─── Trial onboarding · RPC real ─────────────────────────────────────────
  // Si no hay sub previa para este subject y el caller pide startTrial,
  // arrancamos el trial vía RPC `start_subscription_trial` (security
  // definer). Esto sustituye a los triggers DB clubs_start_trial /
  // teams_start_trial que existían hasta 2026-05-21 — el paywall ahora es
  // la source of truth del plan elegido. Devuelve la fila real persistida.
  if (!existing && args.startTrial) {
    const { data, error } = await supabase.rpc('start_subscription_trial', {
      p_subject_type: subjectType,
      p_subject_id: subjectId,
      p_plan_tier: args.tier,
    });
    if (error) throw error;
    if (!data) throw new Error('RPC start_subscription_trial devolvió null');
    return data as Subscription;
  }

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
  // `.select()` post-insert también debe pedir columnas explícitas para
  // no romperse contra el REVOKE de revenuecat_customer_id y
  // original_transaction_id.
  const { data, error } = await supabase
    .from('subscriptions')
    .insert(insertPayload)
    .select(SUB_VISIBLE_COLS)
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
  return (data as unknown) as Subscription;
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
