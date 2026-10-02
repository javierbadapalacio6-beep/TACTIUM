// Vídeo de la memoria técnica del Trabajo Final (Racks Academy), 16:9.
// Voz: memoria/guion.json → public/voz/ia/memoria/*.mp3 (scripts/gen-voz.mjs).
// Tiempos: src/memoria-duraciones.json (ffprobe) y src/reel/palabras/memoria-*.json (Whisper),
// así cada elemento entra cuando la voz lo nombra.
import React from "react";
import {
  AbsoluteFill,
  Audio,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import DUR from "../memoria-duraciones.json";
import { PALABRAS } from "../reel/palabras";
import { C, F } from "../theme";
import { Background, Card, Chip, Eyebrow, Frame, H1, Phone, Sub, useEnter, usePop, Wordmark } from "../ui";

export const FPS = 30;
const LEAD = 0.4; // s de aire antes de la voz
const TAIL = 0.9; // s de aire después

type Id = keyof typeof DUR;
const BLOQUES: { id: Id; seccion: string }[] = [
  { id: "01-intro", seccion: "Memoria técnica" },
  { id: "02-problema", seccion: "01 · El problema" },
  { id: "03-solucion", seccion: "01 · La solución" },
  { id: "04-impacto", seccion: "01 · Impacto" },
  { id: "05-ia-construir", seccion: "02 · Herramientas de IA" },
  { id: "06-ia-producto", seccion: "02 · Herramientas de IA" },
  { id: "07-ia-marketing", seccion: "02 · Herramientas de IA" },
  { id: "08-proceso", seccion: "03 · Proceso y métricas" },
  { id: "09-arquitectura", seccion: "03 · Proceso y métricas" },
  { id: "10-modulos", seccion: "04 · Módulos del curso" },
  { id: "11-lecciones", seccion: "05 · Lecciones" },
  { id: "12-cierre", seccion: "05 · Conclusión" },
];

const framesDe = (id: Id) => Math.round((DUR[id] + LEAD + TAIL) * FPS);
export const durMemoria = () => BLOQUES.reduce((a, b) => a + framesDe(b.id), 0);

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9%.]/g, "").replace(/\.$/, "");

// Frame (relativo al bloque) en el que la voz dice `palabra` (n-ésima aparición).
const cue = (id: Id, palabra: string, n = 1): number => {
  const ws = PALABRAS[`memoria-${id}`]?.palabras ?? [];
  const p = norm(palabra);
  let k = 0;
  for (const w of ws) {
    if (norm(w.t).startsWith(p) && ++k === n) return Math.round((w.a / 1000 + LEAD) * FPS);
  }
  console.warn(`cue no encontrada: ${id} · ${palabra}`);
  return Math.round(LEAD * FPS);
};

// ---------- piezas propias ----------

const Contador: React.FC<{ valor: number; delay: number; size?: number; sufijo?: string; color?: string }> = ({
  valor, delay, size = 120, sufijo = "", color = C.green,
}) => {
  const frame = useCurrentFrame();
  const t = interpolate(frame - delay, [0, 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const v = Math.round(valor * (1 - Math.pow(1 - t, 3)));
  const st = usePop(delay);
  return (
    <div style={{ ...st, fontFamily: F.sans, fontWeight: 900, fontSize: size, lineHeight: 1, color, letterSpacing: -2 }}>
      {v.toLocaleString("es-ES")}
      {sufijo}
    </div>
  );
};

const Dato: React.FC<{ valor: number; label: string; delay: number; sufijo?: string; texto?: string }> = ({
  valor, label, delay, sufijo, texto,
}) => {
  const pop = usePop(delay);
  return (
  <Card delay={delay} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
    {texto ? (
      <div style={{ ...pop, fontFamily: F.sans, fontWeight: 900, fontSize: 104, lineHeight: 1, color: C.green }}>{texto}</div>
    ) : (
      <Contador valor={valor} delay={delay} size={104} sufijo={sufijo} />
    )}
    <div style={{ fontFamily: F.sans, fontSize: 30, color: C.n80, lineHeight: 1.3 }}>{label}</div>
  </Card>
  );
};

const Fila: React.FC<{ delay: number; izq: string; der: string; tag?: string }> = ({ delay, izq, der, tag }) => {
  const st = useEnter(delay, 24);
  return (
    <div style={{ ...st, display: "flex", alignItems: "center", gap: 28, padding: "18px 0", borderTop: `1px solid ${C.n40}` }}>
      {tag ? <div style={{ fontFamily: F.mono, fontSize: 24, color: C.green, width: 150 }}>{tag}</div> : null}
      <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 36, color: C.ink, width: 560 }}>{izq}</div>
      <div style={{ fontFamily: F.sans, fontSize: 30, color: C.n80, flex: 1, lineHeight: 1.35 }}>{der}</div>
    </div>
  );
};

