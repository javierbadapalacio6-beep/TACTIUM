# Guiones de reels — TACTIUM a cámara

Fusión de dos fuentes:
- **`Desktop/CLUBNEXT/03-constructor/nichos/tactium/`** — la estrategia (carriles, banco de
  ángulos, constantes visuales, medición). De ahí salen las piezas **A1, A2 y A3**.
- Los seis guiones largos de esta sesión, que pasan a **tanda 2**.

**Cambio respecto a CLUBNEXT:** allí las tres piezas se generaban con un **avatar de IA**
(hoja de personaje en Nano Banana + prompts de vídeo con `Dialogue:`). Las dices **tú**.
Los prompts de avatar siguen intactos en `03-generacion.md` por si se recuperan.

## Cómo decirlos

- **No los leas.** Entiende la idea y dilo con tus palabras. Si cambias una frase, mejor.
- Los **primeros 2 segundos** no admiten preámbulo. Nada de «hola, qué tal», «hoy os traigo».
- Energía **un punto por encima** de como hablas normalmente.
- Mira **a la lente**, no a tu cara en la pantalla.
- **3 tomas** de cada uno, y déjalas todas (`A1-federaciones-toma3.mp4`). Suelo montar con trozos de dos.
- Si te trabas, **no pares**: respira, repite la frase y sigue. Corto yo.

## La cuenta es @tactium, no la tuya personal

Decidido el 14/09. Consecuencias que afectan a cómo se dicen los guiones:

- **Marca con cara de fundador.** Sales tú, pero el perfil es la marca. Es lo que hacen las
  buenas cuentas de producto pequeño, y funciona — pero exige que **la cara aparezca siempre**.
  Si un día sale tu cara y al siguiente es motion puro sin voz, la cuenta se lee como dos cuentas.
  El motion queda para lanzamientos, no para el día a día.
- **Nadie sabe quién eres al llegar.** En tu cuenta personal el «yo» se entiende solo; en
  @tactium, no. Lo resuelvo con un **cartelito abajo los dos primeros segundos**
  («Javier · hizo TACTIUM»), así no tienes que gastar diálogo en presentarte salvo en el R1.
- **No presentes la marca dentro del vídeo.** Estás en su perfil. Nada de «se llama TACTIUM»
  ni «con TACTIUM puedes». Se dice «aquí», «esto», y ya.
- **El «hablamos» del R4 es un DM a la cuenta.** Deja los mensajes abiertos.

⚠️ **El carril B no encaja aquí.** CLUBNEXT lo manda a LinkedIn, y una *página de empresa* de
LinkedIn no tiene alcance orgánico: es un tablón de anuncios. Ese carril funciona desde **tu
perfil personal** aunque el contenido sea de TACTIUM. No es contradictorio con la decisión:
Instagram y TikTok van a @tactium, y el material de venta a clubes lo publicas tú.

## Constantes visuales (de CLUBNEXT, y son buenas)

Van en **todas** las piezas, son la identidad del nicho:

- **Luz fea de club, no golden hour.** El pádel amateur se juega bajo fluorescente y luz plana.
  Falsearlo canta y se lee como anuncio.
- **Móvil en la mano** (A1, A3) o **trípode fijo** (A2). Nunca grúa, nunca steadycam.
- **Que parezca un vídeo de grupo de WhatsApp, no un anuncio.** Grano, encuadre algo torcido,
  compresión. Si sale demasiado bonito, está mal.

---

# TANDA 1 — Carril capitán · conversión

Las tres van **la misma semana**. Se queda el ángulo ganador y de ese se hacen 10 variantes.
Duración objetivo **10-15s** cada una: gancho 0-2s · desarrollo 2-6s · producto 6-8s · remate 8-10s.

---

## A1 — «Diecisiete federaciones» → `A1-federaciones.mp4` · ~12s

**La primera que se publica.** Es el único ángulo que nadie te puede copiar, porque el trabajo
está hecho y es verdad. No promete: demuestra.

> **[A cámara, junto a una pista, medio serio]**
> Me leí la normativa de alineaciones de las diecisiete federaciones de pádel.
> Una por comunidad. Y no dicen lo mismo.
>
> **[Levanta el móvil, se ve la app un segundo]**
> Así que lo metí todo aquí dentro.
>
> **[Encogimiento de hombros, cierre]**
> Tú eliges jugadores; el orden te lo valida solo.

