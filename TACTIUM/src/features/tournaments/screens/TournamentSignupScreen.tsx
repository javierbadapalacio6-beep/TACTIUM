import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Share,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { useAuthStore } from '@store/authStore';
import { displayNameOf } from '@core/utils/format';
import { toast } from '@store/toastStore';
import {
  signupByCode,
  lookupTournament,
  formatFee,
  getRegistrationPartnerCode,
  sendPartnerInviteEmail,
  checkCategoryEligibility,
  resolveCategoryThreshold,
  hourlyFranjas,
  type TournamentLookup,
} from '@core/services/tournaments';

import type { RootStackScreenProps } from '@navigation/types';
import { makeSignupStyles } from '../components/signup/signupStyles';
import { StepHeader } from '../components/signup/StepHeader';
import { PlayerBlock } from '../components/signup/PlayerBlock';
import { CategoryPicker } from '../components/signup/CategoryPicker';
import {
  emptyPlayer,
  hasErrors,
  nivelKnown,
  playerNivel,
  playerPoints,
  ptsKnown,
  validatePlayer,
  type PlayerDraft,
  type PlayerErrors,
} from '../components/signup/playerDraft';

// Días concretos del torneo (índice = getDay(): 0=Dom … 6=Sáb).
const DOW_ABBR = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DOW_NAME = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES3 = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const parseIsoDate = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

interface TDay {
  label: string; // "Vie 24"
  full: string; // "Viernes 24"
}

const GENDER_LABEL: Record<string, string> = {
  masculino: 'Masculino',
  femenino: 'Femenino',
  mixto: 'Mixto',
};

type Step = 1 | 2 | 3;
const STEP_TITLE: Record<Step, string> = {
  1: '¿Quiénes jugáis?',
  2: '¿En qué categoría?',
  3: 'Horario y pago',
};

type DoneItem = { cat: string | null; partner: string; code: string; emailedTo: string | null };

// MODO MAQUETA (solo desarrollo, EXPO_PUBLIC_AVAILABILITY_MOCK=1): enseña el
// asistente también en torneos con cuota y NO envía la inscripción.
const SIGNUP_PREVIEW = process.env.EXPO_PUBLIC_AVAILABILITY_MOCK === '1';

