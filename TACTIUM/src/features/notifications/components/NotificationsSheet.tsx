import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, ActivityIndicator } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import {
  BottomSheet,
  IconTeam,
  IconLink,
  IconCalendar,
  IconClock,
  IconBell,
  IconUser,
  IconTrophy,
  IconChevron,
} from '@components/ui';
import { useNotificationStore } from '@store/notificationStore';
import { useAuthStore } from '@store/authStore';
import { toast } from '@store/toastStore';
import type { AppNotification } from '@core/services/notifications';
import { respondAvailability, STATUS_LABEL } from '@core/services/availability';
import { followTarget, getPublicUserProfile } from '@core/services/social';
import {
  actorOf,
  buildSections,
  ctaLabel,
  followerNameFromTitle,
  goToTarget,
  loadAvailabilityAction,
  matchdayOf,
  namesLine,
  shortName,
  targetOf,
  type AvailabilityAction,
  type Entry,
  type NavTarget,
} from '../notifActions';

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return 'ahora';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
}

const iconFor = (type: string, color: string) => {
  switch (type) {
    case 'player_claimed':
      return <IconLink size={16} color={color} />;
    case 'new_follower':
      return <IconUser size={16} color={color} />;
    case 'kudos':
      return <Text style={{ fontSize: 15, lineHeight: 18 }}>👏</Text>;
    case 'member_joined':
    case 'joined_team':
      return <IconTeam size={16} color={color} />;
    case 'matchday_created':
    case 'lineup_published':
      return <IconCalendar size={16} color={color} />;
    case 'tournament_bracket':
    case 'tournament_schedule':
    case 'tournament_signup':
    case 'tournament_moved':
    case 'tournament_payment_due':
      return <IconTrophy size={16} color={color} />;
    case 'availability_reminder':
    case 'lineup_reminder':
    case 'schedule_set':
      return <IconClock size={16} color={color} />;
    default:
      return <IconBell size={16} color={color} />;
  }
};

interface Props {
  open: boolean;
  onClose: () => void;
}

// Estado de los botones en línea, por jornada / por persona.
type AvailUi = AvailabilityAction | null | 'loading';
// Perfil público del que te sigue: nombre (full_name) y si ya le sigues.
// null = no se pudo cargar (sin botón).
type Person = { name: string | null; following: boolean } | null | 'loading';

