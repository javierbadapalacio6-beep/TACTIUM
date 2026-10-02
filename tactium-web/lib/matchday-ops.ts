"use client";

import { supabaseBrowser } from "./supabase/client";

/**
 * Operaciones de la pantalla de jornada que la web no tenía: foto del
 * partido y cambio de fecha/hora. Réplica de la app
 * (`TACTIUM/src/core/services/matchdayPhoto.ts` y `updateMatchday`).
 *
 * Ninguna se llama directamente desde la interfaz: siempre dentro de
 * `guardedWrite`, como el resto de mutaciones.
 */

/** Bucket público de fotos de partido. La RLS deja escribir solo al admin
 *  del equipo (`foldername[1] = team_id`). */
const MATCH_PHOTO_BUCKET = "match-photos";

/** Path fijo por partido, el mismo que la app: `{team_id}/{matchday_id}.jpg`.
 *  `upsert` sobrescribe la anterior sin dejar huérfanas. */
const matchPhotoPath = (teamId: string, matchdayId: string) =>
  `${teamId}/${matchdayId}.jpg`;

/**
 * Pasa cualquier imagen a JPEG (lado largo ≤ 2048 px). La app siempre sube
 * JPEG con ese nombre; si la web subiera un PNG con extensión .jpg, el CDN lo
 * serviría con el tipo equivocado.
 */
export async function toJpeg(file: Blob, maxSide = 2048, quality = 0.86): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("No se pudo leer la imagen"));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no puede procesar la imagen");
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("No se pudo convertir la imagen"))),
        "image/jpeg",
        quality,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Sube (o reemplaza) la foto del partido, actualiza `matchdays.photo_url`
 * con la URL pública (+ `?v=<ts>` para romper caché) y la devuelve.
 */
export async function uploadMatchPhoto(
  teamId: string,
  matchdayId: string,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("El archivo tiene que ser una imagen");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("La imagen no puede pesar más de 15 MB");
  }
  const sb = supabaseBrowser();
  const path = matchPhotoPath(teamId, matchdayId);
  const jpeg = await toJpeg(file);

  const { error: upErr } = await sb.storage
    .from(MATCH_PHOTO_BUCKET)
    .upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw upErr;

  const {
    data: { publicUrl },
  } = sb.storage.from(MATCH_PHOTO_BUCKET).getPublicUrl(path);
  const url = `${publicUrl}?v=${Date.now()}`;

  const { error: updErr } = await sb
    .from("matchdays")
    .update({ photo_url: url })
    .eq("id", matchdayId);
  if (updErr) throw updErr;

  return url;
}

/** Quita la foto del partido: borra el objeto (si falla, no bloquea) y
 *  limpia `photo_url`. */
export async function removeMatchPhoto(teamId: string, matchdayId: string): Promise<void> {
  const sb = supabaseBrowser();
  try {
    await sb.storage.from(MATCH_PHOTO_BUCKET).remove([matchPhotoPath(teamId, matchdayId)]);
  } catch {
    /* basura en storage, no es motivo para fallar */
  }
  const { error } = await sb
    .from("matchdays")
    .update({ photo_url: null })
    .eq("id", matchdayId);
  if (error) throw error;
}

/** Cambia fecha y hora de una jornada (`match_date` «AAAA-MM-DD»,
 *  `match_time` «HH:MM»). null = por confirmar. */
export async function updateMatchdaySchedule(
  matchdayId: string,
  patch: { date: string | null; time: string | null },
): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("matchdays")
    .update({ match_date: patch.date, match_time: patch.time })
    .eq("id", matchdayId);
  if (error) throw error;
}
