// ============================================================================
// RevenueCat → Supabase webhook handler  (v10)
// ============================================================================
// v10: NUNCA se escribe un estado premium con el periodo ya vencido. La tienda
//      puede mandar CANCELLATION DESPUÉS de EXPIRATION (mismo
//      original_transaction_id, milisegundos más tarde), y como el UPSERT es
//      por txn eso resucitaba la fila a 'active' con la fecha ya pasada. Peor:
//      el dedup de abajo daba entonces por buena esa fila y expiraba la sub
//      REAL del mismo subject.
// v9: DEDUP por subject. Al crear/actualizar una sub ACTIVA para un subject,
//     expira las OTRAS activas del mismo subject. En Android los planes son
//     suscripciones SEPARADAS, así que un cambio de plac puede dejar dos
//     activas; esto garantiza 1 sub activa por subject (como iOS por grupo).
// v8: normaliza product_id de Android (`productId:basePlanId` → `productId`).
// v7: TRANSFER con rescue.
// ============================================================================

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RCEvent {
  type: string;
  id: string;
  event_timestamp_ms: number;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  original_transaction_id?: string;
  transaction_id?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  period_type?: 'NORMAL' | 'TRIAL' | 'INTRO' | 'PROMOTIONAL';
  store?: 'APP_STORE' | 'PLAY_STORE' | 'AMAZON' | 'STRIPE' | 'PROMOTIONAL';
  environment?: 'SANDBOX' | 'PRODUCTION';
  subscriber_attributes?: Record<string, { value: string; updated_at_ms: number }>;
  cancel_reason?: string;
  new_product_id?: string;
  transferred_from?: string[];
  transferred_to?: string[];
}

interface RCPayload {
  event: RCEvent;
  api_version?: string;
}

const PRODUCT_TIER_MAP: Record<string, { plan_tier: string; billing_period: 'monthly' | 'yearly' }> = {
  tactium_captain_monthly: { plan_tier: 'captain', billing_period: 'monthly' },
  tactium_captain_yearly: { plan_tier: 'captain', billing_period: 'yearly' },
  tactium_club_starter_monthly: { plan_tier: 'club_starter', billing_period: 'monthly' },
  tactium_club_starter_yearly: { plan_tier: 'club_starter', billing_period: 'yearly' },
  tactium_club_pro_monthly: { plan_tier: 'club_pro', billing_period: 'monthly' },
  tactium_club_pro_yearly: { plan_tier: 'club_pro', billing_period: 'yearly' },
  tactium_club_elite_monthly: { plan_tier: 'club_elite', billing_period: 'monthly' },
  tactium_club_elite_yearly: { plan_tier: 'club_elite', billing_period: 'yearly' },
};

// Android manda `productId:basePlanId` (p.ej. `tactium_club_pro_yearly:yearly`).
// iOS manda solo el productId. Normalizamos al productId base para mapear.
function normalizeProductId(raw?: string | null): string {
  return (raw ?? '').split(':')[0];
}

const PREMIUM_STATUSES = ['trialing', 'active', 'grace_period'];

const RESCUE_RELEVANT_TYPES = new Set([
  'INITIAL_PURCHASE',
  'PRODUCT_CHANGE',
  'RENEWAL',
  'UNCANCELLATION',
]);

function storeToPlatform(store?: string): 'ios' | 'android' | 'web' {
  if (store === 'PLAY_STORE') return 'android';
  if (store === 'APP_STORE') return 'ios';
  return 'web';
}

function resolveSubject(
  event: RCEvent,
): { subject_type: 'user' | 'club'; subject_id: string } {
  const attrs = event.subscriber_attributes ?? {};
  const targetType = attrs['$target_subject_type']?.value;
  const targetId = attrs['$target_subject_id']?.value;
  if (targetType === 'club' && targetId) {
    return { subject_type: 'club', subject_id: targetId };
  }
  return { subject_type: 'user', subject_id: event.app_user_id ?? '' };
}

