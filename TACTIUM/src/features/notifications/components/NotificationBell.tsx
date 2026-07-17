import React, { useState } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconBell } from '@components/ui';
import { useNotificationStore } from '@store/notificationStore';
import { NotificationsSheet } from './NotificationsSheet';

/** Campana con contador de no leídos. Se monta en las cabeceras de Home,
 *  ClubDashboard y Perfil. El store se hidrata/subscribe en App.tsx. */
export const NotificationBell: React.FC = () => {
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
        <IconBell size={20} color={Colors.text} />
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

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
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
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: Fonts.mono,
    color: Colors.textInverse,
    fontSize: 10,
    fontWeight: '800',
  },
});
