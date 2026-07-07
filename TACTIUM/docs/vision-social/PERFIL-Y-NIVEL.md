# TACTIUM Social · Perfil de jugador y sistema de nivel

> Fecha: 2026-07-04 · Complementa a `REDISENO-NAV-ONBOARDING.md`.
> Principio rector (lección Strava): **el dato de perfil más valioso se AUTODERIVA de la actividad, no se rellena en un formulario.** Pedir el mínimo; el resto se llena jugando.

## Campos del perfil, por valor

### 1. Ancla funcional (se pide al entrar — mínimo)
- **Clubes donde juega — varios + 1 PRINCIPAL** ⭐ (decisión 2026-07-04). El club principal ancla el feed, la pertenencia, los leaderboards locales y el matchmaking. Poder marcar varios porque en pádel se rota de club.
- **Nivel** (0–7 compatible Playtomic — ver abajo).
- **Lado** (drive / revés / ambos).
- **Zona/barrio** (ubicación fina, opcional) — ver "Ubicación".

### 2. Autoderivado de la actividad (el oro — cero esfuerzo del usuario)
- Rating/nivel real + fiabilidad
- Récord V/D y % de victorias
- Partidos jugados · forma (últimos 5: V-V-D-V…)
- **Club más jugado** (el "club favorito" puede salir SOLO de dónde registra partidos)
- Pareja habitual · rival frecuente (head-to-head)

### 3. Identidad opcional (nice-to-have, no core)
- **Pala / "Mi bolsa"** (identidad, no tienda; ángulo afiliados fino más adelante), estilo de juego, desde cuándo juega, bio corta.

> Cambio respecto al diseño inicial: **club principal sube a campo de primer nivel** (funcional + estratégico); **la pala baja a identidad opcional**.

## Ubicación (fina, sin pedir dirección de casa)
- **Los clubes llevan geolocalización precisa** (coordenadas). Son sitios físicos, dato público → no sensible.
- **El jugador se ancla por sus clubes** + una **zona/barrio** opcional a nivel jugador.
- Esto habilita "jugadores cerca de ti" / "clubes cerca" **sin** pedir la dirección personal. Privacidad respetada, dato útil obtenido.

## Valor estratégico del dato de club
El **club principal** de cada jugador = el **mapa de dónde se forma la red**. Saber qué clubes concentran jugadores activos indica dónde sembrar, dónde hay densidad y es señal para expansión o partnerships. Ningún dato autoreportado da más valor de negocio que este.

---

## Sistema de nivel

### Decisiones (2026-07-04)
- **Escala visible = 0.0–7.0 compatible con Playtomic** (la moneda común del pádel amateur; "soy un 3.5" lo entiende todo el mundo → cero fricción).
- **Motor interno = TrueSkill** (modela 2v2 nativamente; μ + σ de incertidumbre). Se muestra como 0–7; se calcula con TrueSkill.
- **Fiabilidad visible**: empieza baja (autoreporte), sube con partidos, decae con inactividad. Calibra en ~10–15 partidos con diversidad de parejas/rivales.
- **Diferenciación**: el nivel Playtomic se critica por manipulable (te emparejas con flojos y subes). El de TACTIUM es **"nivel verificado por tus partidos reales"** — el mismo número familiar, pero honesto.

### Realidad del "importar Playtomic"
**No hay API oficial para leer el nivel Playtomic de un usuario.** El "import" es **autoreportado** (el propio Playtomic arranca por cuestionario autoreportado — es el estándar). Nada de scraping (frágil + contra ToS).

### Onboarding del nivel — 3 caminos
1. **"Sé mi nivel Playtomic"** → introduce el número (instantáneo, familiar).
2. **"Sé más o menos"** → elige en la escala 0–7 con descripciones por tramo.
3. **"Ni idea"** → 3–4 preguntas rápidas (tiempo jugando, a quién ganas, posición) → nivel estimado (imita el cuestionario de Playtomic).

Los tres → nivel inicial + fiabilidad baja; a partir de ahí lo calibran los partidos reales.

### Nota de marca/legal
Referenciar "Playtomic" de forma factual ("¿Conoces tu nivel Playtomic? Introdúcelo") es uso nominativo legítimo. **No dar a entender acuerdo/partnership.** Texto neutro.

---

## Onboarding del perfil (mínimo)
Pedir solo: **club principal · nivel (1 de los 3 caminos) · lado**. Avatar y zona opcionales con "saltar". Todo lo demás (récord, forma, club más jugado, pareja habitual, pala) se llena solo jugando o después.
