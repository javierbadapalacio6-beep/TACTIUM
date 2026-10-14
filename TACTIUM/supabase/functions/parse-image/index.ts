// TACTIUM · Edge Function parse-image
// Recibe { mode, image (base64), mime, team_name? } y llama a Gemini con
// visión + JSON estructurado. Devuelve la lista de jugadores o jornadas.
//
// v7: reintentos con backoff ante 429/503/500 + mensajes de error legibles.
// v10: el prompt de calendario entiende también la TABLA CRUZADA (matriz).
// v11 (14-10-2026): fechas fiables. El prompt lleva la fecha de HOY y el año
//   de la temporada (antes la IA adivinaba el año), fija el formato español
//   día/mes, y un fin de semana («23 - 25 Oct») ya NO se convierte en el
//   domingo: se omite la fecha (el club la fija después). Además se valida
//   la respuesta: fechas imposibles o fuera de la temporada se descartan.
//
// La clave de Gemini sale del secret GEMINI_API_KEY (ya no hay clave en el código).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

// Las claves nuevas ya no pueden usar gemini-2.5-flash (404): modelo vigente,
// sobrescribible con el secret GEMINI_MODEL sin tocar el código.
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Mode = 'ranking' | 'calendar';

interface Body {
  mode: Mode;
  image: string;
  mime?: string;
  team_name?: string;
}

const RANKING_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      name: { type: 'string' },
      pts: { type: 'integer' },
      position: { type: 'string', enum: ['Drive', 'Revés', 'Ambos'] },
    },
    required: ['name'],
  },
};

const CALENDAR_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      jornada_number: { type: 'integer' },
      opponent: { type: 'string' },
      match_date: {
        type: 'string',
        description: 'Fecha en formato ISO YYYY-MM-DD',
      },
      date_range: {
        type: 'string',
        description:
          'Fin de semana tal como se imprime cuando NO hay día concreto, p. ej. "23 - 25 Oct"',
      },
      match_time: {
        type: 'string',
        description: 'Hora en formato HH:MM',
      },
      is_home: { type: 'boolean' },
    },
    required: ['opponent', 'is_home'],
  },
};

function promptForRanking(): string {
  return [
    'Eres un asistente que extrae datos de un ranking/listado de jugadores',
    'de pádel federado a partir de una imagen. Devuelve EXACTAMENTE el array',
    'JSON solicitado, sin texto adicional.',
    '',
    'Reglas:',
    '- name: nombre y apellidos del jugador tal como aparecen.',
    '- pts: puntos FEP (entero). Si NO aparece para un jugador, OMITE el campo.',
    '- position: "Drive", "Revés" o "Ambos". Solo si aparece explícitamente,',
    '  si no, OMITE el campo.',
    '- Ignora cabeceras, totales y filas que no sean jugadores.',
    '- Conserva el orden en el que aparecen.',
  ].join(' ');
}