const Caja: React.FC<{ x: number; y: number; w: number; h: number; t: string; s: string; delay: number; hi?: boolean }> = ({
  x, y, w, h, t, s, delay, hi,
}) => {
  const st = usePop(delay);
  return (
    <div
      style={{
        ...st, position: "absolute", left: x, top: y, width: w, height: h, boxSizing: "border-box",
        background: hi ? "rgba(0,223,130,0.08)" : "rgba(16,35,34,0.9)", border: `2px solid ${hi ? C.green : C.n40}`,
        borderRadius: 20, padding: "18px 26px", display: "flex", flexDirection: "column", justifyContent: hi ? "flex-start" : "center", gap: 6,
      }}
    >
      <div style={{ fontFamily: F.sans, fontWeight: 900, fontSize: 34, color: C.ink }}>{t}</div>
      <div style={{ fontFamily: F.sans, fontSize: 26, color: C.n80, lineHeight: 1.3 }}>{s}</div>
    </div>
  );
};

const Linea: React.FC<{ x1: number; y1: number; x2: number; y2: number; delay: number }> = ({ x1, y1, x2, y2, delay }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame - delay, [0, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <svg style={{ position: "absolute", left: 0, top: 0 }} width={1920} height={1080}>
      <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * p} y2={y1 + (y2 - y1) * p} stroke={C.green} strokeWidth={3} />
      {p > 0.98 ? <circle cx={x2} cy={y2} r={7} fill={C.green} /> : null}
    </svg>
  );
};

const Flecha: React.FC<{ delay: number }> = ({ delay }) => (
  <div style={{ ...usePop(delay), fontFamily: F.mono, fontSize: 48, color: C.green }}>→</div>
);

// ---------- escenas ----------

const S01: React.FC = () => {
  const id = "01-intro";
  return (
    <Frame style={{ justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 80 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 36 }}>
          <div style={useEnter(cue(id, "TACTIUM"))}><Wordmark size={170} /></div>
          <Sub delay={cue(id, "plataforma")} size={46}>La plataforma del pádel por equipos y de competición</Sub>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Chip delay={cue(id, "trabajo")} accent>Trabajo Final</Chip>
            <Chip delay={cue(id, "especialista")}>Especialista en Programación con IA</Chip>
            <Chip delay={cue(id, "academy")}>Racks Academy</Chip>
          </div>
          <Eyebrow delay={cue(id, "memoria")}>Memoria técnica · Javier Bada Palacio · octubre 2026</Eyebrow>
        </div>
        <Phone src="app/inicio-capitan.png" width={380} delay={cue(id, "plataforma")} tilt={-4} />
      </div>
    </Frame>
  );
};

