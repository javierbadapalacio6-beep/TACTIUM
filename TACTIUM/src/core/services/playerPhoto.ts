import { supabase } from '@core/supabase/client';

// Bucket público 'player-avatars' (migración player_avatars_bucket_and_policies).
// Path: '{team_id}/{player_id}_{timestamp}.{ext}' — el team_id como primer
// segmento permite que la RLS solo deje escribir al admin de ESE equipo
// (foldername[1] = team_id). Timestamp para cache-bust del CDN.

const BUCKET = 'player-avatars';

function detectExt(uri: string): { ext: string; contentType: string } {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return { ext: 'png', contentType: 'image/png' };
  if (lower.endsWith('.webp')) return { ext: 'webp', contentType: 'image/webp' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

/**
 * Sube una foto (local file URI de expo-image-picker) para un jugador,
 * actualiza players.photo_url con la URL pública y devuelve esa URL. Borra
 * las fotos antiguas del mismo jugador (cleanup). El patrón
 * `fetch(uri).arrayBuffer()` es el soportado por supabase-js en RN.
 */
export async function uploadPlayerPhoto(
  teamId: string,
  playerId: string,
  uri: string,
): Promise<string> {
  const { ext, contentType } = detectExt(uri);
  const filename = `${playerId}_${Date.now()}.${ext}`;
  const path = `${teamId}/${filename}`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType, upsert: false });
  if (upErr) throw upErr;

  // Cleanup de fotos antiguas del mismo jugador en la carpeta del equipo.
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list(teamId);
    const old = (files ?? [])
      .filter((f) => f.name.startsWith(`${playerId}_`) && f.name !== filename)
      .map((f) => `${teamId}/${f.name}`);
    if (old.length > 0) await supabase.storage.from(BUCKET).remove(old);
  } catch (cleanupErr) {
    console.warn('player photo cleanup failed', cleanupErr);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: updErr } = await supabase
    .from('players')
    .update({ photo_url: publicUrl })
    .eq('id', playerId);
  if (updErr) throw updErr;

  return publicUrl;
}

/** Borra todas las fotos del jugador y limpia players.photo_url. */
export async function removePlayerPhoto(
  teamId: string,
  playerId: string,
): Promise<void> {
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list(teamId);
    const mine = (files ?? [])
      .filter((f) => f.name.startsWith(`${playerId}_`))
      .map((f) => `${teamId}/${f.name}`);
    if (mine.length > 0) await supabase.storage.from(BUCKET).remove(mine);
  } catch (e) {
    console.warn('player photo remove failed', e);
  }
  const { error } = await supabase
    .from('players')
    .update({ photo_url: null })
    .eq('id', playerId);
  if (error) throw error;
}
