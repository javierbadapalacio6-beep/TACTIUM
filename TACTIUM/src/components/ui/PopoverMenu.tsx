import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  Text,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { IconChevron } from './Icon';

export interface PopoverOption {
  eyebrow?: string;
  label: string;
  onPress: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  options: PopoverOption[];
  /** Distancia desde el borde superior. Por defecto se ancla bajo el header. */
  top?: number;
  /** Distancia desde el borde derecho. */
  right?: number;
  /** Ancho mínimo del menú. */
  minWidth?: number;
}

/**
 * Menú flotante estilo iOS context menu / popover. Aparece anclado en una
 * posición fija (top/right) en lugar de deslizarse desde abajo como un
 * BottomSheet. Ideal para acciones rápidas con 2-4 opciones cortas.
 *
 * UX guide rules aplicadas:
 *  - `escape-routes`: scrim externo cierra al tocar.
 *  - `modal-motion`: entrada con zoom+fade desde el trigger.
 *  - `touch-target-size`: cada fila ≥44pt.
 *  - `state-clarity`: hover/pressed con tinte accent.
 */
export const PopoverMenu: React.FC<Props> = ({
  open,
  onClose,
  options,
  top,
  right = 20,
  minWidth = 240,
}) => {
  const insets = useSafeAreaInsets();
  const effectiveTop = top ?? insets.top + 64;

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      {open ? (
        <View style={styles.root}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
          />
          <View
            style={[
              styles.popover,
              { top: effectiveTop, right, minWidth },
            ]}
          >
            {options.map((opt, idx) => (
              <React.Fragment key={opt.label}>
                {idx > 0 ? <View style={styles.divider} /> : null}
                <Pressable
                  // NO llamamos a onClose aquí: deja que el handler de la
                  // opción decida si cierra (ej. si va a cambiar el estado
                  // del componente padre para mostrar un spinner).
                  onPress={opt.onPress}
                  style={({ pressed }) => [
                    styles.row,
                    pressed && { backgroundColor: Colors.accent10 },
                  ]}
                >
                  <View style={styles.rowLeading}>
                    {opt.eyebrow ? (
                      <Text style={styles.eyebrow}>{opt.eyebrow}</Text>
                    ) : null}
                    <Text style={styles.label}>{opt.label}</Text>
                  </View>
                  <IconChevron size={14} color={Colors.textFaint} />
                </Pressable>
              </React.Fragment>
            ))}
          </View>
        </View>
      ) : null}
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  popover: {
    position: 'absolute',
    backgroundColor: Colors.bgRaised,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.hairStrong,
    overflow: 'hidden',
    // Sombra fuerte para que parezca "flotando" sobre la pantalla.
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
    ...(Platform.OS === 'android' ? { elevation: 16 } : null),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 56,
  },
  rowLeading: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.textFaint,
    letterSpacing: 1.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  label: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.hair,
    marginLeft: 16,
  },
});
