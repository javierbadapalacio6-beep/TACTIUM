# TACTIUM Social · Menú de funciones evaluado (qué comparte/hace el jugador)

> Fecha: 2026-07-04 · Complementa a `PLAN-STRAVA-DEL-PADEL.md`.
> Basado en 4 investigaciones a fondo: teardown completo de Strava, viabilidad de análisis de golpes, sección de noticias, y compartir material/compras.
> Objetivo: tener claro CADA bloque (valor de comunidad + viabilidad para founder solo) antes de construir.

## Marco: los 5 primitivos del pádel

Strava gira sobre GPS, ruta, distancia y esfuerzo. El pádel **no tiene nada de eso**. Su unidad atómica es:

**Partido · Marcador · Nivel · Pareja/rival · Club**

Todo lo social debe girar sobre esos 5. Lo que en Strava depende de GPS (rutas, heatmaps, carga de entrenamiento, segmentos geográficos, kilometraje de material) **NO traduce** y se descarta. Lo que sí traduce —y en pádel es incluso más fuerte porque el grafo social es real (jugaste CON y CONTRA esa gente) y está anclado a un club— es el **motor de comunidad**: feed + kudos + clubes + insignias de pertenencia + nivel/rankings + recap.

## El contenedor: el "tablón" (feed)

El "tablón" que imaginas = el **feed**. Es donde afloran resultados, clips, hitos de nivel, etc. Regla crítica de arranque: **feed por club/equipo primero (denso), no global**. Un feed global arranca vacío = "pueblo fantasma" (el problema real de PadelLog). En comunidades <5.000, ~33% contribuye; global, ~1%.

---

## Semáforo general

| Bloque | Rol | Valor comunidad | Esfuerzo solo | Veredicto | Fase |
|---|---|---|---|---|---|
| Resultado de partido → tarjeta | Contenido | Alto | Bajo (reusa `ResultsScreen`) | 🟢 Núcleo | 1a |
| Tablón/feed + kudos + comentarios | Conexión | **Máximo** | Medio | 🟢 Núcleo | 1c |
| Perfil de jugador + nivel + historial | Pertenencia/Competición | Alto | Medio-alto | 🟢 Núcleo | 1b |
| Nivel/rating (tipo TrueSkill) + head-to-head | Competición | Alto | Medio | 🟢 Núcleo | 1c |
| Clubes/equipos (feed, eventos, chat) | Pertenencia | **Máximo** | Bajo (¡ya existe!) | 🟢 Núcleo | reusa |
| "Habitual del club" (constancia) | Pertenencia | Alto | Bajo | 🟢 Núcleo | 1c |
| Clip / mejor punto (vídeo compartible) | Contenido | Alto (viral) | Medio | 🟢 Núcleo | 1b/2 |
| Recap "Padel Year / temporada" | Pertenencia | Alto | Medio | 🟡 Después | 2 |
| Retos / ligas / americanas / ladders | Competición | Alto | Medio | 🟡 Después | 2 |
| "Mi bolsa / setup" (pala, identidad) | Pertenencia | Medio-alto | Bajo | 🟡 Después | 2 |
| "Sigue el Tour" (scores/rankings vía API) | Contenido (utilidad) | Medio (hábito) | Bajo (~1 sem) | 🟡 Después | 2/3 |
| Matchmaking "busco pareja/cuarto" | Conexión | Alto | Medio | 🟡 Después | 3 |
| Análisis de golpes con IA **propia** | Contenido | Alto | **Moonshot** | 🔴 Descartar | — |
| "Mis golpes" manual + vídeo etiquetado | Contenido | Medio | Medio | 🟡 Después (ligero) | 2/3 |
| Reviews de palas / marketplace | Comercio | Bajo | Alto/empresa entera | 🔴 Descartar | — |
| Feed de "mira lo que compré" | Comercio | Negativo (ruido) | Bajo | 🔴 Descartar | — |
| Portal de noticias / agregador RSS | Contenido | Bajo | Alto + riesgo legal | 🔴 Descartar | — |
| Rutas / heatmaps / carga entreno / km material | — | — | — | 🔴 No traduce | — |

---

## 🟢 NÚCLEO — construir

**1. Resultado de partido → tarjeta compartible.** El motor de contenido. El usuario mete el marcador (o se autorrellena desde jornada) y sale una tarjeta bonita con marca TACTIUM, exportable a IG/WhatsApp = adquisición orgánica gratis. *Reusa la lógica `matchOutcome()` que ya tienes.*

**2. Tablón + kudos + comentarios.** El bucle de hábito nº1 de Strava, traduce casi 1:1. Logueas para ser visto; abres para ver y dar kudos. **Es el mayor motor de retorno diario.** Siempre gratis. Sembrar por club.

