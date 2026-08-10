# Torneos · Backlog de mejoras (feedback clubes)

> Documento vivo. Recogido a partir del feedback de clubes (Smash, etc.). Fecha inicio: 2026-07-29.
> Prioridad: 🔴 alta · 🟡 media · 🟢 baja. Esfuerzo: S/M/L/XL.

---

## 1. Modo de torneo: CUADRO PRINCIPAL + CUADRO CONSOLACIÓN ✅ HECHO (2026-07-29)
> Formato `ko_consolation`. `generateKoBracket` crea main + esqueleto de consolación (size/2). `setMatchResult` enruta al perdedor de R1 principal a consolación (con auto-avance si el rival sale de un BYE). UI: conmutador Principal/Consolación en el detalle. Demo listo: torneo "Demo Consolación" (8 parejas, code SMASHCON8) para jugar R1 y ver caer los perdedores. Limitación conocida: si dos partidos R1 adyacentes son BYE (muchos byes), su partido de consolación queda muerto (raro).

**Objetivo:** que **todos jueguen al menos 2 partidos**.
- Al inicio, todas las parejas en el **cuadro principal**.
- Ganas → sigues en el principal. Pierdes → caes al **cuadro consolación**.
- (Es una eliminatoria con repesca: los perdedores alimentan un segundo cuadro.)

**Implica:**
- Nuevo `format` (p. ej. `ko_consolation`).
- Generación del cuadro: al crear el principal, crear el esqueleto de consolación.
- `advanceWinner` debe además **enrutar al PERDEDOR** al hueco correspondiente de consolación.
- UI: sub-pestañas Principal / Consolación (ya existe el patrón oro/plata/bronce → reutilizable).

**RESUELTO:** solo caen a consolación los **perdedores de la 1ª ronda**. La consolación tiene **su propia final/premio**. → Un segundo cuadro de eliminación sembrado con los perdedores de R1 (estructura análoga a oro/plata ya existente). `advanceWinner` debe enrutar al perdedor de R1 al hueco de consolación.
- Pendiente: byes/nº de parejas no potencia de 2 (definir al implementar).

---

## 2. Horarios: edición manual total + disponibilidad por franjas con tope ✅ HECHO (2026-07-29)
**2a. ✅** rejilla de TODOS los huecos (día × hora × pista) en el Horario → botón "Editar rejilla". Modelo tap-para-mover: tocas un partido (en rejilla o en "sin hora") para cogerlo y un hueco libre para soltarlo; "Quitar" lo saca del horario. Sin drag&drop. `clearMatchSlot` nuevo.
**2b + 2c. ✅** disponibilidad por franjas de 1h en la inscripción: el jugador marca en rojo las horas que NO puede (por defecto disponible en todas), con **tope de franjas que fija el club** (`tournaments.max_removable_hours`, en el sheet de crear; contador N/tope). Ventana diaria = `start_time`–`end_time` (nuevo `end_time`, default 22:00). Se guarda la disponibilidad restante en `registrations.availability` (formato compatible con `regAvailableAt`); el motor usa `end_time` como fin. `tournament_lookup` v3 devuelve start/end/max_removable_hours. Sin tramos obligatorios (decidido). Pendiente menor: editar `end_time` desde el sheet de configuración de horario (hoy usa default).

**2a (original). Mostrar TODOS los slots posibles al generar el horario**, para mover/reasignar a mano (rejilla día × hora × pista, incluidos huecos vacíos).

**2b. Disponibilidad del jugador por FRANJAS DE 1 HORA** (17:00-18:00, 18:00-19:00…), no por "cualquier hora / rangos sueltos".

**2c. Tope de franjas que un jugador puede QUITAR.**
- Por defecto disponible en todas las franjas del torneo; el jugador marca las que NO puede.
- El club fija un **máximo de horas quitables** (ej.: torneo L-D, 17:00-22:00 entre semana = 20 huecos; máximo quitar 8).
- Ciertos tramos **no cancelables** (ej.: fines de semana obligatorios).

**Implica:** cambio del modelo de `availability` (hoy `text[]`), migración, UI de signup por franjas con contador/tope, editor de horario tipo rejilla arrastrable.

**RESUELTO (parcial):** el **club elige cuántas horas** puede quitar cada jugador (config por torneo).
- Pendiente: cómo se marcan los tramos **obligatorios** (findes no cancelables); rejilla de edición ¿drag&drop o tocar hueco→elegir partido?

---

## 3. Categorías por PUNTOS/NIVEL con 2 patrones (elige el club) ✅ HECHO (2026-07-29)
> Implementado y verificado (validación servidor probada). Pendiente OTA/ship. Falta: automatizar nivel Cantabria (FCP) y mostrar nivel/puntos en la lista de inscritos del club.

El club organizador fija los valores por categoría y elige **uno** de los dos patrones (o el que quiera):

**Patrón 1 · Tope de puntos (suma pareja ≤ máximo).**
- Ej.: categoría 5 → máx 1600. Si entre los dos sumáis > 1600, no podéis jugar esa categoría.

**Patrón 2 · Suma de nivel de liga (suma pareja ≥ umbral).**
- Cada jugador aporta el número de su división de liga (2ª→2, 4ª→4…).
- La pareja suma sus dos divisiones. Ej.: juego 2ª + compañero 4ª → suma 6.
- Categoría 5 exige suma **≥ 10**. Como 6 < 10, esa pareja es "demasiado fuerte" → NO puede jugar la 5ª.
- (Evita que jugadores fuertes bajen a categorías flojas.)

**El creador elige el modo:** solo puntos / solo nivel / **ambos** (el cartel real de Smash usa ambos, ver abajo).

**Ejemplo real (5º Aniversario Smash) — cada categoría = NIVEL / PUNTOS:**
- Masc: 1ª LIBRE · 2ª 4/7200 · 3ª 6/4000 · 4ª 8/2600 · 5ª 10/1600 · 6ª 12/800
- Fem: 1ª LIBRE · 2ª 4/7200 · 3ª 6/3600 · 4ª 8/1300 · 5ª 10/500
- Mixta: A LIBRE · B nivel ≥ 7
- NIVEL = suma niveles de liga de la pareja, debe ser **≥** el valor. PUNTOS = suma FEP, **≤** el valor. LIBRE = sin límite.
- Se puede inscribir en varias categorías (Smash: 1 cat 22€, 2 cats 35€).

**Modelo de datos:**
```
tournaments.category_rules (jsonb):
{ "mode": "points" | "nivel" | "both",
  "byCategory": { "5ª": { "puntos": 1600, "nivel": 10 }, "1ª": null /*LIBRE*/, ... } }
tournament_registrations.league_sum (int)  -- suma de niveles de la pareja
tournament_registrations.seed_points (int, ya existe)  -- suma de puntos de la pareja
```

**Implica:** config por categoría al crear (NIVEL+PUNTOS+modo), validación en la inscripción (cliente + RPC `tournament_signup`/`tournament_lookup`), y para NIVEL necesitamos el nivel de liga de cada jugador (lo teclea; Cantabria auto vía FCP después).

**RESUELTO:** el nivel de liga de cada jugador → **lo introduce el jugador a mano** en la inscripción; **para Cantabria se podrá automatizar** (vía FCP `cantabra.ts`/`fcpClient.ts`). El club elige **UN** patrón para el torneo (solo puntos / solo suma de liga) + umbral por categoría.
- Pendiente: ¿tope duro (bloquea) o aviso blando? Asumo **duro** (bloquea inscripción) salvo que digas lo contrario.

---

## (pendiente) Más ítems por llegar
- …
