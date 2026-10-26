import { supabase } from '@core/supabase/client';

// Foto de una PAREJA de la jornada (además de la general, `matchdays.photo_url`). Mismo bucket público
// `match-photos`; path `{team_id}/{matchday_id}-p{pista}.jpg` (la RLS deja escribir solo al admin del equipo).
// La URL queda en `match_pair_photos` (una fila por jornada y pista).
const BUCKET = 'match-photos';

// La tabla es nueva y aún no está en los tipos generados.
const table = () => (supabase as unknown as { from: (t: string) => any }).from('match_pair_photos');

/** Fotos de las parejas de una jornada: pista → URL. */
export async function fetchPairPhotos(matchdayId: string): Promise<Record<number, string>> {
  const { data, error } = await table().select('court_number, photo_url').eq('matchday_id', matchdayId);
  if (error) throw error;
  const out: Record<number, string> = {};
  for (const r of (data ?? []) as { court_number: number; photo_url: string }[]) {
    out[r.court_number] = r.photo_url;
  }
  return out;
}

/** Sube (o reemplaza) la foto de la pareja de una pista y devuelve su URL pública. */
export async function uploadPairPhoto(
  teamId: string,
  matchdayId: string,
  court: number,
  uri: string,
): Promise<string> {
  const path = `${teamId}/${matchdayId}-p${court}.jpg`;
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
  const { error } = await table().upsert(
    { matchday_id: matchdayId, court_number: court, photo_url: url, updated_at: new Date().toISOString() },
    { onConflict: 'matchday_id,court_number' },
  );
  if (error) throw error;
  return url;
}

export async function removePairPhoto(teamId: string, matchdayId: string, court: number): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([`${teamId}/${matchdayId}-p${court}.jpg`]);
  } catch (e) {
    console.warn('pair photo remove failed', e);
  }
  const { error } = await table().delete().eq('matchday_id', matchdayId).eq('court_number', court);
  if (error) throw error;
}