const S02: React.FC = () => {
  const id = "02-problema";
  const frame = useCurrentFrame();
  return (
    <>
      <AbsoluteFill style={{ left: 1060, opacity: interpolate(frame, [0, 30], [0, 0.45], { extrapolateRight: "clamp" }) }}>
        <Img src={staticFile("gen/capitan-libreta.png")} style={{ width: 860, height: 1080, objectFit: "cover" }} />
        <AbsoluteFill style={{ background: `linear-gradient(90deg, ${C.bg} 0%, rgba(3,15,15,0) 60%)` }} />
      </AbsoluteFill>
      <Frame style={{ gap: 40 }}>
        <Eyebrow>01 · El problema</Eyebrow>
        <H1 delay={cue(id, "whatsapp")} size={84}>WhatsApp, Excel<br />y la web de la federación</H1>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, width: 1180 }}>
          <Card delay={cue(id, "alinear")}><div style={{ fontFamily: F.mono, fontSize: 24, color: C.green }}>CAPITÁN</div><div style={{ fontFamily: F.sans, fontSize: 34, color: C.ink, marginTop: 10 }}>Las parejas que exige su federación y liga, ordenadas por sus reglas de puntos</div></Card>
          <Card delay={cue(id, "jugador")}><div style={{ fontFamily: F.mono, fontSize: 24, color: C.green }}>JUGADOR</div><div style={{ fontFamily: F.sans, fontSize: 34, color: C.ink, marginTop: 10 }}>¿Estoy convocado?</div></Card>
          <Card delay={cue(id, "club")}><div style={{ fontFamily: F.mono, fontSize: 24, color: C.green }}>CLUB</div><div style={{ fontFamily: F.sans, fontSize: 34, color: C.ink, marginTop: 10 }}>Torneos en hojas de cálculo</div></Card>
          <Card delay={cue(id, "datos")}><div style={{ fontFamily: F.mono, fontSize: 24, color: C.green }}>FEDERACIÓN</div><div style={{ fontFamily: F.sans, fontSize: 34, color: C.ink, marginTop: 10 }}>Datos oficiales dispersos</div></Card>
        </div>
      </Frame>
    </>
  );
};

const PhoneLabel: React.FC<{ src: string; label: string; delay: number; phase: number }> = ({ src, label, delay, phase }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
    <Phone src={src} width={250} delay={delay} floatPhase={phase} />
    <div style={{ ...useEnter(delay + 6, 12), fontFamily: F.mono, fontSize: 26, color: C.green, textTransform: "uppercase", letterSpacing: 3 }}>{label}</div>
  </div>
);

const S03: React.FC = () => {
  const id = "03-solucion";
  return (
    <Frame style={{ gap: 36 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Eyebrow>01 · La solución</Eyebrow>
          <H1 delay={4} size={76}>Todo en una sola herramienta</H1>
          <div><Chip delay={cue(id, "ajusta")} accent>Nº de parejas y orden por puntos según tu federación y liga</Chip></div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          <Chip delay={cue(id, "ios")}>iOS</Chip>
          <Chip delay={cue(id, "android")}>Android</Chip>
          <Chip delay={cue(id, "web")} accent>tactium.io</Chip>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <PhoneLabel src="app/inicio-capitan.png" label="Capitán" delay={cue(id, "capitan")} phase={0} />
        <PhoneLabel src="app/disponibilidad.png" label="Disponibilidad" delay={cue(id, "disponible")} phase={30} />
        <PhoneLabel src="app/equipo.png" label="Jugador" delay={cue(id, "jugador")} phase={60} />
        <PhoneLabel src="app/torneos-explorar.png" label="Club · torneos" delay={cue(id, "club")} phase={90} />
        <PhoneLabel src="app/fed-ranking.png" label="Federación" delay={cue(id, "federacion", 2)} phase={120} />
      </div>
    </Frame>
  );
};

const S04: React.FC = () => {
  const id = "04-impacto";
  const bloque = (titulo: string, texto: string, d: number) => (
    <Card delay={d} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontFamily: F.sans, fontWeight: 900, fontSize: 44, color: C.ink, lineHeight: 1.15 }}>{titulo}</div>
      <div style={{ fontFamily: F.sans, fontSize: 28, color: C.n80, lineHeight: 1.35 }}>{texto}</div>
    </Card>
  );
  return (
    <Frame style={{ gap: 34 }}>
      <Eyebrow>01 · Impacto actual · 02-10-2026</Eyebrow>
      <H1 delay={cue(id, "piloto")} size={72}>En producción, en fase piloto</H1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 26 }}>
        {bloque("Piloto con un club de Cantabria", "primer cliente, trabajo día a día", cue(id, "trabajando"))}
        {bloque("Primeros usuarios reales", "y alguna suscripción de pago", cue(id, "primeros"))}
        <Dato valor={33428} label="jugadores federados integrados" delay={cue(id, "33")} />
      </div>
      <div style={{ ...useEnter(cue(id, "aclaracion")), display: "flex", flexDirection: "column", gap: 10, padding: "26px 32px", borderLeft: `6px solid ${C.green}`, background: "rgba(16,35,34,0.85)", borderRadius: 16 }}>
        <div style={{ fontFamily: F.mono, fontSize: 24, color: C.green, letterSpacing: 3 }}>TRANSPARENCIA</div>
        <div style={{ fontFamily: F.sans, fontSize: 34, color: C.ink, lineHeight: 1.35 }}>
          Muchas cuentas, clubes y equipos de la base de datos son <b>de prueba o de demostración</b>.
        </div>
        <div style={{ ...useEnter(cue(id, "punta")), fontFamily: F.sans, fontSize: 30, color: C.n80 }}>Prueban que todo funciona de punta a punta, no son tracción comercial.</div>
      </div>
    </Frame>
  );
};