**3. Perfil de jugador + nivel + historial + head-to-head.** Identidad individual (hoy no existe: un "jugador" es un hueco de plantilla). Su récord V/D, su nivel, su historial vs. un rival concreto (el equivalente pádel al duelo por el KOM). Alto coste de cambio = retención.

**4. Nivel/rating tipo TrueSkill.** Modela 2v2 nativamente. Fiabilidad visible, calibra en ~10-15 partidos, exige diversidad de parejas, decae con inactividad. "El número que te hace abrir la app." Complementa (no sustituye) al nivel Playtomic.

**5. Clubes / equipos = tu superpoder.** En Strava los clubes son la capa de pertenencia más fuerte, y aquí **ya los tienes construidos** (jornadas, alineaciones, roles, chat de invitaciones). Solo hay que darles feed + eventos + kudos. Esto es lo que PadelLog y Playtomic NO tienen.

**6. "Habitual del club" (constancia).** El equivalente al "Local Legend": premia a quien MÁS juega, no al mejor. Da pertenencia al jugador recreativo (que es la mayoría). Barato de construir.

**7. Clip / mejor punto.** Vídeo del móvil + recorte + tarjeta "clip de la semana" con branding. El vídeo es el motor viral que las stats puras no dan. Enlaza con lo del Remotion.

---

## 🟡 MÁS ADELANTE — cuando el núcleo funcione

- **Recap "Padel Year / de temporada":** resumen anual/temporada (mejores victorias, pareja favorita, subida de nivel). Alta retención narrativa.
- **Retos / ligas / americanas / ladders:** los formatos competitivos sociales del pádel, más ricos que los "challenges" de Strava.
- **"Mi bolsa / setup":** pala + zapatillas + lado + nivel en el perfil. La pala es señal de identidad fortísima en pádel (cultura casi sneakerhead) y **nadie posee esa capa**. Como identidad (metadato del perfil), NO como tienda. Monetización = capa fina de afiliados ("¿dónde comprar?"), opcional y señalada, nunca líder.
- **"Sigue el Tour":** pestaña casi automática con resultados/rankings/calendario de Premier Padel/FIP vía API de datos (`padelapi.org`, tier gratis para validar). ~1 semana, casi cero mantenimiento. Gancho de hábito entre partidos. **Licencia el dato, enlaza a los artículos — no republiques.**
- **Matchmaking "busco pareja/cuarto":** reutiliza el "hueco" que Strava usa para Beacon; resuelve el problema padel-crítico de completar un partido.
- **"Mis golpes" (versión ligera):** registro manual (bandeja/víbora/smash) + vídeo con marcadores tap-to-tag. Sin IA. Da la *sensación* de análisis y genera clips compartibles.

---

## 🔴 DESCARTAR — no construir

- **Análisis de golpes con IA propia = moonshot.** Todo producto serio (Wingfield, Clutch, GAMETRAQ, SportAI) es una empresa de cámara/CV; hasta el líder en tenis (SwingVision) tiene el pádel en beta sin resolver (cristal + juego plano rompen la visión por computador). *Ruta futura de "IA de verdad": integrar la API de SportAI, no construir CV.*
- **Reviews de palas / marketplace / feed de compras.** Reviews = vertical saturado (webs con +1.000 palas). Marketplace = una empresa entera (fraude, pagos, logística). Feed de compras = ruido de anuncios que mata la comunidad.
- **Portal de noticias / agregador RSS.** Mantenimiento diario + riesgo de copyright al republicar + no crea comunidad (solo consumo).
- **Todo lo GPS de Strava:** rutas, route builder, heatmaps, carga de entrenamiento (Fitness & Freshness), segmentos geográficos, kilometraje de material. No hay equivalente en pádel.

---

## La regla de oro (monetización) — encaja con el paywall actual

**Gratis siempre:** participación y conexión → feed, kudos, comentarios, clubes, perfil, ganar insignias, nivel básico, ver la pizarra. (Son el efecto red y el crecimiento; caparlos lo mata.)

**De pago (reverse-trial actual):** análisis y comparación → estadísticas avanzadas, autoría en el laboratorio, gestión de temporada, analítica de club, head-to-head profundo.

Es exactamente lo que hace Strava (participación gratis, análisis de pago) y lo que ya tienes montado.

---

## Encaje con el plan por fases

- **Fase 1a** — Tarjeta de partido (desde jornada existente). Riesgo cero, valor ya.
- **Fase 1b** — Partido individual + perfil de jugador + clips.
- **Fase 1c** — Nivel TrueSkill + feed de club + kudos + "habitual".
- **Fase 1d** — Navegación libre al descargar (abrir puertas, ya con contenido).
- **Fase 2+** — Recap, retos/americanas, "Mi bolsa", "Sigue el Tour", "Mis golpes" ligero, matchmaking.
