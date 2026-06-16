import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  BackHandler,
  Linking,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius, Spacing } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';
import { IconX, IconCheck, AmbientBackdrop } from '@components/ui';
import { useAuthStore } from '@store/authStore';
import { useTeamStore } from '@store/teamStore';
import { useClubStore, selectActiveClub } from '@store/clubStore';
import { useSubscriptionStore } from '@store/subscriptionStore';
import { toast } from '@store/toastStore';
import {
  CAPTAIN_PLAN,
  CLUB_PLANS,
  PREMIUM_STATUSES,
  TRIAL_DURATION_DAYS,
  annualDiscountPercent,
  formatEur,
  type BillingPeriod,
  type PlanDescriptor,
  type PlanTier,
} from '@core/subscriptions/plans';
import { pollForRecentSubscription } from '@core/services/subscriptions';
import { supabase } from '@core/supabase/client';
import {
  getCurrentOffering,
  diagnoseOfferings,
  purchasePackage,
  resolvePackage,
  restorePurchases,
  presentCodeRedemption,
  setSubjectAttributes,
  type PurchasesOffering,
} from '@core/purchases';
import { TrialTimeline } from '../components/TrialTimeline';

import type { RootStackScreenProps } from '@navigation/types';

// Value props centradas en el dolor real del capitán amateur (WhatsApp,
// Excel, calendarios mal cuadrados), no en features genéricas. Mantener
// entre 3-4 para no saturar.
const VALUE_PROPS = [
  'Convocatorias en 1 toque, sin chats de 80 mensajes',
  'Parejas equilibradas por puntos automáticamente',
  'Calendario y rankings escaneados desde la federación',
  'Tus jugadores avisan si pueden o no, sin perseguir a nadie',
];

// Default tier highlighted en cada flow.
const DEFAULT_CLUB_TIER: PlanTier = 'club_pro';