**Esto es verdad, lo he comprobado en el código**: `TACTIUM/src/core/data/federations.ts` tiene
las 17 autonómicas (más Ceuta y Melilla, y la FEP como referencia), con el número de parejas por
federación, liga y género. Y `LineupScreen` valida el orden con `requiresStrengthOrder`.
Puedes decirlo mirando a cámara sin que te tiemble la voz.

---

## A2 — «El orden de parejas» → `A2-orden.mp4` · ~12s

Formato distinto a propósito: **móvil en la mesa, cámara fija en trípode**, plano de pecho para
arriba. Mesa del bar del club, con el móvil boca arriba en primer plano.

> **[0-2s, inclinado hacia delante, a cámara]**
> El orden de parejas de tu equipo probablemente está mal.
>
> **[2-5s, se encoge de hombros, una mano explicando]**
> No por mala fe: es que cada federación lo define distinto.
> Y si la pareja dos es más fuerte que la uno, te la pueden impugnar.
>
> **[5-8s, coge el móvil y gira la pantalla hacia cámara]**
> Aquí lo tienes comprobado antes de mandarlo.
>
> **[8-10s, lo deja donde estaba y se echa atrás con un gesto de asentimiento]**

**Graba la pantalla del error, es literal.** Cuando la pareja 2 suma más puntos que la 1, la app
pinta en rojo `Pareja 2 más fuerte que la 1`. Esa captura es el reel entero: enséñala.

⚠️ **Contrasta antes de publicar** la frase «te la pueden impugnar». Es la única de todos los
guiones que hace una afirmación de reglamento, y el código modela el orden obligatorio pero no
la sanción. Tienes la normativa en `Normativa Liga Cántabra de Pádel 2026 NUEVO FORMATO(1).pdf`.
Si no lo dice con esas palabras, cámbialo por «te lo pueden reclamar» y listo.

---

## A3 — «De una hora a dos minutos» → `A3-dos-minutos.mp4` · ~12s

El más convencional de los tres, y por eso hay que tenerlo: es el que convierte cuando ya te conocen.
Rodado **dentro del coche**, aparcado en el club, sin arrancar, móvil apoyado en el salpicadero.
Energía de final de semana, algo cansado.

> Cada jornada perdía una hora montando la alineación.
> Grupo de WhatsApp, quién puede, quién no, y el lío del orden.
> Ahora lo hago desde el coche antes de arrancar.
> Dos minutos.

---

# TANDA 2 — Piezas largas (30-45s)

Las tres de arriba son para captar. Estas son para que quien ya paró entienda y se quede.

## R1 — «Lo he construido yo solo» → `R1-fundador.mp4` · ~40s

> **[GANCHO, a cámara]**
> Soy Javier, y esta aplicación la he construido yo solo.
> Doce meses. Sin equipo y sin un euro de inversión.
>
> **[DESARROLLO — tapo con A9 abrir app + A1 alineación + A3 torneo]**
> Juego al pádel federado, y cada semana veía lo mismo: el capitán persiguiendo a ocho tíos
> por WhatsApp para saber quién juega el sábado. La disponibilidad apuntada en una libreta.
> Los resultados que se pierden. Y los datos de la federación en una web que parece de 2005.
>
> Así que me puse. Aplicación para iPhone y Android, la web, el backend,
> y hasta un agente que sincroniza los datos de la Federación Cántabra.
>
> **[CIERRE, a cámara]**
> Esto es TACTIUM por dentro. Quédate.

**Ganchos alternativos** (graba los tres seguidos, pruebo cuál tira):
- «Nadie me ha pagado por hacer esto.»
- «Doce meses, una persona, cero euros de inversión. Esto es lo que salió.»
- «Si juegas al pádel federado, esto lo he hecho por ti. Literalmente.»

## R2 — El domingo del capitán → `R2-capitan.mp4` · ~35s

> **[GANCHO, a cámara]**
> Si eres capitán de un equipo de pádel, esto te va a doler.
>
> **[DESARROLLO — tapo con B7 el caos: el grupo de WhatsApp haciendo scroll]**
> Domingo por la noche. Abres el grupo. Ochenta y cuatro mensajes sin leer.
> Tres que dicen «yo el sábado no sé todavía». Dos que no han contestado.
> Y tú ahí, con una libreta, intentando cuadrar cuatro parejas.
>
> **[GIRO — tapo con A1 alineación]**
> Aquí tus jugadores marcan si están disponibles. Tú abres la jornada,
> ves quién puede, montas la alineación y le das a publicar. Se entera todo el mundo a la vez.
>
> **[CIERRE, a cámara]**
> Diez segundos. No hora y media de chat.

