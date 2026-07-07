# TACTIUM · "El Strava del pádel" — Plan de producto

> Fecha: 2026-07-03 · Estado: estrategia aprobada por el fundador, nada implementado aún.
> Basado en investigación de 3 análisis en paralelo (modelo Strava, mapa competitivo pádel, gamificación que retiene).

**Premisa fija:** el laboratorio táctico (pizarra) y la gestión de equipos/clubes **NO se tocan**. La capa social y de gamificación se construye **encima**, no sustituye nada.

---

## 1. El posicionamiento (la decisión más importante)

- **No pelees por las reservas.** Playtomic tiene ~16.000 pistas y 2M de jugadores; mercado de dos lados con foso imposible para un fundador en solitario. Reservar = distracción, no batalla.
- **El log individual ya está ocupándose.** *PadelLog* (2024) se posiciona como "Strava del pádel" **de jugador suelto** y se mueve rápido.
- **El hueco libre = lo que ya tienes a medias:** fusión de **competición de equipos** (jornadas, alineaciones, disponibilidad, temporadas, roles) **+ identidad social**. Nadie lo ha unido.

> **Frase de posicionamiento:** *Playtomic organiza pistas; TACTIUM organiza equipos y su historia.*
> Eres **"el Strava del pádel de EQUIPOS"**, no de jugadores sueltos. El equipo es el motor de retención (la gente vuelve por su grupo, no por una racha solitaria) y es lo más difícil de copiar.

El jugador suelto / entrenador **sí entra** (navegación libre, ve la pizarra, sube jugadas) — pero es la **puerta de entrada**, no el núcleo. El equipo es el imán.

---

## 2. La arquitectura en capas

```
┌─ CAPA 3 · Gamificación ──────────────────────────┐
│  Nivel (con fiabilidad) · Racha semanal · Ligas   │
├─ CAPA 2 · Social ────────────────────────────────┤
│  Feed · Kudos · Seguir · Compartir jugada/resultado│
├─ CAPA 1 · NÚCLEO (ya existe, intacto) ───────────┤
│  Laboratorio táctico + Gestión equipos/clubes     │
├─ CAPA 0 · Identidad ─────────────────────────────┤
│  Perfil de jugador (nuevo: base de todo lo social)│
└───────────────────────────────────────────────────┘
```

Lo único que **falta de base** es la **Capa 0: el perfil de jugador individual** — hoy la app es "estructura de equipo primero". El perfil permite la navegación libre, que un entrenador exista sin equipo, y que todo lo social cuelgue de algo.

---

## 3. El motor de contenido (la clave del modelo)

El reto del pádel: **no hay GPS ni "actividad" automática** como en un run. El contenido sale de dos sitios que ya están casi resueltos:

1. **Resultado de partido → tarjeta automática.** El usuario mete el resultado en 3 taps (o se autorrellena desde el escáner/jornada existente) y la app genera sola una **tarjeta** con marcador, pareja, rivales, racha, cambio de nivel. *El contenido se crea solo.*
2. **La pizarra como pieza estrella compartible.** Una jugada del laboratorio pasa a ser contenido del feed y **exportable a Instagram/WhatsApp** → adquisición orgánica gratis.

Esto esquiva el "problema del 1%" de las apps UGC: **loguear un resultado es fricción casi cero y lo hace todo el que juega**.

---

## 4. Monetización (encaja con el paywall actual)

Regla de Strava: **la capa social NUNCA se capa.**

- **Gratis para siempre:** perfil, feed de club, kudos, tarjetas compartibles, racha, nivel básico, ver la pizarra. (Son el efecto red y el crecimiento.)
- **De pago (reverse-trial actual):** estadísticas avanzadas, **autoría** en el laboratorio, gestión de temporada, multi-equipo admin, analítica de club.

---

## 5. Hoja de ruta por fases (priorizada retención ÷ esfuerzo)

### Fase 1 — Identidad + motor de contenido ⭐ (empezar aquí)
- **Perfil de jugador** (Capa 0): avatar, historial, nivel. Navegación libre al descargar.
- **Entrada rápida de resultado → tarjeta de partido** automática y compartible.
- **Nivel derivado de partidos con fiabilidad visible.** Matemática tipo **TrueSkill** (modela 2v2 nativamente). Reglas de credibilidad: empieza en fiabilidad baja, calibra en ~10-15 partidos, exige diversidad de parejas/rivales, decae con inactividad. Complemento (no sustituto) del nivel Playtomic.
- *Por qué primero:* es el bucle central y "el número que te hace abrir la app". Funciona con un solo usuario.

### Fase 2 — El motor de red
- **Feed por club/equipo + kudos** (un tap). Sembrar **comunidades pequeñas y densas** (clubes/equipos existentes), NO un feed global fantasma (en comunidades <5.000, ~33% contribuye).
- **Seguir** compañeros y rivales.

### Fase 3 — Gamificación que retiene
- **Racha SEMANAL** (no diaria: el pádel depende de pista/clima/pareja) **con "freeze"** que se activa por adelantado.
- **Leaderboards de club pequeños y pace-matched** (cohortes ~20-30, estilo Duolingo), **nunca globales** (evita el "efecto perdedor"). Rankea también por **constancia** ("Habitual de la pista"), no solo skill.

### Fase 4 — Descubrimiento y comunidad ampliada
- **Explorar público:** jugadas/pizarras de otros, perfiles de entrenadores.
- **Retos mensuales** y **club-vs-club**.

**North Star de activación:** *"registra 3 partidos con 2+ parejas distintas en tus primeras 2 semanas"* — puebla el feed de un compañero, calibra el nivel y cruza el precipicio de churn de las 2 semanas. **Enseñar haciendo**: primera sesión = entrar en un club y registrar/agendar un partido real, no rellenar formularios.

---

## 6. Qué NO construir (ahorra meses)
- ❌ Reservas / matchmaking de pista (foso de Playtomic).
- ❌ Live scores del circuito como núcleo (commodity; máximo una pestaña ligera).
- ❌ Zoo de medallas, puntos/XP decorativos, **leaderboards globales**.
- ❌ Notificaciones de culpa (patrón oscuro).

---

## 7. Riesgos a vigilar
- **PadelLog corre** por el eje individual. Defensa = el eje **equipo/competición**, que ellos no tocan.
- **Densidad de red:** por debajo de un umbral las redes mueren más rápido que linealmente → **club a club**, no lanzamiento global.
- **No diluir el núcleo** (BeReal murió por feature creep). Lo social se añade con disciplina.

---

## 8. Primer paso recomendado
Empezar por la **Fase 1**, y dentro de ella por **perfil de jugador + entrada de resultado + tarjeta compartible** (motor de contenido del que depende todo). El nivel TrueSkill viene justo después.

Pendiente: decidir si profundizar la Fase 1 contra el código real (resultados/escáner/perfil/roles) para sacar la especificación técnica, o afinar antes la estrategia.
