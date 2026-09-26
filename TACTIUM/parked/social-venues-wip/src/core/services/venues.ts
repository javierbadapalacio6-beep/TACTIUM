import { supabase } from '@core/supabase/client';

export type Venue = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  location: string | null;
};

/**
 * Busca en el directorio de clubes/sedes (lectura pública). Filtra por nombre
 * o ciudad. Sin query devuelve los primeros por nombre.
 */
export async function searchVenues(query: string, limit = 25): Promise<Venue[]> {
  const term = query.replace(/[,()%]/g, ' ').trim();
  let q = supabase
    .from('venues')
    .select('id, name, city, province, location')
    .order('name', { ascending: true })
    .limit(limit);
  if (term) q = q.or(`name.ilike.%${term}%,city.ilike.%${term}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Venue[];
}

// ── Búsqueda en vivo de lugares (Google Places vía edge function) ──────
export type PlaceResult = {
  placeId: string;
  name: string;
  address: string | null;
  city: string | null;
  province: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
};

/**
 * Autocompletado de ubicación: busca clubes reales en Google Places (proxy
 * seguro `places-search`). Devuelve nombre + dirección + coords + web.
 */
export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const { data, error } = await supabase.functions.invoke('places-search', {
    body: { query: term },
  });
  if (error) throw error;
  return ((data as { results?: PlaceResult[] })?.results ?? []) as PlaceResult[];
}

// Ficha completa de una sede (para el Panel privado y la ficha pública).
export type MyVenue = {
  id: string;
  name: string;
  location: string | null;
  city: string | null;
  province: string | null;
  website: string | null;
  logo_url: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  num_courts: number | null;
  opening_hours: string | null;
  description: string | null;
  amenities: string[];
};

const VENUE_FIELDS =
  'id,name,location,city,province,website,logo_url,lat,lng,phone,num_courts,opening_hours,description,amenities';

// Catálogo de servicios/amenidades de una sede (tags en venues.amenities).
// Compartido por el Panel (toggles) y la ficha pública (chips).
export const VENUE_AMENITIES: { key: string; label: string; icon: string }[] = [
  { key: 'gimnasio', label: 'Gimnasio', icon: '🏋️' },
  { key: 'parking', label: 'Parking', icon: '🅿️' },
  { key: 'vestuarios', label: 'Vestuarios', icon: '🚿' },
  { key: 'cafeteria', label: 'Cafetería', icon: '☕' },
  { key: 'tienda', label: 'Tienda', icon: '🛍️' },
  { key: 'clases', label: 'Clases', icon: '🎓' },
  { key: 'alquiler', label: 'Alquiler de material', icon: '🎾' },
  { key: 'torneos', label: 'Torneos', icon: '🏆' },
  { key: 'ligas', label: 'Ligas', icon: '📋' },
];

/**
 * Devuelve la sede que posee el usuario (o null). Prefiere el `ownerId` que
 * le pasen (del auth store, sin red); si no, cae a `auth.getUser()`.
 */
export async function getMyVenue(ownerId?: string | null): Promise<MyVenue | null> {
  let uid = ownerId ?? undefined;
  if (!uid) {
    const { data: authData } = await supabase.auth.getUser();
    uid = authData.user?.id;
  }
  if (!uid) return null;
  const { data, error } = await supabase
    .from('venues')
    .select(VENUE_FIELDS)
    .eq('owner_id', uid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as MyVenue | null) ?? null;
}

/** Ficha pública de una sede por id (lectura pública vía RLS venues_select). */
export async function getVenueById(id: string): Promise<MyVenue | null> {
  const { data, error } = await supabase
    .from('venues')
    .select(VENUE_FIELDS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as MyVenue | null) ?? null;
}

/** Edita una sede propia (RPC SECURITY DEFINER que valida owner). */
export async function updateVenue(input: {
  id: string;
  name?: string;
  location?: string;
  website?: string;
  logoUrl?: string;
  city?: string;
  province?: string;
  lat?: number;
  lng?: number;
  externalId?: string;
  phone?: string;
  numCourts?: number;
  openingHours?: string;
  description?: string;
  amenities?: string[];
}): Promise<void> {
  const { error } = await supabase.rpc('update_venue', {
    p_id: input.id,
    p_name: input.name,
    p_location: input.location,
    p_website: input.website,
    p_logo_url: input.logoUrl,
    p_city: input.city,
    p_province: input.province,
    p_lat: input.lat,
    p_lng: input.lng,
    p_external_id: input.externalId,
    p_phone: input.phone,
    p_opening_hours: input.openingHours,
    p_description: input.description,
    p_num_courts: input.numCourts,
    p_amenities: input.amenities,
  });
  if (error) throw error;
}

// ── Logo de la sede (bucket público `venue-logos`) ─────────────────────
// Path: `{user_id}/logo_{timestamp}.{ext}` (mismo esquema que avatars: la
// primera carpeta = auth.uid() para las policies de storage). Timestamp
// para cache-bust en el CDN; limpiamos los antiguos tras subir.
const VENUE_LOGO_BUCKET = 'venue-logos';

function detectImgExt(uri: string): { ext: string; contentType: string } {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return { ext: 'png', contentType: 'image/png' };
  if (lower.endsWith('.webp')) return { ext: 'webp', contentType: 'image/webp' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

/** Sube el logo de la sede desde un file URI (expo-image-picker), actualiza
 *  `venues.logo_url` y devuelve la URL pública. */
export async function uploadVenueLogo(venueId: string, uri: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  const { ext, contentType } = detectImgExt(uri);
  const filename = `logo_${Date.now()}.${ext}`;
  const path = `${userId}/${filename}`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from(VENUE_LOGO_BUCKET)
    .upload(path, arrayBuffer, { contentType, upsert: false });
  if (upErr) throw upErr;

  // Cleanup de logos antiguos del user (no fatal si falla).
  try {
    const { data: files } = await supabase.storage.from(VENUE_LOGO_BUCKET).list(userId);
    const oldPaths = (files ?? [])
      .filter((f) => f.name !== filename)
      .map((f) => `${userId}/${f.name}`);
    if (oldPaths.length > 0) {
      await supabase.storage.from(VENUE_LOGO_BUCKET).remove(oldPaths);
    }
  } catch (e) {
    console.warn('venue logo cleanup failed', e);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(VENUE_LOGO_BUCKET).getPublicUrl(path);

  await updateVenue({ id: venueId, logoUrl: publicUrl });
  return publicUrl;
}

/** Borra el logo de la sede (storage + venues.logo_url). Idempotente. */
export async function removeVenueLogo(venueId: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  const { data: files } = await supabase.storage.from(VENUE_LOGO_BUCKET).list(userId);
  if (files && files.length > 0) {
    await supabase.storage
      .from(VENUE_LOGO_BUCKET)
      .remove(files.map((f) => `${userId}/${f.name}`));
  }
  // '' limpia logo_url (coalesce('', logo_url) = '').
  await updateVenue({ id: venueId, logoUrl: '' });
}

// Servicio de sedes / clubes de pádel (cuenta de negocio). v1 mínimo: crear.
export async function createVenue(input: {
  name: string;
  location?: string;
  logoUrl?: string;
  city?: string;
  province?: string;
  lat?: number;
  lng?: number;
  website?: string;
  externalId?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('create_venue', {
    p_name: input.name,
    p_location: input.location ?? '',
    p_logo_url: input.logoUrl ?? '',
    p_city: input.city ?? '',
    p_province: input.province ?? '',
    p_lat: input.lat,
    p_lng: input.lng,
    p_website: input.website ?? '',
    p_external_id: input.externalId ?? '',
  });
  if (error) throw error;
  return data as string;
}
