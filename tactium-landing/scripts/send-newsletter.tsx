/**
 * send-newsletter.tsx — envío de newsletter a toda la lista.
 * Lee scripts/newsletter-content.ts. Mismas protecciones que el blast:
 * dry-run, --to test, rate-limit y log anti-duplicados POR campaña.
 *
 *   npm run newsletter:preview
 *   npm run newsletter:test
 *   npm run newsletter:dry-run
 *   npm run newsletter:send
 */
import { config } from "dotenv";
import { resolve } from "node:path";
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { render } from "@react-email/components";
import { createClient } from "@supabase/supabase-js";
import { Newsletter } from "../lib/email/templates/Newsletter";
import { sendNewsletter } from "../lib/email/send";
import { newsletter } from "./newsletter-content";

config({ path: resolve(process.cwd(), ".env.local") });

const envSite = process.env.NEXT_PUBLIC_SITE_URL ?? "";
const SITE_URL =
  process.env.EMAIL_SITE_URL ??
  (envSite && !envSite.includes("localhost") ? envSite : "https://tactium.io");

const DELAY_MS = 600;
// Log por campaña, para no reenviar la misma newsletter dos veces.
const SENT_LOG = resolve(
  process.cwd(),
  `scripts/.newsletter-${newsletter.campaignId}.log`,
);

const args = process.argv.slice(2);
const isPreview = args.includes("--preview");
const isDryRun = args.includes("--dry-run");
const isTest = args.includes("--test");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadSent(): Set<string> {
  if (!existsSync(SENT_LOG)) return new Set();
  return new Set(
    readFileSync(SENT_LOG, "utf8")
      .split("\n").map((l) => l.trim().toLowerCase()).filter(Boolean),
  );
}
function markSent(email: string) {
  writeFileSync(SENT_LOG, `${email.toLowerCase()}\n`, { flag: "a" });
}

function buildArgs(to: string) {
  return {
    to,
    siteUrl: SITE_URL,
    subject: newsletter.subject,
    preview: newsletter.preview,
    heading: newsletter.heading,
    paragraphs: newsletter.paragraphs,
    ctaLabel: newsletter.ctaLabel || undefined,
    ctaUrl: newsletter.ctaUrl || undefined,
  };
}

async function main() {
  if (isPreview) {
    const html = await render(
      <Newsletter
        to="tu-email@ejemplo.com"
        siteUrl={SITE_URL}
        preview={newsletter.preview}
        heading={newsletter.heading}
        paragraphs={newsletter.paragraphs}
        ctaLabel={newsletter.ctaLabel || undefined}
        ctaUrl={newsletter.ctaUrl || undefined}
      />,
    );
    const out = resolve(process.cwd(), "scripts/newsletter-preview.html");
    writeFileSync(out, html, "utf8");
    console.log(`✓ Preview: ${out}`);
    return;
  }

  if (isTest) {
    console.log(`Enviando TEST a ${newsletter.testTo}`);
    const res = await sendNewsletter(buildArgs(newsletter.testTo));
    console.log(res.ok && !res.skipped ? `✓ Enviado (${res.id})` : `✗ ${res.error ?? "skipped"}`);
    return;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("✗ Falta NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase
    .from("waitlist").select("email").order("created_at", { ascending: true });
  if (error) { console.error("✗", error.message); process.exit(1); }

  const sent = loadSent();
  const all = (data ?? []).map((r) => r.email).filter(Boolean);
  const target = all.filter((e) => !sent.has(e.toLowerCase()));

  console.log(`Campaña:        ${newsletter.campaignId}`);
  console.log(`Asunto:         ${newsletter.subject}`);
  console.log(`Lista total:    ${all.length}`);
  console.log(`Ya enviados:    ${all.length - target.length}`);
  console.log(`A enviar:       ${target.length}`);

  if (isDryRun) {
    console.log("\n— DRY RUN — destinatarios:");
    target.forEach((e) => console.log(`  · ${e}`));
    return;
  }

  console.log("\nEnviando…\n");
  let ok = 0, fail = 0;
  for (const email of target) {
    const res = await sendNewsletter(buildArgs(email));
    if (res.ok && !res.skipped) { markSent(email); ok++; console.log(`  ✓ ${email}`); }
    else if (res.skipped) console.log(`  ⚠ skipped: ${email}`);
    else { fail++; console.error(`  ✗ ${email} — ${res.error}`); }
    await sleep(DELAY_MS);
  }
  console.log(`\nHecho. Enviados: ${ok} · Fallidos: ${fail}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