const S05: React.FC = () => {
  const id = "05-ia-construir";
  return (
    <Frame style={{ gap: 36 }}>
      <Eyebrow>02 · IA para construir · nivel 1 de 3</Eyebrow>
      <div style={{ display: "flex", gap: 80, alignItems: "flex-start" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Chip delay={cue(id, "bolt")}>Bolt</Chip>
            <Chip delay={cue(id, "cursor")}>Cursor</Chip>
            <Flecha delay={cue(id, "construye")} />
            <Chip delay={cue(id, "construye")} accent>Claude Code · agente principal</Chip>
          </div>
          <div style={{ ...useEnter(cue(id, "mcp")), display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontFamily: F.mono, fontSize: 24, color: C.n80 }}>CONECTADO POR MCP A</div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {["Supabase", "Playwright", "Figma", "Stripe"].map((t, i) => (
                <Chip key={t} delay={cue(id, "mcp") + 6 + i * 5}>{t}</Chip>
              ))}
            </div>
          </div>
          <Card delay={cue(id, "70")} style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <Contador valor={70} delay={cue(id, "70")} size={84} sufijo="" />
            <div style={{ fontFamily: F.sans, fontSize: 32, color: C.ink }}>skills y subagentes propios</div>
          </Card>
          <Card delay={cue(id, "memoria")} style={{ display: "flex", gap: 24, alignItems: "center" }}>
            <Contador valor={117} delay={cue(id, "memoria")} size={84} />
            <div style={{ fontFamily: F.sans, fontSize: 32, color: C.ink }}>notas de memoria persistente</div>
          </Card>
        </div>
        <div style={{ width: 620, display: "flex", flexDirection: "column", gap: 16, paddingTop: 40 }}>
          <Contador valor={92} delay={cue(id, "92")} size={260} sufijo="%" />
          <Sub delay={cue(id, "92") + 8} size={36}>de los commits (473 de 516) coescritos con Claude Code</Sub>
        </div>
      </div>
    </Frame>
  );
};

const S06: React.FC = () => {
  const id = "06-ia-producto";
  const paso = (t: string, d: number, hi = false) => (
    <div style={{ ...usePop(d), padding: "22px 30px", borderRadius: 18, border: `2px solid ${hi ? C.green : C.n40}`, background: hi ? "rgba(0,223,130,0.08)" : "rgba(16,35,34,0.9)", fontFamily: F.sans, fontWeight: 700, fontSize: 34, color: C.ink }}>{t}</div>
  );
  return (
    <Frame style={{ gap: 36 }}>
      <Eyebrow>02 · IA dentro del producto · nivel 2 de 3</Eyebrow>
      <div style={{ display: "flex", gap: 70 }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 40 }}>
          <H1 delay={cue(id, "escaner")} size={72}>Escáner con Gemini</H1>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            {paso("Foto o PDF", cue(id, "foto"))}
            <Flecha delay={cue(id, "foto") + 6} />
            {paso("Gemini 2.5 Flash", cue(id, "ranking"), true)}
            <Flecha delay={cue(id, "plantilla") - 4} />
            {paso("Plantilla · jornadas", cue(id, "plantilla"))}
          </div>
          <div><Chip delay={cue(id, "tabla")} accent>Entiende tablas cruzadas local × visitante</Chip></div>
          <Card delay={cue(id, "investigacion")} style={{ marginTop: 20 }}>
            <div style={{ fontFamily: F.mono, fontSize: 24, color: C.green }}>I+D · TACTIUM AI</div>
            <div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 38, color: C.ink, marginTop: 10 }}>Sigue a los 4 jugadores en un vídeo de pádel</div>
            <div style={{ fontFamily: F.sans, fontSize: 28, color: C.n80, marginTop: 8 }}>YOLO11 + homografía + re-identificación propia</div>
          </Card>
        </div>
        <Phone src="app/equipo.png" width={360} delay={cue(id, "plantilla")} tilt={3} />
      </div>
    </Frame>
  );
};

