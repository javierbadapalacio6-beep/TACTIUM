import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconBack } from '@components/ui';
import { useTeamStore } from '@store/teamStore';
import * as MatchdaysApi from '@core/services/matchdays';
import {
  AVAILABILITY_MOCK,
  MAYBE_REASONS,
  STATUS_LABEL,
  type AvailabilityStatus,
} from '@core/services/availability';
import { scheduleTestAvailabilityPush } from '@core/push/availabilityActions';
import { toast } from '@store/toastStore';
import { useMatchdayAvailability } from '@core/hooks/useMatchdayAvailability';
import { RsvpCard, formatDeadline } from '@features/availability/components/RsvpCard';
import { MaybeSheet } from '@features/availability/components/MaybeSheet';
import { ConvocatoriaCard } from '@features/availability/components/ConvocatoriaCard';
import { statusColor, withAlpha } from '@features/availability/components/statusColors';
import { useRemindPending } from '@features/availability/hooks/useRemindPending';
import { getCourtsForCompetition } from '@core/data/federations';

import type { HomeStackScreenProps } from '@navigation/types';

type Tab = 'pending' | 'yes' | 'maybe' | 'no';

const TABS: { id: Tab; label: string }[] = [
  { id: 'pending', label: 'Sin contestar' },
  { id: 'yes', label: 'Van' },
  { id: 'maybe', label: 'Duda' },
  { id: 'no', label: 'No' },
];

/**
 * Disponibilidad de UNA jornada (la de `matchdayId`). El jugador contesta
 * por sí mismo con la tarjeta de arriba; el capitán ve la plantilla por
 * estado (por defecto «Sin contestar»), recuerda a los pendientes y puede
 * marcar la respuesta de cualquiera tocando su fila.
 */
