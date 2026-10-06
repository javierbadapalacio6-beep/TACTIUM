import React, { useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { BottomSheet, IconBell, IconArrowRight } from '@components/ui';
import { useNotificationStore } from '@store/notificationStore';
import { toast } from '@store/toastStore';
import { navigationRef } from '@navigation/navigationRef';
import { goToTarget, type NavTarget } from '../notifActions';
import { NotificationList } from './NotificationList';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const NotificationsSheet: React.FC<Props> = ({ open, onClose }) => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const items = useNotificationStore((s) => s.items);
  const unread = useNotificationStore((s) => s.unread);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const markOneRead = useNotificationStore((s) => s.markOneRead);
  const deleteOne = useNotificationStore((s) => s.deleteNotification);
  const deleteAll = useNotificationStore((s) => s.deleteAllNotifications);

  const go = useCallback(
    (t: NavTarget) => {
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

  // «Ver todos»: la pantalla con todos los avisos, paginada (como /avisos).
  const openAll = () => {
    onClose();
    setTimeout(() => {
      if (navigationRef.isReady()) navigationRef.navigate('Notifications');
    }, 60);
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
          <NotificationList
            items={items}
            active={open}
            onNavigate={go}
            onRead={(id) => void markOneRead(id)}
            onDelete={async (ids) => {
              for (const id of ids) await deleteOne(id);
            }}
          />
          <Pressable
            onPress={openAll}
            accessibilityRole="button"
            style={({ pressed }) => [styles.allBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.allBtnText}>Ver todos</Text>
            <IconArrowRight size={14} color={c.accent} />
          </Pressable>
          <Text style={styles.hint}>Mantén pulsado un aviso para borrarlo.</Text>
        </View>
      )}
    </BottomSheet>
  );
};

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
  allBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: c.hairStrong,
    backgroundColor: c.bgCard,
  },
  allBtnText: { color: c.accent, fontSize: 13, fontWeight: '700' },
  hint: {
    color: c.textFaint,
    fontSize: 11,
    textAlign: 'center',
  },
});
