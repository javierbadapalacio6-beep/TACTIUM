# TACTIUM Social · Rediseño de navegación + onboarding

> Fecha: 2026-07-04 · Complementa a `PLAN-STRAVA-DEL-PADEL.md` y `MENU-FUNCIONES-EVALUADO.md`.
> Corresponde a la **Fase 1d** del plan (el cambio más estructural). App EN TIENDAS (1.0.2) → requiere build nativo nuevo + QA cuidado.

## Decisiones tomadas (2026-07-04)
- **Tabs:** `Feed · Equipo · ➕ · Pizarra · Perfil` (con botón central para registrar partido).
- **Pantalla inicial:** el Feed social, para todos.
- **Entrada:** cuenta ligera (Apple/Google de un tap) → aterrizas directo en el feed, sin equipo obligatorio ni muro de pago.

---

## 1. Arquitectura de navegación

### Estado actual (del recon del código)
- `RootNavigator.tsx`: `showMainTabs = isAuthenticated && !!team && !isOnboarding`. Sin equipo quedas atrapado en `OnboardingStack`.
- `OnboardingStack`: elige crear club / crear equipo / canjear invitación → **Paywall duro** antes de entrar.
- `TabNavigator.tsx`: tabs distintos por rol (club_admin: Club/Equipos/Perfil; capitán: Home/Temporadas/Equipo/Perfil; player pierde Temporadas/Equipo).
- Pizarra vive dentro de `HomeStack` (ruta `TacticsBoard`).

### Estado objetivo
- `RootNavigator`: `showMainTabs = isAuthenticated && profileReady`. **Se elimina el requisito de equipo** y el muro duro. El equipo pasa de "puerta" a "acción".
- **TabNavigator unificado** de 5 tabs (mismos para todos); el rol se adapta **dentro** del tab Equipo, no cambiando el set de tabs.
- Paywall = modal soft (reverse-trial), disparado solo por acciones productivas (ya existe vía `usePremiumGate`).

### Los 5 tabs

| Tab | Contenido | Sin equipo (usuario social nuevo) |
|---|---|---|
| **📰 Feed** | Tablón: resultados, clips, hitos de nivel, kudos. v1 puede mostrar ya la actividad del equipo (jornadas/resultados existentes) como items del feed. | Estado vacío con sugerencias + tu propia actividad. |
| **👥 Equipo** | Rol-adaptativo: club_admin→Club+Equipos; capitán→jornadas/alineaciones/temporada/disponibilidad; player→vista de su equipo + "Mi jugador". | Pantalla de "crea equipo / únete a club / canjea invitación" (el antiguo onboarding, ahora como acción con gate blando). |
| **➕ Registrar** | Acción central: registrar partido → tarjeta. Punto de entrada también a crear jugada/compartir. | Igual (registrar partido no requiere equipo). |
| **✏️ Pizarra** | El laboratorio (TacticsBoard), ahora top-level y accesible a todos. | Accesible. |
| **👤 Perfil** | Perfil de jugador: nivel, historial, "Mi bolsa", suscripción, ajustes. | Accesible (es la Capa 0). |

### Adaptación por rol (dentro del tab Equipo)
El tab Equipo es un stack que renderiza según `activeRole`:
- **club_admin** → dashboard de Club + lista de Equipos (lo que hoy son los tabs Club/ClubTeams).
- **captain** → hub del equipo (jornadas, alineaciones, temporada, disponibilidad).
- **player** → vista de su equipo + "Mi jugador".
- **sin equipo** → pantalla de alta (crear/unir/canjear), con paywall blando al crear.

El selector de modo (mode switcher) que ya existe en Perfil se mantiene.

### Reframe de roles: TODO EL MUNDO es jugador primero (decisión 2026-07-06)
En la app social el **jugador es el usuario PRINCIPAL, no el limitado**. Antes: "player" = capitán menos gestión (hueco de plantilla pasivo). Ahora:
- **Base social que TODOS tienen (incl. jugador):** ver feed, perfil completo (nivel/historial/"Mi bolsa"), registrar/compartir, kudos, comentar, seguir, usar la pizarra.
- **Capitán y club_admin = roles que se AÑADEN encima** para gestión (jornadas, alineaciones, club). La gestión es el extra; lo social es la base.
- El **jugador es siempre gratis** (así está el paywall = capa social gratis). El paywall solo salta en gestión.
- Tab **Equipo del jugador**: si está en un equipo → vista de lectura + "Mi jugador" + marcar SU disponibilidad (crear jornada/alineación NO, es del capitán). Si no está en ninguno → "únete / crea".

### El ➕ Registrar = hub de crear/compartir
No solo "registrar partido". Para cualquier jugador ofrece: **partido** (resultado→tarjeta) · **clip/vídeo** (mejor punto).
> Compartir **jugadas de la pizarra al feed = DESACTIVADO por ahora** (decisión 2026-07-06): mientras la pizarra sean garabatos libres no aporta. Se reintroduce cuando existan jugadas estructuradas (con comandos/animación).