export const TournamentSignupScreen = ({
  navigation,
  route,
}: RootStackScreenProps<'TournamentSignup'>) => {
  const c = useColors();
  const styles = useMemo(() => makeSignupStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const scrollRef = useRef<ScrollView>(null);

  const [code, setCode] = useState(route.params?.code ?? '');
  const [found, setFound] = useState<TournamentLookup | null>(null);
  const [looking, setLooking] = useState(false);

  // Asistente en 3 pasos. Volver atrás no borra nada: todo vive aquí arriba.
  const [step, setStep] = useState<Step>(1);
  // Los errores en rojo solo aparecen tras intentar avanzar desde ese paso.
  const [tried, setTried] = useState<Record<Step, boolean>>({ 1: false, 2: false, 3: false });

  const [gender, setGender] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  // 2ª categoría OPCIONAL, con OTRO compañero (o el mismo).
  const [showSecond, setShowSecond] = useState(false);
  const [category2, setCategory2] = useState<string | null>(null);

  // Los datos de la pareja los rellena quien se inscribe.
  const [me, setMe] = useState<PlayerDraft>(() =>
    emptyPlayer({
      name: user ? displayNameOf(user) : '',
      email: (user?.email as string | undefined) ?? '',
    }),
  );
  const [mate, setMate] = useState<PlayerDraft>(() => emptyPlayer());
  const [mate2, setMate2] = useState<PlayerDraft>(() => emptyPlayer());
  const patchMe = (p: Partial<PlayerDraft>) => setMe((d) => ({ ...d, ...p }));
  const patchMate = (p: Partial<PlayerDraft>) => setMate((d) => ({ ...d, ...p }));
  const patchMate2 = (p: Partial<PlayerDraft>) => setMate2((d) => ({ ...d, ...p }));

  // Condiciones del torneo: casilla OBLIGATORIA (el servidor también la exige).
  const [termsOk, setTermsOk] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  // Franjas de 1h que el jugador marca que NO puede (por día). Por defecto vacío
  // = disponible a cualquier hora.
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  // Pantalla de éxito: un código de compañero por cada inscripción (1 o 2).
  const [done, setDone] = useState<DoneItem[] | null>(null);

  // Al cambiar de paso, arriba del todo.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  // Días concretos del torneo (del inicio al fin).
  const tDays = useMemo<TDay[]>(() => {
    if (!found?.starts_on) return [];
    const start = parseIsoDate(found.starts_on);
    const end = found.ends_on ? parseIsoDate(found.ends_on) : start;
    const out: TDay[] = [];
    const d = new Date(start);
    let guard = 0;
    while (d.getTime() <= end.getTime() && guard < 31) {
      const dow = d.getDay();
      const num = d.getDate();
      out.push({ label: `${DOW_ABBR[dow]} ${num}`, full: `${DOW_NAME[dow]} ${num}` });
      d.setDate(d.getDate() + 1);
      guard++;
    }
    return out;
  }, [found]);

  // Disponibilidad por FRANJAS DE 1H: el jugador marca las horas que NO puede,
  // hasta el tope que fije el club. Por defecto disponible en todas.
  const slots = useMemo(
    () => hourlyFranjas(found?.start_time, found?.end_time),
    [found?.start_time, found?.end_time],
  );
  const removeCap = found?.max_removable_hours ?? null;
  const keyOf = (dayLabel: string, from: number) => `${dayLabel}#${from}`;
  const toggleRemoved = (dayLabel: string, from: number) => {
    const k = keyOf(dayLabel, from);
    setRemoved((prev) => {
      const n = new Set(prev);
      if (n.has(k)) {
        n.delete(k);
        return n;
      }
      if (removeCap != null && n.size >= removeCap) {
        toast.error(
          `Máximo ${removeCap} ${removeCap === 1 ? 'hora' : 'horas'}`,
          'No puedes quitar más franjas en este torneo.',
        );
        return prev;
      }
      n.add(k);
      return n;
    });
  };
  // Lo que se guarda: las franjas que el jugador NO puede (las que marcó en
  // rojo). Vacío = puede a cualquier hora. Guardar directamente las "no puede"
  // (en vez del complemento) permite excluir un día ENTERO sin ambigüedad.
  const availability = useMemo<string[]>(() => {
    if (removed.size === 0 || tDays.length === 0) return [];
    const out: string[] = [];
    for (const day of tDays)
      for (const s of slots)
        if (removed.has(keyOf(day.label, s.from))) out.push(`${day.label} ${s.label}`);
    return out;
  }, [removed, tDays, slots]);

  const doLookup = async () => {
    if (code.trim().length < 4) {
      toast.error('Escribe el código del torneo');
      return;
    }
    setLooking(true);
    try {
      const t = await lookupTournament(code);
      if (!t) {
        setFound(null);
        toast.error('No encontrado', 'Revisa el código o la inscripción está cerrada.');
        return;
      }
      setFound(t);
      setStep(1);
      setTried({ 1: false, 2: false, 3: false });
      setGender(t.genders.length === 1 ? t.genders[0] : null);
      setCategory(t.categories.length === 1 ? t.categories[0] : null);
      setCategory2(null);
      setShowSecond(false);
    } catch (e: any) {
      toast.error('Error al buscar', e?.message ?? '');
    } finally {
      setLooking(false);
    }
  };

  // Si llegamos con el código precargado (desde Explorar/Seguir), busca el
  // torneo automáticamente.
  useEffect(() => {
    if (route.params?.code && !found) doLookup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needsGender = (found?.genders.length ?? 0) > 0;
  const needsCategory = (found?.categories.length ?? 0) > 0;
  const isPair = found?.pair_based !== false;
  const rules = found?.category_rules ?? null;
  const usesNivel = !!rules && (rules.mode === 'nivel' || rules.mode === 'both');
  const generoFilter: 'M' | 'F' | null =
    gender === 'masculino' ? 'M' : gender === 'femenino' ? 'F' : null;

  // ── Pareja principal ────────────────────────────────────────────────
  const seedPoints = playerPoints(me) + (isPair ? playerPoints(mate) : 0);
  const ptsEntered = ptsKnown(me) && (!isPair || ptsKnown(mate));
  const nivelEntered = nivelKnown(me) && (!isPair || nivelKnown(mate));
  const leagueSum = nivelEntered ? playerNivel(me) + (isPair ? playerNivel(mate) : 0) : null;

  // Motivo por el que NO podéis jugar cada categoría (null = podéis).
  const catReasons = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const cat of found?.categories ?? [])
      map[cat] = checkCategoryEligibility(
        rules,
        cat,
        gender,
        ptsEntered ? seedPoints : null,
        leagueSum,
      );
    return map;
  }, [found, rules, gender, ptsEntered, seedPoints, leagueSum]);
  const eligibleCats = useMemo(
    () => (found?.categories ?? []).filter((cat) => catReasons[cat] == null),
    [found, catReasons],
  );
  // Requisito legible de cada categoría («Hasta 900 pts · nivel ≥ 8» / «Libre»).
  const catDetails = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const cat of found?.categories ?? []) {
      if (!rules) {
        map[cat] = null;
        continue;
      }
      const t = resolveCategoryThreshold(rules, cat, gender);
      const parts = [
        t?.puntos != null && (rules.mode === 'points' || rules.mode === 'both')
          ? `hasta ${t.puntos} pts`
          : null,
        t?.nivel != null && (rules.mode === 'nivel' || rules.mode === 'both')
          ? `nivel ≥ ${t.nivel}`
          : null,
      ].filter(Boolean) as string[];
      const txt = parts.join(' · ');
      map[cat] = txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : 'Libre';
    }
    return map;
  }, [found, rules, gender]);

  const eligibilityError = checkCategoryEligibility(
    rules,
    category,
    gender,
    ptsEntered ? seedPoints : null,
    leagueSum,
  );

  // ── 2ª categoría (compañero B) ───────────────────────────────────────
  // Solo si el torneo tiene ≥2 categorías y es por parejas.
  const canSecond = !!found && (found.categories?.length ?? 0) >= 2 && isPair;
  const seedPointsB = playerPoints(me) + playerPoints(mate2);
  const ptsEnteredB = ptsKnown(me) && ptsKnown(mate2);
  const leagueSumB =
    nivelKnown(me) && nivelKnown(mate2) ? playerNivel(me) + playerNivel(mate2) : null;
  const catReasonsB = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const cat of found?.categories ?? [])
      map[cat] = checkCategoryEligibility(
        rules,
        cat,
        gender,
        ptsEnteredB ? seedPointsB : null,
        leagueSumB,
      );
    return map;
  }, [found, rules, gender, ptsEnteredB, seedPointsB, leagueSumB]);
  const eligibilityErrorB = category2 ? catReasonsB[category2] ?? null : null;

  // Al entrar en el paso 2: si la categoría elegida ya no encaja se quita, y si
  // solo encaja UNA se marca sola.
  useEffect(() => {
    if (step !== 2 || !found) return;
    const current = category && catReasons[category] == null ? category : null;
    if (current !== category) setCategory(current);
    if (!current && eligibleCats.length === 1) setCategory(eligibleCats[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, found, catReasons]);
  // La 2ª categoría no puede ser la misma que la 1ª.
  useEffect(() => {
    if (category2 && category2 === category) setCategory2(null);
  }, [category, category2]);

  // Precio: cuota de 2 categorías si hay 2ª (fallback a 2× la de 1).
  const feeToPay = category2
    ? found?.entry_fee_2 ?? (found?.entry_fee != null ? found.entry_fee * 2 : null)
    : found?.entry_fee ?? null;
  // Texto de la ficha: estructura de precios (1 cat / 2 cats) o cuota única.
  const feeInfo = ((): string => {
    if (!found) return '';
    const oneFee = found.entry_fee;
    const twoFee = found.entry_fee_2 ?? (oneFee != null ? oneFee * 2 : null);
    const hasTwo = (found.categories?.length ?? 0) >= 2;
    if (!oneFee && !twoFee) return 'Inscripción gratuita';
    if (hasTwo && twoFee != null) {
      return `1 categoría ${oneFee ? formatFee(oneFee, found.fee_currency) : 'gratis'} · 2 categorías ${formatFee(twoFee, found.fee_currency)}`;
    }
    return oneFee ? formatFee(oneFee, found.fee_currency) : 'Inscripción gratuita';
  })();
  // Rango de fechas legible del torneo ("Sáb 15 – Dom 16 ago").
  const datesLabel = useMemo(() => {
    if (!found?.starts_on) return null;
    const s = parseIsoDate(found.starts_on);
    const sLbl = `${DOW_ABBR[s.getDay()]} ${s.getDate()} ${MESES3[s.getMonth()]}`;
    if (!found.ends_on || found.ends_on === found.starts_on) return sLbl;
    const e = parseIsoDate(found.ends_on);
    return `${DOW_ABBR[s.getDay()]} ${s.getDate()} – ${DOW_ABBR[e.getDay()]} ${e.getDate()} ${MESES3[e.getMonth()]}`;
  }, [found]);

  // ── Validación por paso ─────────────────────────────────────────────
  const errMe: PlayerErrors = validatePlayer(me, {
    me: true,
    usesNivel,
    emailRequired: true,
    phoneRequired: true,
  });
  const errMate: PlayerErrors = isPair
    ? validatePlayer(mate, { me: false, usesNivel, emailRequired: false, phoneRequired: false })
    : {};
  const errMate2: PlayerErrors = showSecond
    ? validatePlayer(mate2, { me: false, usesNivel, emailRequired: false, phoneRequired: false })
    : {};
  const genderError = needsGender && !gender ? 'Elige una opción' : null;
  const step1Ok = !genderError && !hasErrors(errMe) && !hasErrors(errMate);

  const categoryError =
    needsCategory && !category
      ? eligibleCats.length
        ? 'Elige una categoría'
        : null
      : eligibilityError;
  const category2Error = showSecond
    ? !category2
      ? 'Elige la 2ª categoría o quítala'
      : eligibilityErrorB
    : null;
  const step2Ok = !categoryError && (!needsCategory || !!category) && !category2Error && !hasErrors(errMate2);

  const goNext = () => {
    if (step === 1) {
      setTried((t) => ({ ...t, 1: true }));
      if (!step1Ok) {
        toast.error('Revisa los datos marcados');
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      setTried((t) => ({ ...t, 2: true }));
      if (!step2Ok) {
        toast.error(
          needsCategory && eligibleCats.length === 0
            ? 'No encajáis en ninguna categoría'
            : 'Revisa la categoría',
        );
        return;
      }
      setStep(3);
      return;
    }
    setTried((t) => ({ ...t, 3: true }));
    if (!termsOk) {
      toast.error('Acepta las condiciones del torneo');
      return;
    }
    save();
  };
  const goBack = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  // Atrás del sistema (Android) o gesto de volver: en los pasos 2 y 3 vuelve
  // un paso en vez de salir de la inscripción y perder lo rellenado.
  const stepRef = useRef(step);
  stepRef.current = step;
  const doneRef = useRef(done);
  doneRef.current = done;
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (doneRef.current || !found || stepRef.current === 1) return;
        e.preventDefault();
        setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
      }),
    [navigation, found],
  );

  // Torneo con CUOTA → el pago es web-first (Apple 3.1.3: la app no puede
  // cobrar servicios del mundo real por métodos ajenos a IAP dentro de la app,
  // pero sí comunicarlos fuera). Se abre la ficha de pago en el navegador; allí
  // la pareja rellena, paga y queda inscrita. La BD además bloquea la
  // inscripción gratuita en estos torneos.
  const openWebSignup = () => {
    if (!found) return;
    Linking.openURL(`https://tactium.io/torneos/${found.id}/inscripcion`).catch(() =>
      toast.error('No se pudo abrir la ficha de pago'),
    );
  };

  const save = async () => {
    if (!found) {
      toast.error('Busca primero el torneo con su código');
      return;
    }
    if (SIGNUP_PREVIEW) {
      toast.info('Modo maqueta', 'No se ha enviado nada: así quedaría la inscripción.');
      return;
    }
    if ((found.entry_fee ?? 0) > 0) {
      openWebSignup();
      return;
    }
    // Red de seguridad: el asistente ya valida cada paso.
    if (!step1Ok || !step2Ok || !termsOk) {
      toast.error('Faltan datos', 'Revisa los pasos anteriores.');
      return;
    }
    const p1 = me.name;
    const p2 = mate.name;
    const p2b = mate2.name;
    setSaving(true);
    try {
      // Inscribe UNA categoría con su compañero; devuelve el código de compañero
      // (o null si es individual o no se pudo recuperar).
      const signupOne = async (
        cat: string | null,
        partnerName: string,
        partnerEmail: string,
        seed: number,
        league: number | null,
      ) => {
        const regId = await signupByCode({
          code,
          gender,
          category: cat,
          p1Name: p1,
          p1Email: me.email.trim() || undefined,
          p1Phone: me.phone.trim() || undefined,
          p2Name: isPair ? partnerName : '',
          p2Email: isPair ? partnerEmail.trim() || undefined : undefined,
          seedPoints: seed,
          leagueSum: league,
          availability,
          termsAccepted: termsOk,
        });
        if (!isPair) return null;
        const partnerCode = await getRegistrationPartnerCode(regId).catch(() => null);
        let emailedTo: string | null = null;
        if (partnerCode && partnerEmail.trim()) {
          const ok = await sendPartnerInviteEmail({
            toEmail: partnerEmail.trim(),
            toName: partnerName.trim() || null,
            fromName: p1.trim() || 'Tu compañero',
            tournamentName: found?.name ?? 'el torneo',
            code: partnerCode,
          });
          if (ok) emailedTo = partnerEmail.trim();
        }
        return partnerCode
          ? { cat, partner: partnerName.trim(), code: partnerCode, emailedTo }
          : null;
      };

      const results: DoneItem[] = [];
      const r1 = await signupOne(category, p2, mate.email, seedPoints, leagueSum);
      if (r1) results.push(r1);
      if (category2) {
        const r2 = await signupOne(category2, p2b, mate2.email, seedPointsB, leagueSumB);
        if (r2) results.push(r2);
      }

      if (!isPair || results.length === 0) {
        toast.success('¡Inscripción hecha!', 'El club te confirmará el cuadro.');
        navigation.goBack();
        return;
      }
      setDone(results);
    } catch (e: any) {
      toast.error('No se pudo inscribir', e?.message ?? 'Revisa el código.');
    } finally {
      setSaving(false);
    }
  };

  const shareCode = async () => {
    if (!done || done.length === 0) return;
    const lines = done
      .map((d) => `${d.cat ? d.cat + ': ' : ''}${d.partner || 'tu pareja'} → código ${d.code}`)
      .join('\n');
    try {
      await Share.share({
        message: `🎾 Te he apuntado como pareja en "${found?.name ?? 'un torneo'}" (TACTIUM).\n${lines}\nVincula tu cuenta en la app: Torneos → "Tengo un código de compañero".`,
      });
    } catch {
      /* cancelado */
    }
  };

  // ── Éxito: tarjeta tipo entrada ───────────────────────────────────────
  if (done) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingBottom: insets.bottom + 24,
            flexGrow: 1,
            justifyContent: 'center',
          }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.successTitle}>Estáis dentro</Text>
          <Text style={styles.successText}>
            {done.length > 1
              ? 'Te has apuntado a 2 categorías. Pásale a cada compañero/a su código para que vincule su cuenta y vea el torneo.'
              : 'El club os confirmará el cuadro. Pásale este código a tu pareja para que vincule su cuenta y vea el torneo en su app.'}
          </Text>

          {done.map((d, i) => (
            <View key={i} style={styles.ticket}>
              <View style={styles.ticketTop}>
                <Text style={styles.ticketEyebrow}>INSCRIPCIÓN CONFIRMADA</Text>
                <Text style={styles.ticketName} numberOfLines={2}>
                  {found?.name ?? 'Torneo'}
                </Text>
                <View style={styles.infoBox}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>CATEGORÍA</Text>
                    <Text style={styles.infoValue}>{d.cat ?? 'Única'}</Text>
                  </View>
                  <View style={[styles.infoRow, !datesLabel && styles.infoRowLast]}>
                    <Text style={styles.infoLabel}>PAREJA</Text>
                    <Text style={styles.infoValue}>
                      {me.name.trim()} / {d.partner || 'tu pareja'}
                    </Text>
                  </View>
                  {datesLabel ? (
                    <View style={[styles.infoRow, styles.infoRowLast]}>
                      <Text style={styles.infoLabel}>FECHAS</Text>
                      <Text style={styles.infoValue}>{datesLabel}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View style={styles.ticketCut}>
                <View style={[styles.ticketNotch, { marginLeft: -9 }]} />
                <View style={styles.ticketDash} />
                <View style={[styles.ticketNotch, { marginRight: -9 }]} />
              </View>
              <View style={styles.ticketBottom}>
                <Text style={styles.codeBigLabel}>CÓDIGO DE COMPAÑERO</Text>
                <Text style={styles.codeBig}>{d.code}</Text>
                <Text style={styles.ticketNote}>
                  {d.emailedTo
                    ? `Enviado por email a ${d.emailedTo}`
                    : `Pásaselo a ${d.partner || 'tu pareja'}`}
                </Text>
              </View>
            </View>
          ))}

          <Pressable onPress={shareCode} style={styles.primaryBtn}>
            <Text style={styles.primaryBtnText}>
              Compartir {done.length > 1 ? 'códigos' : 'código'}
            </Text>
          </Pressable>
          <Pressable onPress={() => navigation.goBack()} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Hecho</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // Ficha ordenada del torneo (se ve antes del paso 1 y en los de cuota).
  const infoCard = found ? (
    <View style={styles.foundCard}>
      <Text style={styles.foundName} numberOfLines={2}>
        {found.name}
      </Text>
      <View style={styles.infoBox}>
        {datesLabel ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>FECHAS</Text>
            <Text style={styles.infoValue}>{datesLabel}</Text>
          </View>
        ) : null}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>HORARIO</Text>
          <Text style={styles.infoValue}>
            {(found.start_time || '09:00').slice(0, 5)}–{(found.end_time || '22:00').slice(0, 5)}
          </Text>
        </View>
        {found.genders.length ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>GÉNEROS</Text>
            <Text style={styles.infoValue}>
              {found.genders.map((g) => GENDER_LABEL[g] ?? g).join(' · ')}
            </Text>
          </View>
        ) : null}
        {found.categories.length ? (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CATEGORÍAS</Text>
            <Text style={styles.infoValue}>{found.categories.join(' · ')}</Text>
          </View>
        ) : null}
        <View style={[styles.infoRow, styles.infoRowLast]}>
          <Text style={styles.infoLabel}>CUOTA</Text>
          <Text style={[styles.infoValue, { color: c.accent, fontWeight: '800' }]}>{feeInfo}</Text>
        </View>
      </View>
    </View>
  ) : null;

  // Torneo con CUOTA → inscripción y pago WEB-FIRST. No pedimos el formulario en
  // la app: se perdía al saltar al navegador y no se puede pasar el nombre/
  // teléfono por la URL (privacidad). Se rellena y paga UNA vez en la web, donde
  // además se autodetectan los puntos por nombre (Federación). Solo mostramos la
  // ficha del torneo + botón para ir a la inscripción.
  if (found && (found.entry_fee ?? 0) > 0 && !SIGNUP_PREVIEW) {
    return (
      <View style={styles.root}>
        <StepHeader
          c={c}
          styles={styles}
          topInset={insets.top}
          onExit={() => navigation.goBack()}
          step={null}
          title="Apuntarme"
        />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {infoCard}
          <Text style={[styles.webNote, { marginTop: 14 }]}>
            La inscripción y el pago de este torneo se hacen en la web. Al escribir tu nombre se
            detectan tus puntos de la Federación automáticamente; ahí rellenáis la pareja y
            pagáis.
          </Text>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            onPress={openWebSignup}
            style={({ pressed }) => [styles.saveBtn, { flex: 0 }, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.saveLabel}>
              Ir a la inscripción · {found.entry_fee} {found.fee_currency ?? '€'}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── Paso 1: ¿Quiénes jugáis? ──────────────────────────────────────────
  const renderStep1 = () => (
    <>
      {found!.genders.length > 1 ? (
        <>
          <Text style={styles.label}>Género</Text>
          <View style={styles.catChips}>
            {found!.genders.map((g) => {
              const sel = gender === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => setGender(g)}
                  style={[
                    styles.catChip,
                    sel && { backgroundColor: c.accent, borderColor: c.accent },
                    tried[1] && genderError ? { borderColor: c.error } : null,
                  ]}
                >
                  <Text style={[styles.catChipText, { color: sel ? c.textInverse : c.text }]}>
                    {GENDER_LABEL[g] ?? g}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {tried[1] && genderError ? <Text style={styles.fieldError}>{genderError}</Text> : null}
        </>
      ) : null}

      <PlayerBlock
        c={c}
        styles={styles}
        title="TÚ"
        me
        draft={me}
        onChange={patchMe}
        errors={tried[1] ? errMe : {}}
        usesNivel={usesNivel}
        genero={generoFilter}
        showPhone
        emailRequired
        namePlaceholder="Tu nombre y apellidos"
      />

      {isPair ? (
        <PlayerBlock
          c={c}
          styles={styles}
          title="TU PAREJA"
          note="Rellena tú sus datos; luego le pasas un código para que vincule su cuenta."
          me={false}
          draft={mate}
          onChange={patchMate}
          errors={tried[1] ? errMate : {}}
          usesNivel={usesNivel}
          genero={generoFilter}
          showPhone={false}
          emailRequired={false}
          emailHint="Si lo pones, le mandamos el código por email."
          namePlaceholder="Nombre y apellidos de tu pareja"
        />
      ) : null}
    </>
  );

  // ── Paso 2: ¿En qué categoría? ────────────────────────────────────────
  const sumLine = [
    `${isPair ? 'Sumáis' : 'Sumas'} ${seedPoints} pts`,
    usesNivel && leagueSum != null ? `nivel ${leagueSum}` : null,
    gender ? GENDER_LABEL[gender] ?? gender : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const cats2 = (found?.categories ?? []).filter((cat) => cat !== category);

  const renderStep2 = () => (
    <>
      <Text style={styles.stepSub}>{sumLine}</Text>

      {!needsCategory ? (
        <View style={styles.catList}>
          <View style={[styles.catCard, styles.catCardSel]}>
            <View style={[styles.radio, styles.radioOn]}>
              <View style={styles.radioDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.catName}>Categoría única</Text>
              <Text style={styles.catDetail}>Este torneo no separa por categorías</Text>
            </View>
          </View>
        </View>
      ) : eligibleCats.length === 0 ? (
        <>
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No encajáis en ninguna categoría</Text>
            <Text style={styles.emptyText}>
              Con los puntos{usesNivel ? ' y el nivel' : ''} que habéis puesto no cumplís los
              requisitos de ninguna. Revisa los datos por si hay algún error.
            </Text>
            <Pressable onPress={() => setStep(1)} style={styles.ghostBtn}>
              <Text style={styles.ghostBtnText}>← Revisar datos</Text>
            </Pressable>
          </View>
          <CategoryPicker
            styles={styles}
            categories={found!.categories}
            selected={null}
            onSelect={() => {}}
            reasons={catReasons}
          />
        </>
      ) : (
        <>
          <CategoryPicker
            styles={styles}
            categories={found!.categories}
            selected={category}
            onSelect={setCategory}
            reasons={catReasons}
            details={catDetails}
          />
          {tried[2] && categoryError ? (
            <Text style={styles.fieldError}>{categoryError}</Text>
          ) : null}
        </>
      )}

      {canSecond && eligibleCats.length > 0 ? (
        showSecond ? (
          <View style={styles.secondCatBlock}>
            <View style={styles.secondHead}>
              <Text style={[styles.blockTitle, { marginTop: 0 }]}>2ª CATEGORÍA</Text>
              <Pressable
                onPress={() => {
                  setShowSecond(false);
                  setCategory2(null);
                }}
                hitSlop={8}
              >
                <Text style={styles.linkText}>Quitar</Text>
              </Pressable>
            </View>
            <Text style={styles.blockNote}>
              Puedes jugar otra categoría con otro compañero (o el mismo).
            </Text>
            <PlayerBlock
              c={c}
              styles={styles}
              title="COMPAÑERO/A DE LA 2ª CATEGORÍA"
              me={false}
              draft={mate2}
              onChange={patchMate2}
              errors={tried[2] ? errMate2 : {}}
              usesNivel={usesNivel}
              genero={generoFilter}
              showPhone={false}
              emailRequired={false}
              emailHint="Si lo pones, le mandamos el código por email."
              namePlaceholder="Nombre y apellidos"
            />
            <Text style={styles.label}>¿Qué categoría?</Text>
            <CategoryPicker
              styles={styles}
              categories={cats2}
              selected={category2}
              onSelect={setCategory2}
              reasons={catReasonsB}
              details={catDetails}
            />
            {tried[2] && category2Error ? (
              <Text style={styles.fieldError}>{category2Error}</Text>
            ) : null}
          </View>
        ) : (
          <Pressable onPress={() => setShowSecond(true)} style={styles.addSecondBtn}>
            <Text style={styles.linkText}>+ Apuntarme también a una 2ª categoría</Text>
          </Pressable>
        )
      ) : null}
    </>
  );

  // ── Paso 3: Horario y pago ────────────────────────────────────────────
  const partnersLine = [
    isPair ? `${me.name.trim()} / ${mate.name.trim()}` : me.name.trim(),
    category2 ? `${me.name.trim()} / ${mate2.name.trim()}` : null,
  ].filter(Boolean) as string[];

  const renderStep3 = () => (
    <>
      <View style={styles.availHead}>
        <Text style={[styles.label, { marginTop: 0, marginBottom: 0 }]}>
          ¿Cuándo no {isPair ? 'podéis' : 'puedes'}?
        </Text>
        {removeCap != null || removed.size > 0 ? (
          <View style={styles.capChip}>
            <Text style={styles.capChipText}>
              {removeCap != null ? `${removed.size}/${removeCap} h` : `${removed.size} h`}
            </Text>
          </View>
        ) : null}
      </View>
      {tDays.length === 0 ? (
        <Text style={styles.availHint}>
          Aún no hay fechas · te apuntas disponible a cualquier hora.
        </Text>
      ) : (
        <>
          <Text style={styles.availHint}>
            Toca las horas en las que{' '}
            <Text style={{ fontWeight: '800', color: c.text }}>NO</Text>{' '}
            {isPair ? 'podéis' : 'puedes'} jugar. Si no marcas nada, cualquier hora vale.
          </Text>
          {tDays.map((day) => (
            <View key={day.label} style={styles.franjaBlock}>
              <Text style={styles.franjaLabel}>{day.full}</Text>
              <View style={styles.hourGrid}>
                {slots.map((s) => {
                  const off = removed.has(keyOf(day.label, s.from));
                  return (
                    <Pressable
                      key={s.from}
                      onPress={() => toggleRemoved(day.label, s.from)}
                      style={[
                        styles.hourCell,
                        off && { backgroundColor: c.error, borderColor: c.error },
                      ]}
                    >
                      <Text
                        style={[styles.hourCellText, { color: off ? c.textInverse : c.text }]}
                        numberOfLines={1}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </>
      )}

      <View style={styles.summary}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>CATEGORÍA</Text>
          <Text style={styles.infoValue}>
            {[category ?? 'Única', category2].filter(Boolean).join(' · ')}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{isPair ? 'PAREJA' : 'JUGADOR'}</Text>
          <Text style={styles.infoValue}>{partnersLine.join('\n')}</Text>
        </View>
        <View style={[styles.infoRow, styles.infoRowLast]}>
          <Text style={styles.infoLabel}>CUOTA</Text>
          <Text style={[styles.infoValue, { color: c.accent, fontWeight: '800' }]}>
            {feeToPay && feeToPay > 0
              ? `${formatFee(feeToPay, found!.fee_currency)}${category2 ? ' · 2 categorías' : ''}`
              : 'Inscripción gratuita'}
          </Text>
        </View>
      </View>

      <View style={styles.termsRow}>
        <Pressable
          onPress={() => setTermsOk((v) => !v)}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: termsOk }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}
        >
          <View
            style={[
              styles.checkBox,
              termsOk && styles.checkBoxOn,
              tried[3] && !termsOk ? { borderColor: c.error } : null,
            ]}
          >
            {termsOk ? <Text style={styles.checkMark}>✓</Text> : null}
          </View>
          <Text style={styles.termsAccept}>Acepto las condiciones del torneo</Text>
        </Pressable>
        <Pressable onPress={() => setTermsOpen((v) => !v)} hitSlop={8}>
          <Text style={styles.linkText}>{termsOpen ? 'Ocultar' : 'Leer'}</Text>
        </Pressable>
      </View>
      {tried[3] && !termsOk ? (
        <Text style={styles.fieldError}>Tienes que aceptarlas para apuntaros.</Text>
      ) : null}
      {termsOpen ? <Text style={styles.termsText}>{found!.terms}</Text> : null}
    </>
  );

  const primaryLabel =
    step === 1
      ? 'Ver categorías →'
      : step === 2
        ? 'Elegir horario →'
        : isPair
          ? 'Apuntarnos al torneo'
          : 'Apuntarme al torneo';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.root}
    >
      <StepHeader
        c={c}
        styles={styles}
        topInset={insets.top}
        onExit={() => navigation.goBack()}
        step={found ? step : null}
        tournamentName={found?.name}
        title={found ? STEP_TITLE[step] : 'Apuntarme'}
      />

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingHorizontal: 22, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <>
            <Text style={styles.label}>Código del torneo</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={[styles.input, { flex: 1 }]}>
                <TextInput
                  value={code}
                  onChangeText={(v) => {
                    setCode(v.toUpperCase().replace(/\s/g, ''));
                    setFound(null);
                    setStep(1);
                  }}
                  placeholder="ABC123"
                  placeholderTextColor={c.textFaint}
                  style={[styles.inputField, { fontFamily: Fonts.mono, letterSpacing: 3 }]}
                  autoCapitalize="characters"
                  maxLength={8}
                />
              </View>
              <Pressable
                onPress={doLookup}
                disabled={looking}
                style={({ pressed }) => [styles.lookupBtn, pressed && { opacity: 0.85 }]}
              >
                {looking ? (
                  <ActivityIndicator size="small" color={c.accent} />
                ) : (
                  <Text style={styles.lookupText}>Buscar</Text>
                )}
              </Pressable>
            </View>
            {infoCard}
          </>
        ) : null}

        {found ? (
          step === 1 ? renderStep1() : step === 2 ? renderStep2() : renderStep3()
        ) : null}
      </ScrollView>

      {found ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.footerRow}>
            {step > 1 ? (
              <Pressable
                onPress={goBack}
                disabled={saving}
                style={({ pressed }) => [styles.stepBackBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.stepBackText}>Atrás</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={goNext}
              disabled={saving}
              style={({ pressed }) => [
                styles.saveBtn,
                saving && { opacity: 0.5 },
                pressed && { opacity: 0.85 },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={c.textInverse} />
              ) : (
                <Text style={styles.saveLabel}>{primaryLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
};
