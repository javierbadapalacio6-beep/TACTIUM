# TACTIUM web

La app en el navegador. Proyecto aparte de `tactium-landing/` (marketing) — este
es el **producto**, y va a `app.tactium.io`.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
```

Stack: Next.js 16 (App Router, Turbopack) · React 19 · Tailwind v4. El mismo que
la landing, a propósito: se reutiliza configuración y conocimiento.

---

## Estado

Implementadas **las 14 tandas** del plan (`../TACTIUM-plan-web-app.html`), a
partir del proyecto de Claude Design «Sistema TACTIUM completo». **40 rutas**,
build limpio, sin errores de consola ni avisos de hidratación.

| Área | Rutas |
|---|---|
| Entrada | `/bienvenida` · `/entrar` · `/empezar` · `/empezar/equipo` · `/empezar/club` · `/empezar/club/equipos` · `/empezar/jugadores` |
| Inicio | `/` — panel de capitán o «Mi pádel» según el rol |
| Jornada | `/jornada/[id]` · `/alineacion` · `/resultados` · `/disponibilidad` |
| Equipo | `/equipo` |
| Temporadas | `/temporadas` · `/temporadas/[id]` |
| Club | `/club` · `/club/equipos` · `/club/equipos/[id]` · `/club/horarios` · `/club/torneos` · `/club/facturacion` |
| Torneos | `/torneos` · `/torneos/[id]` · `/torneos/[id]/inscripcion` |
| Federación | `/federacion` · `/federacion/[fed]` · `/grupo/[id]` · `/equipo/[id]` · `/jugador/[id]` |
| Comunidad | `/comunidad` · `/novedades` · `/u/[username]` |
| Amistosos | `/amistosos` · `/amistosos/nuevo` · `/amistosos/[id]` |
| Stats | `/stats` |
| Cuenta | `/ajustes/[seccion]` (10 secciones) · `/suscripcion` · `/pro` |

### Los lienzos anchos

Son la razón de existir de la web — en el móvil no caben:

- **Alineación** (`components/lineup/LineupBoard.tsx`): pistas a la izquierda,
  banquillo a la derecha, **arrastrar y soltar de verdad** con la API nativa de
  HTML5. Intercambio al soltar sobre un hueco ocupado, aviso cuando una pareja
  rompe el orden por puntos, generador (Drive+Revés o sólo por nivel) y
  variantes con una oficial.
- **Horario de torneo** (`TournamentDetail.tsx` → `ScheduleGrid`): rejilla
  pistas × horas, partidos arrastrables, y **detección de conflictos** — pista
  ocupada o una pareja jugando dos veces a la misma hora — que se pinta en rojo
  y bloquea el drop.
- **Cuadro KO**: columnas por ronda con conectores, principal + consolación,
  «Por determinar» en los enfrentamientos sin definir.

El arrastre siempre tiene una alternativa **tap-para-intercambiar**, que es la
única que funciona con teclado y lectores de pantalla.

---

## Tres cosas que conviene no romper

### 1 · El doble tema

Tres modos, igual que `useThemeStore` en la app móvil: `light` · `dark` ·
`system`. Implementación en `lib/theme.tsx` y `app/globals.css`.

- El modo **sistema se representa quitando** el atributo `data-theme`, no
  poniéndolo a `"system"`. Eso devuelve el control a `prefers-color-scheme`.
- Un script en el `<head>` (`THEME_INIT_SCRIPT`) aplica el tema guardado antes
  del primer pintado, para que no haya destello.
- Los valores del tema claro viven **una sola vez** como `--lt-*`; los dos
  bloques de tema sólo los remapean. No dupliques hex.

En claro el acento es `#00995E`, **no** `#00DF82` (el neón da 1,6:1 sobre blanco
y no pasa WCAG), los glows desaparecen y las sombras se tintan con el color del
texto.

### 2 · La regla que evita cobros duplicados

En `lib/account-data.ts` (`SubscriptionSource`, `isStoreManaged`) y aplicada en
`components/subscription/MiSuscripcion.tsx`.

Una cuenta puede tener la suscripción comprada en la web (Stripe) o en una
tienda móvil. **La web sólo puede vender y gestionar lo que es suyo.** Con una
compra de App Store o Google Play la pantalla queda en solo lectura: ni un botón
de contratar, cambiar plan o cancelar.

En el paywall, además: **el importe realmente facturado es siempre el precio más
prominente**; el equivalente mensual del plan anual va pequeño y debajo. Es la
restricción por la que Apple rechazó la build 1.0(8) (motivo 3.1.2c).

### 3 · Un solo accent

