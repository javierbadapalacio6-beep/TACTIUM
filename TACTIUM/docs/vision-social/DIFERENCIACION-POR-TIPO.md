# Diferenciación por tipo de cuenta (jugador · club · sede)

> Decidido con el usuario 2026-07-07. Hoy el tipo del onboarding solo cambia el
> alta; después todos caen en la misma app. Debe adaptar la experiencia.

## Modelo mental
- **Identidad = persona** (`profiles`). Siempre existe.
- Encima, **entidades** que la persona puede poseer/pertenecer, cada una con su
  **página pública** propia:
  - 🎾 **Jugador** → perfil de jugador (nivel, partidos, clips).
  - 🏆 **Club con equipos** (`clubs`) → página del club (equipos, liga, resultados).
  - 📍 **Sede / negocio** (`venues`) → ficha de la sede (servicios, pistas, gym…).
- El tipo del onboarding define la **experiencia principal**. NO encierra: se
  pueden añadir facetas después (ver [[tactium_access_model]]).

## Qué cambia según el tipo

| | 🎾 Jugador | 🏆 Club (equipos) | 📍 Sede |
|---|---|---|---|
| Qué publica (➕) | Resultado, clip, texto | Resultado liga, torneo | Novedad, torneo, oferta, foto (NO resultado) |
| Crea equipo | No (se une) | Sí | No |
| Su "yo" (perfil) | Perfil jugador | Gestión club | Gestión de la sede (Panel) |
| Página pública | Perfil jugador | Página club | Ficha rica de sede |
| Pizarra | Sí | Sí | Se deja (no molesta) |

## Sede — alcance concreto
1. **Datos ricos** en `venues`: `phone`, `num_courts`, `opening_hours` (texto libre
   v1), `description`, `amenities text[]` (tags: gimnasio, parking, vestuarios,
   cafeteria, tienda, clases, alquiler, torneos, ligas). Logo + ubicación + web ya
   existen.
2. **Panel de sede** (privado, del dueño): edita todo eso.
3. **Ficha pública** (`VenuePublicScreen`): al buscar/tocar el club en la feed se
   abre con toda la info + los **posts** que la sede haya publicado. Lectura
   pública (RLS `venues_select`).
4. **Publica** novedades/torneos/ofertas (posts con `venue_id`, autor = la sede
   con su nombre+logo). NO registra resultados de partido.

## Cómo se deriva el "tipo/modo" (sin campo nuevo que encierre)
- Posee `venues` (owner) → **sede**.
- Es `club_admin` de un `clubs` → **club**.
- Está en un `team` → **jugador/capitán**.
- Nada → **jugador amateur** (acceso abierto).
El onboarding (`AccountTypeScreen`) marca el punto de partida creando la entidad
correspondiente; el modo se deriva de lo que posee, no de un flag rígido.

## Plan de construcción
1. ✅/🔜 Datos ricos de venue (migración + `update_venue` + tipos).
2. 🔜 Panel de sede: edición de datos ricos.
3. 🔜 `VenuePublicScreen` (ficha pública + posts), reachable desde feed/perfil.
4. 🔜 Publicaciones de sede (posts con `venue_id`, create_post/list_feed + botón).
5. 🔜 ➕ adaptativo por tipo (sede: novedad/torneo/oferta; jugador: resultado/clip).
6. 🔜 Tabs/perfil adaptativos (sede: "Mi sede" en vez de gestión de equipo; ocultar
   registrar resultados). Pizarra se mantiene.
