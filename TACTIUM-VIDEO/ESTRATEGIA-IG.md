# Estrategia de crecimiento · @tactium.io

Documento vivo. Lo mantiene el agente `estratega-instagram` (`.claude/agents/estratega-instagram.md`).
Creado el 10-10-2026. Cada afirmación lleva su nivel de certeza:

- ✅ **Oficial** — documentación de Meta o dato propio de la cuenta.
- 🟡 **Declarado** — lo dicen Instagram/Mosseri según la prensa del sector; no he visto la fuente primaria.
- ⚪ **Folclore** — blogs y herramientas de programación; úsalo como hipótesis a probar, no como verdad.

## 1. Tesis de crecimiento

Instagram reparte los reels a **desconocidos** (el 91 % de nuestro alcance ya son no seguidores) y decide por tres señales: tiempo de visionado, «me gusta» por alcance y **envíos por mensaje directo por alcance** 🟡. Para quien no te sigue, los envíos pesan algo más que los likes 🟡.

Nuestro nicho tiene una ventaja que casi nadie tiene: **un jugador de pádel federado manda por WhatsApp e Instagram lo que habla de SU equipo**. Hay 323 equipos y 41 grupos en la Liga Cántabra 26/27. Cada equipo son ~10-12 personas con un grupo de chat. Una pieza sobre su equipo, su club o su rival se reenvía; una pieza sobre «una app» no.

```
contenido sobre SU equipo/club/rival → se envía al grupo de WhatsApp → visitas al perfil → seguidores
        → el capitán ve TACTIUM → descarga / prueba de 14 días
```

El competidor (Padel Pro Manager, 204 seguidores) ya hace una versión de esto: una pieza por equipo o club con datos reales, etiquetando la cuenta del club. Nosotros tenemos mejores datos (6 temporadas, grupos, zonas, plantillas) y una app mejor: hay que usarlos.

## 2. Línea base (10-10-2026, datos propios ✅)

346 seguidores · 14 piezas medidas desde el 28-09.

| Formato | Piezas | Visualizaciones (mediana) | Compartidos/pieza | Guardados/pieza | Comentarios |
|---|---|---|---|---|---|
| Reel | 9 | 581 | 1,3 | 0,0 | 0 |
| Carrusel | 4 | 304 | 1,5 | 0,3 | 0 |
| Post | 1 | 843 | 1,0 | 0 | 0 |

- **Retención de los reels:** 2,7-5,3 s de media; ninguno llega a los 7 s del objetivo.
- **Ganadores:** V1 «Se acabó el verano» (2.871 visualizaciones), A1 (1.199), T1 «Alineación en 20 s» (1.079), J1 (917) y lo local: carrusel G1 «Ya están los grupos» (826) y post P1 «26/27 ya está cargada» (843).
- **Perdedores:** los reels «M» de motion y W1 (~100 visualizaciones cada uno) y el carrusel C2 (96).
- **Lo que falta del todo:** conversación (0 comentarios) y guardados (0). Sin eso el algoritmo no ve interés más allá de ver.
- **Conclusión:** gana lo humano y lo local; pierde lo abstracto y lo de producto puro.

## 3. Cómo funciona Instagram (lo que sabemos)

| Tema | Qué sabemos | Certeza |
|---|---|---|
| Señales de ranking | Tiempo de visionado, likes/alcance y envíos/alcance. Likes algo más importantes para seguidores; envíos algo más para no seguidores | 🟡 |
| «Envíos valen 3-5 × un like» | Cifra repetida en muchos blogs; Instagram nunca ha publicado un peso | ⚪ |
| Reels de prueba | Solo los ven NO seguidores, no salen en el perfil, se gradúan a seguidores a mano o solos si rinden. La documentación de Meta describe `trial_params` para la API, pero **desde esta cuenta no se pueden subir por API (corrección de Javier, 11-10): se suben A MANO** | ✅ (propio) |
| Alcance de las pruebas | Menor que un reel normal (no tienen el empujón inicial de los seguidores) | 🟡 |
| Requisitos de las pruebas | Los blogs dicen entre 200 y 1.000 seguidores; la documentación de Meta no dice nada. **Hay que probarlo** | ⚪ |
| Datos de las pruebas por API | Meta no dice si devuelven métricas; el informe del bot avisa si no llegan | ❓ |
| Palabras clave | Los textos del pie, el texto en pantalla y lo que se dice pesan más que los hashtags para descubrir | 🟡 |
| Hashtags | 3-5 relevantes; ya no son una palanca de crecimiento | ⚪ (cifra) |
| Contenido original | Se prioriza lo hecho por una persona y se penalizan reposts; en 2026 se enfatiza lo «humano» sobre lo pulido | 🟡 |
| Colaboraciones (collab) | Un post compartido sale en los dos perfiles y suma sus métricas; sin mínimo de seguidores; hasta 3 colaboradores (la API) | ✅ / ⚪ (efecto) |
| Mejor hora | No existe una universal. Consenso de guías para España: tarde-noche entre semana (20-23 h), mediodía de 13:30 a 15:30, fines de semana por la mañana; noches de viernes y sábado, peores | ⚪ |
| Hora en nuestra cuenta | Mejor mediana de reels de 18 a 20 h (2.871) y peor los lunes. `online_followers` vuelve vacío: aún hay pocos datos | ✅ |
| Retención | No hay referencia externa fiable. Se compara con la mediana propia; si la retención media baja de 3,5 s el reel muere | ⚪ / ✅ |

