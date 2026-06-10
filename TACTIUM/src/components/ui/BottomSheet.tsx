import React from 'react';
import {
  Modal,
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@core/theme/colors';
import { Spacing } from '@core/theme/spacing';
interface Props {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  scrollable?: boolean;
  /**
   * Footer sticky opcional. Se renderiza FUERA del ScrollView, siempre
   * visible al fondo del sheet aunque el contenido scrollee. Pensado
   * para CTAs principales (Guardar, Confirmar) — sigue las reglas
   * `fixed-element-offset` + `primary-action` del UX guide.
   * Cuando el teclado abre, el KAV lo empuja arriba pegado al teclado.
   */
  footer?: React.ReactNode;
}
// Altura aproximada del home indicator / barra de navegación. Lo usamos
// como FALLBACK cuando estamos dentro de un <Modal> y no podemos leer
// los safe-area insets reales (en iOS, los Modals se renderizan fuera
// del árbol normal y `useSafeAreaInsets()` puede devolver 0).
const HOME_INDICATOR_FALLBACK = Platform.OS === 'ios' ? 34 : 24;
export const BottomSheet: React.FC<Props> = ({
  open,
  onClose,
  children,
  scrollable = true,
  footer,
}) => {
  const insets = useSafeAreaInsets();
  // ✅ REDUCIDO: De safeBottom + 48 a solo safeBottom + 16
  // El sheet termina pegado al borde inferior de la pantalla, así que el
  // home indicator queda DENTRO del sheet.
  const safeBottom = Math.max(insets.bottom, HOME_INDICATOR_FALLBACK);
  // safeBottom respeta el home indicator + colchón visual generoso para
  // que CTAs (footer sticky) no queden pegados al borde inferior ni
  // tapados por el indicator. ~66pt en iPhone X+.
  const paddingBottom = safeBottom + 32;
  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={styles.root}>
        {/* Scrim ocupa SOLO el espacio por encima del sheet (flex: 1 en
            columna). El UX guide pide opacidad 40-60% — usamos 55%. */}
        <Pressable style={styles.scrim} onPress={onClose} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrap}
        >
          <View style={styles.sheet}>
            <View style={styles.handle} />
            {/* Contenido scrollable. Si hay footer sticky, el ScrollView
                se queda con flex-shrink para dejarle hueco. */}
            {scrollable ? (
              <ScrollView
                contentContainerStyle={[
                  styles.content,
                  { paddingBottom: paddingBottom + 16 }, // ← paddingBottom ahora aquí
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                style={footer ? styles.scrollFlex : styles.scrollFull}
                bounces={false}
              >
                {children}
              </ScrollView>
            ) : (
              <View style={[styles.content, { paddingBottom }]}>
                {children}
              </View>
            )}
            {/* Footer sticky (CTA principal). Siempre visible.
                paddingBottom dinámico para respetar el home indicator y
                dar aire visual a los botones (antes el borde inferior
                quedaba cortado). */}
            {footer ? (
              <View
                style={[
                  styles.footer,
                  { paddingBottom: safeBottom + 16 },
                ]}
              >
                {footer}
              </View>
            ) : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};
const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'column',
  },
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheetWrap: {
    width: '100%',
    // En tablet/iPad el Modal ocupa toda la pantalla; capamos el ancho y
    // centramos para que el sheet quede alineado con la columna de la app
    // (ResponsiveFrame). En teléfono 100% < maxWidth → sin efecto.
    maxWidth: 720,
    alignSelf: 'center',
    // SIN flex: 1. Si lo pones, el sheetWrap se reparte la pantalla 50/50
    // con el scrim (que también tiene flex:1), y el sheet acaba en el
    // centro vertical con una franja grande vacía encima. Dejándolo sin
    // flex, el sheetWrap se dimensiona a su contenido (el sheet) y se
    // ancla naturalmente al fondo gracias a la flex column del root.
    backgroundColor: Colors.bgRaised,
  },
  sheet: {
    backgroundColor: Colors.bgRaised,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: Colors.hairStrong,
    paddingTop: 10,
    maxHeight: '90%',
    // Sin minHeight: que el sheet abrace el contenido. Si el contenido
    // es corto (como el idle de ScanSheet con 2 cards), no hay hueco
    // vacío detrás. Si excede, el ScrollView gestiona el scroll.
  },
  scrollFull: {
    // El ScrollView solo necesita poder shrinkear cuando el contenido
    // excede el maxHeight del sheet; NO debe expandirse: si lo hace,
    // arrastra al sheet a su maxHeight aunque el contenido sea pequeño.
    flexShrink: 1,
  },
  scrollFlex: {
    flexShrink: 1, // Cuando hay footer, se adapta
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.hairStrong,
    marginBottom: 10,
  },
  content: {
    paddingHorizontal: Spacing.md + 4,
    paddingTop: 8,
    gap: 14,
  },
  footer: {
    paddingHorizontal: Spacing.md + 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.hair,
  },
});