const S07: React.FC = () => {
  const id = "07-ia-marketing";
  const frame = useCurrentFrame();
  const dH = cue(id, "horizontales");
  const bar = (w: number, d: number) => interpolate(frame - d, [0, 20], [0, w], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <Frame style={{ gap: 36 }}>
      <Eyebrow>02 · IA para salir al mercado · nivel 3 de 3</Eyebrow>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 22 }}>
        {[["Remotion", "reels hechos con código", "remotion"], ["Whisper", "subtítulos palabra a palabra", "whisper"], ["ElevenLabs", "voces en off", "eleven"], ["Gemini", "imágenes generadas", "gemini"]].map(([t, s, c]) => (
          <Card key={t} delay={cue(id, c)}>
            <div style={{ fontFamily: F.sans, fontWeight: 900, fontSize: 40, color: C.ink }}>{t}</div>
            <div style={{ fontFamily: F.sans, fontSize: 28, color: C.n80, marginTop: 8 }}>{s}</div>
          </Card>
        ))}
      </div>
      <div><Chip delay={cue(id, "panel")} accent>Panel propio · publica en Instagram</Chip></div>
      <div style={{ ...useEnter(dH), display: "flex", flexDirection: "column", gap: 22, marginTop: 10 }}>
        <div style={{ fontFamily: F.mono, fontSize: 24, color: C.n80 }}>TIEMPO DE VISIONADO DE LOS REELS</div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 200, fontFamily: F.sans, fontSize: 32, color: C.n80 }}>Horizontal</div>
          <div style={{ height: 44, width: bar(560, dH), background: C.n40, borderRadius: 10 }} />
          <div style={{ fontFamily: F.mono, fontSize: 28, color: C.n80 }}>la mitad</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 200, fontFamily: F.sans, fontSize: 32, color: C.ink }}>Vertical</div>
          <div style={{ height: 44, width: bar(1120, dH + 24), background: C.green, borderRadius: 10 }} />
        </div>
      </div>
    </Frame>
  );
};