## 4. Reels de prueba: el motor de la semana

Un reel de prueba cada día, a un público que no nos conoce, sin quemar a los seguidores.

**Protocolo diario**
1. Se publica 1 reel de prueba al día a las 19:00 (ver §6 para variar la hora).
2. A las 24 h el bot manda el informe con la **decisión**:
   - ✅ **Graduar** si cumple al menos 2 de 3: retención ≥ 5 s, ≥ 3 envíos por 1.000 de alcance, alcance ≥ la mitad de la mediana.
   - 🟡 **Dudoso**: espera a las 72 h.
   - 🗑️ **Descartar**: se archiva y se prueba otro gancho.
3. Lo graduado se comparte con seguidores desde la app (**Reels de prueba → Compartir con todos**) y se **manda a mano** a los grupos de los equipos que salen en él. Se empuja con 2 historias.
4. Cada descarte deja una línea en el registro (§9): qué gancho, qué falló.

**Reglas**
- Probar UNA variable por reel: el gancho, la duración o el tema.
- Misma idea con 2-3 ganchos distintos en días distintos.
- Objetivo: 7 pruebas a la semana, 2-3 graduadas.
- Activar con `ig_reels_prueba = AVISO` (y `ig_reels_prueba_piezas` si solo quieres algunos): a la hora de cada reel el bot manda el vídeo, los pasos y el pie a Telegram, tú lo subes como reel de prueba y a las 24 h te recuerda qué mirar. Hoy está en `off`.

## 5. Sistema de contenido

Cinco pilares; cada pieza pertenece a uno.

1. **LIGA (el motor).** Ficha de equipo o club, previa de la jornada, quién sube y quién baja, zonas, «tu rival». Siempre equipos y clubs, **nunca nombres de jugadores**.
2. **CAPITÁN (identificación y humor).** El caos del WhatsApp, el orden de parejas, «¿al final jugamos?». Es lo que más se comparte.
3. **CARA (humano).** Javier en cámara, detrás de la app. Lo «humano» es el diferencial frente a un competidor sin cara.
4. **PRODUCTO (prueba, no anuncio).** Una demo de 15-20 s dentro de una historia más grande. Nunca abrir con el producto.
5. **TORNEOS (herramienta, no organizador).** CTA a organizadores: «el torneo lo pones tú».

**Semana tipo** (7 reels de prueba → 2-3 graduados, más lo fijo)
- 3 reels de LIGA/CAPITÁN graduados o normales.
- 2 carruseles de consulta (**guardables**: calendario, ranking, normativa).
- 4-6 historias al día con un sticker de pregunta o encuesta.
- 1 pieza de CARA.

**Reglas de la casa:** formato 9:16 · texto dentro de la zona segura (x 80-910, y 260-1540) · la acción en el primer fotograma, sin intro ni logo · subtítulos · 5 parejas / 10 jugadores por encuentro en la Liga Cántabra · sin anotaciones sobre las capturas de pantalla · con voz en off, todo texto se dice · no reutilizar vídeos ya publicados · no presumir de «17 federaciones» (solo la Cántabra está activa).

## 6. Horas: cómo averiguarlas en vez de adivinarlas

- Dos semanas, tres franjas rotando para los reels de prueba: **13:30 · 19:00 · 21:30**.
- Se compara la **mediana** por franja con al menos 5 piezas cada una, no un reel suelto.
- Se evitan las noches de viernes y sábado; el fin de semana, por la mañana.
- Cuando `online_followers` devuelva datos, manda ese dato.
- Hasta entonces: reels 19:00 (nuestro mejor dato), carruseles 14:00.

## 7. Conversación (lo que hoy vale 0)

