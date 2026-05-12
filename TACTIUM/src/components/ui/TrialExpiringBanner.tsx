import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { IconAlert, IconArrowRight } from './Icon';
import { useSubscriptionStore } from '@store/subscriptionStore';

import type { RootStackParamList } from '@navigation/types';

interface Props {
  // Días de umbral para mostrar el banner. Por defecto ≤3 (faltan 3 días
  // o menos para que termine el trial).
  thresholdDays?: number;
}

/**
 * Banner que aparece cuando el trial del usuario está por expirar.
 *
 * Diseño no intrusivo: pequeña pill amarilla con icono y texto que invita
 * a actualizar al plan. Al pulsar, navega a Paywall.
 *
 * Se monta SIEMPRE; el render es condicional según los días que queden.
 * Pensado para colocar en la parte superior de HomeScreen/ClubDashboard.
 */
export const TrialExpiringBanner: React.FC<Props> = ({
  thresholdDays = 3,
}) => {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const days = useSubscriptionStore((s) => s.trialDaysLeft());

  if (days === null || days > thresholdDays) return null;

  const label =
    days === 0
      ? 'Tu prueba expira hoy'
      : days === 1
        ? 'Tu prueba expira mañana'
        : `Tu prueba expira en ${days} días`;

  return (
    <Animated.View
      entering={FadeInDown.duration(260)}
      style={styles.wrap}
    >
      <Pressable
        onPress={() =>
          navigation.navigate('Paywall', { intent: 'trial_expiring' })
        }
        accessibilityRole="button"
        accessibilityLabel={`${label}. Pulsa para actualizar plan.`}
        style={({ pressed }) => [
          styles.banner,
          pressed && { opacity: 0.85 },
        ]}
      >
        <View style={styles.iconWrap}>
          <IconAlert size={12} color={Colors.warning} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.label} numberOfLines={1}>
            {label}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            Mantén el acceso premium · Pulsa para actualizar
          </Text>
        </View>
        <IconArrowRight size={12} color={Colors.warning} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 22,
    paddingTop: 6,
    paddingBottom: 4,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(242,201,76,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(242,201,76,0.40)',
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 7,
    backgroundColor: 'rgba(242,201,76,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: Colors.text,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  sub: {
    fontFamily: Fonts.mono,
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
