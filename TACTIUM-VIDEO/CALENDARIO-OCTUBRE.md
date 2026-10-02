# Calendario de contenido · @tactium · 28 sep → 25 oct 2026

Cuatro semanas, una audiencia por semana. Cada pieza lleva su estado: **LISTO** (ya
renderizado en `renders/`), **GRABAR** (falta tu plano a cámara; el montaje está
preparado en `src/reel/piezas.ts`) o **DISEÑO** (imagen estática lista en
`renders/carruseles/`).

El copy completo de carruseles, posts y stories está en [`carruseles/COPY.md`](carruseles/COPY.md).
Los guiones de los reels a cámara, en [`GUIONES-REELS.md`](GUIONES-REELS.md).

> **El calendario vivo está en el panel** (`node panel/server.mjs` → http://localhost:4173) y se guarda en
> `calendario.json`. Lo que cambies allí (día, hora, estado, vínculo con Instagram) manda sobre este documento.
> Las horas se revisaron con tus datos reales el 28-09: reels a las 19:00, carruseles y posts a las 16:00.

## Dos formatos de cada vídeo

Cada pieza sale en **vertical** (`renders/<id>.mp4`, reels y TikTok) y en **16:9**
(`renders/<id>-16x9.mp4`): tu plano entero a un lado y las pantallas al otro. El 16:9 es el
formato preferido para YouTube, LinkedIn y el feed; el vertical, para reels.

## Reglas que no se saltan

- **Tu cara sale siempre** en los reels. Es una cuenta de marca con cara de fundador.
- No se presenta la marca dentro del vídeo («aquí», «esto»), ni se dice el precio.
- «17 federaciones» solo como trabajo hecho (las normas están metidas en la app), nunca
  como «17 federaciones cargadas». La competición al día es la **Cántabra**; «el resto irán entrando».
- «Te lo pueden **reclamar**», no «impugnar».
- Un reel al día como máximo. Stories a diario, aunque sea un repost.

## Cadencia

| Día | Formato |
|---|---|
| Lunes | Reel (el de más alcance de la semana) |
| Martes | Carrusel |
| Miércoles | Reel corto (12-15 s) |
| Jueves | Post estático + encuesta en stories |
| Viernes | Reel |
| Fin de semana | Stories: jornada, resultados, repost de clubes |

---

## Semana 1 · 28 sep – 4 oct · «Vuelve la liga» (lanzamiento)

| Día | Pieza | Formato | Estado | Archivo |
|---|---|---|---|---|
| L 28 | **V1 · Se acabó el verano** | Reel 36 s | LISTO | `renders/V1-vuelta.mp4` |
| M 29 | **C1 · Tres cosas que cambian esta temporada** | Carrusel 7 | DISEÑO | `renders/carruseles/C1/` |
| X 30 | **A1 · Me leí las 17 normativas** | Reel 12 s | GRABAR | plano → `public/plano/A1-federaciones.mp4` |
| J 1 | **P1 · 26/27 ya está cargada** | Post | DISEÑO | `renders/carruseles/P1/` |
| V 2 | **V1a · Tu equipo** (corte de V1) | Reel 10 s | LISTO | `renders/V1a-equipo.mp4` |
| S-D | Stories 6 y 2 (cuenta atrás de la liga · «¿cuántos mensajes sin leer?») | Stories | — | copy en COPY.md |

**Si el A1 no está grabado el miércoles**, publica el V1a el miércoles y el A1 cuando lo tengas.
Plan B para toda la semana sin grabar nada: V1 · C1 · V1a · P1 · V1b.

Caption del V1 (reel):
> Se acabó el verano. Vuelve la liga.
> Tres meses sin parar y muchos cambios en la app. Tu equipo, tus torneos y la Federación Cántabra, en el mismo sitio.
> La temporada 2026/2027 ya está cargada. Empezamos.
> #padel #padelfederado #ligadepadel #capitandeequipo #padelcantabria #torneosdepadel #clubdepadel

Caption del V1a (reel):
> Quién puede jugar, la alineación según la normativa de tu federación y la temporada entera registrada.
> Eso es «tu equipo» esta temporada. Lo demás, en el perfil.
> #padel #capitandeequipo #ligadepadel #padelfederado #alineacion

---

## Semana 2 · 5 – 11 oct · Capitán (conversión)

| Día | Pieza | Formato | Estado | Archivo |
|---|---|---|---|---|
| L 5 | **A2 · El orden de parejas** | Reel 12 s | GRABAR | sentado a la mesa, móvil boca arriba |
| M 6 | **C2 · El orden de parejas: lo que casi nadie sabe** | Carrusel 7 | DISEÑO | `renders/carruseles/C2/` |
| X 7 | **A3 · De una hora a dos minutos** | Reel 12 s | GRABAR | palas de fondo |
| J 8 | **P2 · 84 mensajes sin leer** | Post | DISEÑO | `renders/carruseles/P2/` |
| V 9 | **R2 · El domingo del capitán** | Reel 35 s | GRABAR | + cobertura B7 (el caos de WhatsApp) |
| S-D | Stories 1 y 7 (encuesta «¿orden de fuerza?» · caja «lo peor de montar la alineación») | Stories | — | |

Es la semana que decide el ángulo ganador: A1, A2 y A3 en siete días. El que mejor
retenga a 3 s se convierte en la familia de la que salen 10 variantes en noviembre.

Plan B sin grabar: V1a repetido con otro gancho · C2 · T1 (si hay grabación de pantalla) · P2 · V1b.

---

## Semana 3 · 12 – 18 oct · Club y torneos (credibilidad)

| Día | Pieza | Formato | Estado | Archivo |
|---|---|---|---|---|
| L 12 | **V1b · Torneos** (corte de V1) | Reel 9 s | LISTO | `renders/V1b-torneos.mp4` |
| M 13 | **C3 · Un torneo de 32 parejas, paso a paso** | Carrusel 8 | DISEÑO | `renders/carruseles/C3/` |
| X 14 | **T3 · Inscribirse en un torneo** | Tutorial 20 s | GRABAR | cara + grabación de pantalla A4 |
| J 15 | **P3 · DEMO16** | Post | DISEÑO | `renders/carruseles/P3/` |
| V 16 | **R4 · Un torneo de 32 parejas** | Reel 28 s | GRABAR | + cobertura A3 y A4 |
| S-D | Stories 3 y 8 («Excel o WhatsApp» · «en esto hemos estado este verano») | Stories | — | |

El R4 y el C3 también van a tu perfil personal de LinkedIn (carril B): ahí está quien paga.

Caption del V1b (reel):
> Grupos, eliminatoria y consolación, con horarios pista a pista. Se inscriben con un código y pagan por la web.
> Si tu club sigue montando torneos con un Excel, hablamos por DM.
> #padel #clubdepadel #torneosdepadel #gestiondeclubes #padelfederado

---

## Semana 4 · 19 – 25 oct · Federación y jugador (notoriedad)

| Día | Pieza | Formato | Estado | Archivo |
|---|---|---|---|---|
| L 19 | **V1c · La Federación dentro de la app** (corte de V1) | Reel 13 s | LISTO | `renders/V1c-federacion.mp4` |
| M 20 | **C4 · Tus puntos, sin buscarte en un PDF** | Carrusel 8 | DISEÑO | `renders/carruseles/C4/` |
| X 21 | **R6 · No quieres otra app** | Reel 25 s | GRABAR | solo a cámara, sin cobertura |
| J 22 | **P4 · Registra el amistoso, comparte la tarjeta** | Post | DISEÑO | `renders/carruseles/P4/` |
| V 23 | **R1 · Lo he construido yo solo** | Reel 40 s | GRABAR | cierra el mes presentándote |
| S-D | Stories 4 y 5 (aviso en rojo «así se ve antes de publicar» · «¿sabes tus puntos?») | Stories | — | |

Caption del V1c (reel):
> La Federación Cántabra dentro de la app: tus puntos, las clasificaciones y los cuadros. Sin buscarte en un PDF.
> De momento la Cántabra. El resto irán entrando.
> #padel #padelfederado #federacioncantabra #padelcantabria #rankingpadel

---

## Material extra (tanda 2, 28-09)

- **Stories S1–S10** en `renders/carruseles/S*/`: una por día de la semana que toque, con la tabla de
  qué sticker lleva cada una en `carruseles/COPY.md`. Las de encuesta (S1, S3, S5) van los jueves;
  las de caja de preguntas (S2, S7) los fines de semana; S6 (cuenta atrás) los días previos a la
  primera jornada; S9 y S10 el mismo día que se publique el carrusel al que apuntan.
- **Posts con foto P5–P10** en `renders/carruseles/P*/`: repuesto para cualquier jueves o para
  un día en que no haya reel. Captions en `carruseles/COPY.md`.
- **Fotos en bruto** en `public/gen/` (23): sirven de fondo para piezas nuevas o sueltas.

## Lo que hay que grabar este mes (una tarde, dos como mucho)

Por orden de prioridad, con el guion en `GUIONES-REELS.md`:

1. **A1, A2, A3** (36 s de texto en total, tres encuadres distintos). Desbloquean la semana 2.
2. **Cobertura B7** (el grupo de WhatsApp con 84 sin leer, la libreta) y **A4** (inscribirse con `DEMO16`).
3. **R2, R4** (35 s + 28 s).
4. **R6, R1** para la semana 4.

Los brutos van a `bruto/cara/` y `bruto/app/` con los nombres de `LISTA-DE-RODAJE-REDES.md`.
Cada reel nuevo se monta cambiando `plano: null` por la ruta del plano en `piezas.ts` y
renderizando: `npx remotion render src/index.ts reel-<id> renders/<id>.mp4`.

## Producción de imágenes

- **Carruseles y posts**: `node scripts/carruseles.mjs` (spec en `carruseles/*.json`, salida 1080×1350).
- **Capturas de la web en móvil**: `node scripts/capturas-web.mjs` → `public/web/` (sin cabecera del navegador).
- **Fotos generadas** (pistas, palas, pelotas, libreta): `public/gen/`, hechas con Gemini
  (`gemini-2.5-flash-image`), todas sin marcas ni caras. Revisar cada una antes de publicar por si
  cuela un logo.

## Perfil antes del lunes 28

- Nombre: `TACTIUM · Pádel de equipos`. Bio de tres líneas (en GUIONES-REELS.md). Enlace a `tactium.io`.
- Destacados desde el primer día: *Qué es* · *Capitanes* · *Clubes*.
- Mensajes abiertos: el «hablamos» del R4 y el «escríbenos» del C3 son un DM.

## Medición (revisar cada lunes)

| Métrica | Umbral | Si falla, lo roto es |
|---|---|---|
| Retención a 3 s | > 50 % | el gancho |
| Retención al 50 % | > 30 % | el formato |
| Guardados | > 1 % | el ángulo |
| Clics a perfil | > 2 % | el remate |