### Pizarra abierta a todos y gratis (decisión 2026-07-06)
Cambia respecto al plan viejo (era "solo capitán"). Ahora **ver y usar la pizarra = gratis para todos** (jugadores incluidos). La autoría avanzada / guardar en biblioteca podría reservarse como premium más adelante, pero el uso base es libre.

---

## 1bis. Feed: modelo de contenido (decisión 2026-07-06)

**NO es un feed global** (eso nace vacío = error de PadelLog). Son **círculos concéntricos alrededor del usuario**:
1. **Tu equipo** — resultados de jornadas, alineaciones publicadas, actividad de compañeros (núcleo).
2. **Tu club** — otros equipos del mismo club, resultados, anuncios.
3. **Tu liga/grupo** — resultados de los **equipos rivales contra los que compites** (aparecen automáticamente → dan vida al feed desde el día 1 y enganchan con la clasificación).
4. **Jugadores que sigues** — su actividad, jueguen donde jueguen.

**Qué NO va en el feed principal:** equipos/jugadores aleatorios sin relación → eso es una pestaña **"Explorar"** posterior y opt-in.

**Privacidad:** lo interno del equipo (alineaciones antes de publicar, disponibilidad, chat) NO se difunde a rivales. Los resultados de liga son semipúblicos (competición). Los partidos personales: el jugador controla la visibilidad (todos / seguidores / solo yo), estilo Strava.

**Filtros opcionales** arriba del feed: `Mi equipo · Mi club · Mi liga · Siguiendo` (o un muro mezclado v1 + filtros si hacen falta).

---

## 2. Onboarding

### Flujo objetivo
1. **Welcome** — propuesta de valor ("El Strava del pádel"), 1 pantalla.
2. **Registro** — Apple/Google de un tap (email de reserva).
3. **Crear perfil de jugador** (Capa 0, sin fricción, "enseñar haciendo). Pedir el MÍNIMO: **club principal · nivel · lado** (ver `PERFIL-Y-NIVEL.md`). Nombre prerelleno; avatar y zona opcionales. Nivel por 3 caminos (Playtomic / "sé más o menos" / 3 preguntas), escala 0–7 compatible Playtomic + TrueSkill interno. La pala pasa a identidad opcional, no core. 1–2 pantallas, con "saltar". Todo lo demás se autoderiva jugando.
4. **Aterrizas en el Feed** — sin equipo, sin muro.
5. **Empujones suaves** (checklist descartable): "Completa tu perfil" · "Únete a tu club / crea tu equipo" · "Registra tu primer partido". Refleja el North Star de activación (*3 partidos con 2+ parejas en 2 semanas*).
6. **Paywall** — fuera del onboarding. Blando, disparado por acciones productivas (crear/editar jornada, alineación, invitar, crear equipo/club, escanear…). El muro duro se elimina.

### Migración de usuarios actuales (1.0.2 en tiendas)
- Ya tienen perfil + equipo → aterrizan en el **Feed de su equipo**; su gestión sigue intacta en el tab Equipo.
- Pizarra pasa de ruta en HomeStack a tab propio (cambio menor de ruta).
- Estado de suscripción sin cambios.
- **QA crítico:** verificar que el tab Equipo renderiza correctamente las vistas de club_admin / captain / player existentes.

---

## 3. Cambios de código (resumen, para especificar tickets)

| Archivo / módulo | Cambio |
|---|---|
| `navigation/RootNavigator.tsx` | Quitar `&& !!team`; nuevo gate `isAuthenticated && profileReady`. Paywall pasa a modal soft. |
| `OnboardingStack` | Reconvertir en "alta de perfil" ligera (o plegar en Auth). Quitar la pantalla de Paywall duro del flujo obligatorio. |
| `navigation/TabNavigator.tsx` | Nuevo set unificado de 5 tabs. Rol adaptativo movido DENTRO del stack de Equipo. |
| `features/feed/*` (nuevo) | Tab Feed + pantalla + servicio. v1: agrega actividad de equipo existente (resultados/jornadas) + estado vacío. |
| `features/matches/*` (nuevo) | Flujo Registrar partido → tarjeta (Fase 1b). |
| `features/tactics` (ruta) | Mover TacticsBoard a tab top-level. |
| `features/profile` | Ampliar a perfil de jugador (nivel, historial, "Mi bolsa"). |
| Entitlements | Permitir usuarios autenticados sin equipo (features sociales gratis = simplemente no envueltas en `gate()`; el paywall blando sigue en acciones de equipo). |

**Dependencias nativas** que este bloque arrastra (build nativo, no OTA): `react-native-view-shot` + `expo-sharing` para las tarjetas.

---

## 4. Riesgo y secuenciación
- Es un cambio grande a una app en tiendas → hacerlo en **build nativo nuevo**, bien probado, idealmente escalonado.
- El Feed no debe nacer vacío: su v1 puede **surtirse de datos que ya existen** (resultados/jornadas del equipo) para tener contenido desde el día 1, antes incluso de los partidos individuales.
- Orden sugerido: (1) shell de navegación + tabs + mover Pizarra + Perfil ampliado; (2) Feed v1 con actividad de equipo; (3) Registrar partido + tarjeta; (4) nivel + kudos; (5) onboarding nuevo y quitar muro duro (último, por ser lo más sensible para usuarios actuales).
