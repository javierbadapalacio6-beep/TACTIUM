// Genera una imagen con Gemini. Uso: node scripts/gen-foto.mjs public/gen/nombre.png "prompt" [4:5|9:16|16:9]
import fs from "node:fs";
const [,, out, prompt, aspect = "4:5"] = process.argv;
const key = process.env.GEMINI_API_KEY;
const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${key}`;
const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } } };
const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const j = await r.json();
const part = j?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
if (!part) { console.error(JSON.stringify(j).slice(0, 800)); process.exit(1); }
fs.writeFileSync(out, Buffer.from(part.inlineData.data, "base64"));
console.log("ok", out, part.inlineData.mimeType);
