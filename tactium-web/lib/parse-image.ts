"use client";

import { supabaseBrowser } from "./supabase/client";
import { createPlayer, updatePlayer, type DbPlayer } from "./queries";

/**
 * Escáner de ranking y calendario con la Edge Function `parse-image`
 * (Gemini). Copia de `TACTIUM/src/core/services/imageRecognition.ts` y de
 * `core/utils/bulkUpsertPlayers.ts` de la app: mismo cuerpo
 * `{ mode, image, mime, team_name }` y misma regla de volcado (por nombre
 * normalizado: si el jugador ya está se actualizan sus puntos; si no, se crea).
 */

export interface ScannedPlayer {
  name: string;
  pts?: number;
  position?: "Drive" | "Revés" | "Ambos";
}

export interface ScannedMatchday {
  jornada_number?: number;
  opponent: string;
  match_date?: string; // YYYY-MM-DD
  match_time?: string; // HH:MM
  is_home: boolean;
}

/** Formatos que entiende Gemini por `inline_data`: imágenes y PDF. */
export const SCAN_ACCEPT = "image/*,application/pdf,.pdf";
const MAX_BYTES = 10 * 1024 * 1024;

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result ?? ""));
    r.onerror = () => reject(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(blob);
  });
}

/**
 * Las fotos del móvil pesan 4-8 MB; la app las manda a calidad 0,7. Aquí se
 * reducen a 2000 px de lado y JPEG 0,8, que sigue siendo legible para la IA.
 */
async function shrinkImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bmp = await createImageBitmap(file);
    const max = 2000;
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 2 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    canvas.getContext("2d")?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.8));
    return out ?? file;
  } catch {
    return file;
  }
}

/** Archivo → `{ base64, mime }` listo para `parse-image`. */
export async function fileToScanPayload(file: File): Promise<{ base64: string; mime: string }> {
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  if (!isPdf && !file.type.startsWith("image/")) {
    throw new Error("Sube una imagen o un PDF. Si lo tienes en Word o Excel, expórtalo antes a PDF.");
  }
  const blob = isPdf ? file : await shrinkImage(file);
  if (blob.size > MAX_BYTES) throw new Error("El archivo pesa demasiado (máximo 10 MB).");
  const url = await readAsDataUrl(blob);
  const base64 = url.slice(url.indexOf(",") + 1);
  const mime = isPdf ? "application/pdf" : blob.type || "image/jpeg";
  return { base64, mime };
}

async function callParseImage<T>(
  mode: "ranking" | "calendar",
  base64: string,
  mime: string,
  teamName?: string,
): Promise<T[]> {
  const { data, error } = await supabaseBrowser().functions.invoke<{ items?: T[]; error?: string }>(
    "parse-image",
    { body: { mode, image: base64, mime, team_name: teamName } },
  );
  if (error) throw error;
  if (!data) throw new Error("La lectura no ha devuelto nada. Prueba con otra foto.");
  if (data.error) throw new Error(data.error);
  return data.items ?? [];
}

export const scanRanking = (file: File) =>
  fileToScanPayload(file).then((p) => callParseImage<ScannedPlayer>("ranking", p.base64, p.mime));

export const scanCalendar = (file: File, teamName?: string) =>
  fileToScanPayload(file).then((p) =>
    callParseImage<ScannedMatchday>("calendar", p.base64, p.mime, teamName),
  );

/** «Javier Pérez», «javier perez » y «JAVIER  PEREZ» son el mismo jugador. */
export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

/**
 * Vuelca a la plantilla lo escaneado. No pasa por `guardedWrite`: quien llama
 * lo envuelve.
 */
export async function bulkUpsertPlayers(
  teamId: string,
  scanned: ScannedPlayer[],
  existing: DbPlayer[],
): Promise<{ added: number; updated: number }> {
  const byName = new Map(existing.map((p) => [normalizeName(p.name), p]));
  const seen = new Set<string>();
  let added = 0;
  let updated = 0;
  for (const s of scanned) {
    const name = s.name.trim();
    const key = normalizeName(name);
    // La IA a veces repite una fila: un nombre, una vez.
    if (!name || seen.has(key)) continue;
    seen.add(key);
    const match = byName.get(key);
    if (match) {
      const patch: { pts?: number; position?: string } = { pts: s.pts ?? match.pts };
      if (s.position && s.position !== "Ambos" && s.position !== match.position) {
        patch.position = s.position;
      }
      await updatePlayer(match.id, patch);
      updated++;
    } else {
      await createPlayer(teamId, {
        name,
        pts: s.pts ?? 0,
        position: s.position ?? "Ambos",
      });
      added++;
    }
  }
  return { added, updated };
}