export const PaywallScreen = ({
  navigation,
  route,
}: RootStackScreenProps<'Paywall'>) => {
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const signOut = useAuthStore((s) => s.signOut);
  const activeRole = useTeamStore((s) => s.activeRole);
  const createTeam = useTeamStore((s) => s.createTeam);
  const club = useClubStore(selectActiveClub);
  const clubs = useClubStore((s) => s.clubs);
  const activeTeam = useTeamStore((s) => s.team);
  const addOptimistic = useSubscriptionStore((s) => s.addOptimistic);
  const refreshSubs = useSubscriptionStore((s) => s.refresh);
  const subscriptions = useSubscriptionStore((s) => s.subscriptions);

  // Modo onboarding: PaywallScreen vive en dos stacks (RootStack como modal
  // y OnboardingStack como gate obligatorio). El marcador es `nextScreen`
  // — solo el OnboardingStack lo pasa. En modo onboarding:
  //  · no hay X de cerrar (no se puede saltar el gate),
  //  · al iniciar trial hacemos replace(nextScreen) en vez de goBack,
  //  · ocultamos el link "Continuar gratis" y lo sustituimos por "Salir
  //    y cerrar sesión",
  //  · bloqueamos el back de hardware Android.
  const params = route.params as
    | {
        nextScreen?: string;
        intent?: 'captain' | 'club';
        pendingTeam?: {
          name: string;
          federation?: string;
          league?: string;
          category?: string;
          group?: string;
          gender?: 'masculino' | 'femenino' | 'mixto';
        };
      }
    | undefined;
  const nextScreen = params?.nextScreen;
  const isOnboarding = Boolean(nextScreen);
  // El flow Capitán empaqueta los datos de CreateTeam aquí: tras success
  // del trial creamos el team (el trigger DB ya pasa porque la sub user/
  // captain acaba de insertarse) y navegamos a AddPlayers.
  const pendingTeam = params?.pendingTeam;
  // En onboarding `activeRole` puede ser null (justo tras CreateClub aún
  // no hay team, y deriveRawRole(null,…) = null). Usamos `intent` como
  // verdad para decidir qué familia de planes mostrar. Fuera de onboarding
  // (modal de upgrade desde Profile) sí confiamos en activeRole, que ya
  // está poblado para entonces.
  const intent = params?.intent;

  useFocusEffect(
    useCallback(() => {
      if (!isOnboarding) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
      return () => sub.remove();
    }, [isOnboarding]),
  );

  const handleExitOnboarding = () => {
    Alert.alert(
      'Salir del registro',
      'Esto cerrará tu sesión. Podrás volver más tarde para elegir tu plan.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Salir',
          style: 'destructive',
          onPress: () => signOut(),
        },
      ],
    );
  };

  // Modo: club_admin ve los 3 tier de club; el resto ve solo plan capitán.
  // En onboarding el activeRole aún no es fiable (no hay team), así que
  // usamos la `intent` que el flow nos pasó (club vs captain).
  // Un dueño de club se suscribe a NIVEL CLUB, aunque haya cambiado su rol
  // activo a "capitán" para operar sus equipos. Si el equipo activo es de un
  // club que el usuario posee, el paywall ofrece planes Club (no Capitán) —
  // si no, un dueño de club podría comprar por error un plan Capitán (que NO
  // cubre equipos de club, ver hasPremiumAccess).
  const ownsActiveTeamClub = Boolean(
    activeTeam?.club_id && clubs.some((c) => c.id === activeTeam.club_id),
  );
  const showClubPlans = isOnboarding
    ? intent === 'club'
    : activeRole === 'club_admin' || ownsActiveTeamClub;

  const [billing, setBilling] = useState<BillingPeriod>('yearly');
  // Hoja de confirmación con la línea de tiempo del trial (Apple HIG).
  const [showTimeline, setShowTimeline] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PlanTier>(
    showClubPlans ? DEFAULT_CLUB_TIER : 'captain',
  );
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  // Offering de RC. `null` significa "no cargado aún o no disponible".
  // En simulator iOS y en sandbox sin Sandbox Tester logueado, RC devuelve
  // null y el CTA muestra toast de error en handleStartTrial.
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [offeringLoaded, setOfferingLoaded] = useState(false);

  // Carga el offering al mount. No bloquea la UI: las cards muestran
  // precios del módulo `plans.ts` (= source of truth display, ya en sync
  // con App Store Connect). El offering sólo lo necesitamos al pulsar el
  // CTA para resolver qué `PurchasesPackage` lanzar al SDK.
  useEffect(() => {
    let cancelled = false;
    getCurrentOffering()
      .then((o) => {
        if (!cancelled) {
          setOffering(o);
          setOfferingLoaded(true);
        }
      })
      .catch((e) => {
        console.warn('Paywall: getCurrentOffering failed', e);
        if (!cancelled) setOfferingLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visiblePlans: PlanDescriptor[] = useMemo(
    () => (showClubPlans ? CLUB_PLANS : [CAPTAIN_PLAN]),
    [showClubPlans],
  );

  const selectedPlan = useMemo(
    () => visiblePlans.find((p) => p.tier === selectedTier) ?? visiblePlans[0],
    [visiblePlans, selectedTier],
  );

  const price =
    billing === 'yearly'
      ? selectedPlan.priceYearlyEur
      : selectedPlan.priceMonthlyEur;
  const yearlyDiscount = annualDiscountPercent(selectedPlan);
  // Importe FACTURADO formateado para la hoja de confirmación (elemento de
  // precio prominente, coherente con el fix de 3.1.2(c) en las cards).
  const billedLabel = `${formatEur(price)}/${billing === 'monthly' ? 'mes' : 'año'}`;
  // Avisamos ~2 días antes de que termine el trial.
  const reminderDays = Math.max(1, TRIAL_DURATION_DAYS - 2);

  // ¿Hay ya una sub premium activa PARA EL SUBJECT que estamos por
  // suscribir? Si sí, este flujo es un cambio de plan (no un trial nuevo)
  // — el copy del CTA y el disclaimer deben reflejarlo. Caso típico:
  // el club_admin está dentro de los 14 días de prueba y quiere subir
  // de Starter a Pro; no debemos decirle "Empezar prueba 14 días" como
  // si fuese su primera compra.
  const existingSubForSubject = useMemo(() => {
    const subjectType = showClubPlans ? 'club' : 'user';
    const subjectId = showClubPlans ? club?.id : userId;
    if (!subjectId) return null;
    return (
      subscriptions
        .filter(
          (s) =>
            s.subject_type === subjectType &&
            s.subject_id === subjectId &&
            PREMIUM_STATUSES.includes(s.status),
        )
        .sort(
          (a, b) =>
            new Date(b.current_period_end).getTime() -
            new Date(a.current_period_end).getTime(),
        )[0] ?? null
    );
  }, [subscriptions, showClubPlans, club?.id, userId]);

  const isInTrial = existingSubForSubject?.status === 'trialing';

  // Días restantes del trial activo (si aplica). Preferimos `trial_end` y
  // caemos a `current_period_end` (en trial suelen coincidir).
  const trialDaysLeft = useMemo(() => {
    if (!isInTrial || !existingSubForSubject) return null;
    const endIso =
      existingSubForSubject.trial_end ??
      existingSubForSubject.current_period_end;
    if (!endIso) return null;
    const ms = new Date(endIso).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }, [isInTrial, existingSubForSubject]);

  const trialDaysLabel =
    trialDaysLeft == null
      ? null
      : trialDaysLeft === 0
        ? 'hoy termina tu prueba'
        : trialDaysLeft === 1
          ? 'te queda 1 día de prueba'
          : `te quedan ${trialDaysLeft} días de prueba`;

  const handleStartTrial = async () => {
    if (!userId) {
      toast.error('No hay sesión activa');
      return;
    }
    if (showClubPlans && !club?.id) {
      toast.error('Sin club activo', 'Crea un club antes de suscribirte.');
      return;
    }
    setPurchasing(true);
    try {
      const subjectType = showClubPlans ? 'club' : 'user';
      const subjectId = showClubPlans ? (club?.id as string) : userId;
      // Anotamos el id de la sub activa PREVIA para que el polling tras
      // la compra distinga una fila nueva (insertada por el webhook) de
      // la que ya estaba (cambio de plan dentro del trial).
      const previousSub = subscriptions.find(
        (s) =>
          s.subject_type === subjectType &&
          s.subject_id === subjectId &&
          PREMIUM_STATUSES.includes(s.status),
      );
      const hadExistingPremium = Boolean(previousSub);

      // Resolver package real del offering. Si RC no expone el package
      // (simulator, sandbox sin tester logueado, o productos mal
      // configurados en RC dashboard), pkg será null y abortamos con
      // toast de error. NO usamos fallback mock — enmascara configs
      // rotas que en producción dejarían a los usuarios pagando algo
      // que en realidad no se cobra.
      const pkg = offering
        ? resolvePackage(offering, selectedPlan.tier, billing)
        : null;

      let resultSub: Awaited<ReturnType<typeof pollForRecentSubscription>> =
        null;

      if (pkg) {
        // ── Flow REAL RevenueCat ─────────────────────────────────────────
        // 1) Setear attrs custom ANTES de purchase. El webhook RC →
        //    Supabase los lee del primer evento INITIAL_PURCHASE para
        //    decidir si la sub es del user o de un club concreto.
        if (subjectType === 'club') {
          await setSubjectAttributes('club', subjectId);
        } else {
          await setSubjectAttributes('user', subjectId);
        }
        // 2) StoreKit/Play toma el control: muestra sheet nativo, gestiona
        //    Face ID/biometría, intro offer (trial 14 días). Si el user
        //    cancela, lanza userCancelled.
        //    ANDROID · cambio de plan: los planes son subs SEPARADAS, así que
        //    hay que decirle a Google que REEMPLACE la actual (si no, rechaza
        //    con "ya tienes una activa"). Upgrade=inmediato, downgrade=diferido.
        const TIER_RANK: Record<string, number> = {
          captain: 0,
          club_starter: 1,
          club_pro: 2,
          club_elite: 3,
        };
        const androidChange =
          Platform.OS === 'android' && hadExistingPremium && previousSub
            ? {
                oldProductIdentifier: `${previousSub.product_id}:${previousSub.billing_period}`,
                isDowngrade:
                  TIER_RANK[selectedPlan.tier] <
                  TIER_RANK[previousSub.plan_tier],
              }
            : null;
        const purchase = await purchasePackage(pkg, androidChange).catch(
          (e: any) => {
            if (e?.userCancelled) return null;
            throw e;
          },
        );
        if (!purchase) {
          return; // el usuario canceló el sheet de compra
        }
        const info = purchase;

        // 3) CAMBIO DE PLAN: no esperamos al webhook (que antes caducaba el
        //    polling porque ACTUALIZA la fila existente, no crea una nueva).
        //    Usamos el `customerInfo` que RC devuelve al instante: Apple
        //    aplica los UPGRADES ya (el entitlement del nuevo tier queda
        //    activo) y DIFIERE los downgrades al final del periodo (el nuevo
        //    tier aún no aparece). Así el cambio se refleja al momento o se
        //    comunica claro, sin esperas raras.
        if (hadExistingPremium && previousSub) {
          const upgraded = Boolean(info.entitlements.active[selectedPlan.tier]);
          if (upgraded) {
            // Upgrade aplicado: reflejo el plan nuevo y limpio cualquier
            // downgrade que estuviera programado (lo supera).
            addOptimistic({
              ...previousSub,
              id: `optimistic_${previousSub.id}`,
              plan_tier: selectedPlan.tier,
              billing_period: billing,
              scheduled_plan_tier: null,
              status:
                previousSub.status === 'trialing' ? 'trialing' : 'active',
            });
            toast.success(
              'Plan actualizado',
              `Ahora: ${selectedPlan.displayName}`,
            );
          } else {
            // Downgrade diferido por Apple: lo persistimos como cambio
            // PROGRAMADO (RPC) para mostrarlo de forma fija en Mi suscripción,
            // y lo reflejamos al instante de forma optimista.
            supabase
              .rpc('set_scheduled_plan_change', {
                p_subscription_id: previousSub.id,
                p_tier: selectedPlan.tier,
              })
              .then(({ error }) => {
                if (error) console.warn('set_scheduled_plan_change', error);
              });
            addOptimistic({
              ...previousSub,
              id: `optimistic_${previousSub.id}`,
              scheduled_plan_tier: selectedPlan.tier,
            });
            const renew = previousSub.current_period_end
              ? new Date(previousSub.current_period_end).toLocaleDateString(
                  'es-ES',
                )
              : null;
            toast.info(
              'Cambio programado',
              renew
                ? `Pasarás a ${selectedPlan.displayName} al renovar (${renew}). Hasta entonces mantienes tu plan actual.`
                : `Pasarás a ${selectedPlan.displayName} al renovar. Hasta entonces mantienes tu plan actual.`,
            );
          }
          // No bloqueamos la navegación con el refresh: el optimistic ya
          // muestra el plan al instante. Reconciliamos con la DB en segundo
          // plano (cuando el webhook actualice la fila).
          void refreshSubs(userId);
          if (isOnboarding && nextScreen) {
            (navigation as any).replace(nextScreen);
          } else {
            navigation.goBack();
          }
          return;
        }

        // 4) TRIAL/COMPRA NUEVA: esperar a que el webhook escriba la fila.
        //    Buscamos por payer_user_id + plan_tier (para club_* RC suele
        //    insertar la fila con subject_type='user' y luego la relinkeamos).
        resultSub = await pollForRecentSubscription({
          payerUserId: userId,
          expectedTier: selectedPlan.tier,
          previousSubId: previousSub?.id ?? null,
        });
        if (resultSub) {
          // 4) Si era flow club y la fila quedó como subject=user,
          //    llamamos al RPC `link_subscription_to_club` para moverla
          //    al club destino. Idempotente — si ya está apuntando al
          //    club correcto (renewal, restore), no-op.
          if (subjectType === 'club') {
            try {
              const { data: relinked, error: relinkErr } = await supabase.rpc(
                'link_subscription_to_club',
                {
                  p_subscription_id: resultSub.id,
                  p_club_id: subjectId,
                },
              );
              if (relinkErr) throw relinkErr;
              if (relinked) {
                resultSub = (relinked as unknown) as typeof resultSub;
              }
            } catch (e) {
              console.warn('link_subscription_to_club failed', e);
              // No es fatal: la sub queda como user, el user reintentará
              // crear team y verá el bloqueo. El siguiente refresh con
              // attrs ya propagados o un manual relink resolverá.
            }
          }
          addOptimistic(resultSub);
        } else {
          // Webhook tardó >10s. La compra está hecha (StoreKit confirmó)
          // pero la fila en DB aún no llegó. Toast informativo y dejamos
          // que Realtime la traiga al store cuando aparezca.
          toast.warn(
            'Compra completada',
            'Sincronizando tu suscripción... actualiza en unos segundos.',
          );
        }
      } else {
        // RC no expone el package que pedimos. Distinguimos los dos
        // sub-casos para que el log del usuario (y nuestra propia
        // depuración) deje claro DÓNDE está la config rota:
        //   · offering null   → RC no devuelve current offering
        //     (App-Specific Shared Secret vacío en RC, App Store Server
        //     API Key sin subir, productos no aprobados en App Store
        //     Connect, o SDK aún sin configurar para este user).
        //   · pkg null pero offering OK → el offering "default" existe
        //     pero le falta el package `<tier>_<billing>` esperado
        //     (mal nombrado en RC dashboard, o no añadido al offering
        //     current).
        // DIAGNÓSTICO temporal: error real de getOfferings en el dispositivo.
        const diag = await diagnoseOfferings();
        Alert.alert('Diagnóstico tienda (debug)', diag);
        const why = !offering
          ? 'No se pudo conectar con la tienda. Revisa tu conexión y vuelve a intentarlo.'
          : `El plan ${selectedPlan.displayName} ${billing === 'monthly' ? 'Mensual' : 'Anual'} no está disponible ahora mismo. Inténtalo más tarde.`;
        toast.error('Productos no disponibles', why);
        console.warn(
          'Paywall: pkg null →',
          !offering ? 'offering null' : 'package no encontrado en offering',
          { tier: selectedPlan.tier, billing },
        );
        return;
      }

      // Flow Capitán: el form de CreateTeam pasó los datos como
      // `pendingTeam`; ahora que la sub user/captain ya existe el trigger
      // DB nos deja INSERT del team. Si la creación falla aquí, la sub
      // queda creada pero el team no — el user puede reintentarlo desde
      // el siguiente flow (no es bloqueante).
      if (pendingTeam) {
        try {
          await createTeam(pendingTeam);
        } catch (e: any) {
          toast.error(
            'No se pudo crear el equipo',
            e?.message ?? 'Inténtalo de nuevo.',
          );
          return;
        }
      }

      // Sincroniza el store con la DB antes de navegar. No basta con
      // `addOptimistic` (solo corre si el polling encontró la fila) ni con
      // Realtime (puede llegar tarde/fallar): si no refrescamos aquí, la
      // siguiente pantalla puede ver el store vacío y mostrar "sin
      // suscripción activa" justo después de haber pagado. El trigger DB
      // `subscriptions_auto_link_club` ya garantiza que la fila de un plan
      // club_* esté en subject_type='club', así que este fetch trae la sub
      // ya enlazada al club.
      await refreshSubs(userId);

      if (isOnboarding && nextScreen) {
        (navigation as any).replace(nextScreen);
      } else {
        navigation.goBack();
      }
    } catch (e: any) {
      toast.error(
        'No se pudo iniciar la prueba',
        e?.message ?? 'Inténtalo de nuevo.',
      );
    } finally {
      setPurchasing(false);
    }
  };

  // Canje de Offer Code / código promocional (top-100 waitlist, 30 días).
  // iOS abre la hoja nativa; Android, la página de canje de Play. Tras
  // volver refrescamos por si el webhook ya creó la sub.
  const handleRedeemCode = async () => {
    try {
      await presentCodeRedemption();
      if (userId) await refreshSubs(userId);
    } catch (e: any) {
      toast.error('No se pudo abrir el canje', e?.message ?? 'Inténtalo de nuevo.');
    }
  };

  // CTA principal: un trial NUEVO pasa primero por la hoja de confirmación
  // con la línea de tiempo (Hoy → recordatorio → cobro). Un cambio de plan
  // (ya hay sub activa para el subject) va directo a la compra, sin timeline.
  const onCtaPress = () => {
    if (existingSubForSubject) {
      handleStartTrial();
    } else {
      setShowTimeline(true);
    }
  };

  const handleRestore = async () => {
    if (!userId) {
      toast.error('No hay sesión activa');
      return;
    }
    setRestoring(true);
    try {
      const info = await restorePurchases();
      const activeEntitlements = Object.values(info.entitlements.active);
      if (activeEntitlements.length === 0) {
        toast.info(
          'Sin compras previas',
          'No encontramos suscripciones en esta cuenta de Apple.',
        );
        return;
      }

      // Sync directo con la RPC `sync_subscription_from_revenuecat`. En
      // teoría el webhook RC → Supabase ya creó la fila cuando Apple notificó
      // RC del restore. En la práctica hay edge cases (sub fantasma de un
      // user borrado en testing, eventos perdidos, race conditions) donde el
      // webhook no aterriza la fila. La RPC es idempotente (UPSERT por
      // original_transaction_id) — si el webhook ya creó la sub, esto solo
      // refresca su estado al snapshot fresco del SDK Apple.
      let syncedCount = 0;
      for (const ent of activeEntitlements) {
        const productId = ent.productIdentifier;
        const originalPurchaseDateMs = ent.originalPurchaseDate
          ? new Date(ent.originalPurchaseDate).getTime()
          : Date.now();
        // Stable id basado en (product, fecha de compra) para que Restore
        // múltiples sea idempotente vía el ON CONFLICT del UPSERT.
        const stableTxnId = `restore_${productId}_${originalPurchaseDateMs}`;
        const expirationAtMs = ent.expirationDate
          ? new Date(ent.expirationDate).getTime()
          : null;

        const { error: syncErr } = await supabase.rpc(
          'sync_subscription_from_revenuecat',
          {
            p_product_id: productId,
            p_original_transaction_id: stableTxnId,
            p_period_type: ent.periodType,
            p_purchased_at_ms: originalPurchaseDateMs,
            p_expiration_at_ms: expirationAtMs,
          },
        );
        if (syncErr) {
          console.warn(
            'sync_subscription_from_revenuecat failed',
            ent.identifier,
            syncErr,
          );
          continue;
        }
        syncedCount++;
      }

      if (syncedCount > 0) {
        // Refresh el store para que la UI repinte con la sub sincronizada
        // sin esperar a Realtime.
        await refreshSubs(userId);
        toast.success(
          'Compras restauradas',
          'Tu suscripción se ha vinculado a esta cuenta.',
        );
      } else {
        toast.warn(
          'Compras detectadas',
          'No se pudo sincronizar. Inténtalo en unos segundos.',
        );
      }
    } catch (e: any) {
      toast.error('No se pudo restaurar', e?.message ?? 'Inténtalo de nuevo.');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={styles.root}>
      <AmbientBackdrop intensity={0.35} />

      {/* === HEADER === */}
      <Animated.View
        entering={FadeIn.duration(220)}
        style={[styles.header, { paddingTop: insets.top + 8 }]}
      >
        {isOnboarding ? (
          // Hard gate: sin botón de cerrar. El usuario solo sale vía
          // "Empezar prueba" o "Salir y cerrar sesión" en el footer.
          <View style={{ width: 36 }} />
        ) : (
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <IconX size={14} color={Colors.text} />
          </Pressable>
        )}
        <View style={styles.headerCenter}>
          <Text style={styles.eyebrow}>TACTIUM PRO</Text>
        </View>
        <View style={{ width: 36 }} />
      </Animated.View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* === HERO === */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(60)}
          style={styles.hero}
        >
          <TactiumMark size={64} />
          {isInTrial && trialDaysLabel ? (
            <View style={styles.trialPill}>
              <Text style={styles.trialPillText}>
                EN PRUEBA · {trialDaysLabel.toUpperCase()}
              </Text>
            </View>
          ) : null}
          <Text style={styles.heroTitle}>
            {isInTrial
              ? 'Mejora tu plan'
              : showClubPlans
                ? 'Tu club, sin Excel ni WhatsApp'
                : 'Tu próxima alineación, en 90 segundos'}
          </Text>
          <Text style={styles.heroLede}>
            {isInTrial
              ? 'Sigues dentro de tu prueba gratuita: al cambiar de plan no empieza una nueva, mantienes los días que te quedan.'
              : showClubPlans
                ? 'Tus capitanes convocan, equilibran parejas y registran resultados desde un solo sitio. Tú lo ves todo.'
                : 'Convoca, equilibra parejas por puntos y envía notificaciones en menos de 2 minutos por jornada.'}
          </Text>
        </Animated.View>

        {/* === VALUE PROPS === */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(140)}
          style={styles.valueProps}
        >
          {VALUE_PROPS.map((label) => (
            <View key={label} style={styles.valueRow}>
              <View style={styles.checkDot}>
                <IconCheck size={12} color={Colors.accent} />
              </View>
              <Text style={styles.valueText}>{label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* === SOCIAL PROOF ===
            Mientras no tengamos números reales (post-launch), un copy
            honesto y específico es mejor que una métrica inventada. Lo
            cambiaremos a algo como "+200 capitanes alinean en TACTIUM"
            cuando lo tengamos. Hoy: el "para quién" sin mentir. */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(180)}
          style={styles.socialProof}
        >
          <Text style={styles.socialProofText}>
            Hecho con capitanes federados de toda España
          </Text>
        </Animated.View>

        {/* === BILLING TOGGLE === */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(220)}
          style={styles.billingToggle}
        >
          {(['monthly', 'yearly'] as const).map((opt) => {
            const sel = billing === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => setBilling(opt)}
                style={[styles.billingChip, sel && styles.billingChipActive]}
              >
                <Text
                  style={[
                    styles.billingChipText,
                    sel && styles.billingChipTextActive,
                  ]}
                >
                  {opt === 'monthly' ? 'Mensual' : 'Anual'}
                </Text>
                {opt === 'yearly' && yearlyDiscount > 0 ? (
                  <View style={styles.discountBadge}>
                    <Text style={styles.discountBadgeText}>
                      -{yearlyDiscount}%
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Animated.View>

        {/* === PLANS === */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(300)}
          style={styles.plansBlock}
        >
          {visiblePlans.map((plan) => {
            const sel = plan.tier === selectedTier;
            const monthlyEquiv =
              billing === 'yearly'
                ? (plan.priceYearlyEur / 12).toFixed(2).replace('.', ',')
                : plan.priceMonthlyEur.toFixed(2).replace('.', ',');
            const showBadge = plan.tier === DEFAULT_CLUB_TIER && showClubPlans;
            // Sub-line concreta de fit por tier — orienta al cap/admin
            // indeciso hacia el tier que probablemente le toque.
            const fitLine =
              plan.tier === 'captain'
                ? 'Para 1 capitán · gestiona tu equipo'
                : plan.tier === 'club_starter'
                  ? 'Hasta 3 equipos · clubes pequeños'
                  : plan.tier === 'club_pro'
                    ? 'Hasta 10 equipos · la mayoría de clubes federados'
                    : 'Hasta 25 equipos · escuelas y academias';
            // Ahorro anual en € (concreto, mejor que solo "-20%").
            const yearlySavings =
              billing === 'yearly'
                ? plan.priceMonthlyEur * 12 - plan.priceYearlyEur
                : 0;
            return (
              <Pressable
                key={plan.tier}
                onPress={() => setSelectedTier(plan.tier)}
                style={({ pressed }) => [
                  styles.planCard,
                  sel && styles.planCardSelected,
                  pressed && { opacity: 0.95 },
                ]}
              >
                <View style={styles.planCardHeader}>
                  <View>
                    <Text style={styles.planTitle}>{plan.displayName}</Text>
                    <Text style={styles.planQuota}>{fitLine}</Text>
                  </View>
                  {showBadge ? (
                    <View style={styles.recommendedBadge}>
                      <Text style={styles.recommendedBadgeText}>
                        MÁS ELEGIDO
                      </Text>
                    </View>
                  ) : null}
                </View>
                {/* Apple 3.1.2(c): el IMPORTE FACTURADO debe ser el elemento
                    de precio más prominente. En anual mostramos el total/año
                    en grande; el equivalente mensual va aparte, subordinado en
                    tamaño y posición. En mensual lo facturado = lo mostrado. */}
                <View style={styles.planPriceRow}>
                  {billing === 'yearly' ? (
                    <>
                      <Text style={styles.planPrice}>
                        {formatEur(plan.priceYearlyEur)}
                      </Text>
                      <Text style={styles.planPriceSuffix}>/año</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.planPrice}>{monthlyEquiv}</Text>
                      <Text style={styles.planPriceSuffix}>€/mes</Text>
                    </>
                  )}
                </View>
                {billing === 'yearly' ? (
                  <Text style={styles.planAnnualHint}>
                    ≈ {monthlyEquiv} €/mes
                  </Text>
                ) : null}
                {billing === 'yearly' && yearlySavings > 0 ? (
                  <Text style={styles.planSavings}>
                    Ahorras {formatEur(yearlySavings)} al año
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </Animated.View>

        {/* === DISCLAIMER (Apple/Google obligan visible) === */}
        <Animated.View
          entering={FadeInDown.duration(280).delay(360)}
          style={styles.disclaimer}
        >
          <Text style={styles.disclaimerText}>
            {isInTrial && trialDaysLabel
              ? `Ya estás en prueba gratuita: ${trialDaysLabel}. Al terminar pagarás ${formatEur(price)}/${billing === 'monthly' ? 'mes' : 'año'} con renovación automática. Cancela en cualquier momento desde Ajustes.`
              : existingSubForSubject
                ? `Cambiarás tu plan a ${formatEur(price)}/${billing === 'monthly' ? 'mes' : 'año'} con renovación automática. El cambio se gestiona a través de tu cuenta de App Store. Cancela en cualquier momento desde Ajustes.`
                : `Pago tras ${TRIAL_DURATION_DAYS} días de prueba. ${formatEur(price)}/${billing === 'monthly' ? 'mes' : 'año'} con renovación automática. Cancela en cualquier momento desde Ajustes.`}
          </Text>
          {/* Enlaces legales funcionales en el punto de compra: Apple
              Guideline 3.1.2(c) los exige junto al precio/duración. */}
          <View style={styles.legalLinks}>
            <Pressable
              onPress={() =>
                Linking.openURL('https://tactium.io/legal/terminos').catch(() =>
                  toast.error('No se pudo abrir', 'Comprueba tu conexión.'),
                )
              }
              hitSlop={6}
              accessibilityRole="link"
              accessibilityLabel="Términos de uso"
            >
              <Text style={styles.legalLink}>Términos de uso</Text>
            </Pressable>
            <Text style={styles.footerLinkSep}>·</Text>
            <Pressable
              onPress={() =>
                Linking.openURL('https://tactium.io/legal/privacidad').catch(
                  () => toast.error('No se pudo abrir', 'Comprueba tu conexión.'),
                )
              }
              hitSlop={6}
              accessibilityRole="link"
              accessibilityLabel="Política de privacidad"
            >
              <Text style={styles.legalLink}>Política de privacidad</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>

      {/* === FOOTER CTA === */}
      <View
        style={[styles.footer, { paddingBottom: insets.bottom + 14 }]}
      >
        <Pressable
          disabled={purchasing}
          onPress={onCtaPress}
          style={({ pressed }) => [
            styles.cta,
            purchasing && { opacity: 0.5 },
            pressed && !purchasing && { opacity: 0.85 },
          ]}
        >
          {purchasing ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <Text style={styles.ctaLabel}>
              {existingSubForSubject
                ? isInTrial
                  ? 'Mejorar plan ahora'
                  : 'Cambiar de plan'
                : `Probar gratis ${TRIAL_DURATION_DAYS} días`}
            </Text>
          )}
        </Pressable>
        {/* Trust line bajo el CTA: lo importante (sin compromiso, sin
            cargo durante el trial) merece estar pegado a la acción, no
            relegado al disclaimer legal de 11px más abajo. */}
        {!existingSubForSubject ? (
          <Text style={styles.trustLine}>
            14 días gratis · Sin compromiso · Cancela cuando quieras
          </Text>
        ) : null}
        <View style={styles.footerLinks}>
          {isOnboarding ? (
            <Pressable
              onPress={handleExitOnboarding}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Salir y cerrar sesión"
            >
              <Text style={styles.footerLink}>Salir y cerrar sesión</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => navigation.goBack()}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={
                existingSubForSubject
                  ? 'Mantener plan actual'
                  : 'Continuar gratis'
              }
            >
              <Text style={styles.footerLink}>
                {existingSubForSubject
                  ? 'Mantener plan actual'
                  : 'Continuar gratis'}
              </Text>
            </Pressable>
          )}
          <Text style={styles.footerLinkSep}>·</Text>
          <Pressable
            onPress={handleRestore}
            disabled={restoring || purchasing}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Restaurar compras"
          >
            <Text
              style={[
                styles.footerLink,
                (restoring || purchasing) && { opacity: 0.5 },
              ]}
            >
              {restoring ? 'Restaurando…' : 'Restaurar compras'}
            </Text>
          </Pressable>
          <Text style={styles.footerLinkSep}>·</Text>
          <Pressable
            onPress={handleRedeemCode}
            disabled={purchasing}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Canjear código"
          >
            <Text
              style={[styles.footerLink, purchasing && { opacity: 0.5 }]}
            >
              Canjear código
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Hoja de confirmación: línea de tiempo del trial antes de comprar. */}
      <TrialTimeline
        visible={showTimeline}
        planName={selectedPlan.displayName}
        billedLabel={billedLabel}
        trialDays={TRIAL_DURATION_DAYS}
        reminderDays={reminderDays}
        loading={purchasing}
        onConfirm={handleStartTrial}
        onCancel={() => setShowTimeline(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: '500',
  },

  scroll: {
    paddingHorizontal: 22,
    paddingTop: 18,
  },

  // Hero
  hero: {
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },
  heroTitle: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
    textAlign: 'center',
    marginTop: 8,
  },
  heroLede: {
    color: Colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
  trialPill: {
    marginTop: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
  },
  trialPillText: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },

  // Value props
  valueProps: {
    gap: 10,
    marginBottom: 22,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  socialProof: {
    alignItems: 'center',
    marginBottom: 18,
  },
  socialProofText: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  checkDot: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: Colors.accent10,
    borderWidth: 1,
    borderColor: Colors.accent40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  valueText: {
    color: Colors.text,
    fontSize: 14,
    lineHeight: 19,
    flex: 1,
  },

  // Billing toggle
  billingToggle: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    marginBottom: 14,
  },
  billingChip: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  billingChipActive: {
    backgroundColor: Colors.bgRaised,
  },
  billingChipText: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  billingChipTextActive: { color: Colors.text },
  discountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  discountBadgeText: {
    fontFamily: Fonts.mono,
    color: Colors.textInverse,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Plan cards
  plansBlock: {
    gap: 10,
    marginBottom: 18,
  },
  planCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    padding: 16,
    gap: 4,
  },
  planCardSelected: {
    // Fondo sólido (bgRaised, ligeramente más claro que bgCard) + borde
    // accent doble grosor + sombra accent para destacar sin transparencia.
    backgroundColor: Colors.bgRaised,
    borderColor: Colors.accent,
    borderWidth: 2,
    shadowColor: Colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planTitle: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  planQuota: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  recommendedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  recommendedBadgeText: {
    fontFamily: Fonts.mono,
    color: Colors.textInverse,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  planPrice: {
    fontFamily: Fonts.mono,
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  planPriceSuffix: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  planAnnualHint: {
    color: Colors.textFaint,
    fontSize: 11,
    fontFamily: Fonts.mono,
    marginTop: 4,
  },
  planSavings: {
    color: Colors.accent,
    fontFamily: Fonts.mono,
    fontSize: 11,
    letterSpacing: 0.3,
    fontWeight: '600',
    marginTop: 4,
  },
  planCheckmark: {
    position: 'absolute',
    top: 14,
    right: 14,
  },

  // Disclaimer
  disclaimer: {
    paddingTop: 6,
    paddingBottom: 4,
  },
  disclaimerText: {
    color: Colors.textFaint,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  legalLink: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },

  // Footer
  footer: {
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.hair,
    backgroundColor: Colors.background,
    gap: 12,
  },
  cta: {
    height: 56,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  ctaLabel: {
    color: Colors.textInverse,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  trustLine: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 0.5,
    textAlign: 'center',
    marginTop: 10,
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  footerLink: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  footerLinkSep: {
    color: Colors.textFaint,
  },
});
