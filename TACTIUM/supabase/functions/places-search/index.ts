// Proxy seguro a Google Places (New) Text Search. Guarda la API key en el
// servidor (secreto GOOGLE_PLACES_API_KEY). Solo usuarios autenticados
// (verify_jwt=true). Devuelve clubes de pádel con nombre/dirección/coords/web.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const key = Deno.env.get('GOOGLE_PLACES_API_KEY');
  if (!key) return json({ error: 'missing_places_key' }, 500);

  let body: { query?: string } = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  const query = (body.query ?? '').toString().trim();
  if (query.length < 2) return json({ results: [] });

  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.location,places.websiteUri,places.addressComponents',
    },
    body: JSON.stringify({
      textQuery: query + ' padel',
      regionCode: 'ES',
      languageCode: 'es',
      maxResultCount: 10,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    return json({ error: 'places_error', detail }, 502);
  }

  const data = await resp.json();
  const results = (data.places ?? []).map((p: any) => {
    const comps = p.addressComponents ?? [];
    const city =
      comps.find((c: any) => (c.types ?? []).includes('locality'))?.longText ??
      comps.find((c: any) => (c.types ?? []).includes('postal_town'))?.longText ??
      comps.find((c: any) => (c.types ?? []).includes('administrative_area_level_2'))?.longText ??
      null;
    const province =
      comps.find((c: any) => (c.types ?? []).includes('administrative_area_level_1'))?.longText ?? null;
    return {
      placeId: p.id,
      name: p.displayName?.text ?? '',
      address: p.formattedAddress ?? null,
      city,
      province,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      website: p.websiteUri ?? null,
    };
  });

  return json({ results });
});
