import React, { useMemo, useState } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';

import { useColors, type Palette } from '@core/theme';
import { Fonts } from '@core/theme/fonts';
import { IconBell } from '@components/ui';
import { useNotificationStore } from '@store/notificationStore';
import { NotificationsSheet } from './NotificationsSheet';

/** Campana con contador de no leídos. Se monta en las cabeceras de Home,
 *  ClubDashboard y Perfil. El store se hidrata/subscribe en App.tsx. */
export const NotificationBell: React.FC = () => {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const unread = useNotificationStore((s) => s.unread);
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={
          unread > 0 ? `Notificaciones, ${unread} sin leer` : 'Notificaciones'
        }
        style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }]}
      >
        <IconBell size={20} color={c.text} />
        {unread > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
          </View>
        ) : null}
      </Pressable>
      <NotificationsSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
};

const makeStyles = (c: Palette) => StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.bgCard,
    borderWidth: 1,
    borderColor: c.hairStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: c.accent,
    borderWidth: 2,
    borderColor: c.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.mono,
    color: c.textInverse,
    fontSize: 10,
    fontWeight: '800',
  },
});
