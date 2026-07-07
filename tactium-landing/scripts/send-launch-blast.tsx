/**
 * send-launch-blast.tsx
 * ─────────────────────────────────────────────────────────────────────────
 * Envío masivo del email de LANZAMIENTO iOS a toda la waitlist.
 *
 * Lee la tabla `waitlist` de Supabase y manda el email `LaunchIOS` a cada
 * dirección, en lotes, con rate-limit y un log local para NO reenviar a
 * quien ya recibió (idempotente entre ejecuciones).
 *
 * USO (desde tactium-landing/):
 *   npm run email:preview                                   # genera launch-preview.html
 *   npm run email:dry-run                                   # lista destinatarios, NO envía
 *   npx tsx scripts/send-launch-blast.tsx --limit 5         # envía SOLO a los 5 primeros
 *   npm run email:launch                                    # envío real a toda la lista
 *
 * Requiere en .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY,
 *   EMAIL_FROM
 * Y la constante APP_STORE_URL (o env APP_STORE_URL) con el link real.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { render } from "@react-email/components";
import { createClient } from "@supabase/supabase-js";
import { LaunchIOS } from "../lib/email/templates/LaunchIOS";
import { sendLaunchIOS, sendLaunchIOSPlain } from "../lib/email/send";

// Carga .env.local (Next no lo inyecta en scripts sueltos).
config({ path: resolve(process.cwd(), ".env.local") });

// ⚠️ PEGA AQUÍ el link real de la ficha de App Store (numeric App ID).
// Ejemplo: https://apps.apple.com/es/app/tactium/id6740000000
const APP_STORE_URL =
  process.env.APP_STORE_URL ?? "https://apps.apple.com/es/app/tactium/id6769825905";

// URL pública desde la que se cargan las imágenes del email (logo). DEBE
// ser el dominio de producción — si es localhost, el logo saldría roto en
// las bandejas. Si NEXT_PUBLIC_SITE_URL apunta a localhost (config de dev),
// caemos a tactium.io. Puedes forzar otra con EMAIL_SITE_URL.
const envSite = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const SITE_URL =
  process.env.EMAIL_SITE_URL ??
  (envSite && !envSite.includes("localhost") ? envSite : "https://tactium.io");

// Resend free: ~2 req/s. Dejamos un margen cómodo entre envíos.
const DELAY_MS = 600;
// Log de envíos para idempotencia entre ejecuciones.
const SENT_LOG = resolve(process.cwd(), "scripts/.launch-sent.log");

const args = process.argv.slice(2);
const isPreview = args.includes("--preview");
const isDryRun = args.includes("--dry-run");
const limitArg = args.indexOf("--limit");
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : Infinity;
const toArg = args.indexOf("--to");
const singleTo = toArg !== -1 ? args[toArg + 1] : null;
const usePlain = args.includes("--plain");
const sendEmail = usePlain ? sendLaunchIOSPlain : sendLaunchIOS;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadSent(): Set<string> {
  if (!existsSync(SENT_LOG)) return new Set();
  return new Set(
    readFileSync(SENT_LOG, "utf8")
      .split("\n")
      .map((l) => l.trim().toLowerCase())
      .filter(Boolean),
  );
}

function markSent(email: string) {
  writeFileSync(SENT_LOG, `${email.toLowerCase()}\n`, { flag: "a" });
}

async function main() {
  // ── Modo PREVIEW: renderiza el email a un HTML local y termina ──────────
  if (isPreview) {
    const html = await render(
      <LaunchIOS
        to="tu-email@ejemplo.com"
        siteUrl={SITE_URL}
        appStoreUrl={APP_STORE_URL}
      />,
    );
    const out = resolve(process.cwd(), "scripts/launch-preview.html");
    writeFileSync(out, html, "utf8");
    console.log(`✓ Preview generado: ${out}`);
    console.log(`  siteUrl usado: ${SITE_URL}`);
    return;
  }

  // ── Modo TEST (--to email): manda UN email a esa dirección y termina.
  // No toca Supabase ni el log de enviados — solo para previsualizar en
  // bandeja real antes del envío masivo.
  if (singleTo) {
    console.log(`Enviando email de prueba a: ${singleTo}`);
    console.log(`App Store URL: ${APP_STORE_URL}`);
    console.log(`siteUrl (assets): ${SITE_URL}`);
    const res = await sendEmail({
      to: singleTo,
      siteUrl: SITE_URL,
      appStoreUrl: APP_STORE_URL,
    });
    if (res.ok && !res.skipped) console.log(`✓ Enviado (id: ${res.id})`);
    else if (res.skipped) console.log("⚠ skipped — falta RESEND_API_KEY");
    else console.error(`✗ Fallo: ${res.error}`);
    return;
  }

  // ── Conexión a Supabase con service role (solo server) ──────────────────
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error(
      "✗ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local",
    );
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data, error } = await supabase
    .from("waitlist")
    .select("email")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("✗ Error leyendo waitlist:", error.message);
    process.exit(1);
  }

  const sent = loadSent();
  const all = (data ?? []).map((r) => r.email).filter(Boolean);
  const pending = all.filter((e) => !sent.has(e.toLowerCase()));
  const target = pending.slice(0, limit);

  console.log(`Waitlist total:      ${all.length}`);
  console.log(`Ya enviados (log):   ${all.length - pending.length}`);
  console.log(`Pendientes:          ${pending.length}`);
  console.log(`A enviar esta vez:   ${target.length}`);
  console.log(`App Store URL:       ${APP_STORE_URL}`);
  console.log(`siteUrl (assets):    ${SITE_URL}`);
  console.log(`Remitente:           ${process.env.EMAIL_FROM ?? "(default)"}`);

  if (APP_STORE_URL.includes("PENDIENTE")) {
    console.error(
      "\n✗ APP_STORE_URL no configurada. Pega el link real antes de enviar.",
    );
    process.exit(1);
  }

  if (isDryRun) {
    console.log("\n— DRY RUN — no se envía nada. Destinatarios:");
    target.forEach((e) => console.log(`  · ${e}`));
    return;
  }

  console.log("\nEnviando…\n");
  let ok = 0;
  let fail = 0;
  for (const email of target) {
    const res = await sendEmail({
      to: email,
      siteUrl: SITE_URL,
      appStoreUrl: APP_STORE_URL,
    });
    if (res.ok && !res.skipped) {
      markSent(email);
      ok++;
      console.log(`  ✓ ${email}`);
    } else if (res.skipped) {
      console.log(`  ⚠ skipped (sin RESEND_API_KEY): ${email}`);
    } else {
      fail++;
      console.error(`  ✗ ${email} — ${res.error}`);
    }
    await sleep(DELAY_MS);
  }

  console.log(`\nHecho. Enviados: ${ok} · Fallidos: ${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
