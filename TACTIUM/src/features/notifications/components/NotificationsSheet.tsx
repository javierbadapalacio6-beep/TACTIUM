import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import {
  BottomSheet,
  IconTeam,
  IconLink,
  IconCalendar,
  IconClock,
  IconBell,
} from '@components/ui';
import { useNotificationStore } from '@store/notificationStore';
import type { AppNotification } from '@core/services/notifications';

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
    case 'member_joined':
    case 'joined_team':
      return <IconTeam size={16} color={color} />;
    case 'matchday_created':
    case 'lineup_published':
      return <IconCalendar size={16} color={color} />;
    case 'availability_reminder':
    case 'lineup_reminder':
      return <IconClock size={16} color={color} />;
    default:
      return <IconBell size={16} color={color} />;
  }
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export const NotificationsSheet: React.FC<Props> = ({ open, onClose }) => {
  const items = useNotificationStore((s) => s.items);
  const markAllRead = useNotificationStore((s) => s.markAllRead);

  // Al abrir, marcamos todas como leídas (tras un instante para que se vea
  // el resalte de "no leída" un momento).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      void markAllRead();
    }, 700);
    return () => clearTimeout(t);
  }, [open, markAllRead]);

  return (
    <BottomSheet open={open} onClose={onClose}>
      <Text style={styles.eyebrow}>NOTIFICACIONES</Text>
      <Text style={styles.title}>Novedades</Text>

      {items.length === 0 ? (
        <View style={styles.empty}>
          <IconBell size={26} color={Colors.textFaint} />
          <Text style={styles.emptyText}>
            Aquí verás cuando alguien se una a tu equipo, tus jornadas y
            recordatorios.
          </Text>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((n: AppNotification) => {
            const unread = !n.read_at;
            const tint = unread ? Colors.accent : Colors.textMuted;
            return (
              <View
                key={n.id}
                style={[styles.row, unread && styles.rowUnread]}
              >
                <View
                  style={[
                    styles.iconBox,
                    unread && {
                      backgroundColor: Colors.accent10,
                      borderColor: Colors.accent40,
                    },
                  ]}
                >
                  {iconFor(n.type, tint)}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {n.title}
                  </Text>
                  {n.body ? (
                    <Text style={styles.rowBody} numberOfLines={3}>
                      {n.body}
                    </Text>
                  ) : null}
                  <Text style={styles.rowTime}>{timeAgo(n.created_at)}</Text>
                </View>
                {unread ? <View style={styles.unreadDot} /> : null}
              </View>
            );
          })}
        </View>
      )}
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '500',
  },
  title: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hair,
  },
  rowUnread: { borderColor: Colors.accent40, backgroundColor: Colors.bgCard2 },
  iconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: Colors.bgRaised,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rowTitle: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '650',
    letterSpacing: -0.1,
  },
  rowBody: {
    color: Colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  rowTime: {
    fontFamily: Fonts.mono,
    color: Colors.textFaint,
    fontSize: 10,
    letterSpacing: 0.4,
    marginTop: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginTop: 4,
  },
});
