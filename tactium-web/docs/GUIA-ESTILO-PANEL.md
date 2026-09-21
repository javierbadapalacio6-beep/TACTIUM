# Guía de estilo del panel web (rediseño 2026-09)

Objetivo: que TODA la web se lea como un producto profesional, denso y coherente,
con la paleta TACTIUM (oscuro verde + acento #00DF82). La regla de oro: **cada
valor sale de un token o de una primitiva**; ningún componente inventa tamaños,
colores ni radios.

Fuentes de verdad (léelas antes de tocar nada):

- `app/globals.css` — tokens y recetas (`.card`, `.btn-*`, `.chip-*`, `.input`,
  `.tw-table`, `.stat-row`, `.list-row`, `.note`, `.seg`, `.tw-page*`…).
- `components/ui.tsx` — primitivas React: `PageHeader`, `SectionHead`, `Card`,
  `CardHead`, `StatRow`/`Stat`, `Progress`, `Btn`/`BtnLink`, `Chip`, `IconTile`,
  `Avatar`, `Field`/`Input`/`Textarea`/`Select`/`InputWrap`, `Segmented`,
  `Toggle`, `Note`, `Table`, `Modal`, `Row`, `ListRow`, `Eyebrow`.
- `components/states.tsx` — `EmptyState`, `Skeleton`, `SkeletonCard`,
  `SkeletonPage`, `Toast`, `Banner`.
- Referencias ya migradas: `components/club/ClubDashboard.tsx`,
  `components/club/ClubTeams.tsx`, `components/home/CaptainHome.tsx`,
  `components/home/SoloHome.tsx`, `components/AppShell.tsx`.

## Las reglas (se aplican a TODOS los ficheros)

1. **Raíz de pantalla**: `<div className="tw-page">` (formularios largos:
   `tw-page-narrow`). Fuera `style={{ maxWidth: 1280, margin: "0 auto" }}`.
2. **Cabecera de pantalla**: `<PageHeader title lede actions meta back />`.
   Sin `Eyebrow` + `<h1 style={{ fontSize: 30 }}>` a mano. La barra superior
   ya dice dónde estás: no repitas "CLUB · EQUIPOS" encima del título.
   Ningún `h1` con `fontSize` inline (la clase ya lo pone a 24). En modales,
   el título va por la prop `title` del `Modal`.
3. **Tarjetas**: `<Card>` (padding 18 por defecto). Tablas y listas dentro de
   `<Card flush>` con `<CardHead title count>…acciones…</CardHead>`. Nada de
   `padding: 28 / 26 / 22` inline. **Nunca tarjeta dentro de tarjeta**: dentro
   se separa con `divider`, `list-row` o fondo `var(--bg-card-2)` en un bloque.
4. **Botones**: `<Btn variant size icon>` o `<BtnLink href …>` (o clases
   `btn btn-accent|btn-ghost|btn-quiet|btn-tint|btn-danger|btn-danger-ghost`
   + `btn-sm|btn-lg`). **Quita todo `padding` y `fontSize` inline de botones.**
   Un solo botón `accent` por bloque (la acción principal); el resto `ghost`
   o `quiet`. Etiqueta ≤ 3 palabras, frase normal ("Nuevo equipo").
5. **Estados / etiquetas de estado**: `<Chip tone="accent|mute|warning|error|info|solid">`
   con texto en frase normal ("Cubierto", "En juego", "Inscripción abierta").
   Fuera `style={{ color, borderColor }}` a mano en chips. Un chip que es
   botón: `<button className="chip chip-warning">`.
6. **Etiquetas de texto**: TODO lo que hoy va en `.mono` + MAYÚSCULAS +
   `letterSpacing` como etiqueta (labels de campo, cabeceras de tabla, rótulos
   de sección, meta "2ª · MASCULINO") pasa a **frase normal en Satoshi**:
   - etiqueta de campo → `<Field label="Nombre">…</Field>`
   - cabecera de tabla → `<Table>` con `<th>` o clase `grid-head` en los
     div-grid ya existentes (`tw-roster-head`, `tw-score-head`… ya llevan el
     tono; basta con escribir el texto en frase normal: "Equipo", "Día y hora")
   - rótulo de bloque → `<SectionHead title count>` o `<CardHead>`
   - meta bajo un título → texto a 12.5 `var(--text-muted)` o `meta` del
     `PageHeader`
   `.mono` se queda SOLO para números, marcadores, horas, códigos y fechas
   cortas. Cero `letterSpacing: "0.1xem"` en texto normal. `<Eyebrow>` sólo
   cuando es un marcador de sección genuino: **máximo uno por pantalla**.
7. **Cifras clave**: `<StatRow><Stat label value unit sub tone icon>…</StatRow>`
   en vez de tarjetas sueltas con `tw-stat-label/value` o `tw-solo-stats`.
8. **Formularios**: `<Field label hint error>` + `<Input>` / `<Textarea>` /
   `<Select>` / `<InputWrap icon><input/></InputWrap>`. Fuera los inputs con
   estilos inline (`padding: "13px 15px", borderRadius: 12, border…`).
   `.tw-form-grid` para 2 columnas. Botones de radio "tarjeta" (elegir tipo,
   plan…): usa `background: var(--bg-card-2)`, borde `var(--line)`, y para el
   activo `var(--accent-10)` + borde `var(--accent-40)`; radio 10.
9. **Filtros**: `<Segmented>` para elección única; `.tw-fcp-chip is-on` para
   chips de filtro; buscador con `<InputWrap icon={<IconSearch/>}>` dentro de
   `<div className="tw-toolbar">`.
10. **Listas y tablas**: filas con `<ListRow href icon title sub right>` dentro
    de `<Card flush>`; tablas con `<Table>` (`<th className="num">` y
    `<td className="num">` para columnas numéricas; `cell-main`, `cell-sub`,
    `cell-muted`; acciones en `<div className="tw-table-actions">`).
    Filas div-grid existentes (`tw-md-row`, `tw-roster-row`, `tw-score-row`,
    `tw-sched-row`, `tw-signup-row`, `tw-standings-row`, `tw-fcp-*-row`,
    `tw-billing-row`) ya llevan hairline y hover: **no** les pongas
    `borderBottom` inline.
11. **Modales**: `<Modal open onClose labelledBy title lede footer>`: los
    botones van en `footer` (Cancelar `ghost` + acción `accent`/`danger`).
12. **Avisos en línea** (solo lectura, advertencias, info): `<Note tone icon>`.
    Fuera las cajas `background: var(--warning-soft); border: 1px solid…` a mano.
13. **Estados vacíos**: `<EmptyState icon={<Icon size={22} />} title body action>`
    (`compact` dentro de tarjetas con cabecera). Icono a 22–24, no 34.
    Carga: `<SkeletonPage />` para pantallas enteras; `<SkeletonCard />` para
    un bloque.
14. **Tipografía**: cuerpo 13.5–14 · meta 12–12.5 · nunca < 11. Sin
    `fontWeight: 900` (700 máximo). Títulos de bloque 15–16; título dentro de
    tarjeta destacada ≤ 22.
15. **Color**: solo tokens (`var(--…)`). El acento es para la acción
    principal, el estado activo y lo positivo. No colorea títulos, ni
    etiquetas, ni bordes decorativos.
16. **Espaciado**: 8 / 12 / 16 / 24. Rejillas de tarjetas con `gap: 16`
    (antes 20). Separación entre bloques con `<SectionHead>` (margen arriba
    28) o `marginTop: 16` entre tarjetas.
17. **Iconos** (`components/Icon.tsx`): 15–17 en botones y filas; 14 en chips.
    No añadas iconos nuevos si ya hay uno parecido; si hace falta, añádelo a
    `Icon.tsx` siguiendo el estilo (Lucide, trazo 1.75).
18. **Copy**: frase normal, sin MAYÚSCULAS, sin "·" encadenados donde una
    frase lee mejor, sin exclamaciones. Los textos de negocio (precios,
    condiciones, mensajes de error de servidor) no se reescriben.

## Lo que NO se toca

- Lógica, datos, `useAsync`, handlers, `guardedWrite`, `WRITES_ENABLED`,
  rutas, `aria-*`, ids de `labelledBy`, nombres exportados, props públicas.
- `globals.css`, `ui.tsx`, `states.tsx`, `AppShell.tsx` (si echas en falta
  una primitiva, resuélvelo con estilos inline **con tokens** y anótalo en el
  informe).
- `package.json`.

## Verificación

`npx tsc --noEmit` debe pasar sin errores en tus ficheros (ignora errores de
ficheros que no son tuyos: hay otros agentes trabajando en paralelo).
