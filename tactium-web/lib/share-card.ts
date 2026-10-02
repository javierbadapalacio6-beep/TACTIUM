"use client";

import { LOGO_PATHS, LOGO_VIEWBOX } from "@/components/LogoMark";

/**
 * Tarjeta para compartir el resultado de una jornada (1080×1350, 4:5 de
 * Instagram). Se dibuja en el cliente con canvas, inspirada en la
 * `PhotoShareCard` de la app: la foto del partido de fondo con un velo, el
 * marcador en dos filas, el detalle por pistas y la marca TACTIUM.
 *
 * Los colores van fijos y no por token: la imagen sale de la web y tiene que
 * verse igual en modo claro y oscuro (en la app también es oscura a propósito).
 */

export interface ShareCourt {
  court: number;
  pair: string;
  /** «6-3 6-4», «W.O.» o «—». */
  score: string;
  won: boolean | null;
}

export interface ShareCardInput {
  ourName: string;
  opponent: string;
  scoreUs: number;
  scoreThem: number;
  outcome: "win" | "lose" | "draw";
  /** «Jornada 7 · sábado 12 de octubre». */
  subtitle: string;
  /** Nombre de la temporada (opcional, va arriba a la derecha). */
  season?: string | null;
  courts: ShareCourt[];
  photoUrl?: string | null;
}

const W = 1080;
const H = 1350;
const PAD = 72;
const ACCENT = "#00DF82";
const ERROR = "#FF6B6B";
const WARN = "#F5B544";
const BG = "#030F0F";

const OUTCOME_LABEL = { win: "Victoria", lose: "Derrota", draw: "Empate" } as const;

function fontFamilies(): { sans: string; mono: string } {
  let mono = "";
  try {
    mono = getComputedStyle(document.body).getPropertyValue("--font-jetbrains-mono").trim();
  } catch {
    /* sin estilos: fuente del sistema */
  }
  return {
    sans: `Satoshi, ui-sans-serif, system-ui, -apple-system, sans-serif`,
    mono: `${mono ? mono + ", " : ""}"JetBrains Mono", ui-monospace, Menlo, monospace`,
  };
}