export const AvailabilityScreen = ({
  navigation,
  route,
}: HomeStackScreenProps<'Availability'>) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const insets = useSafeAreaInsets();
  const players = useTeamStore((s) => s.players);
  const team = useTeamStore((s) => s.team);
  const activeRole = useTeamStore((s) => s.activeRole);
  const myPlayerId = useTeamStore((s) => s.myPlayerId);
  const isPlayer = activeRole === 'player';
  const canEdit = !isPlayer;

  const matchdayId = route.params?.matchdayId ?? null;
  const [matchday, setMatchday] = useState<MatchdaysApi.Matchday | null>(null);
  useEffect(() => {
    if (!matchdayId) return;
    MatchdaysApi.fetchMatchday(matchdayId).then(setMatchday).catch(() => setMatchday(null));
  }, [matchdayId]);

  const availability = useMatchdayAvailability(matchdayId);
  const { map, counts, deadline, maybeClosed } = availability;
  const remind = useRemindPending({
    matchdayId,
    opponent: matchday?.opponent,
    jornadaNumber: matchday?.jornada_number,
    lastReminder: availability.lastReminder,
    setLastReminder: availability.setLastReminder,
  });

  const [tab, setTab] = useState<Tab>(isPlayer ? 'yes' : 'pending');
  // Si no queda nadie sin contestar, abrir en «Van».
  useEffect(() => {
    if (!isPlayer && counts.total > 0 && counts.pending === 0 && tab === 'pending') setTab('yes');
  }, [counts.pending, counts.total, isPlayer, tab]);

  const [maybeFor, setMaybeFor] = useState<{ id: string; name: string } | null>(null);

  const courts = getCourtsForCompetition(team?.federation, team?.league, team?.gender);
  const jLabel = matchday?.jornada_number != null ? `J${String(matchday.jornada_number).padStart(2, '0')}` : null;

  const rows = players.filter((p) => {
    const s = map[p.id]?.status ?? null;
    return tab === 'pending' ? s === null : s === tab;
  });

  const editFor = (playerId: string, name: string) => {
    if (!canEdit || !matchdayId) return;
    const current = map[playerId]?.status ?? null;
    const opts: { text: string; status: AvailabilityStatus | 'clear' }[] = [
      { text: 'Va', status: 'yes' },
      ...(maybeClosed ? [] : [{ text: 'En duda…', status: 'maybe' as const }]),
      { text: 'No puede', status: 'no' },
      ...(current ? [{ text: 'Quitar respuesta', status: 'clear' as const }] : []),
    ];
    Alert.alert(name, 'Marca su respuesta para esta jornada.', [
      ...opts.map((o) => ({
        text: o.text,
        style: o.status === 'clear' ? ('destructive' as const) : ('default' as const),
        onPress: () => {
          if (o.status === 'clear') availability.clear(playerId);
          else if (o.status === 'maybe') setMaybeFor({ id: playerId, name });
          else availability.respond(playerId, o.status);
        },
      })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => {
            if (navigation.canGoBack()) navigation.goBack();
            else navigation.navigate('HomeRoot');
          }}
          style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="Volver"
        >
          <IconBack size={16} color={c.text} />
          <Text style={styles.backLabel}>{jLabel ? `Jornada ${matchday?.jornada_number}` : 'Volver'}</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>DISPONIBILIDAD{jLabel ? ` · ${jLabel}` : ''}</Text>
        <Text style={styles.title}>
          {matchday?.opponent ? `vs ${matchday.opponent}` : isPlayer ? '¿Puedes jugar?' : '¿Quién juega?'}
        </Text>
        {deadline ? (
          <Text style={styles.sub}>
            {maybeClosed
              ? 'La convocatoria está cerrada para dudas: solo Voy o No puedo.'
              : `Las dudas se cierran el ${formatDeadline(deadline)}.`}
          </Text>
        ) : null}

        {!matchdayId ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>No hay jornada próxima</Text>
            <Text style={styles.noticeText}>
              La disponibilidad se pide por jornada. Cuando haya una programada, aparecerá aquí.
            </Text>
          </View>
        ) : null}

        {matchdayId && myPlayerId ? (
          <RsvpCard
            jornadaNumber={matchday?.jornada_number ?? null}
            answer={map[myPlayerId]}
            deadline={deadline}
            maybeClosed={maybeClosed}
            onRespond={(status, extra) => availability.respond(myPlayerId, status, extra)}
          />
        ) : null}
        {matchdayId && isPlayer && !myPlayerId ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Aún no estás vinculado</Text>
            <Text style={styles.noticeText}>
              Pide al capitán que te añada a la plantilla, o usa la opción «Soy yo» en la pantalla de bienvenida.
            </Text>
          </View>
        ) : null}

        {matchdayId && canEdit && players.length > 0 ? (
          <ConvocatoriaCard
            counts={counts}
            needed={courts * 2}
            courts={courts}
            onRemind={remind.remind}
            remindDisabledUntil={remind.cooldownUntil}
            sending={remind.sending}
            onOpen={() => setTab('pending')}
          />
        ) : null}

        {matchdayId ? (
          <>
            <View style={styles.tabs}>
              {TABS.map((t) => {
                const active = tab === t.id;
                const n = counts[t.id];
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => setTab(t.id)}
                    style={[styles.tab, active && styles.tabActive]}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: active }}
                  >
                    <Text numberOfLines={1} style={[styles.tabText, { color: active ? c.text : c.textMuted }]}>
                      {t.label} <Text style={styles.tabCount}>{n}</Text>
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.list}>
              {players.length === 0 ? (
                <Text style={styles.emptyText}>
                  Aún no hay jugadores en la plantilla. Añádelos desde la pestaña Equipo.
                </Text>
              ) : rows.length === 0 ? (
                <Text style={styles.emptyText}>
                  {tab === 'pending' ? 'Todos han contestado.' : 'Nadie en este grupo.'}
                </Text>
              ) : (
                rows.map((p, i) => {
                  const a = map[p.id];
                  const s = a?.status ?? null;
                  const isMine = p.id === myPlayerId;
                  const reason = a?.reason ? MAYBE_REASONS.find((r) => r.id === a.reason)?.label : null;
                  const meta = [
                    reason,
                    a?.note ? `«${a.note}»` : null,
                    a?.auto_resolved ? 'duda sin resolver' : null,
                    !a && !p.user_id ? 'sin la app' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ');
                  return (
                    <Pressable
                      key={p.id}
                      disabled={!canEdit}
                      onPress={() => editFor(p.id, p.name)}
                      accessibilityRole={canEdit ? 'button' : undefined}
                      accessibilityLabel={`${p.name}: ${s ? STATUS_LABEL[s] : 'sin contestar'}`}
                      style={({ pressed }) => [
                        styles.row,
                        i < rows.length - 1 && styles.rowDivider,
                        isMine && styles.rowMine,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {p.name}
                          {isMine ? <Text style={styles.rowYou}>  TÚ</Text> : null}
                        </Text>
                        <Text style={styles.rowMeta} numberOfLines={1}>
                          {meta || `${p.position} · ${p.pts} pts`}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.badge,
                          s
                            ? { borderColor: withAlpha(statusColor(c, s), 0.5), backgroundColor: withAlpha(statusColor(c, s), 0.12) }
                            : styles.badgePending,
                        ]}
                      >
                        <Text style={[styles.badgeText, { color: statusColor(c, s) }]}>
                          {s ? STATUS_LABEL[s].toUpperCase() : '—'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>
            {canEdit && players.length > 0 ? (
              <Text style={styles.footHint}>Toca a un jugador para marcar su respuesta.</Text>
            ) : null}

            {AVAILABILITY_MOCK ? (
              <View style={styles.mockBox}>
                <Text style={styles.mockTitle}>MODO MAQUETA · nada se guarda en el servidor</Text>
                <Text style={styles.mockText}>
                  Te llega una notificación a los 5 s. Sal de la app y mantenla pulsada para ver los botones.
                </Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {(['rsvp', 'resolve'] as const).map((kind) => (
                    <Pressable
                      key={kind}
                      onPress={async () => {
                        const ok = await scheduleTestAvailabilityPush({
                          matchdayId: matchdayId!,
                          kind,
                          jornadaNumber: matchday?.jornada_number,
                          opponent: matchday?.opponent,
                        });
                        if (ok) toast.info('Notificación en 5 s', 'Sal de la app para verla.');
                        else toast.error('Sin permiso de notificaciones', 'Actívalo en Ajustes del móvil.');
                      }}
                      style={({ pressed }) => [styles.mockBtn, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={styles.mockBtnText}>
                        {kind === 'rsvp' ? 'Probar «¿Puedes jugar?»' : 'Probar «¿Al final juegas?»'}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <MaybeSheet
        open={!!maybeFor}
        onClose={() => setMaybeFor(null)}
        forName={maybeFor?.name}
        title={matchday?.jornada_number != null ? `Jornada ${matchday.jornada_number}` : 'Jornada'}
        deadlineLabel={deadline ? formatDeadline(deadline) : null}
        initialReason={maybeFor ? map[maybeFor.id]?.reason ?? null : null}
        initialNote={maybeFor ? map[maybeFor.id]?.note ?? null : null}
        onSave={(reason, note) => {
          if (maybeFor) availability.respond(maybeFor.id, 'maybe', { reason, note });
          setMaybeFor(null);
        }}
      />
    </View>
  );
};

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
    },
    backBtn: {
      height: 36,
      paddingHorizontal: 12,
      borderRadius: Radius.md,
      backgroundColor: c.bgCard,
      borderWidth: 1,
      borderColor: c.hairStrong,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    backLabel: { color: c.text, fontSize: 14, fontWeight: '500' },
    scroll: { paddingHorizontal: 22, paddingTop: 22 },
    eyebrow: {
      fontFamily: Fonts.mono,
      fontSize: 11,
      letterSpacing: 3,
      color: c.accent,
      fontWeight: '500',
      marginBottom: 8,
    },
    title: {
      color: c.text,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.7,
      lineHeight: 32,
    },
    sub: { color: c.textMuted, fontSize: 13, marginTop: 6 },
    notice: {
      marginTop: 16,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hairStrong,
      paddingVertical: 14,
      paddingHorizontal: 16,
      gap: 4,
    },
    noticeTitle: { color: c.text, fontSize: 14, fontWeight: '700' },
    noticeText: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
    tabs: {
      flexDirection: 'row',
      gap: 4,
      padding: 4,
      marginTop: 18,
      backgroundColor: c.bgCard,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hair,
    },
    tab: {
      flex: 1,
      height: 36,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
    },
    tabActive: { backgroundColor: c.bgRaised },
    tabText: { fontSize: 12, fontWeight: '600' },
    tabCount: { fontFamily: Fonts.mono, fontSize: 12 },
    list: {
      marginTop: 12,
      backgroundColor: c.bgCard,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderColor: c.hair,
      overflow: 'hidden',
    },
    emptyText: {
      color: c.textMuted,
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      padding: 20,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 13,
    },
    rowDivider: { borderBottomWidth: 1, borderColor: c.hair },
    rowMine: { backgroundColor: c.accent10 },
    rowName: { color: c.text, fontSize: 14, fontWeight: '600' },
    rowYou: { fontFamily: Fonts.mono, fontSize: 10, color: c.accent, letterSpacing: 1 },
    rowMeta: { color: c.textMuted, fontSize: 12, marginTop: 2 },
    badge: {
      minWidth: 64,
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 8,
      borderWidth: 1,
    },
    badgePending: { borderStyle: 'dashed', borderColor: c.hairStrong },
    badgeText: { fontFamily: Fonts.mono, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.6 },
    footHint: { color: c.textFaint, fontSize: 12, textAlign: 'center', marginTop: 12 },
    mockBox: {
      marginTop: 24,
      padding: 14,
      borderRadius: Radius.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: c.warning,
      gap: 8,
    },
    mockTitle: { fontFamily: Fonts.mono, fontSize: 10.5, letterSpacing: 1.2, color: c.warning },
    mockText: { color: c.textMuted, fontSize: 12.5, lineHeight: 17 },
    mockBtn: {
      flex: 1,
      minHeight: 40,
      paddingHorizontal: 8,
      borderRadius: Radius.md,
      borderWidth: 1,
      borderColor: c.hairStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    mockBtnText: { color: c.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
  });
