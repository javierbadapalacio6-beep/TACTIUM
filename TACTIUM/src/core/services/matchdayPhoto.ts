import { supabase } from '@core/supabase/client';

// Foto "portada" de una jornada (estilo Strava). Se guarda en el bucket
// público `match-photos` con path `{team_id}/{matchday_id}.jpg` — la RLS deja
// escribir solo al admin del equipo (foldername[1] = team_id, igual que
// player-avatars). Al ser un path fijo por partido, `upsert` sobrescribe la
// anterior sin dejar huérfanas; añadimos `?v=<ts>` a la URL para romper caché.
const BUCKET = 'match-photos';

/**
 * Sube (o reemplaza) la foto del partido, actualiza `matchdays.photo_url`
 * con la URL pública y la devuelve. Patrón `fetch(uri).arrayBuffer()`, el
 * soportado por supabase-js en React Native.
 */
export async function uploadMatchPhoto(
  teamId: string,
  matchdayId: string,
  uri: string,
): Promise<string> {
  const path = `${teamId}/${matchdayId}.jpg`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
  if (upErr) throw upErr;

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const url = `${publicUrl}?v=${Date.now()}`;

  const { error: updErr } = await supabase
    .from('matchdays')
    .update({ photo_url: url })
    .eq('id', matchdayId);
  if (updErr) throw updErr;

  return url;
}

/** Quita la foto del partido (borra el objeto y limpia photo_url). */
export async function removeMatchPhoto(
  teamId: string,
  matchdayId: string,
): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([`${teamId}/${matchdayId}.jpg`]);
  } catch (e) {
    console.warn('match photo remove failed', e);
  }
  const { error } = await supabase
    .from('matchdays')
    .update({ photo_url: null })
    .eq('id', matchdayId);
  if (error) throw error;
}
