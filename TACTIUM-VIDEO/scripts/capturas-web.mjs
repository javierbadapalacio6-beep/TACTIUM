// Capturas móviles de la web (tactium.io) en alta resolución para los reels y carruseles.
// Uso: node scripts/capturas-web.mjs [nombre...]   (sin args = todas)
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const EXE = path.join(os.homedir(), "AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe");
const OUT = "public/web";
// BASE=http://localhost:3000 para capturar algo que aún no está publicado.
const BASE = process.env.BASE ?? "https://tactium.io";
const TORNEO = "/torneos/dd508541-9587-49e5-a09b-e2aa4efe632a";

/** Cada captura: url + acciones (click por texto, scroll hasta texto, scroll px) */
const SHOTS = [
  { name: "torneos-lista", url: "/torneos" },
  { name: "torneos-codigo", url: "/torneos", acts: [{ scrollTo: "Tengo un código" }] },
  { name: "torneo-ficha", url: TORNEO },
  { name: "torneo-cuadro", url: TORNEO, acts: [{ click: "Cuadro" }, { scrollTo: "Cuadro principal", offset: -16 }] },
  { name: "torneo-cuadro-cuartos", url: TORNEO, acts: [{ click: "Cuadro" }, { scrollTo: "Cuartos", offset: -16 }] },
  { name: "torneo-consolacion", url: TORNEO, acts: [{ click: "Cuadro" }, { scrollTo: "Cuadro de consolación", offset: -16 }] },
  { name: "torneo-horario", url: TORNEO, acts: [{ click: "Horario" }, { scrollTo: "Horario", offset: -16 }] },
  { name: "torneo-inscripciones", url: TORNEO, acts: [{ click: "Inscripciones" }, { scrollTo: "Inscripciones", offset: -16 }] },
  { name: "fed-cantabra", url: "/federacion/cantabra", dump: true },
];

const only = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: EXE, headless: true });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  colorScheme: "dark",
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await ctx.newPage();
fs.mkdirSync(OUT, { recursive: true });

const extra = fs.existsSync("scripts/capturas-extra.json") ? JSON.parse(fs.readFileSync("scripts/capturas-extra.json", "utf8")) : [];
for (const s of [...SHOTS, ...extra]) {
  if (only.length && !only.includes(s.name)) continue;
  try {
    await page.goto(BASE + s.url, { waitUntil: "networkidle", timeout: 45000 });
    // En local, Next pinta su botón de desarrollo («N») encima de la página.
    if (BASE.includes("localhost")) await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    await page.waitForTimeout(800);
    for (const a of s.acts ?? []) {
      if (a.click) {
        await page.getByText(a.click, { exact: true }).first().click();
        await page.waitForTimeout(700);
      }
      if (a.clickRole) {
        await page.getByRole(a.clickRole.role, { name: a.clickRole.name }).first().click();
        await page.waitForTimeout(700);
      }
      if (a.type) {
        await page.getByPlaceholder(a.type, { exact: false }).first().fill(a.text);
        await page.waitForTimeout(1500);
      }
      if (a.scrollTo) {
        const off = a.offset ?? 0;
        await page.evaluate(([txt, off]) => {
          const el = [...document.querySelectorAll("h1,h2,h3,h4,p,span,div,button,label,th,td")]
            .find((e) => e.childElementCount === 0 && e.textContent.trim() === txt)
            ?? [...document.querySelectorAll("*")].find((e) => e.textContent.trim().startsWith(txt) && e.childElementCount <= 2);
          if (!el) throw new Error("no encuentro: " + txt);
          el.scrollIntoView({ block: "start", behavior: "instant" });
          // deja sitio a la barra superior fija y corrige con el contenedor que de verdad hace scroll
          let c = el.parentElement;
          while (c && !(c.scrollHeight > c.clientHeight && /(auto|scroll)/.test(getComputedStyle(c).overflowY))) c = c.parentElement;
          (c ?? window).scrollBy(0, -64 + off);
        }, [a.scrollTo, off]);
        await page.waitForTimeout(500);
      }
      if (a.scrollPx) {
        // La página puede hacer scroll en window o en un contenedor con overflow.
        await page.evaluate((y) => {
          const c = [...document.querySelectorAll("*")].find(
            (e) => e.scrollHeight > e.clientHeight + 80 && /(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.clientHeight > 300,
          );
          (c ?? window).scrollBy(0, y);
        }, a.scrollPx);
        await page.waitForTimeout(500);
      }
    }
    await page.screenshot({ path: path.join(OUT, s.name + ".png"), fullPage: !!s.fullPage });
    console.log("ok", s.name);
    if (s.dump) {
      const links = await page.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") + "  ·  " + a.textContent.trim().slice(0, 60)));
      const text = await page.evaluate(() => document.querySelector("main")?.innerText.slice(0, 2500));
      console.log(text); console.log(links.join("\n"));
    }
  } catch (e) {
    console.log("FALLO", s.name, e.message.split("\n")[0]);
  }
}
await browser.close();
