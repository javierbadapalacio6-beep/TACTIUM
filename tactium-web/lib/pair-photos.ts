"use client";

import { supabaseBrowser } from "./supabase/client";
import { toJpeg } from "./matchday-ops";

/**
 * Fotos por PAREJA de una jornada (además de la general). Réplica de la app
 * (`TACTIUM/src/core/services/pairPhotos.ts`): mismo bucket público `match-photos`, path
 * `{team_id}/{matchday_id}-p{pista}.jpg` y una fila por jornada y pista en `match_pair_photos`.
 * Siempre dentro de `guardedWrite`, como el resto de mutaciones.
 */
const BUCKET = "match-photos";
// La tabla es nueva y aún no está en los tipos generados.
const table = () => (supabaseBrowser() as unknown as { from: (t: string) => any }).from("match_pair_photos");

export async function fetchPairPhotos(matchdayId: string): Promise<Record<number, string>> {
  const { data, error } = await table().select("court_number, photo_url").eq("matchday_id", matchdayId);
  if (error) throw error;
  const out: Record<number, string> = {};
  for (const r of (data ?? []) as { court_number: number; photo_url: string }[]) {
    out[r.court_number] = r.photo_url;
  }
  return out;
}

export async function uploadPairPhoto(
  teamId: string,
  matchdayId: string,
  court: number,
  file: File,
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("El archivo tiene que ser una imagen");
  if (file.size > 15 * 1024 * 1024) throw new Error("La imagen no puede pesar más de 15 MB");
  const sb = supabaseBrowser();
  const path = `${teamId}/${matchdayId}-p${court}.jpg`;
  const jpeg = await toJpeg(file);
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert: true });
  if (upErr) throw upErr;
  const {
    data: { publicUrl },
  } = sb.storage.from(BUCKET).getPublicUrl(path);
  const url = `${publicUrl}?v=${Date.now()}`;
  const { error } = await table().upsert(
    { matchday_id: matchdayId, court_number: court, photo_url: url, updated_at: new Date().toISOString() },
    { onConflict: "matchday_id,court_number" },
  );
  if (error) throw error;
  return url;
}

export async function removePairPhoto(teamId: string, matchdayId: string, court: number): Promise<void> {
  const sb = supabaseBrowser();
  try {
    await sb.storage.from(BUCKET).remove([`${teamId}/${matchdayId}-p${court}.jpg`]);
  } catch {
    /* basura en storage, no es motivo para fallar */
  }
  const { error } = await table().delete().eq("matchday_id", matchdayId).eq("court_number", court);
  if (error) throw error;
}

export interface PairCardInput {
  photoUrl: string;
  playerA: string;
  playerB: string;
  courtLabel: string;
  summary: string;
  won: boolean | null;
  matchLine: string;
  subtitle: string;
  clubLogoUrl?: string | null;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    i.src = src;
  });
}

/** Parte un texto en líneas que quepan en `maxW` (nunca lo recorta con puntos suspensivos). */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * Dibuja la tarjeta de la pareja (1080×1350, formato Instagram 4:5): foto, nombres COMPLETOS, resultado,
 * victoria, marca TACTIUM y el logo del club si lo hay. Devuelve un JPEG listo para compartir o descargar.
 */
export async function renderPairCard(i: PairCardInput): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no puede crear la imagen");

  const img = await loadImage(i.photoUrl);
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const iw = img.naturalWidth * s;
  const ih = img.naturalHeight * s;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);

  const top = ctx.createLinearGradient(0, 0, 0, 280);
  top.addColorStop(0, "rgba(4,10,8,0.6)");
  top.addColorStop(1, "rgba(4,10,8,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, W, 280);
  const bot = ctx.createLinearGradient(0, H - 760, 0, H);
  bot.addColorStop(0, "rgba(4,10,8,0)");
  bot.addColorStop(0.55, "rgba(4,10,8,0.72)");
  bot.addColorStop(1, "rgba(4,10,8,0.96)");
  ctx.fillStyle = bot;
  ctx.fillRect(0, H - 760, W, 760);

  // Marca arriba
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 38px system-ui, -apple-system, Segoe UI, sans-serif";
  ctx.fillText("TACTIUM", 56, 96);
  if (i.clubLogoUrl) {
    try {
      const logo = await loadImage(i.clubLogoUrl);
      const d = 104;
      ctx.save();
      ctx.beginPath();
      ctx.arc(W - 56 - d / 2, 56 + d / 2, d / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.clip();
      ctx.drawImage(logo, W - 56 - d, 56, d, d);
      ctx.restore();
    } catch {
      /* sin logo del club: queda solo TACTIUM */
    }
  }

  // Bloque inferior, de abajo arriba
  let y = H - 60;
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "500 28px ui-monospace, Menlo, monospace";
  ctx.fillText("tactium.io", 56, y);
  y -= 52;
  if (i.subtitle) {
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.font = "500 30px system-ui, -apple-system, Segoe UI, sans-serif";
    ctx.fillText(i.subtitle, 56, y);
    y -= 44;
  }
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "600 34px system-ui, -apple-system, Segoe UI, sans-serif";
  for (const l of wrap(ctx, i.matchLine, W - 112).reverse()) {
    ctx.fillText(l, 56, y);
    y -= 44;
  }
  y -= 10;
  if (i.summary) {
    ctx.fillStyle = "#22E08A";
    ctx.font = "800 54px ui-monospace, Menlo, monospace";
    ctx.fillText(i.summary, 56, y);
    y -= 78;
  }
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "800 70px system-ui, -apple-system, Segoe UI, sans-serif";
  const names = [i.playerB, i.playerA];
  for (const n of names) {
    for (const l of wrap(ctx, n, W - 112).reverse()) {
      ctx.fillText(l, 56, y);
      y -= 78;
    }
  }
  if (i.won != null) {
    const label = `${i.won ? "VICTORIA" : "DERROTA"} · ${i.courtLabel}`;
    ctx.font = "800 32px system-ui, -apple-system, Segoe UI, sans-serif";
    const tw = ctx.measureText(label).width + 48;
    const bh = 58;
    ctx.fillStyle = i.won ? "#22E08A" : "rgba(255,255,255,0.2)";
    ctx.beginPath();
    ctx.roundRect(56, y - bh + 14, tw, bh, bh / 2);
    ctx.fill();
    ctx.fillStyle = i.won ? "#04110B" : "#FFFFFF";
    ctx.fillText(label, 80, y - 14 + 14 - 6);
  }

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo crear la imagen"))), "image/jpeg", 0.92),
  );
}