- **Primera hora:** responder a TODOS los comentarios y mensajes en los primeros 60 minutos.
- **Pregunta de cierre** en cada pieza: de dos opciones y con respuesta fácil («¿Pareja 1 o pareja 2?», «¿En qué grupo estás?»).
- **Historias:** una pregunta o encuesta al día. Las respuestas cuentan.
- **Guardados:** carruseles de consulta con «guárdalo para la jornada 1».
- **Objetivo 30 días:** ≥ 1 comentario por cada 500 de alcance; ≥ 10 guardados por cada 1.000.

## 8. De visita a seguidor (conversión)

- **Perfil:** nombre con palabra clave («TACTIUM · App de pádel federado»), bio con el beneficio («Alineación de tu equipo en 20 s · Liga Cántabra»), enlace a tactium.io, ubicación Santander.
- **Fijados:** el mejor reel, «cómo funciona» y «Liga 26/27».
- **Destacadas:** las seis nuevas (Cómo funciona · Liga 26/27 · Equipos · Clubs · Torneos · Descargar).
- **Cierre de cada pieza:** «sigue la cuenta» solo si hay un motivo concreto (la jornada, el ranking), no genérico.
- **El enlace de disponibilidad** (tactium.io/d/…) es una puerta de entrada: cada jugador que responde ve TACTIUM.

## 9. Colaboraciones y menciones

- **Colaborador por defecto:** `@javierbademiro` (activo en `ig_colaboradores`).
- **Clubs (colaboración o etiqueta), solo si la cuenta es clara:** G6 `@g6padelgym`, Smash `@smash_padel_club`, Alday `@alday_padel_club`, Medio Cudeyo `@padelmediocudeyo`. Regla del usuario: **si no está claro, no mencionar a nadie**.
- Máximo 2-3 etiquetas por pieza, solo equipos o clubs, nunca jugadores.
- Invitar al club solo cuando la pieza trata de él; si invitamos siempre, dejará de aceptar.

## 10. Objetivos (hipótesis ambiciosas, a revisar cada lunes)

| Plazo | Seguidores | Reels con ≥ 5 s de retención | Compartidos/1.000 | Guardados/1.000 |
|---|---|---|---|---|
| Hoy (10-10) | 346 | 0 de 9 | ~1-2 | 0 |
| 9-11 | 600 | 3 de cada 7 | ≥ 4 | ≥ 5 |
| 9-12 | 1.000 | 4 de cada 7 | ≥ 6 | ≥ 10 |
| 1-03 | 2.000 | 5 de cada 7 | ≥ 8 | ≥ 10 |

Cuenta de la ventaja: ganar 8 seguidores al día con una conversión del 0,3 % del alcance exige ~2.700 de alcance diario. Hoy el alcance medio por reel ronda los 600. Hay que multiplicar el alcance por 4-5 **o** la conversión por 3. Los reels de prueba y las piezas de equipo atacan el alcance; la bio, los fijados y los cierres atacan la conversión.

## 11. Registro de experimentos

| Fecha | Hipótesis | Qué se cambia | Métrica | Umbral de éxito | Resultado |
|---|---|---|---|---|---|
| (pendiente) | El nombre del equipo en el gancho dispara los envíos | Gancho con «Tu equipo, grupo X» | Envíos/1.000 | ≥ 4 | — |
| (pendiente) | Un reel de ≤ 12 s retiene más que uno de 20 s | Duración | Retención | ≥ 5 s | — |
| (pendiente) | Carrusel de consulta con «guárdalo» se guarda | CTA + contenido útil | Guardados/1.000 | ≥ 10 | — |
| (pendiente) | Franja 21:30 supera a 19:00 | Hora | Mediana de visualizaciones | +20 % | — |

## 12. Cómo leer los informes de Telegram

- **Cada pieza del feed:** informe a las 48 h (24 h si fue reel de prueba), con alcance frente a la mediana de su formato, retención (reels), tasas por 1.000, crecimiento por pieza (seguidores y visitas al perfil; Instagram solo lo da en carruseles, posts e historias, NO en reels), diagnóstico y siguiente paso.
- **Historias:** informe entre las 16 y las 24 h con salidas, toques adelante/atrás y respuestas.
- **Lunes:** crecimiento (seguidores, meta, alcance, % de no seguidores, visitas, clics), marcador por formato, mejor y peor pieza, lectura del experto y **la apuesta de la semana**.

## 13. Qué NO hacer

- Comprar seguidores, grupos de «follow for follow» o bots de comentarios.
- Etiquetar 20 cuentas en el pie.
- Reutilizar vídeos ya publicados.
- Mensajes directos en frío por Instagram a clubs (riesgo de bloqueo): usar email o WhatsApp al contacto del club.
- Prometer en la bio cosas que la app no hace.
