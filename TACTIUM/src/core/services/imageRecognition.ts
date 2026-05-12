import { Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from '@core/supabase/client';

// Sentinel: thrown cuando el user deniega permiso de cámara o galería.
// El caller (ScanSheet) puede detectarlo y mostrar Alert con link a
// Ajustes del OS en vez de un toast genérico de "error".
export class PermissionDeniedError extends Error {
  kind: 'camera' | 'library';
  constructor(kind: 'camera' | 'library') {
    super(
      kind === 'camera'
        ? 'Permiso de cámara denegado'
        : 'Permiso de galería denegado',
    );
    this.name = 'PermissionDeniedError';
    this.kind = kind;
  }
}

/**
 * Abre Ajustes del OS para que el user pueda otorgar el permiso manualmente
 * tras una denegación previa. iOS y Android lo manejan distinto pero
 * `Linking.openSettings()` funciona en ambos a partir de RN 0.69+.
 */
export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

// MIME types soportados por el picker de archivos. Gemini 2.5 Flash (la
// llamada subyacente en `parse-image`) acepta nativamente PDF e imágenes
// vía `inline_data`. Los formatos Office (.docx/.xlsx) son ZIP-XML y NO
// los procesa por inline_data — si el usuario quiere importar desde
// Word/Excel, debe exportar a PDF antes (lo indicamos en la UI).
const SUPPORTED_FILE_MIMES = [
  'application/pdf',
  'image/*',
];

export interface ScannedPlayer {
  name: string;
  pts?: number;
  position?: 'Drive' | 'Revés' | 'Ambos';
}

export interface ScannedMatchday {
  jornada_number?: number;
  opponent: string;
  match_date?: string; // 'YYYY-MM-DD'
  match_time?: string; // 'HH:MM'
  is_home: boolean;
}

type Mode = 'ranking' | 'calendar';

interface ParseResponse<T> {
  items?: T[];
  error?: string;
}

/**
 * Picker de archivos (PDF / Word / Excel / TXT / CSV / imágenes). Lee el
 * archivo seleccionado y devuelve `{ base64, mime }`. Si el usuario cancela
 * devuelve `null`.
 *
 * `expo-document-picker` da una URI local; `expo-file-system` la lee a
 * base64. Hacemos esto manualmente porque DocumentPicker no expone base64
 * directamente (al contrario que ImagePicker).
 */
async function pickFileBase64(): Promise<{
  base64: string;
  mime: string;
  name?: string;
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: SUPPORTED_FILE_MIMES,
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;

  const mime = asset.mimeType ?? 'application/octet-stream';

  const base64 = await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (!base64) return null;
  return { base64, mime, name: asset.name };
}

async function pickImageBase64(
  source: 'camera' | 'library',
): Promise<{ base64: string; mime: string } | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new PermissionDeniedError('camera');
    }
    const result = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return null;
    return {
      base64: result.assets[0].base64,
      mime: result.assets[0].mimeType ?? 'image/jpeg',
    };
  }

  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new PermissionDeniedError('library');
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    base64: true,
    quality: 0.7,
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
  });
  if (result.canceled || !result.assets?.[0]?.base64) return null;
  return {
    base64: result.assets[0].base64,
    mime: result.assets[0].mimeType ?? 'image/jpeg',
  };
}

async function callParseImage<T>(
  mode: Mode,
  base64: string,
  mime: string,
  teamName?: string,
): Promise<T[]> {
  const { data, error } = await supabase.functions.invoke<ParseResponse<T>>(
    'parse-image',
    {
      body: { mode, image: base64, mime, team_name: teamName },
    },
  );
  if (error) throw error;
  if (!data) throw new Error('Respuesta vacía de parse-image');
  if (data.error) throw new Error(data.error);
  return data.items ?? [];
}

export const ImageRecognitionApi = {
  pickImageBase64,
  pickFileBase64,
  scanRanking: (base64: string, mime: string) =>
    callParseImage<ScannedPlayer>('ranking', base64, mime),
  scanCalendar: (base64: string, mime: string, teamName?: string) =>
    callParseImage<ScannedMatchday>('calendar', base64, mime, teamName),
};
