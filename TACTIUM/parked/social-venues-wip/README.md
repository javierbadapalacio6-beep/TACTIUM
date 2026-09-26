# «Sedes» y perfiles — frontend aparcado

Esto **no está enchufado a la app**, pero su **backend sí está vivo en
producción**, y por eso se rescata en vez de tirarlo.

De dónde viene: el snapshot `823229a6` de la rama local `backup/strava-social`
(7 de julio de 2026), que se borró después de traer a `main` todo lo que valía.
Era la única copia, y no estaba en GitHub.

## Lo que hay funcionando en el servidor ahora mismo

Comprobado contra producción el 26-09-2026:

| Pieza | Estado |
| --- | --- |
| Tabla `venues` | **63 filas**, con `website`, `lat`, `lng`, `external_id` |
| RPC `create_venue` | viva (9 argumentos) |
| RPC `update_venue` | viva (15 argumentos — evolucionó más que la migración) |
| Bucket `venue-logos` | creado, público |
| Edge function `places-search` | **ACTIVE**, versión 1 |

El registro de todo eso vive ahora en `TACTIUM/supabase/`: las tres migraciones
`20260706_social_create_venue_places`, `20260706_social_update_venue` y
`20260707_social_venue_logos_bucket`, y la función en
`supabase/functions/places-search/`. Antes no estaban en ningún sitio de `main`,
así que había cinco objetos vivos en la base de datos sin nada en git que
dijera de dónde salían.

## Por qué el frontend está aparcado y no en `src/`

Se quedó a medias y `main` tomó otro camino: la capa social se rehízo en
`src/features/social/` (feed, perfil público, seguir, buscar comunidad) y se
publicó en la OTA del 20-07-2026. Estas pantallas son de la tanda ANTERIOR y
cuelgan de stacks de navegación que ya no existen (`FeedStack`, `NewUserStack`,
`PublishStack`, `VenueStack`), así que no compilarían contra la navegación de
hoy. `parked` está excluido del `tsconfig.json` por eso.

Lo que sigue teniendo valor es el trabajo de sedes, que no se rehízo:

- `src/core/services/venues.ts` — alta, reclamación y edición de sedes.
- `src/store/venueStore.ts` — estado de la sede.
- `src/features/venue/` — panel de la sede y su ficha pública.
- `src/features/onboarding/components/PlaceSearch.tsx` · `VenuePicker.tsx` —
  buscador de Google Places contra la edge function que sigue activa.

## Si algún día se retoma

Servirá de punto de partida, no de código a copiar: la navegación, el tema y el
modelo de datos han cambiado mucho desde julio. Lo que de verdad se aprovecha es
cómo hablan con `create_venue` / `update_venue` / `places-search`, que siguen
siendo las mismas.

Si se decide que esto no vuelve, se borra la carpeta y no se pierde nada del
servidor: las migraciones y la función ya están en su sitio.