const S08: React.FC = () => {
  const id = "08-proceso";
  return (
    <Frame style={{ gap: 40 }}>
      <Eyebrow>03 · Proceso y métricas</Eyebrow>
      <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
        <Card delay={cue(id, "11")}><div style={{ fontFamily: F.mono, fontSize: 26, color: C.green }}>11-05-2026</div><div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 34, color: C.ink, marginTop: 6 }}>Primer commit</div></Card>
        <Flecha delay={cue(id, "seis")} />
        <Card delay={cue(id, "seis")}><div style={{ fontFamily: F.mono, fontSize: 26, color: C.green }}>+6 SEMANAS</div><div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 34, color: C.ink, marginTop: 6 }}>1.0 en App Store y Google Play</div></Card>
        <Flecha delay={cue(id, "cinco")} />
        <Card delay={cue(id, "cinco")}><div style={{ fontFamily: F.mono, fontSize: 26, color: C.green }}>5 MESES</div><div style={{ fontFamily: F.sans, fontWeight: 700, fontSize: 34, color: C.ink, marginTop: 6 }}>Plataforma completa</div></Card>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24 }}>
        <Dato valor={516} label="commits" delay={cue(id, "516")} />
        <Dato valor={50} label="pantallas en la app" delay={cue(id, "50")} />
        <Dato valor={53} label="páginas web" delay={cue(id, "53")} />
        <Dato valor={51} label="tablas PostgreSQL" delay={cue(id, "51", 2)} />
        <Dato valor={109} label="políticas de seguridad RLS" delay={cue(id, "109")} />
        <Dato valor={0} texto="1.4.2" label="versión publicada" delay={cue(id, "version")} />
      </div>
    </Frame>
  );
};

const S09: React.FC = () => {
  const id = "09-arquitectura";
  const dApp = cue(id, "app"), dSb = cue(id, "backend"), dRls = cue(id, "fila"), dRc = cue(id, "compras"), dSt = cue(id, "stripe");
  return (
    <AbsoluteFill>
      <Frame><Eyebrow>03 · Arquitectura</Eyebrow><div style={{ height: 24 }} /><H1 delay={4} size={68}>Un backend, dos superficies</H1></Frame>
      <Caja x={110} y={400} w={460} h={150} t="App iOS · Android" s="Expo + React Native" delay={dApp} />
      <Caja x={110} y={640} w={460} h={150} t="Web tactium.io" s="Next.js · Vercel" delay={cue(id, "web")} />
      <Caja x={730} y={380} w={560} h={430} t="Supabase" s="PostgreSQL 17 · Auth · Storage · RPC · Edge Functions" delay={dSb} hi />
      <div style={{ ...usePop(dRls), position: "absolute", left: 770, top: 720, width: 480 }}><Chip accent>Seguridad a nivel de fila (RLS)</Chip></div>
      <Caja x={1450} y={400} w={360} h={150} t="RevenueCat" s="compras en el móvil" delay={dRc} />
      <Caja x={1450} y={640} w={360} h={150} t="Stripe + Connect" s="web y torneos" delay={dSt} />
      <Linea x1={570} y1={475} x2={730} y2={475} delay={dSb + 4} />
      <Linea x1={570} y1={715} x2={730} y2={715} delay={dSb + 8} />
      <Linea x1={1450} y1={475} x2={1290} y2={475} delay={dRc + 4} />
      <Linea x1={1450} y1={715} x2={1290} y2={715} delay={dSt + 4} />
    </AbsoluteFill>
  );
};

const S10: React.FC = () => {
  const id = "10-modulos";
  return (
    <Frame style={{ gap: 26 }}>
      <Eyebrow>04 · Vinculación con los módulos del curso</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <Fila delay={cue(id, "mvp")} tag="M1–M3" izq="Mentalidad y herramientas" der="MVP primero · Bolt y Cursor → Claude Code · Git" />
        <Fila delay={cue(id, "front")} tag="M4–M6" izq="Frontend del MVP" der="Next.js con rutas protegidas · app en Expo" />
        <Fila delay={cue(id, "back")} tag="M7–M11" izq="Backend, base de datos, auth" der="Supabase · RPC · 109 políticas RLS · JWT" />
        <Fila delay={cue(id, "integracion")} tag="M12–M13" izq="Integración" der="MCP · Playwright · emails con Resend · fuera los mocks" />
        <Fila delay={cue(id, "pagos")} tag="M14" izq="Plataforma de pago" der="Stripe Checkout + Connect · RevenueCat" />
        <Fila delay={cue(id, "despliegue")} tag="M15–M16" izq="Build y deploy" der="Vercel · dominio y SSL · EAS · OTA" />
        <Fila delay={cue(id, "go")} tag="GTM" izq="Go to Market" der="ICPs · prueba gratuita de 14 días · Instagram · clubes" />
      </div>
    </Frame>
  );
};