async function ensureFonts(sans: string, mono: string) {
  try {
    await Promise.all([
      document.fonts.load(`700 40px ${sans}`),
      document.fonts.load(`500 40px ${sans}`),
      document.fonts.load(`700 40px ${mono}`),
    ]);
  } catch {
    /* si no cargan, el canvas usa la del sistema */
  }
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // El bucket es público y responde con CORS: sin `anonymous` el canvas
    // quedaría «manchado» y no se podría exportar.
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Recorta un texto con «…» hasta que quepa en `max` px. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t.trimEnd() + "…";
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement) {
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const w = img.naturalWidth * s;
  const h = img.naturalHeight * s;
  ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / LOGO_VIEWBOX, size / LOGO_VIEWBOX);
  ctx.fillStyle = ACCENT;
  for (const d of LOGO_PATHS) ctx.fill(new Path2D(d));
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function paint(
  ctx: CanvasRenderingContext2D,
  input: ShareCardInput,
  photo: HTMLImageElement | null,
  f: { sans: string; mono: string },
) {
  // ── Fondo ────────────────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  if (photo) {
    drawCover(ctx, photo);
    // Velo: arriba suave para la marca, abajo denso para el marcador.
    const top = ctx.createLinearGradient(0, 0, 0, 260);
    top.addColorStop(0, "rgba(3,15,15,0.7)");
    top.addColorStop(1, "rgba(3,15,15,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 260);
    const veil = ctx.createLinearGradient(0, H * 0.28, 0, H);
    veil.addColorStop(0, "rgba(3,15,15,0)");
    veil.addColorStop(0.35, "rgba(3,15,15,0.62)");
    veil.addColorStop(0.65, "rgba(3,15,15,0.9)");
    veil.addColorStop(1, "rgba(3,15,15,0.97)");
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);
  } else {
    const glow = ctx.createRadialGradient(W * 0.85, H * 0.12, 0, W * 0.85, H * 0.12, W * 0.95);
    glow.addColorStop(0, "rgba(0,223,130,0.22)");
    glow.addColorStop(1, "rgba(0,223,130,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    // Marca de agua grande y discreta.
    ctx.save();
    ctx.globalAlpha = 0.06;
    drawLogo(ctx, W - 640, 120, 760);
    ctx.restore();
  }

  ctx.textBaseline = "alphabetic";

  // ── Cabecera: marca + temporada ─────────────────────────────────
  drawLogo(ctx, PAD - 10, PAD - 18, 76);
  ctx.fillStyle = "#FFFFFF";
  ctx.font = `700 30px ${f.sans}`;
  ctx.textAlign = "left";
  ctx.fillText("TACTIUM", PAD + 74, PAD + 30);
  if (input.season) {
    ctx.font = `500 26px ${f.sans}`;
    ctx.fillStyle = "rgba(255,255,255,0.72)";
    ctx.textAlign = "right";
    ctx.fillText(fit(ctx, input.season, 460), W - PAD, PAD + 30);
  }

  // ── Bloque inferior, de abajo arriba ────────────────────────────
  let y = H - PAD;

  // Pie: dominio.
  ctx.textAlign = "left";
  ctx.font = `500 24px ${f.mono}`;
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillText("tactium.io", PAD, y);
  y -= 56;

  // Detalle por pistas (máx. 7).
  const courts = input.courts.slice(0, 7);
  const rowH = 54;
  if (courts.length > 0) {
    for (let i = courts.length - 1; i >= 0; i--) {
      const c = courts[i]!;
      ctx.textAlign = "left";
      ctx.font = `700 26px ${f.mono}`;
      ctx.fillStyle = "rgba(255,255,255,0.45)";
      ctx.fillText(`P${c.court}`, PAD, y);

      ctx.textAlign = "right";
      ctx.font = `700 28px ${f.mono}`;
      ctx.fillStyle = c.won == null ? "rgba(255,255,255,0.6)" : c.won ? ACCENT : "rgba(255,255,255,0.85)";
      ctx.fillText(c.score, W - PAD, y);
      const scoreW = ctx.measureText(c.score).width;

      ctx.textAlign = "left";
      ctx.font = `500 28px ${f.sans}`;
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillText(fit(ctx, c.pair, W - PAD * 2 - 80 - scoreW - 24), PAD + 80, y);
      y -= rowH;
    }
    // Filete separador.
    y += 14;
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(PAD, y - 4, W - PAD * 2, 2);
    y -= 44;
  }

  // Resultado (chip).
  const label = OUTCOME_LABEL[input.outcome];
  const tone = input.outcome === "win" ? ACCENT : input.outcome === "lose" ? ERROR : WARN;
  ctx.font = `700 26px ${f.sans}`;
  const chipW = ctx.measureText(label).width + 44;
  roundRect(ctx, PAD, y - 40, chipW, 52, 26);
  ctx.fillStyle =
    input.outcome === "win"
      ? "rgba(0,223,130,0.16)"
      : input.outcome === "lose"
        ? "rgba(255,107,107,0.16)"
        : "rgba(245,181,68,0.16)";
  ctx.fill();
  ctx.fillStyle = tone;
  ctx.textAlign = "left";
  ctx.fillText(label, PAD + 22, y - 5);
  y -= 84;

  // Marcador en dos filas: rival (abajo) y nosotros (arriba).
  const rows: [string, number, boolean][] = [
    [input.ourName, input.scoreUs, true],
    [input.opponent, input.scoreThem, false],
  ];
  for (let i = rows.length - 1; i >= 0; i--) {
    const [name, score, us] = rows[i]!;
    ctx.textAlign = "right";
    ctx.font = `700 96px ${f.mono}`;
    ctx.fillStyle = us ? ACCENT : "rgba(255,255,255,0.88)";
    ctx.fillText(String(score), W - PAD, y);
    const sw = ctx.measureText(String(score)).width;

    ctx.textAlign = "left";
    ctx.font = `700 58px ${f.sans}`;
    ctx.fillStyle = us ? "#FFFFFF" : "rgba(255,255,255,0.82)";
    ctx.fillText(fit(ctx, name, W - PAD * 2 - sw - 40), PAD, y - 10);
    y -= 112;
  }

  // Antetítulo: jornada y fecha.
  ctx.textAlign = "left";
  ctx.font = `500 30px ${f.sans}`;
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.fillText(fit(ctx, input.subtitle, W - PAD * 2), PAD, y + 20);
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), "image/png");
    } catch {
      // Canvas manchado (la foto no trajo CORS): se rehace sin foto.
      resolve(null);
    }
  });
}

/** Genera el PNG de la tarjeta. Si la foto no se puede usar (CORS, 404), la
 *  tarjeta sale igual, sin foto. */
export async function renderShareCard(input: ShareCardInput): Promise<Blob> {
  const f = fontFamilies();
  await ensureFonts(f.sans, f.mono);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Tu navegador no puede generar la imagen");

  const photo = input.photoUrl ? await loadImage(input.photoUrl) : null;
  paint(ctx, input, photo, f);
  let blob = await toBlob(canvas);
  if (!blob && photo) {
    paint(ctx, input, null, f);
    blob = await toBlob(canvas);
  }
  if (!blob) throw new Error("No se pudo generar la imagen");
  return blob;
}

/**
 * Comparte el PNG con la hoja nativa (`navigator.share` con ficheros) si el
 * navegador lo permite; si no, lo descarga. Devuelve qué ha pasado.
 */
export async function shareOrDownload(
  blob: Blob,
  filename: string,
  text: string,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Otro fallo (permiso, gesto caducado…): se cae a la descarga.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return "downloaded";
}
