import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert, Share, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { IconCheck, IconClock } from '@components/ui/Icon';
import { useColors, withAlpha, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { usePremiumGate } from '@core/hooks/usePremiumGate';
import * as TimePollsApi from '@core/services/timePolls';
import { RemindError } from '@core/services/availabilityErrors';
import { toast } from '@store/toastStore';
import { useTeamStore } from '@store/teamStore';
import type { RootStackParamList } from '@navigation/types';

import { useTimePoll } from '../hooks/useTimePoll';
import { ProposeTimesSheet } from './ProposeTimesSheet';

const REMIND_COOLDOWN_MS = 12 * 3_600_000;
const DAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

function shortWhen(d: Date): string {
  return `${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} a las ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function initials(n: string) {
  return n
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

interface Props {
  matchdayId: string;
  /** Capitán o gestor del club del equipo: crea, recuerda, fija. */
  canManage: boolean;
  /**
   * `full`: bloque de la pantalla de la jornada (con «Proponer horas»).
   * `home`: dentro de la tarjeta «Próxima jornada»; solo si hay encuesta
   * abierta, compacto.
   */
  variant?: 'full' | 'home';
  /** Paleta forzada (la tarjeta de Inicio es siempre oscura). */
  palette?: Palette;
  /** Tras fijar o crear: la pantalla recarga la jornada. */
  onChanged?: () => void;
}

/**
 * Encuesta de hora de la jornada.
 *
 * Referencias (Mobbin): filas de opción con el círculo de marcar y los
 * avatares de quién la eligió, de la encuesta de Messages (iOS) y del
 * resultado de Yubo; el recuento ordenado con «Fijar» en cada fila, del
 * «Top times · Book» de Calendly (Meeting polls).
 */
export const TimePollCard: React.FC<Props> = ({
  matchdayId,
  canManage: canManageProp,
  variant = 'full',
  palette,
  onChanged,
}) => {
  const themed = useColors();
  const c = palette ?? themed;
  const styles = useMemo(() => makeStyles(c), [c]);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const gate = usePremiumGate();
  const tp = useTimePoll(matchdayId);
  // El gestor del club del equipo también puede (la RPC lo permite vía
  // private.is_team_admin), aunque el resto de la jornada la vea en lectura.
  const isClubAdmin = useTeamStore((s) => s.activeRole === 'club_admin');
  const canManage = canManageProp || isClubAdmin;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [remindedAt, setRemindedAt] = useState<Date | null>(null);

  const { poll, matchday, team, players, myPlayerId, availability } = tp;
  if (tp.loading || !matchday) return null;

  const isOpen = poll?.status === 'open';
  const deadlinePassed = !!poll?.deadline && poll.deadline.getTime() <= Date.now();
  const canVote = isOpen && !deadlinePassed && !!myPlayerId;
  const title = `J${String(matchday.jornada_number ?? '').padStart(2, '0')} vs ${matchday.opponent ?? 'rival'}`;

  // ── Sin encuesta abierta ───────────────────────────────────────────────
  if (!isOpen) {
    if (variant === 'home') return null;
    const fixedOpt =
      poll?.status === 'fixed' ? poll.options.find((o) => o.id === poll.fixedOptionId) : null;
    const offer = canManage && TimePollsApi.canProposeTimes(team, matchday);
    if (!fixedOpt && !offer) return null;

    const create = async (input: {
      options: { date: string; time: string }[];
      message: string | null;
      deadline: Date | null;
    }) => {
      setCreating(true);
      try {
        await TimePollsApi.createTimePoll({ matchdayId, ...input });
        setSheetOpen(false);
        toast.success('Encuesta enviada', 'Tu equipo ya puede votar.');
        await tp.reload();
        onChanged?.();
      } catch (e) {
        if (e instanceof TimePollsApi.TimePollError && e.kind === 'premium') {
          setSheetOpen(false);
          nav.navigate('Paywall', { intent: 'time_poll' });
        } else {
          toast.error('No se pudo enviar', (e as Error)?.message);
        }
      } finally {
        setCreating(false);
      }
    };

    return (
      <View style={styles.card}>
        {fixedOpt ? (
          <View style={styles.fixedRow}>
            <View style={styles.fixedIcon}>
              <IconCheck size={14} color={c.accent} />
            </View>
            <Text style={styles.fixedText}>
              Hora elegida por encuesta:{' '}
              <Text style={styles.mono}>{TimePollsApi.optionLabel(fixedOpt)}</Text>
            </Text>
          </View>
        ) : null}
        {offer ? (
          <Pressable
            onPress={gate(() => setSheetOpen(true), 'time_poll')}
            style={({ pressed }) => [styles.proposeRow, fixedOpt && styles.proposeRowTop, pressed && { opacity: 0.75 }]}
            accessibilityRole="button"
          >
            <IconClock size={16} color={c.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.proposeTitle}>Proponer horas</Text>
              <Text style={styles.proposeSub}>
                {matchday.match_time
                  ? 'Pregunta al equipo qué día y hora les va mejor.'
                  : 'Esta jornada aún no tiene hora. Que vote el equipo.'}
              </Text>
            </View>
          </Pressable>
        ) : null}
        <ProposeTimesSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={title}
          matchDate={matchday.match_date}
          matchTime={matchday.match_time}
          slots={team?.preferred_home_slots ?? []}
          sending={creating}
          onSubmit={create}
        />
      </View>
    );
  }

  // ── Encuesta abierta ──────────────────────────────────────────────────
  const ids = players.map((p) => p.id);
  const tally = TimePollsApi.tallyPoll(poll!, ids);
  const byId = new Map(players.map((p) => [p.id, p]));
  const myVote = myPlayerId ? poll!.votes[myPlayerId] : undefined;
  const maxCount = Math.max(1, ...Object.values(tally.byOption).map((a) => a.length));
  const hasAvail = Object.keys(availability).length > 0;

  const vote = async (next: string[]) => {
    if (!canVote) return;
    const prev = myVote;
    tp.setMyVote(next);
    try {
      await TimePollsApi.voteTimePoll(poll!.id, next);
    } catch (e) {
      tp.setMyVote(prev ?? []);
      toast.error('No se guardó tu voto', (e as Error)?.message);
      tp.reload();
    }
  };
  const toggle = (optionId: string) => {
    const cur = myVote ?? [];
    vote(cur.includes(optionId) ? cur.filter((x) => x !== optionId) : [...cur, optionId]);
  };

  const doFix = async (optionId: string, overwrite = false) => {
    setBusy(optionId);
    try {
      await TimePollsApi.fixTimePoll(poll!.id, optionId, overwrite);
      const o = poll!.options.find((x) => x.id === optionId)!;
      toast.success(`Fijada: ${TimePollsApi.optionLabel(o)}`, 'Hemos avisado a todo el equipo.');
      await tp.reload();
      onChanged?.();
    } catch (e) {
      if (e instanceof TimePollsApi.TimePollError && e.kind === 'time_changed' && e.current) {
        const [d, t] = e.current.split('T');
        const now = TimePollsApi.optionLabel({ date: d, time: t });
        const o = poll!.options.find((x) => x.id === optionId)!;
        Alert.alert(
          'Ya tiene otra hora',
          `Mientras votabais se puso ${now} en la jornada (normalmente lo hace el club). ¿Qué hacemos?`,
          [
            { text: 'Ahora no', style: 'cancel' },
            {
              text: `Mantener ${now}`,
              onPress: async () => {
                try {
                  await TimePollsApi.cancelTimePoll(poll!.id);
                  toast.info('Se mantiene la hora', 'La encuesta queda cerrada.');
                  tp.reload();
                } catch (err) {
                  toast.error('No se pudo cerrar', (err as Error)?.message);
                }
              },
            },
            { text: `Cambiar a ${TimePollsApi.optionLabel(o)}`, onPress: () => doFix(optionId, true) },
          ],
        );
      } else {
        toast.error('No se pudo fijar', (e as Error)?.message);
      }
    } finally {
      setBusy(null);
    }
  };
  const askFix = (optionId: string) => {
    const o = poll!.options.find((x) => x.id === optionId)!;
    const n = tally.byOption[optionId].length;
    Alert.alert(
      `¿Fijar ${TimePollsApi.optionLabel(o)}?`,
      `${n} ${n === 1 ? 'jugador puede' : 'jugadores pueden'}. Se guarda en la jornada, se cierra la encuesta y avisamos a todo el equipo.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Fijar', onPress: () => doFix(optionId) },
      ],
    );
  };

  const lastReminder = remindedAt ?? poll!.lastRemindedAt;
  const cooldown =
    lastReminder && Date.now() - lastReminder.getTime() < REMIND_COOLDOWN_MS
      ? new Date(lastReminder.getTime() + REMIND_COOLDOWN_MS)
      : null;
  const pendingWithApp = tally.pending.filter((id) => byId.get(id)?.hasApp);
  const pendingNoApp = tally.pending.filter((id) => !byId.get(id)?.hasApp);

  const remind = async () => {
    setBusy('remind');
    try {
      const res = await TimePollsApi.remindTimePoll(poll!.id);
      setRemindedAt(new Date());
      toast.success(
        res.reminded === 0
          ? 'Todos los que tienen la app ya han votado'
          : `Recordatorio enviado a ${res.reminded} ${res.reminded === 1 ? 'jugador' : 'jugadores'}`,
      );
      const names = pendingNoApp.map((id) => byId.get(id)?.name).filter(Boolean) as string[];
      if (names.length > 0) {
        Alert.alert(
          `${names.length} sin la app`,
          `${names.join(', ')} no ${names.length === 1 ? 'tiene' : 'tienen'} TACTIUM. ¿Les preguntas por WhatsApp?`,
          [
            { text: 'Ahora no', style: 'cancel' },
            {
              text: 'Preparar mensaje',
              onPress: () =>
                Share.share({
                  message:
                    `${names.join(', ')}: para la ${title}, ¿qué os va mejor? ` +
                    poll!.options.map((o) => TimePollsApi.optionLabel(o)).join(' / ') +
                    '. Contestadme por aquí.',
                }).catch(() => {}),
            },
          ],
        );
      }
    } catch (e) {
      if (e instanceof RemindError && e.kind === 'premium') nav.navigate('Paywall', { intent: 'time_poll' });
      else if (e instanceof RemindError && e.kind === 'cooldown') {
        if (e.nextAllowedAt) setRemindedAt(new Date(e.nextAllowedAt.getTime() - REMIND_COOLDOWN_MS));
        toast.info('Ya recordaste hace poco', 'Podrás volver a hacerlo en unas horas.');
      } else toast.error('No se pudo recordar', (e as Error)?.message);
    } finally {
      setBusy(null);
    }
  };

  const cancel = () =>
    Alert.alert('¿Cerrar la encuesta sin fijar hora?', 'Los votos se pierden y la jornada se queda como está.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cerrar encuesta',
        style: 'destructive',
        onPress: async () => {
          try {
            await TimePollsApi.cancelTimePoll(poll!.id);
            tp.reload();
          } catch (e) {
            toast.error('No se pudo cerrar', (e as Error)?.message);
          }
        },
      },
    ]);

  const Avatars = ({ pids }: { pids: string[] }) => {
    const shown = pids.slice(0, 4);
    return (
      <View style={styles.avatars}>
        {shown.map((id, i) => {
          const p = byId.get(id);
          return (
            <View key={id} style={[styles.avatar, i > 0 && { marginLeft: -7 }]}>
              {p?.photoUrl ? (
                <Image source={{ uri: p.photoUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarText}>{initials(p?.name ?? '?')}</Text>
              )}
            </View>
          );
        })}
        {pids.length > 4 ? <Text style={styles.avatarMore}>+{pids.length - 4}</Text> : null}
      </View>
    );
  };

  const meta =
    `${tally.voted.length} de ${ids.length} han votado` +
    (poll!.deadline
      ? deadlinePassed
        ? ' · votación cerrada'
        : ` · hasta el ${shortWhen(poll!.deadline)}`
      : '');

  // ── Inicio: compacto ──────────────────────────────────────────────────
  if (variant === 'home') {
    const top = poll!.options.find((o) => o.id === tally.topIds[0]);
    return (
      <View style={styles.embedded}>
        <Text style={styles.eyebrow}>
          {canVote ? (myVote ? 'TU VOTO · TOCA PARA CAMBIAR' : 'VOTA LA HORA') : 'ENCUESTA DE HORA'}
        </Text>
        {canVote ? (
          <View style={styles.chips}>
            {poll!.options.map((o) => {
              const on = !!myVote?.includes(o.id);
              return (
                <Pressable
                  key={o.id}
                  onPress={() => toggle(o.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [styles.chip, on && styles.chipOn, pressed && { opacity: 0.8 }]}
                >
                  {on ? <IconCheck size={12} color={c.textInverse} /> : null}
                  <Text style={[styles.chipText, on && { color: c.textInverse }]}>
                    {TimePollsApi.optionLabel(o)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Text style={styles.hint}>
          {canManage
            ? `${meta}${top ? ` · va ganando ${TimePollsApi.optionLabel(top)} (${tally.byOption[top.id].length})` : ''}`
            : canVote
              ? 'Marca todas las que te van. Tu capitán fija la hora.'
              : meta}
        </Text>
      </View>
    );
  }

  // ── Jornada: completo ─────────────────────────────────────────────────
  const ordered = canManage
    ? [...poll!.options].sort((a, b) => tally.byOption[b.id].length - tally.byOption[a.id].length || a.position - b.position)
    : poll!.options;

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>¿A qué hora jugamos?</Text>
      <Text style={styles.meta}>{meta}</Text>
      {poll!.message ? <Text style={styles.message}>«{poll!.message}»</Text> : null}
      {canVote ? (
        <Text style={styles.hint}>Marca todas las que te van. Puedes cambiarlo hasta que se cierre.</Text>
      ) : null}

      <View style={{ gap: 8, marginTop: 10 }}>
        {ordered.map((o) => {
          const who = tally.byOption[o.id];
          const on = !!myVote?.includes(o.id);
          const top = tally.topIds.includes(o.id);
          const goingYes = hasAvail ? who.filter((id) => availability[id]?.status === 'yes').length : 0;
          return (
            <Pressable
              key={o.id}
              onPress={canVote ? () => toggle(o.id) : undefined}
              disabled={!canVote}
              accessibilityRole={canVote ? 'checkbox' : undefined}
              accessibilityState={canVote ? { checked: on } : undefined}
              style={({ pressed }) => [styles.option, top && styles.optionTop, pressed && canVote && { opacity: 0.85 }]}
            >
              <View
                style={[
                  styles.optionFill,
                  { width: `${(who.length / maxCount) * 100}%`, backgroundColor: withAlpha(c.accent, top ? 0.14 : 0.07) },
                ]}
              />
              <View style={styles.optionRow}>
                {canVote ? (
                  <View style={[styles.check, on && styles.checkOn]}>
                    {on ? <IconCheck size={12} color={c.textInverse} /> : null}
                  </View>
                ) : null}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.optionLabel}>{TimePollsApi.optionLabel(o)}</Text>
                  <Text style={styles.optionSub} numberOfLines={1}>
                    {who.length === 0
                      ? 'Nadie todavía'
                      : `${who.length} ${who.length === 1 ? 'puede' : 'pueden'}`}
                    {hasAvail && who.length > 0 ? ` · ${goingYes} con «Voy»` : ''}
                    {top ? ' · la más votada' : ''}
                  </Text>
                </View>
                <Avatars pids={who} />
                {canManage ? (
                  <Pressable
                    onPress={() => askFix(o.id)}
                    disabled={!!busy}
                    style={({ pressed }) => [styles.fixBtn, top && styles.fixBtnTop, pressed && { opacity: 0.8 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Fijar ${TimePollsApi.optionLabel(o)}`}
                  >
                    {busy === o.id ? (
                      <ActivityIndicator size="small" color={top ? c.textInverse : c.accent} />
                    ) : (
                      <Text style={[styles.fixLabel, top && { color: c.textInverse }]}>Fijar</Text>
                    )}
                  </Pressable>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>

      {canVote ? (
        <Pressable
          onPress={() => vote([])}
          style={({ pressed }) => [styles.none, myVote && myVote.length === 0 && styles.noneOn, pressed && { opacity: 0.8 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.noneLabel, myVote && myVote.length === 0 && { color: c.error }]}>
            {myVote && myVote.length === 0 ? 'Has dicho que ninguna te va' : 'Ninguna me va'}
          </Text>
        </Pressable>
      ) : null}

      {tally.pending.length > 0 ? (
        <View style={styles.pending}>
          <Text style={styles.pendingTitle}>Sin votar ({tally.pending.length})</Text>
          <Text style={styles.pendingNames}>
            {tally.pending.map((id) => byId.get(id)?.name ?? '').join(', ')}
          </Text>
        </View>
      ) : null}

      {canManage ? (
        <View style={styles.actions}>
          {!deadlinePassed && pendingWithApp.length + pendingNoApp.length > 0 ? (
            <Pressable
              onPress={gate(remind, 'time_poll')}
              disabled={!!cooldown || busy === 'remind'}
              style={({ pressed }) => [styles.remindBtn, (cooldown || busy === 'remind') && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Text style={styles.remindLabel}>
                {busy === 'remind'
                  ? 'Enviando…'
                  : cooldown
                    ? `Podrás recordar el ${shortWhen(cooldown)}`
                    : 'Recordar a los que faltan'}
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={cancel} hitSlop={8} accessibilityRole="button">
            <Text style={styles.cancel}>Cerrar sin fijar</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    card: {
      marginBottom: 14,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      padding: 16,
    },
    embedded: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderColor: c.hairStrong,
      gap: 8,
    },
    eyebrow: { fontFamily: Fonts.mono, fontSize: 11, letterSpacing: 2.2, fontWeight: '600', color: c.accent },
    cardTitle: { color: c.text, fontSize: 16, fontWeight: '700' },
    meta: { color: c.textMuted, fontSize: 12.5, marginTop: 3 },
    message: { color: c.text, fontSize: 13.5, marginTop: 8, fontStyle: 'italic' },
    hint: { color: c.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
    mono: { fontFamily: Fonts.mono, color: c.text },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      height: 36,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.black35,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { color: c.text, fontSize: 13, fontWeight: '700', fontFamily: Fonts.mono },
    option: {
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      backgroundColor: c.background,
      overflow: 'hidden',
    },
    optionTop: { borderColor: c.accent40 },
    optionFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
    optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
    check: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: c.textFaint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkOn: { backgroundColor: c.accent, borderColor: c.accent },
    optionLabel: { color: c.text, fontSize: 15, fontWeight: '700', fontFamily: Fonts.mono },
    optionSub: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    avatars: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: c.primary,
      borderWidth: 1.5,
      borderColor: c.bgCard,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    avatarImg: { width: 24, height: 24 },
    avatarText: { color: '#E8F5EF', fontSize: 9, fontWeight: '700' },
    avatarMore: { color: c.textMuted, fontSize: 11.5, marginLeft: 4, fontFamily: Fonts.mono },
    fixBtn: {
      minWidth: 58,
      height: 32,
      paddingHorizontal: 10,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fixBtnTop: { backgroundColor: c.accent, borderColor: c.accent },
    fixLabel: { color: c.accent, fontSize: 13, fontWeight: '700' },
    none: {
      marginTop: 8,
      height: 40,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    noneOn: { borderColor: withAlpha(c.error, 0.5), backgroundColor: withAlpha(c.error, 0.08) },
    noneLabel: { color: c.textMuted, fontSize: 13.5, fontWeight: '600' },
    pending: { marginTop: 12 },
    pendingTitle: { color: c.text, fontSize: 13, fontWeight: '700' },
    pendingNames: { color: c.textMuted, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14, flexWrap: 'wrap' },
    remindBtn: {
      flexGrow: 1,
      height: 42,
      paddingHorizontal: 14,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.accent40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    remindLabel: { color: c.accent, fontSize: 13.5, fontWeight: '700' },
    cancel: { color: c.textMuted, fontSize: 13, textDecorationLine: 'underline' },
    fixedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    fixedIcon: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: c.accent10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    fixedText: { flex: 1, color: c.textMuted, fontSize: 13 },
    proposeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    proposeRowTop: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderColor: c.hair },
    proposeTitle: { color: c.text, fontSize: 14.5, fontWeight: '700' },
    proposeSub: { color: c.textMuted, fontSize: 12.5, marginTop: 2 },
  });