const S11: React.FC = () => {
  const id = "11-lecciones";
  const L: [string, string, string][] = [
    ["verificar", "Verificar siempre", "una herramienta puede decir «enviado» sin que sea verdad"],
    ["memoria", "La memoria es la ventaja", "decisiones y errores que la IA recupera"],
    ["seguridad", "Seguridad desde la base de datos", "RLS y RPC; los secretos, fuera del código"],
    ["tiendas", "Las tiendas mandan", "reglas de Apple y Google sobre pagos y paywall"],
    ["inflar", "No inflar el impacto", "primero una federación bien hecha"],
  ];
  return (
    <Frame style={{ gap: 30 }}>
      <Eyebrow>05 · Lecciones aprendidas</Eyebrow>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {L.map(([c, a, b], i) => (
          <Fila key={c} delay={cue(id, c)} tag={`0${i + 1}`} izq={a} der={b} />
        ))}
      </div>
    </Frame>
  );
};

const S12: React.FC = () => {
  const id = "12-cierre";
  return (
    <Frame style={{ justifyContent: "center", gap: 40 }}>
      <Sub delay={cue(id, "con")} size={44}>Con IA, una sola persona ha construido y lanzado una plataforma completa.</Sub>
      <H1 delay={cue(id, "sustituye")} size={110}>La IA no sustituye al criterio.</H1>
      <H1 delay={cue(id, "multiplica")} size={110} color={C.green}>Lo multiplica.</H1>
      <div style={{ ...useEnter(cue(id, "tactium")), display: "flex", alignItems: "center", gap: 40, marginTop: 30 }}>
        <Wordmark size={90} />
        <div style={{ fontFamily: F.mono, fontSize: 40, color: C.green }}>tactium.io</div>
      </div>
    </Frame>
  );
};

const ESCENAS: Record<Id, React.FC> = {
  "01-intro": S01, "02-problema": S02, "03-solucion": S03, "04-impacto": S04,
  "05-ia-construir": S05, "06-ia-producto": S06, "07-ia-marketing": S07, "08-proceso": S08,
  "09-arquitectura": S09, "10-modulos": S10, "11-lecciones": S11, "12-cierre": S12,
};

// Fundido de entrada y salida de cada bloque.
const Fundido: React.FC<{ dur: number; children: React.ReactNode }> = ({ dur, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10, dur - 12, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

// Barra de progreso + sección, abajo.
const Pie: React.FC<{ seccion: string }> = ({ seccion }) => {
  const frame = useCurrentFrame();
  const total = durMemoria();
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 110px 34px", fontFamily: F.mono, fontSize: 22, color: C.n60, letterSpacing: 2 }}>
        <span>TACTIUM · MEMORIA TÉCNICA · RACKS ACADEMY</span>
        <span style={{ textTransform: "uppercase" }}>{seccion}</span>
      </div>
      <div style={{ height: 4, width: `${(frame / total) * 100}%`, background: C.green }} />
    </AbsoluteFill>
  );
};

export const Memoria: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  let at = 0;
  let seccion = BLOQUES[0].seccion;
  const seqs = BLOQUES.map((b) => {
    const dur = framesDe(b.id);
    const from = at;
    at += dur;
    if (frame >= from) seccion = b.seccion;
    const Esc = ESCENAS[b.id];
    return (
      <Sequence key={b.id} from={from} durationInFrames={dur} name={b.id}>
        <Sequence from={Math.round(LEAD * FPS)}>
          <Audio src={staticFile(`voz/ia/memoria/${b.id}.mp3`)} />
        </Sequence>
        <Fundido dur={dur}><Esc /></Fundido>
      </Sequence>
    );
  });
  const musica = (f: number) =>
    interpolate(f, [0, 30, durationInFrames - 60, durationInFrames], [0, 0.05, 0.05, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <Background />
      {seqs}
      <Pie seccion={seccion} />
      <Audio src={staticFile("musica/pixabay-creative-technology-showreel.mp3")} volume={musica} loop />
    </AbsoluteFill>
  );
};
