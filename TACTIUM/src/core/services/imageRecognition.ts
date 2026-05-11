import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@core/supabase/client';

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

async function pickImageBase64(
  source: 'camera' | 'library',
): Promise<{ base64: string; mime: string } | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      throw new Error('Permiso de cámara denegado');
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
    throw new Error('Permiso de galería denegado');
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
  scanRanking: (base64: string, mime: string) =>
    callParseImage<ScannedPlayer>('ranking', base64, mime),
  scanCalendar: (base64: string, mime: string, teamName?: string) =>
    callParseImage<ScannedMatchday>('calendar', base64, mime, teamName),
};