TACTIUM es monocromática. En los gráficos (`components/charts.tsx`) eso encaja
porque los datos son de **magnitud** (una escala) o de **polaridad**
ganado/perdido (dos colores semánticos que ya existen). No hay series
categóricas, así que no se introduce ningún segundo hue.

---

---

## Conexión con Supabase

La web habla con la **misma base de datos que la app móvil**
(proyecto `tactium` · `aabgnylvmntkzmgixlpe`). Copia `.env.example` a
`.env.local` y rellena las dos primeras variables.

```
NEXT_PUBLIC_SUPABASE_URL=https://aabgnylvmntkzmgixlpe.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…
NEXT_PUBLIC_TACTIUM_WRITES=off
```

### ⚠️ El interruptor de escrituras

`NEXT_PUBLIC_TACTIUM_WRITES` sale **en `off`**. Con ese valor la web **no hace
ningún INSERT, UPDATE ni DELETE** contra producción: las mutaciones pasan por
`guardedWrite()` (`lib/writes.ts`), que las bloquea y avisa en pantalla. Dar de
alta una cuenta también está bloqueado, porque crea un usuario real.

Está así a propósito: la base es la de producción, con clubes y actas de
usuarios reales. Un dato de prueba ahí no es un error recuperable. Ponlo a `on`
sólo cuando quieras que la web escriba de verdad, y prueba antes con las cuentas
demo (`smash.*@tactium.io`).

### Qué se lee y cómo

| Origen | Qué |
|---|---|
| RLS con sesión | plantilla, temporadas, jornadas, alineaciones, resultados, disponibilidad, club, suscripción |
| RPC `SECURITY DEFINER` (también sin sesión) | torneos, buscador de comunidad, perfiles públicos, feed |

Hallazgo importante: **las tablas `fcp_*` exigen `authenticated`**. La idea del
plan de que la Federación traería tráfico de buscadores sin login no se sostiene
con la RLS actual — habría que añadir una política para `anon` o una RPC
pública.

La sesión (`lib/session.tsx`) **deriva el rol de la base de datos**, no lo elige
el usuario: club si pertenece a `club_members`, capitán si tiene
`team_members.role` en (`captain`,`admin`), jugador si pertenece a un equipo, y
suelto si no pertenece a ninguno.

### Pantallas ya conectadas

- **Acceso** (`/entrar`) — login real con email/contraseña y OAuth Google/Apple.
- **Inicio** (`/`) — temporada activa, próxima jornada, disponibles sobre la
  plantilla real y las siguientes jornadas del calendario.
- **Jornada** (`/jornada/[id]`) — acta con la alineación real por pista y los
  sets guardados. ⚠️ `match_results` guarda **una fila por SET**, no por pista:
  el componente los agrupa por `court_number`.
- **Alineación** (`/jornada/[id]/alineacion`) — pistas y banquillo con jugadores
  reales, variantes de `lineup_variants` (la `is_active` es la oficial), y el
  aviso de «rompe el orden por puntos» calculado sobre los puntos de verdad.
  El bloqueo se **deriva**: no eres capitán, o el acta está cerrada.
- **Plantilla** (`/equipo`) — jugadores del equipo activo con puntos FEP,
  posición y disponibilidad.
- **Temporadas** (`/temporadas`) — temporadas reales del equipo.
- **Torneos** (`/torneos`) — vía `explore_tournaments`; funciona incluso sin
  sesión, con portadas reales de Storage.

El resto de pantallas sigue mostrando los datos de ejemplo de `lib/*-data.ts`:
club, torneo detalle, federación, comunidad, stats, amistosos y cuenta. Las
consultas que necesitan ya están en `lib/queries.ts` (`fetchClubTeams`,
`fetchSubscription`, `fetchFcpGroups`, `searchCommunity`, `fetchFeed`…): falta
enchufarlas.

**Ojo con los equipos duplicados.** En producción hay varios equipos con el
mismo nombre (seis «MEDIO CUDEYO A», unos con temporada y otro sin ninguna). Si
una pantalla sale vacía, comprueba en SQL antes de darlo por un bug: el
selector de equipo elige el primero que devuelve la consulta.

---

## Lo que todavía no hay

Falta:

- **Stripe** — productos, checkout, portal de cliente y webhook que escriba en la
  misma tabla de suscripciones que ya alimenta RevenueCat, sin duplicar por
  `payer + tier`.
- En `MiSuscripcion.tsx` hay un **selector de caso A/B/C**, también andamiaje.
- **Escaneo de imagen** — la zona de arrastrar y soltar está, falta enchufarla a
  la edge function `parse-image` que ya existe.
- **Tarjetas para compartir** — hay que generarlas en canvas (en el móvil lo hace
  `react-native-view-shot`).