/** Año en el que ARRANCA la temporada que contiene `today` (septiembre → junio). */
function seasonStartYear(today: Date): number {
  const y = today.getUTCFullYear();
  return today.getUTCMonth() >= 6 ? y : y - 1; // jul-dic → este año; ene-jun → el anterior
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

function promptForCalendar(teamName: string | undefined, today: Date): string {
  const team = teamName ?? '[desconocido]';
  const y0 = seasonStartYear(today);
  return [
    'Eres un asistente que extrae el calendario de partidos de una liga de',
    'pádel federado a partir de una imagen o PDF. Devuelve EXACTAMENTE el',
    'array JSON solicitado, sin texto adicional.',
    '',
    `El equipo del usuario se llama "${team}". Extrae ÚNICAMENTE los partidos`,
    'en los que participa ESE equipo; ignora por completo los partidos entre',
    'otros equipos. Compara nombres de forma flexible (mayúsculas, acentos,',
    'espacios o sufijos como A/B pueden variar ligeramente).',
    '',
    `CONTEXTO DE FECHAS: hoy es ${iso(today)}. Es una liga española: las fechas`,
    'se escriben DÍA/MES (23/10 es el 23 de octubre, NUNCA el 10 de febrero) y',
    `los meses vienen en español. La temporada es ${y0}/${y0 + 1}: de septiembre`,
    `a diciembre el año es ${y0} y de enero a junio es ${y0 + 1}. Si la tabla no`,
    'trae año, usa ese. Nunca devuelvas una fecha de otra temporada.',
    '',
    'El calendario puede venir en DOS formatos:',
    '',
    'FORMATO A · LISTA POR JORNADAS: una fila por partido (jornada, rival,',
    'fecha, hora, sede). Extrae cada partido del equipo del usuario y decide',
    'is_home según se indique local/visitante o el campo/sede. Si las jornadas',
    'van en bloques con su fecha en la cabecera (p. ej. "Jornada 3 · 7-8 Nov"),',
    'esa fecha vale para todos los partidos del bloque.',
    '',
    'FORMATO B · TABLA CRUZADA (matriz): hay una cabecera de FILAS con equipos',
    'y una cabecera de COLUMNAS con equipos; cada celda con fecha/hora es el',
    'partido entre el equipo de SU FILA y el de SU COLUMNA. La convención',
    '(suele indicarse con una etiqueta tipo "Local / Visitante" en la esquina',
    'superior izquierda) es: el equipo de la FILA juega de LOCAL y el de la',
    'COLUMNA de VISITANTE. Para el equipo del usuario:',
    `- Localiza la FILA cuyo nombre es "${team}": CADA celda con datos de esa`,
    '  fila es un partido EN CASA (is_home=true); el rival (opponent) es el',
    '  equipo de la CABECERA DE COLUMNA de esa celda.',
    `- Localiza la COLUMNA cuyo nombre es "${team}": CADA celda con datos de`,
    '  esa columna es un partido FUERA (is_home=false); el rival es el equipo',
    '  de la CABECERA DE FILA de esa celda.',
    '- La celda del cruce (misma fila y columna del equipo) está vacía:',
    '  ignórala. No incluyas celdas vacías ni de otros equipos.',
    '- Lee la fecha de CADA celda por separado: no copies la de la celda',
    '  vecina ni asumas que una columna o una fila comparte fecha.',
    '- En una tabla cruzada NO inventes número de jornada.',
    '',
    'Reglas de campos (ambos formatos):',
    '- opponent: nombre del equipo rival tal como aparece.',
    '- is_home: true si el equipo del usuario es LOCAL, false si visita.',
    '- jornada_number: número de jornada si aparece (J1, Jornada 03…). Si no',
    '  aparece, OMITE el campo.',
    '- match_date: SOLO si aparece un día concreto (p. ej. 24/10, "sáb 24 oct").',
    '  Formato YYYY-MM-DD. Si solo hay un fin de semana o un rango de días',
    '  ("23 - 25 Oct", "30 Oct - 1 Nov"), OMITE match_date: NO elijas un día',
    '  del rango. Si no hay fecha, OMITE el campo.',
    '- date_range: SOLO cuando la celda trae un rango de días en vez de un día',
    '  concreto (lo habitual en el calendario de la Federación Cántabra).',
    '  Cópialo tal cual se imprime: "23 - 25 Oct", "30 Oct - 1 Nov". Si hay',
    '  día concreto, OMITE este campo.',
    '- match_time: HH:MM (24 h) si aparece. Si no, OMITE el campo.',
    '- Ordena los partidos por fecha ascendente (los que no tienen fecha, por',
    '  jornada o por orden de aparición).',
  ].join(' ');
}

/**
 * Red de seguridad sobre lo que devuelve la IA: una fecha imposible, mal
 * formada o fuera de la temporada es peor que ninguna (queda "sin fecha" y el
 * usuario la pone a mano), así que se descarta. Hora con formato HH:MM o fuera.
 */
function cleanCalendar(items: unknown, today: Date): unknown[] {
  if (!Array.isArray(items)) return [];
  const y0 = seasonStartYear(today);
  const from = Date.UTC(y0, 6, 1); // 1 jul de la temporada
  const to = Date.UTC(y0 + 1, 7, 31); // 31 ago del año siguiente
  const cleaned = items.map((raw) => {
    const it = { ...(raw as Record<string, unknown>) };
    const d = typeof it.match_date === 'string' ? it.match_date.trim() : '';
    if (d) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
      const ts = m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
      const ok =
        m &&
        !Number.isNaN(ts) &&
        new Date(ts).toISOString().slice(0, 10) === d &&
        ts >= from &&
        ts <= to;
      if (ok) it.match_date = d;
      else delete it.match_date;
    } else {
      delete it.match_date;
    }
    const t = typeof it.match_time === 'string' ? it.match_time.trim() : '';
    const tm = /^(\d{1,2}):(\d{2})/.exec(t);
    if (tm && +tm[1] < 24 && +tm[2] < 60) {
      it.match_time = `${tm[1].padStart(2, '0')}:${tm[2]}`;
    } else {
      delete it.match_time;
    }
    // Rango impreso («23 - 25 Oct»): solo si se entiende; con día concreto sobra.
    const r = typeof it.date_range === 'string' ? it.date_range.trim() : '';
    if (!it.match_date && r.length <= 24 && Number.isFinite(rangeStart(r, y0))) {
      it.date_range = r;
    } else {
      delete it.date_range;
    }
    return it;
  });
  // Orden cronológico (día concreto o inicio del fin de semana); sin fecha, al
  // final y en el orden en que vienen. Importa: en una tabla cruzada salen
  // primero los partidos en casa y luego los de fuera, no por jornada.
  const key = (it: Record<string, unknown>) =>
    it.match_date
      ? Date.parse(String(it.match_date))
      : it.date_range
        ? rangeStart(String(it.date_range), y0)
        : Infinity;
  return cleaned
    .map((it, i) => ({ it, i, k: key(it as Record<string, unknown>) }))
    .sort((a, b) => (a.k === b.k ? a.i - b.i : a.k < b.k ? -1 : 1))
    .map((x) => x.it);
}