export const NotificationsSheet: React.FC<Props> = ({ open, onClose }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const items = useNotificationStore((s) => s.items);
  const unread = useNotificationStore((s) => s.unread);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markOneRead = useNotificationStore((s) => s.markOneRead);
  const deleteOne = useNotificationStore((s) => s.deleteNotification);
  const deleteAll = useNotificationStore((s) => s.deleteAllNotifications);
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const sections = useMemo(() => buildSections(items), [items]);

  // Solo el aviso de disponibilidad MÁS RECIENTE de cada jornada lleva botones.
  const availOwner = useMemo(() => {
    const m = new Map<string, string>(); // matchdayId → notification id
    for (const n of items) {
      if (n.type !== 'availability_reminder') continue;
      const md = matchdayOf(n);
      if (md && !m.has(md)) m.set(md, n.id);
    }
    return m;
  }, [items]);

  const [avail, setAvail] = useState<Record<string, AvailUi>>({});
  const [answeredNow, setAnsweredNow] = useState<Record<string, 'yes' | 'no'>>({});
  const [busyMd, setBusyMd] = useState<string | null>(null);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [followUi, setFollowUi] = useState<Record<string, 'busy' | 'done'>>({});
  // Motivo del fallo de una respuesta/seguimiento, por aviso (en rojo).
  const [rowError, setRowError] = useState<Record<string, string>>({});

  // Al abrir: averiguamos qué botones tienen sentido (jornada por jugar y sin
  // respuesta; seguidores a los que aún no sigues).
  useEffect(() => {
    if (!open || !userId) return;
    let alive = true;
    const mds = [...availOwner.keys()].filter((md) => avail[md] === undefined);
    for (const md of mds) {
      setAvail((s) => ({ ...s, [md]: 'loading' }));
      loadAvailabilityAction(md, userId)
        .then((r) => alive && setAvail((s) => ({ ...s, [md]: r })))
        .catch(() => alive && setAvail((s) => ({ ...s, [md]: null })));
    }
    const actors = new Set<string>();
    for (const n of items) {
      if (n.type !== 'new_follower') continue;
      const a = actorOf(n);
      if (a && a !== userId && people[a] === undefined) actors.add(a);
    }
    for (const a of actors) {
      setPeople((s) => ({ ...s, [a]: 'loading' }));
      getPublicUserProfile(a)
        .then(
          (p) =>
            alive &&
            setPeople((s) => ({
              ...s,
              [a]: { name: p?.full_name ?? p?.username ?? null, following: !!p?.is_following },
            })),
        )
        .catch(() => alive && setPeople((s) => ({ ...s, [a]: null })));
    }
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId, availOwner, items]);

  const go = useCallback(
    (t: NavTarget | null) => {
      if (!t) return;
      if (t.kind === 'web') {
        goToTarget(t);
        return;
      }
      onClose();
      // Pequeño respiro para que el sheet cierre antes de navegar.
      setTimeout(() => goToTarget(t), 60);
    },
    [onClose],
  );

  const onPressEntry = (e: Entry) => {
    if (e.kind === 'single') {
      void markOneRead(e.n.id);
      go(targetOf(e.n));
    } else {
      for (const n of e.items) void markOneRead(n.id);
      // Varios seguidores: tu perfil público, donde está la lista de seguidores.
      if (userId) go({ kind: 'profile', id: userId });
    }
  };

  const onLongPressEntry = (e: Entry) => {
    const ids = e.kind === 'single' ? [e.n.id] : e.items.map((n) => n.id);
    Alert.alert(
      ids.length > 1 ? 'Borrar avisos' : 'Borrar aviso',
      ids.length > 1
        ? `Se borrarán estos ${ids.length} avisos.`
        : 'Este aviso desaparecerá de tu campana.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Borrar',
          style: 'destructive',
          onPress: async () => {
            try {
              for (const id of ids) await deleteOne(id);
            } catch (err: any) {
              toast.error('No se pudo borrar', err?.message);
            }
          },
        },
      ],
    );
  };

  const onClearAll = () => {
    Alert.alert('Vaciar notificaciones', 'Se borrarán todos tus avisos. No se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Vaciar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAll();
          } catch (err: any) {
            toast.error('No se pudieron borrar', err?.message);
          }
        },
      },
    ]);
  };

  const answer = async (n: AppNotification, md: string, a: AvailabilityAction, s: 'yes' | 'no') => {
    setBusyMd(md);
    setRowError(({ [n.id]: _omit, ...rest }) => rest);
    try {
      await respondAvailability({ matchdayId: md, playerId: a.playerId, status: s });
      setAnsweredNow((x) => ({ ...x, [md]: s }));
      void markOneRead(n.id);
    } catch (err: any) {
      const msg = err?.message ?? 'Inténtalo desde la jornada.';
      setRowError((x) => ({ ...x, [n.id]: `No se guardó tu respuesta: ${msg}` }));
      toast.error('No se guardó tu respuesta', msg);
    } finally {
      setBusyMd(null);
    }
  };

  const followBack = async (n: AppNotification, actor: string) => {
    setFollowUi((s) => ({ ...s, [actor]: 'busy' }));
    setRowError(({ [n.id]: _omit, ...rest }) => rest);
    try {
      await followTarget('user', actor);
      setFollowUi((s) => ({ ...s, [actor]: 'done' }));
      void markOneRead(n.id);
    } catch (err: any) {
      setFollowUi(({ [actor]: _omit, ...rest }) => rest);
      const msg = err?.message ?? 'Inténtalo desde su perfil.';
      setRowError((x) => ({ ...x, [n.id]: `No se pudo seguir: ${msg}` }));
      toast.error('No se pudo seguir', msg);
    }
  };

  const Done = ({ text }: { text: string }) => (
    <Text style={styles.done}>✓ {text}</Text>
  );

  const renderActions = (n: AppNotification) => {
    const actions = renderActionsInner(n);
    const err = rowError[n.id];
    if (!err) return actions;
    return (
      <>
        {actions}
        <Text style={styles.rowError}>{err}</Text>
      </>
    );
  };

  const renderActionsInner = (n: AppNotification) => {
    if (n.type === 'availability_reminder') {
      const md = matchdayOf(n);
      if (!md || availOwner.get(md) !== n.id) return null;
      const now = answeredNow[md];
      if (now) return <Done text={`Respondiste: ${STATUS_LABEL[now]}`} />;
      const a = avail[md];
      if (!a || a === 'loading') return null;
      if (a.answered) return <Done text={`Respondiste: ${STATUS_LABEL[a.answered]}`} />;
      if (!a.canAnswer) return null;
      const busy = busyMd === md;
      return (
        <View style={styles.actions}>
          <Chip label="Voy" primary disabled={busy} onPress={() => answer(n, md, a, 'yes')} styles={styles} />
          <Chip
            label="Duda"
            disabled={busy}
            onPress={() => {
              void markOneRead(n.id);
              go({ kind: 'home', screen: 'Availability', matchdayId: md });
            }}
            styles={styles}
          />
          <Chip label="No puedo" disabled={busy} onPress={() => answer(n, md, a, 'no')} styles={styles} />
          {busy ? <ActivityIndicator size="small" color={c.textMuted} /> : null}
        </View>
      );
    }
    if (n.type === 'new_follower') {
      // También en «X sigue tu club»: el que sigue es una persona.
      const actor = actorOf(n);
      if (!actor || actor === userId) return null;
      const ui = followUi[actor];
      if (ui === 'done') return <Done text="Le sigues" />;
      const p = people[actor];
      if (!p || p === 'loading' || p.following) return null;
      return (
        <View style={styles.actions}>
          <Chip
            label="Seguir también"
            primary
            disabled={ui === 'busy'}
            onPress={() => followBack(n, actor)}
            styles={styles}
          />
        </View>
      );
    }
    const label = ctaLabel(n.type);
    const t = targetOf(n);
    if (!label || !t) return null;
    return (
      <View style={styles.actions}>
        <Chip
          label={label}
          onPress={() => {
            void markOneRead(n.id);
            go(t);
          }}
          styles={styles}
        />
      </View>
    );
  };

  const renderEntry = (e: Entry) => {
    const isGroup = e.kind === 'followers';
    const list = isGroup ? e.items : [e.n];
    const head = list[0];
    const isUnread = list.some((n) => !n.read_at);
    const tint = isUnread ? c.accent : c.textMuted;
    const navigable = isGroup ? !!userId : !!targetOf(e.n);
    const title = isGroup
      ? `${e.actors.length || e.items.length} nuevos seguidores`
      : e.n.title;
    let body: string | null = isGroup ? null : e.n.body;
    if (isGroup) {
      // Nombres del perfil público (full_name); si no cargó, del título.
      const names: string[] = [];
      for (const a of e.actors) {
        const p = people[a];
        const fromProfile = p && p !== 'loading' ? shortName(p.name) : null;
        const src = e.items.find((x) => actorOf(x) === a);
        const nm = fromProfile ?? (src ? followerNameFromTitle(src) : null);
        if (nm) names.push(nm);
      }
      body = namesLine(names);
    }
    return (
      <Pressable
        key={isGroup ? e.key : e.n.id}
        onPress={() => onPressEntry(e)}
        onLongPress={() => onLongPressEntry(e)}
        delayLongPress={450}
        accessibilityHint="Mantén pulsado para borrar"
        style={({ pressed }) => [
          styles.row,
          isUnread && styles.rowUnread,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View
          style={[
            styles.iconBox,
            isUnread && { backgroundColor: c.accent10, borderColor: c.accent40 },
          ]}
        >
          {iconFor(head.type, tint)}
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {title}
          </Text>
          {body ? (
            <Text style={styles.rowBody} numberOfLines={3}>
              {body}
            </Text>
          ) : null}
          <Text style={styles.rowTime}>{timeAgo(head.created_at)}</Text>
          {isGroup ? null : renderActions(e.n)}
        </View>
        {isUnread ? (
          <View style={styles.unreadDot} />
        ) : navigable ? (
          <IconChevron size={15} color={c.textFaint} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <View style={styles.headRow}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.eyebrow}>NOTIFICACIONES</Text>
          <Text style={styles.title}>Novedades</Text>
        </View>
        {items.length > 0 ? (
          <View style={styles.headActions}>
            <Pressable
              onPress={() => void markAllRead()}
              disabled={unread === 0}
              hitSlop={6}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.headBtn,
                unread === 0 && { opacity: 0.4 },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.headBtnText}>Marcar todo leído</Text>
            </Pressable>
            <Pressable
              onPress={onClearAll}
              hitSlop={6}
              accessibilityRole="button"
              style={({ pressed }) => [styles.headBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.headBtnText, { color: c.error }]}>Vaciar</Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <IconBell size={26} color={c.textFaint} />
          <Text style={styles.emptyText}>
            Aquí verás cuando alguien se una a tu equipo, tus jornadas y
            recordatorios.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {sections.map((s) => (
            <View key={s.key} style={styles.section}>
              <Text style={styles.sectionLabel}>{s.label}</Text>
              {s.entries.map(renderEntry)}
            </View>
          ))}
          <Text style={styles.hint}>Mantén pulsado un aviso para borrarlo.</Text>
        </View>
      )}
    </BottomSheet>
  );
};

const Chip: React.FC<{
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  styles: ReturnType<typeof makeStyles>;
}> = ({ label, onPress, primary, disabled, styles }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    hitSlop={4}
    accessibilityRole="button"
    style={({ pressed }) => [
      styles.chip,
      primary && styles.chipPrimary,
      (pressed || disabled) && { opacity: 0.6 },
    ]}
  >
    <Text style={[styles.chipText, primary && styles.chipTextPrimary]}>{label}</Text>
  </Pressable>
);

const makeStyles = (c: Palette) => StyleSheet.create({
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  headActions: { flexDirection: 'row', gap: 6, paddingBottom: 3 },
  headBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: c.hairStrong,
    backgroundColor: c.bgCard,
  },
  headBtnText: { color: c.text, fontSize: 12, fontWeight: '600' },
  eyebrow: {
    fontFamily: Fonts.mono,
    color: c.accent,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
  },
  title: {
    color: c.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  emptyText: {
    color: c.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  list: { gap: 16, marginTop: 14 },
  section: { gap: 8 },
  sectionLabel: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '600',
  },
  hint: {
    color: c.textFaint,
    fontSize: 11,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: Radius.md,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hair,
  },
  rowUnread: { borderColor: c.accent40, backgroundColor: c.bgCard2 },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: c.bgRaised,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rowTitle: {
    color: c.text,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  rowBody: {
    color: c.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  rowTime: {
    fontFamily: Fonts.mono,
    color: c.textFaint,
    fontSize: 10,
    letterSpacing: 0.4,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: c.hairStrong,
    backgroundColor: c.bgRaised,
  },
  chipPrimary: { backgroundColor: c.accent, borderColor: c.accent },
  chipText: { color: c.text, fontSize: 12, fontWeight: '600' },
  chipTextPrimary: { color: c.textInverse },
  rowError: {
    color: c.error,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 6,
  },
  done: {
    color: c.accent,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.accent,
    marginTop: 4,
  },
});
