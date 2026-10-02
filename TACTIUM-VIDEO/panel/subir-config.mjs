// Sube a Supabase la conexión con Instagram del panel local (token, cuenta y caducidad),
// para que la función de la nube pueda publicar. Se ejecuta una vez, o tras volver a autorizar.
//   node panel/subir-config.mjs
import fs from "node:fs";
import path from "node:path";
import * as nube from "./nube.mjs";

const env = Object.fromEntries(fs.readFileSync(path.join(import.meta.dirname, ".env"), "utf8").split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
await nube.subirConfigInstagram(env);
const t = await nube.tokenNube();
console.log("Conexión con Instagram en la nube: token", t.ig_token === env.IG_ACCESS_TOKEN ? "igual al local" : "DISTINTO", "· caduca", new Date(Number(t.ig_token_caduca)).toISOString().slice(0, 10));
