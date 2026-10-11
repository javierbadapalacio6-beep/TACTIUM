# 26 fórmulas de gancho, en español y para TACTIUM

Biblioteca del agente `editor-video-viral`. Adaptada de `hooks.json` de «instagram-agent-skill» de Jake Schincariol
(MIT, https://github.com/Jakeschincariol/instagram-agent-skill): las 26 estructuras son de ahí; las plantillas en
español y los ejemplos para pádel federado son nuestros. Última actualización: 11-10-2026.

**Los ejemplos son plantillas. Todo lo que lleve `{…}` se rellena con un hecho REAL nuestro.** Nada de inventar
cifras, equipos, resultados ni «clientes»; si falta el dato, se deja `{tu cifra}` y se avisa.

## Reglas (valen para las 26)

1. **Un reel tiene DOS ganchos a la vez y no son la misma frase:** lo primero que se **dice** (~2 s) y lo primero que
   se **ve** (~1 s: se lee antes de oírse). El de pantalla es más corto y más seco: **6 palabras o menos**, sin
   puntuación que no haga falta, y ya está en el fotograma 1.
2. **Sin preámbulo.** El vídeo empieza por la frase que normalmente dirías en el segundo seis. Nada de «hola», «en este
   vídeo» ni logo.
3. **Di el número.** «Mucho» no es un número ni «un montón de tiempo».
4. **El primer fotograma también es gancho:** un plano fijo de una cara sin texto ni movimiento son tres ganchos tirados.
5. **Si el gancho serviría igual a cualquier otra cuenta de pádel, no es tuyo.** Mete lo único que solo nosotros
   podemos decir (la Liga Cántabra, el orden de fuerza, la jornada, el capitán).
6. **Un gancho promete algo: cúmplelo antes de la mitad** o devuelves la retención que compraste.

## Cómo se usa

1. Elige **tres fórmulas distintas** que encajen con la idea (no tres versiones de la misma). Escribe la línea hablada y la
   de pantalla de cada una.
2. Puntúalas: `node scripts/guion.mjs gancho -f ganchos.txt`. Si la mejor no llega a 50, **todavía no hay gancho**:
   reescribe, no retoques. (La puntuación es una regla de oficio, no una medición de Instagram.)
3. Pruébalas **una por día** (reels de prueba si están activados): el resultado real manda sobre la puntuación.
4. Anota la fórmula usada en `APRENDIZAJES-VIDEO.md`: así se ve qué fórmula funciona en NUESTRA cuenta.

## Las 26

| # | Fórmula | Plantilla | Ejemplo TACTIUM (rellenar con datos reales) | Cuidado |
|---|---|---|---|---|
| 1 | Confesión de coste | «{Una cifra} es lo que me costó {un error}» | «Un domingo sin pareja tres me costó {un punto de grupo}» | Solo si es verdad y es tuyo |
| 2 | Mandato negativo | «Deja de {hacer X}. Haz {Y}» | «Deja de montar la alineación en el grupo de WhatsApp. Hazla con orden de fuerza» | No pidas atención («para de hacer scroll») |
| 3 | Nadie te cuenta | «Nadie te cuenta que {verdad incómoda}» | «Nadie te cuenta que tu pareja 2 no puede sumar más puntos que la 1» | Que la verdad sea comprobable |
| 4 | El reemplazo | «{Esto} sustituyó a {cosa larga/cara} por {precio}» | «Una app sustituyó a la libreta del capitán por {precio}» | No prometas lo que la app no hace |
| 5 | Colapso del tiempo | «Esto me llevaba {mucho}. Ahora, {poco}» | «Montar la alineación me llevaba una hora. Ahora, veinte segundos» | La proporción tiene que ser creíble |
| 6 | El recibo | «Probé {X} {N} días. Los números reales» | «Probamos la disponibilidad con un toque {N} jornadas. Esto contestó el grupo» | Números propios y medidos |
| 7 | Mal hecho, bien hecho | «Estás haciendo {X} mal, y no es culpa tuya. {Arreglo}» | «Estás ordenando las parejas a ojo, y no es culpa tuya. Hay un orden de fuerza» | No culpes a la persona |
| 8 | Filtración desde dentro | «Llevo {N años} {dentro de X}. Esto no se dice» | «Llevo {N temporadas} de capitán. Esto no lo cuenta nadie del grupo» | Solo con experiencia real |
| 9 | Llévatelo | «Copia esto: {plantilla}. Me costó {tiempo} acertarla» | «Copia este mensaje para pedir disponibilidad al grupo» | Regala algo de verdad |
| 10 | Si esto, entonces mira | «Si {situación concreta}, estos {segundos} lo arreglan» | «Si eres capitán y nadie contesta al WhatsApp, estos 20 segundos lo arreglan» | Situación muy concreta |
| 11 | Lista con favorito | «{N} {cosas} para {resultado}. La {k} no la usa nadie» | «3 cosas que pasan el domingo en tu grupo. La tercera la sufres tú» | No hagas listas de herramientas: no se comparten |
| 12 | La objeción | «“{Objeción real}.” Vale. Aun así, esto funciona» | «“Yo ya lo llevo en un Excel.” Vale. Mira lo que pasa cuando hay dos bajas» | Cita una objeción que oyes de verdad |
| 13 | Antes y después en pantalla | {Enseña lo viejo}. {Enseña lo nuevo}. {Una frase sobre la palanca} | WhatsApp con 47 mensajes → la convocatoria ordenada | Sin anotaciones sobre las capturas |
| 14 | El apelativo | «{Grupo concreto}, esto va por vosotros» | «Capitanes de {categoría}, esto va por vosotros» | Un grupo concreto, no «todos» |
| 15 | El registro de fracasos | «Mis primeros {N} {intentos} no sirvieron. Esto cambió en el {N+1}» | «Mis primeros 10 reels no llegaron a 300 visualizaciones. Esto cambió en el 11» | Solo si lo cuentas con números reales |
| 16 | La pregunta literal | «“{Pregunta tal cual}”. Me lo preguntan cada semana» | «“¿Al final jugamos el domingo?” Me lo preguntan cada semana» | La pregunta debe existir |
| 17 | Cara a cara | «{A} contra {B}. Probé los dos {tiempo}» | «Libreta contra convocatoria con un toque. Probé los dos {N} jornadas» | No inventes un resultado |
| 18 | Demo en frío | {Empieza ya haciendo la cosa}. «Mira lo que hace esto» | Se abre ya sobre la pantalla de alineación moviéndose | Que el primer fotograma se mueva |
| 19 | La fecha límite | «{Cosa} cambia el {fecha}. Haz {acción} antes» | «La primera jornada es el {fecha}. Mira tu grupo antes» | Fechas reales y comprobadas de la Federación |
| 20 | Permiso | «No necesitas {lo que todos dicen}» | «No necesitas que tus jugadores se instalen nada» | Que sea cierto |
| 21 | A media frase | «…y entonces fue cuando {el giro}» | «…y entonces vimos que éramos cinco parejas y cuatro jugadores» | Un giro que se entienda sin contexto |
| 22 | Giro contrario | {Refrán o frase hecha, al revés} | «Lo importante no es participar: es no jugar con pareja 3 de pareja 1» | Que se entienda al instante |
| 23 | La estadística | «El {N} % de {grupo} {dato sorprendente}» | «323 equipos en 41 grupos: el tuyo es {el más duro / el más igualado}» | Datos reales de la liga (script `liga-datos.mjs`) |
| 24 | La revelación | «Esto es lo nuevo {cosa}» | «Esto es la ficha de tu equipo en la Liga 26/27» | No prometas más de lo que enseñas |
| 25 | El resultado de otro | «Hubo un {capitán} que {resultado} en {tiempo}» | «Un capitán de {categoría} montó su jornada en {tiempo}» | Con permiso y sin nombre de jugador |
| 26 | El superlativo | «El {más rápido / único} {cosa} es {la respuesta}» | «La forma más rápida de saber quién juega el domingo» | Solo si puedes defenderlo |

## Mejores apuestas para empezar (según nuestros datos y los virales de VIRALES.md)

Las que más se parecen a lo que ya ganó (situación reconocible, dato local, humor de capitán): **#16 la pregunta
literal**, **#5 colapso del tiempo**, **#23 la estadística local**, **#14 el apelativo** y **#12 la objeción**. Las de
«producto» (#4, #24, #26) son las que peor resultado han dado: úsalas dentro de una pieza, no para abrir.