const MONTHS: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, set: 8, oct: 9, nov: 10, dic: 11,
};

/** Inicio (UTC) de un rango «23 - 25 Oct» / «30 Oct - 1 Nov»; NaN si no se entiende. */
function rangeStart(range: string, y0: number): number {
  const m =
    /^(\d{1,2})\s*([a-záéíóú]{3})?\.?\s*[-–—]\s*(\d{1,2})\s*([a-záéíóú]{3})\.?$/i.exec(range);
  if (!m) return NaN;
  const mon = MONTHS[(m[2] ?? m[4]).toLowerCase()];
  const day = +m[1];
  if (mon === undefined || day < 1 || day > 31) return NaN;
  return Date.UTC(mon >= 6 ? y0 : y0 + 1, mon, day);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callGemini(
  apiKey: string,
  prompt: string,
  imageBase64: string,
  mime: string,
  schema: unknown,
) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}` +
    `:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mime, data: imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: schema,
      temperature: 0,
    },
  };

  // 429 (cuota/rate-limit), 503 (modelo saturado) y 500 son transitorios:
  // reintentamos con backoff creciente. El resto no se arregla reintentando.
  const MAX_ATTEMPTS = 3;
  let lastDetail = '';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch (netErr) {
      lastDetail = netErr instanceof Error ? netErr.message : 'red';
      if (attempt < MAX_ATTEMPTS) {
        await sleep(attempt * 800);
        continue;
      }
      throw new Error(
        `No se pudo contactar con la IA. Revisa tu conexión y reinténtalo.`,
      );
    }

    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) {
        const finish = data?.candidates?.[0]?.finishReason ?? '?';
        throw new Error(
          `La IA no devolvió datos (motivo=${finish}). Prueba con una imagen más nítida o que se lea mejor.`,
        );
      }
      return JSON.parse(text);
    }

    const txt = await res.text();
    lastDetail = `${res.status}: ${txt.slice(0, 300)}`;

    const transient =
      res.status === 429 || res.status === 503 || res.status === 500;
    if (transient && attempt < MAX_ATTEMPTS) {
      await sleep(attempt * 1200);
      continue;
    }

    if (res.status === 429) {
      throw new Error(
        'La IA ha alcanzado su límite de uso temporal. Espera un minuto y reinténtalo.',
      );
    }
    if (res.status === 503) {
      throw new Error(
        'La IA está saturada ahora mismo. Reinténtalo en unos segundos.',
      );
    }
    if (res.status === 400) {
      throw new Error(
        `La IA no pudo leer el archivo. Prueba con una foto o PDF más ligero y nítido.`,
      );
    }
    throw new Error(`Error de la IA (${lastDetail}).`);
  }
  throw new Error(`La IA no respondió tras ${MAX_ATTEMPTS} intentos.`);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY no configurada' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const body = (await req.json()) as Body;
    if (!body?.image || !body?.mode) {
      return new Response(
        JSON.stringify({ error: 'image y mode son obligatorios' }),
        { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const mime = body.mime || 'image/jpeg';
    const today = new Date();
    const prompt =
      body.mode === 'ranking'
        ? promptForRanking()
        : promptForCalendar(body.team_name, today);
    const schema = body.mode === 'ranking' ? RANKING_SCHEMA : CALENDAR_SCHEMA;

    const raw = await callGemini(apiKey, prompt, body.image, mime, schema);
    const items = body.mode === 'calendar' ? cleanCalendar(raw, today) : raw;

    return new Response(JSON.stringify({ items }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown error';
    console.error('parse-image error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});
