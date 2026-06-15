import { supabase } from '@core/supabase/client';

// Bucket público 'avatars' creado en la migración
// `avatars_bucket_and_policies`. Estructura de paths:
//   `{user_id}/avatar_{timestamp}.{ext}` — timestamp incluido en el
// nombre para forzar cache-bust en el CDN cuando se cambia la foto. Tras
// cada upload eliminamos los archivos antiguos del mismo user (cleanup)
// para no acumular basura en storage.

const BUCKET = 'avatars';

function detectExt(uri: string): { ext: string; contentType: string } {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.png')) return { ext: 'png', contentType: 'image/png' };
  if (lower.endsWith('.webp')) return { ext: 'webp', contentType: 'image/webp' };
  return { ext: 'jpg', contentType: 'image/jpeg' };
}

/**
 * Sube una imagen desde un local file URI (típicamente el resultado de
 * `expo-image-picker`) al bucket avatars del user autenticado, actualiza
 * `profiles.avatar_url` con la URL pública y devuelve la URL nueva.
 *
 * Detalles de implementación:
 *  · `fetch(uri).arrayBuffer()` es el patrón soportado por supabase-js
 *    en React Native; Blob a veces falla en iOS por incompatibilidad
 *    entre el polyfill de RN y el upload del SDK.
 *  · Cada upload usa un filename único (timestamp) para que la URL
 *    pública cambie y el CDN/cliente no sirvan la versión cacheada.
 *  · Tras subir el nuevo, listamos archivos del user y borramos los
 *    antiguos. Si la limpieza falla no es fatal — el storage es barato
 *    y el profile ya apunta al archivo nuevo.
 */
export async function uploadMyAvatar(uri: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  const { ext, contentType } = detectExt(uri);
  const filename = `avatar_${Date.now()}.${ext}`;
  const path = `${userId}/${filename}`;

  const response = await fetch(uri);
  const arrayBuffer = await response.arrayBuffer();

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType, upsert: false });
  if (upErr) throw upErr;

  // Cleanup: borrar archivos antiguos del user. Si falla, no rompemos el
  // flow — el profile ya apunta al archivo nuevo, los viejos son ruido.
  try {
    const { data: files } = await supabase.storage.from(BUCKET).list(userId);
    const oldPaths = (files ?? [])
      .filter((f) => f.name !== filename)
      .map((f) => `${userId}/${f.name}`);
    if (oldPaths.length > 0) {
      await supabase.storage.from(BUCKET).remove(oldPaths);
    }
  } catch (cleanupErr) {
    console.warn('avatar cleanup failed', cleanupErr);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path);

  const { error: updErr } = await supabase
    .from('profiles')
    .update({ avatar_url: publicUrl })
    .eq('id', userId);
  if (updErr) throw updErr;

  return publicUrl;
}

/**
 * Borra todos los avatars del user en storage y limpia
 * `profiles.avatar_url`. Idempotente — si no había avatar, no-op.
 */
export async function deleteMyAvatar(): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error('Sin sesión activa');

  const { data: files } = await supabase.storage.from(BUCKET).list(userId);
  if (files && files.length > 0) {
    const paths = files.map((f) => `${userId}/${f.name}`);
    await supabase.storage.from(BUCKET).remove(paths);
  }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: null })
    .eq('id', userId);
  if (error) throw error;
}