function pickRealUser(ids?: string[]): string | null {
  return (ids ?? []).find((x) => x && !x.startsWith('$RCAnonymousID:')) ?? null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405);
  }

  const expected = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  if (!expected) {
    console.error('REVENUECAT_WEBHOOK_AUTH no configurado en secrets');
    return json({ error: 'misconfigured' }, 500);
  }
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : auth;
  if (token !== expected) {
    return json({ error: 'unauthorized' }, 401);
  }

  let payload: RCPayload;
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const event = payload.event;
  if (!event || !event.type) {
    return json({ error: 'missing_event_type' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no disponibles');
    return json({ error: 'misconfigured' }, 500);
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // ── TRANSFER (con RESCUE) ───────────────────────────
  if (event.type === 'TRANSFER') {
    const toUser = pickRealUser(event.transferred_to);
    const fromUsers = (event.transferred_from ?? []).filter(
      (x) => x && !x.startsWith('$RCAnonymousID:'),
    );
    let movedCount = 0;
    let rescuedCount = 0;

    if (toUser && fromUsers.length > 0) {
      const { data: movedUser, error: e1 } = await supabase
        .from('subscriptions')
        .update({
          payer_user_id: toUser,
          revenuecat_customer_id: toUser,
          subject_id: toUser,
        })
        .in('payer_user_id', fromUsers)
        .eq('subject_type', 'user')
        .select('id');
      if (e1) console.error('TRANSFER move (user subs) failed:', e1);
      else movedCount += movedUser?.length ?? 0;

      const { data: movedClub, error: e2 } = await supabase
        .from('subscriptions')
        .update({
          payer_user_id: toUser,
          revenuecat_customer_id: toUser,
        })
        .in('payer_user_id', fromUsers)
        .eq('subject_type', 'club')
        .select('id');
      if (e2) console.error('TRANSFER move (club subs) failed:', e2);
      else movedCount += movedClub?.length ?? 0;

      if (movedCount === 0) {
        const { data: userCheck } =
          await supabase.auth.admin.getUserById(toUser);
        if (userCheck?.user) {
          const { data: recent } = await supabase
            .from('subscription_events')
            .select('payload')
            .order('received_at', { ascending: false })
            .limit(50);

          const rescueEvt = (recent ?? [])
            .map((row: { payload: { event?: RCEvent } }) => row.payload?.event)
            .find(
              (e: RCEvent | undefined) =>
                !!e &&
                RESCUE_RELEVANT_TYPES.has(e.type) &&
                !!e.app_user_id &&
                fromUsers.includes(e.app_user_id),
            );

          if (rescueEvt) {
            const productId = normalizeProductId(
              rescueEvt.new_product_id ?? rescueEvt.product_id,
            );
            const tierInfo = PRODUCT_TIER_MAP[productId];
            const txnId =
              rescueEvt.original_transaction_id ?? rescueEvt.transaction_id;

            if (tierInfo && txnId) {
              const periodEnd = rescueEvt.expiration_at_ms
                ? new Date(rescueEvt.expiration_at_ms).toISOString()
                : new Date(
                    Date.now() + 30 * 24 * 60 * 60 * 1000,
                  ).toISOString();
              const periodStart = rescueEvt.purchased_at_ms
                ? new Date(rescueEvt.purchased_at_ms).toISOString()
                : null;
              const trialEnd =
                rescueEvt.period_type === 'TRIAL' && rescueEvt.expiration_at_ms
                  ? new Date(rescueEvt.expiration_at_ms).toISOString()
                  : null;
              const status =
                rescueEvt.period_type === 'TRIAL' ? 'trialing' : 'active';

              const { error: rescueErr } = await supabase
                .from('subscriptions')
                .upsert(
                  {
                    subject_type: 'user',
                    subject_id: toUser,
                    payer_user_id: toUser,
                    plan_tier: tierInfo.plan_tier,
                    billing_period: tierInfo.billing_period,
                    status,
                    current_period_start: periodStart,
                    current_period_end: periodEnd,
                    trial_end: trialEnd,
                    cancel_at_period_end: false,
                    revenuecat_customer_id: toUser,
                    original_transaction_id: txnId,
                    product_id: productId,
                    platform: storeToPlatform(rescueEvt.store),
                  },
                  { onConflict: 'original_transaction_id' },
                );

              if (rescueErr) {
                console.error('TRANSFER rescue UPSERT failed:', rescueErr);
              } else {
                rescuedCount++;
              }
            } else {
              console.warn(
                'TRANSFER rescue: evento sin tierInfo/txn',
                productId,
                txnId,
              );
            }
          }
        }
      }
    }

    await supabase.from('subscription_events').insert({
      subscription_id: null,
      event_type: 'TRANSFER',
      payload: event as unknown as Record<string, unknown>,
      processed_at: new Date().toISOString(),
    });

    return json({
      ok: true,
      transfer_moved: movedCount,
      transfer_rescued: rescuedCount,
    });
  }

  if (!event.app_user_id) {
    console.warn('Evento sin app_user_id ignorado:', event.type);
    return json({ ok: true, ignored_no_app_user_id: event.type });
  }

  const handled = new Set([
    'INITIAL_PURCHASE',
    'RENEWAL',
    'UNCANCELLATION',
    'CANCELLATION',
    'EXPIRATION',
    'BILLING_ISSUE',
    'PRODUCT_CHANGE',
  ]);
  const logOnly = new Set(['SUBSCRIPTION_PAUSED', 'UNPAUSE', 'TEST']);

  if (!handled.has(event.type) && !logOnly.has(event.type)) {
    console.log('RC event ignored:', event.type);
    return json({ ok: true, ignored: event.type });
  }

  const productId = normalizeProductId(event.new_product_id ?? event.product_id);
  const tierInfo = PRODUCT_TIER_MAP[productId];
  if (handled.has(event.type) && !tierInfo) {
    console.warn('Product no mapeado:', productId);
    await supabase.from('subscription_events').insert({
      subscription_id: null,
      event_type: `${event.type}_IGNORED_UNMAPPED_PRODUCT`,
      payload: event as unknown as Record<string, unknown>,
      processed_at: new Date().toISOString(),
    });
    return json({ ok: true, ignored_product: productId });
  }

  const { subject_type, subject_id } = resolveSubject(event);
  const platform = storeToPlatform(event.store);
  const transactionId = event.original_transaction_id ?? event.transaction_id;
  if (handled.has(event.type) && !transactionId) {
    console.warn('Evento handled sin transaction_id:', event.type);
    await supabase.from('subscription_events').insert({
      subscription_id: null,
      event_type: `${event.type}_IGNORED_NO_TXN`,
      payload: event as unknown as Record<string, unknown>,
      processed_at: new Date().toISOString(),
    });
    return json({ ok: true, ignored_no_txn: event.type });
  }

  let status: string = 'active';
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'PRODUCT_CHANGE':
      status = event.period_type === 'TRIAL' ? 'trialing' : 'active';
      break;
    case 'CANCELLATION':
      status = event.period_type === 'TRIAL' ? 'trialing' : 'active';
      break;
    case 'EXPIRATION':
      status = 'expired';
      break;
    case 'BILLING_ISSUE':
      status = 'grace_period';
      break;
  }

  if (handled.has(event.type) && tierInfo && transactionId) {
    const { data: userCheck, error: userCheckErr } =
      await supabase.auth.admin.getUserById(event.app_user_id);
    if (userCheckErr || !userCheck?.user) {
      console.warn(
        `Evento ${event.type} ignorado: user ${event.app_user_id} no existe en auth.users`,
      );
      await supabase.from('subscription_events').insert({
        subscription_id: null,
        event_type: `${event.type}_IGNORED_UNKNOWN_USER`,
        payload: event as unknown as Record<string, unknown>,
        processed_at: new Date().toISOString(),
      });
      return json({
        ok: true,
        ignored: 'unknown_user',
        app_user_id: event.app_user_id,
      });
    }

    const periodEnd = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const periodStart = event.purchased_at_ms
      ? new Date(event.purchased_at_ms).toISOString()
      : null;
    const trialEnd =
      event.period_type === 'TRIAL' && event.expiration_at_ms
        ? new Date(event.expiration_at_ms).toISOString()
        : null;

    // Un periodo ya vencido NO puede quedar en estado premium.
    //
    // CANCELLATION significa «no renovará», no «se acabó»: por eso deja la sub
    // activa hasta el final del periodo pagado. Pero la tienda puede mandarlo
    // DESPUÉS del EXPIRATION del mismo original_transaction_id (visto con 409 ms
    // de diferencia: 14:43:49.488 EXPIRATION → 14:43:49.897 CANCELLATION), y
    // como el UPSERT va por txn, el segundo evento resucitaba la fila a
    // 'active' con la fecha ya pasada. Además el dedup de más abajo la tomaba
    // por buena y expiraba la sub REAL del mismo subject.
    //
    // Con esto la tabla dice lo mismo que ya exigen quienes la leen
    // (`fn_has_premium_access` y `hasAnyActiveSub`): premium = estado bueno Y
    // periodo por vencer.
    //
    // BILLING_ISSUE queda fuera a propósito: el periodo de gracia existe
    // precisamente para mantener el acceso después del final del periodo.
    if (
      event.type !== 'BILLING_ISSUE' &&
      PREMIUM_STATUSES.includes(status) &&
      new Date(periodEnd).getTime() <= Date.now()
    ) {
      console.warn(
        `Evento ${event.type} con periodo vencido (${periodEnd}); se guarda como expired`,
      );
      status = 'expired';
    }

    const row = {
      subject_type,
      subject_id,
      payer_user_id: event.app_user_id,
      plan_tier: tierInfo.plan_tier,
      billing_period: tierInfo.billing_period,
      status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      trial_end: trialEnd,
      cancel_at_period_end: event.type === 'CANCELLATION',
      revenuecat_customer_id: event.app_user_id,
      original_transaction_id: transactionId,
      product_id: productId,
      platform,
    };

    const { data: upserted, error } = await supabase
      .from('subscriptions')
      .upsert(row, { onConflict: 'original_transaction_id' })
      .select()
      .single();

    if (error) {
      console.error('UPSERT subscription failed:', error);
      return json({ error: 'db_error', details: error.message }, 500);
    }

    // DEDUP: un subject tiene UNA sub activa. Si esta quedó activa, expira las
    // OTRAS activas del mismo subject (Android: planes = subs separadas, un
    // cambio de plan puede dejar dos activas).
    if (upserted && PREMIUM_STATUSES.includes(status)) {
      const { error: dedupErr } = await supabase
        .from('subscriptions')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('subject_type', subject_type)
        .eq('subject_id', subject_id)
        .neq('id', upserted.id)
        .in('status', PREMIUM_STATUSES);
      if (dedupErr) console.error('dedup subject subs failed:', dedupErr);
    }

    await supabase.from('subscription_events').insert({
      subscription_id: upserted?.id ?? null,
      event_type: event.type,
      payload: event as unknown as Record<string, unknown>,
      processed_at: new Date().toISOString(),
    });

    return json({ ok: true, subscription_id: upserted?.id });
  }

  await supabase.from('subscription_events').insert({
    subscription_id: null,
    event_type: event.type,
    payload: event as unknown as Record<string, unknown>,
    processed_at: new Date().toISOString(),
  });

  return json({ ok: true, logged: event.type });
});