## R3 — El escáner → `R3-escaner.mp4` · ~30s

Necesito **el calendario de la liga en papel de verdad** en la mano.

> **[GANCHO, a cámara, enseñando el papel]**
> Mira lo que pasa cuando le hago una foto a esto.
>
> **[DESARROLLO — tapo con A2 escáner]**
> Es el calendario de la liga. En papel. Como te lo dan.
> Le hago una foto desde la app… y me monta la temporada entera.
> Todas las jornadas, contra quién juegas cada una, si es en casa o fuera.
>
> **[CIERRE, a cámara]**
> Antes era una tarde copiando fechas a mano.

## R4 — Un torneo en dos minutos → `R4-torneo.mp4` · ~40s

Carril B (club). Este es el que te trae a quien paga.

> **[GANCHO, a cámara]**
> Así se monta un torneo de pádel de treinta y dos parejas.
>
> **[DESARROLLO — tapo con A3 torneo + A4 inscripción]**
> Eliges el formato: fase de grupos y eliminatoria, con cuadro de consolación
> para que nadie se vuelva a casa después de perder un partido.
> Generas los cuadros, y la app reparte los partidos pista por pista, con su horario.
> Los jugadores se inscriben con un código desde el móvil y pagan por la web.
>
> **[CIERRE, a cámara]**
> Si tu club sigue haciendo esto con un Excel, hablamos.

## R5 — La federación → `R5-federacion.mp4` · ~35s

> **[GANCHO, a cámara]**
> Tus puntos federados están en una web que parece de 2005.
>
> **[DESARROLLO — tapo con A5 federación]**
> Y para saber si puedes jugar una categoría, te toca buscarte a ti mismo en un PDF.
> Hice un agente que sincroniza los rankings, las clasificaciones y los cuadros
> de la Federación Cántabra, y los mete dentro de la app.
> Cuando te inscribes a un torneo, el sistema ya sabe tus puntos.
> Y te dice si puedes jugar esa categoría o no.
>
> **[CIERRE, a cámara]**
> Sin buscar nada. Sin preguntar a nadie.

## R6 — «No quieres otra app» → `R6-objecion.mp4` · ~25s

> **[A cámara, entero]**
> No quieres otra app. Lo sé.
> Nadie se levanta por la mañana con ganas de instalarse otra aplicación más.
> Lo que quieres es dejar de perseguir a ocho tíos por WhatsApp cada semana.
> Eso es lo único que hace TACTIUM: que el sábado sepas quién juega.

---

## Lo que NO digas nunca en cámara

- «Solución integral», «plataforma 360», «revolucionar el pádel», «potenciar».
- Listas de funcionalidades seguidas. Una idea por pieza.
- El precio, todavía. Primero que entiendan para qué sirve.
- Nada que no puedas demostrar en pantalla. Los tres de la tanda 1 se pueden demostrar.

## El perfil, antes de publicar nada

El primer reel que funcione va a mandar gente al perfil. Que esté montado:

- **Nombre** (el campo que sí busca el buscador, no el @): `TACTIUM · Pádel de equipos`.
  Que aparezcas cuando alguien busque «pádel equipos» o «alineaciones pádel».
- **Bio**, tres líneas, concreta y sin adjetivos:
  `La app para capitanes y clubes de pádel.` / `Alineaciones según la normativa de tu federación.`
  / `Torneos, temporadas y federación en un sitio.`
- **Foto**: el isotipo sobre fondo oscuro, que es como se reconoce a 40 píxeles. El wordmark
  completo no se lee en un círculo pequeño.
- **Enlace**: a `tactium.io`, no a la ficha de la App Store. La landing ya reparte a las dos tiendas
  y encima puedes medirla.
- **Destacados** desde el primer día: *Qué es* · *Capitanes* · *Clubes*. Ahí va la tanda 2.

## Medición (de CLUBNEXT, paso 8)

| Métrica | Umbral | Si falla, lo que está roto es |
|---|---|---|
| Retención 3 s | > 50% | el gancho |
| Retención 50% | > 30% | el formato |
| Guardados | > 1% | el ángulo |
| Clics a perfil | > 2% | el remate |
