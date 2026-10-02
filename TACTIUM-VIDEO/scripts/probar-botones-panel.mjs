// Prueba de extremo a extremo de los botones que guardan cambios en el panel.
// Hace copia de calendario.json antes y la restaura al terminar, pase lo que pase.
//   node scripts/probar-botones-panel.mjs
import { chromium } from "playwright-core";
import fs from "node:fs"; import path from "node:path"; import os from "node:os";

const CAL = "calendario.json";
const copia = fs.readFileSync(CAL, "utf8");
const EXE = path.join(os.homedir(), "AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe");
const b = await chromium.launch({ executablePath: EXE, headless: true });
const p = await b.newPage({ viewport: { width: 1500, height: 980 } });
const errs = [];
p.on("pageerror", (e) => errs.push("pageerror: " + String(e)));
p.on("response", (r) => { if (r.status() >= 400 && !r.url().includes("favicon")) errs.push(`${r.status()} ${r.url()}`); });
const leer = () => JSON.parse(fs.readFileSync(CAL, "utf8")).piezas;
const pieza = (id) => leer().find((x) => x.id === id);
const ok = (cond, txt) => console.log(cond ? "  OK " : "  MAL", txt);

try {
  await p.goto("http://localhost:4173/", { waitUntil: "networkidle" });
  await p.waitForSelector(".pz");
  await p.waitForFunction(() => !document.body.innerText.includes("Cargando Instagram"), null, { timeout: 30000 });

  console.log("Ficha V1a: cambiar hora y estado");
  await p.getByRole("button", { name: /Abrir la ficha de V1a:/ }).click();
  await p.locator("#hora-V1a").fill("19:30");
  await p.getByRole("button", { name: "Guardar", exact: true }).click();
  await p.waitForTimeout(400);
  ok(pieza("V1a").hora === "19:30", "la hora se guarda en calendario.json");
  await p.getByRole("group", { name: "Estado de la pieza" }).getByRole("button", { name: "Por grabar" }).click();
  await p.waitForTimeout(400);
  ok(pieza("V1a").estado === "grabar", "el estado se guarda");

  console.log("Ficha V1a: al repuesto y vuelta");
  await p.getByRole("button", { name: "Al repuesto" }).click();
  await p.waitForTimeout(400);
  ok(pieza("V1a").fecha === null, "se queda sin fecha (repuesto)");
  await p.locator("#fecha-V1a").fill("2026-10-02");
  await p.locator("#hora-V1a").fill("19:00");
  await p.getByRole("button", { name: "Guardar", exact: true }).click();
  await p.waitForTimeout(400);
  ok(pieza("V1a").fecha === "2026-10-02" && pieza("V1a").semana === 1, "vuelve al calendario con su semana");
  await p.getByRole("button", { name: "Cerrar la ficha" }).click();

  console.log("Ficha V1: vincular y desvincular con Instagram");
  await p.getByRole("button", { name: /Abrir la ficha de V1:/ }).click();
  const opcion = await p.locator("#ig-V1 option").nth(1).getAttribute("value");
  await p.locator("#ig-V1").selectOption(opcion);
  await p.getByRole("button", { name: "Vincular", exact: true }).click();
  await p.waitForTimeout(500);
  ok(pieza("V1").ig === opcion && pieza("V1").estado === "publicado", "vincular guarda la publicación y la marca publicada");
  ok(await p.getByText("Visualizaciones").isVisible(), "la ficha enseña sus cifras reales");
  await p.screenshot({ path: "renders/pub-10-vinculada.png" });
  await p.getByRole("button", { name: "Desvincular" }).click();
  await p.waitForTimeout(400);
  ok(pieza("V1").ig === null, "desvincular la suelta");
  await p.getByRole("button", { name: "Cerrar la ficha" }).click();

  console.log("Otros botones");
  await p.getByRole("button", { name: "Semana siguiente" }).click();
  ok(await p.getByText("El capitán", { exact: true }).isVisible(), "flecha: pasa a la semana 2");
  await p.getByRole("button", { name: /Semana 4, / }).click();
  ok(await p.getByText("Federación y jugador", { exact: true }).isVisible(), "barra de abajo: salta a la semana 4");
  await p.getByRole("button", { name: "Volver a hoy" }).click();
  ok(await p.getByText("Vuelve la liga", { exact: true }).first().isVisible(), "casa: vuelve a la semana de hoy");
  await p.getByRole("button", { name: "Reels", exact: true }).click();
  ok((await p.locator(".pz--story").count()) > 0 && (await p.getByRole("button", { name: /Abrir la ficha de V1:/ }).count()) === 0, "filtro Reels: oculta los reels");
  await p.getByRole("button", { name: "Restablecer filtros" }).click();
  ok((await p.getByRole("button", { name: /Abrir la ficha de V1:/ }).count()) === 1, "restablecer: vuelven a verse");
  await p.getByRole("button", { name: /Próxima subida/ }).click();
  ok(await p.locator(".ficha").isVisible(), "cifra «Próxima subida»: abre su ficha");
  await p.keyboard.press("Escape");
  ok(!(await p.locator(".ficha").isVisible()), "Escape cierra la ficha");
  await p.getByRole("button", { name: "Generar" }).first().click();
  ok(await p.getByRole("dialog", { name: "Generar contenido" }).isVisible(), "Generar abre el modal");
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "Actualizar los datos de Instagram" }).click();
  await p.waitForFunction(() => document.body.innerText.includes("ahora mismo"), null, { timeout: 60000 });
  ok(true, "actualizar Instagram: datos recién leídos");
  await p.getByRole("tab", { name: "Publicado" }).click();
  await p.waitForTimeout(2500);
  const cargadas = await p.locator(".pubcard__img").evaluateAll((xs) => xs.filter((x) => x.naturalWidth > 0).length);
  ok(cargadas > 10, `miniaturas de Instagram cargadas: ${cargadas}`);
  await p.screenshot({ path: "renders/pub-5-publicado.png" });
  await p.getByRole("tab", { name: "Horas" }).click();
  await p.waitForTimeout(400);
  await p.screenshot({ path: "renders/pub-4-horas.png" });
} finally {
  fs.writeFileSync(CAL, copia);
  console.log("calendario.json restaurado ·", fs.readFileSync(CAL, "utf8") === copia ? "idéntico al original" : "DIFERENTE");
  console.log("errores:", errs.length ? errs : "ninguno");
  await b.close();
}
