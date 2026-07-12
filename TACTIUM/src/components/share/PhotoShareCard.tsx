import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Share,
  Platform,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';

// ⚠️ view-shot se carga PEREZOSAMENTE: con TurboModules, importar el
// módulo cuando el binario no lo incluye LANZA al evaluar el bundle y
// tumba la app entera al arrancar. Con require() protegido, el binario
// viejo funciona (fallback foto+texto) y el nuevo captura de verdad.
type CaptureRefFn = (
  ref: unknown,
  options?: { format?: string; quality?: number },
) => Promise<string>;

let captureRefSafe: CaptureRefFn | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  captureRefSafe = (
    require('react-native-view-shot') as { captureRef: CaptureRefFn }
  ).captureRef;
} catch {
  captureRefSafe = null;
}

/** Captura una vista como imagen; null si el binario no trae view-shot. */
export async function captureViewSafe(
  ref: React.RefObject<View | null>,
  options?: { format?: string; quality?: number },
): Promise<string | null> {
  if (!captureRefSafe) return null;
  try {
    return await captureRefSafe(ref, options);
  } catch {
    return null;
  }
}

// expo-sharing también se carga PEREZOSAMENTE: es un módulo nativo que no
// existe en binarios anteriores a 1.2.0. Con require() protegido, un binario
// viejo (p. ej. 1.1.0 que reciba este JS por OTA) no casca — cae al Share
// nativo — y el nuevo abre la hoja de compartir imagen de verdad.
type ShareAsyncFn = (
  url: string,
  options?: { mimeType?: string; dialogTitle?: string; UTI?: string },
) => Promise<void>;
let expoSharing: {
  shareAsync: ShareAsyncFn;
  isAvailableAsync: () => Promise<boolean>;
} | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  expoSharing = require('expo-sharing');
} catch {
  expoSharing = null;
}

import { Colors } from '@core/theme/colors';
import { Fonts } from '@core/theme/fonts';
import { Radius } from '@core/theme/spacing';
import { TactiumMark } from '@components/brand/TactiumMark';

// Tarjeta "estilo Strava" (F7): la foto del partido con el resultado y la
// marca TACTIUM superpuestos. Se comparte como imagen compuesta cuando el
// binario incluye view-shot; si no, degradamos a foto + texto por el share
// nativo (WhatsApp la muestra como imagen con caption).

interface Props {
  photoUri: string;
  /** Línea grande sobre la foto (p. ej. "CD Tactium 2 – 1 Pádel Río"). */
  title: string;
  /** Línea secundaria (p. ej. "Amistoso · 7 jul 2026"). */
  subtitle?: string;
  /** Línea de detalle (p. ej. "6-4 6-3 · P1"). */
  detail?: string;
}

export const PhotoShareCard = React.forwardRef<View, Props>(
  ({ photoUri, title, subtitle, detail }, ref) => (
    <View ref={ref} collapsable={false} style={styles.card}>
      <Image source={{ uri: photoUri }} style={styles.photo} resizeMode="cover" />
      {/* Velo inferior para legibilidad del resultado sobre la foto */}
      <LinearGradient
        colors={['transparent', 'rgba(4,10,8,0.55)', 'rgba(4,10,8,0.92)']}
        style={styles.veil}
      />
      <View style={styles.overlay}>
        <View style={styles.brandRow}>
          <TactiumMark size={22} gradient />
          <Text style={styles.brandName}>TACTIUM</Text>
        </View>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
        <Text style={styles.url}>tactium.io</Text>
      </View>
    </View>
  ),
);
PhotoShareCard.displayName = 'PhotoShareCard';

/**
 * Foto del partido: cámara (hazla en la pista) o galería. Devuelve la
 * URI o null si el usuario cancela / no da permiso.
 */
export function pickMatchPhoto(): Promise<string | null> {
  const fromCamera = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
      return null;
    }
    const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
    return r.canceled ? null : (r.assets?.[0]?.uri ?? null);
  };
  const fromLibrary = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.');
      return null;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    return r.canceled ? null : (r.assets?.[0]?.uri ?? null);
  };
  return new Promise((resolve) => {
    Alert.alert('Foto del partido', '¿De dónde sacamos la foto?', [
      { text: '📷 Hacer foto', onPress: () => fromCamera().then(resolve) },
      { text: '🖼️ De la galería', onPress: () => fromLibrary().then(resolve) },
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(null) },
    ]);
  });
}

/**
 * Comparte la tarjeta como imagen COMPUESTA (foto + resultado). Si la
 * captura no está disponible en este binario, comparte la foto original
 * con el texto como caption (fallback transparente para el usuario).
 */
export async function sharePhotoCard(
  ref: React.RefObject<View | null>,
  photoUri: string,
  text: string,
): Promise<void> {
  // Compuesta si el binario lo permite; si no, foto original + texto.
  const captured = await captureViewSafe(ref, {
    format: 'jpg',
    quality: 0.92,
  });
  const uri = captured ?? photoUri;
  try {
    await Share.share(
      Platform.OS === 'ios'
        ? ({ url: uri, message: text } as never)
        : ({ message: text, url: uri } as never),
    );
  } catch {
    // cancelado por el usuario
  }
}

/**
 * Comparte la tarjeta compuesta como IMAGEN mediante la hoja de compartir
 * nativa (expo-sharing). La tarjeta ya lleva resultado + marca + tactium.io,
 * así que no necesita caption: se comparte solo la foto (que WhatsApp/IG
 * muestran como imagen). Si el binario no trae expo-sharing (p. ej. 1.1.0),
 * cae de forma transparente al Share nativo con foto + texto de respaldo.
 */
export async function shareCardImage(
  ref: React.RefObject<View | null>,
  photoUri: string,
  fallbackText: string,
): Promise<void> {
  const captured = await captureViewSafe(ref, { format: 'jpg', quality: 0.92 });
  const uri = captured ?? photoUri;
  // Camino preferente: hoja nativa de compartir imagen (expo-sharing).
  try {
    if (expoSharing && (await expoSharing.isAvailableAsync())) {
      const fileUri =
        uri.startsWith('file://') || uri.startsWith('content://')
          ? uri
          : `file://${uri}`;
      await expoSharing.shareAsync(fileUri, {
        mimeType: 'image/jpeg',
        dialogTitle: 'Compartir partido',
        UTI: 'public.jpeg',
      });
      return;
    }
  } catch {
    // si expo-sharing falla (cancelado/no soportado), probamos el fallback
  }
  // Fallback binario viejo: foto + texto por el Share de React Native.
  try {
    await Share.share(
      Platform.OS === 'ios'
        ? ({ url: uri, message: fallbackText } as never)
        : ({ message: fallbackText, url: uri } as never),
    );
  } catch {
    // cancelado por el usuario
  }
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    height: 380,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.bgCard,
  },
  photo: { ...StyleSheet.absoluteFillObject },
  veil: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
  },
  overlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 8,
  },
  brandName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  detail: {
    fontFamily: Fonts.mono,
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: 1,
  },
  url: {
    fontFamily: Fonts.mono,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    letterSpacing: 1.5,
    marginTop: 10,
  },
});
