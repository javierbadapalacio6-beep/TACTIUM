# Plantilla de reel (9:16)

Una composición por pieza, 1080×1920 a 30fps. **Para montar una pieza nueva solo se toca
`piezas.ts`** — el componente no se edita.

## Ver y renderizar

```bash
# Editor en vivo. OJO: el puerto 3000 suele tenerlo otro proyecto.
npx remotion studio src/index.ts --port=3999

# Render de una pieza
npx remotion render src/index.ts reel-A1-federaciones renders/A1.mp4 --port=3999

# Un fotograma suelto para comprobar un momento concreto
npx remotion still src/index.ts reel-A1-federaciones renders/p.png --frame=100 --port=3999
```

Las guías de zona segura se activan en el studio poniendo `guias: true` en los props.

## El panel respira

En `motion` el panel de abajo **no está siempre**. Se abre cuando hay un gráfico que
enseñar y se cierra cuando no, y mientras está cerrado el plano ocupa el lienzo entero.

Antes el panel estaba fijo y en los huecos se rellenaba con el wordmark: eso convertía
el 55% del lienzo en un logo durante buena parte de la pieza, y en el gancho —los tres
segundos que deciden el vídeo— lo primero que se veía era una marca. La firma se reserva
al cierre, que para eso está.

Dos gráficos separados por menos de dos transiciones se fusionan en un solo tramo
abierto, o el panel rebotaría entre uno y el siguiente. El subtítulo acompaña a la
juntura: al 62% con el panel cerrado, al 46% cuando está abierto.

**El panel mantiene su altura de token (45% de cara / 55% de panel) aunque el gráfico
sea pequeño.** Se probó a encogerlo al contenido y no sale: los 420px de abajo son zona
muerta por la interfaz de la plataforma, así que un panel más bajo dejaría el dato fuera
de la zona segura. La consecuencia es que en los huecos de medio segundo entre gráficos
el panel se ve vacío. Es preferible a un logo.

## Campos nuevos de `Pieza`

| Campo | Para qué |
|---|---|
| `gancho` | Rótulo de apertura a pantalla completa, a 1,5× el tamaño del subtítulo. Mientras está, el subtítulo calla. Es la promesa que para el scroll. |
| `zoom` | Punch-in del plano, `[inicio, fin]`. Por defecto `[1, 1.07]`. Un plano fijo deja de retener a los tres segundos; el empuje lo sostiene sin cortar. `[1, 1]` lo desactiva. |
| `planoDesdeMs` | Por qué segundo del plano entra la pieza. Permite sacar varias piezas de una misma grabación sin recortar el mp4 otra vez. |

## Sacar piezas cortas de una larga

`derivar(base, { id, titulo, desdeMs, hastaMs })` corta una pieza ya montada. Desplaza
solo los tiempos de frases, coberturas y gráficos, y recorta al borde lo que se queda a
caballo. De `V1-vuelta` salen así `V1a-equipo`, `V1b-torneos` y `V1c-federacion`.

Por qué: 35 segundos enumerando tres bloques es un vídeo de producto, no un reel. Quien
entra buscando alineaciones aguanta veinte segundos de torneos que no le interesan. Cada
corte persigue a una persona distinta — el capitán, el club, el jugador federado.

**Los tres arrancan en frío**, a media frase, porque el gancho de la grabación está en
los primeros seis segundos y allí se queda. Para publicarlos hay que grabar dos segundos
de gancho propio para cada uno; el campo `gancho` ya está listo.

## Anatomía de una pieza

1. **Plano** — tú a cámara. No se le corrige el color ni se le mete LUT: el sistema dice que
   la marca vive en los bordes, no en el plano.
2. **Cobertura** — pantallas de la app y pádel real, encima del plano, por tramos.
3. **Subtítulos + cartelito** — siempre por encima de todo.
4. **Cierre** — un segundo de `#030F0F` con el wordmark. Idéntico en todas las piezas: es la firma.

## Gráficos de dato

Cinco, en `graficos.tsx`, todos leyendo los tokens. Se declaran por tramo en `piezas.ts`:

| Tipo | Para qué | Dónde se usa |
|---|---|---|
| `numero` | Una cifra que entra contando | A1 — el «17» |
| `resalte` | Marco en verde sobre una zona de la captura, apagando el resto | A2 — la pareja 2 |
| `contador` | De una cifra a otra. El verde llega solo al final | A3 — 60 → 2 minutos |
| `ticks` | Enumerar marcando. `enMs` por ítem si cada uno cae sobre una palabra | R4 — formato, consolación, horarios |
| `cortinilla` | Separar dos ideas sin transición de efecto. Es opaca: tapa el plano | R4 — antes del remate |

La zona del `resalte` va en **% del lienzo**, no en píxeles, para no depender del tamaño de la
captura.

**Mientras hay un gráfico en pantalla, el subtítulo pierde su palabra en verde.** Es
automático: el sistema pide un solo accent dominante por composición, y un gráfico de dato ya
es verde y grande. Dos bloques verdes compiten y ninguno señala.

Y la regla que decide si un gráfico entra: **si se puede quitar sin que se pierda información,
sobra.** Por eso en las piezas A no hay ni `ticks` ni `cortinilla`: no hay nada que enumerar ni
dos ideas que separar. En el R4 sí.

Una cobertura con `src: null` pinta un marcador con el archivo que falta, así que una pieza se
puede montar entera antes de tener el metraje.

## Dónde van los archivos

Remotion solo sirve desde `public/`. Los brutos de `bruto/` **no se leen directamente**: se
recortan antes con ffmpeg y el recorte se deja en:

- `public/plano/` — lo que dices a cámara (`A1-federaciones.mp4`…)
- `public/cobertura/` — pantallas de la app y pádel real

Mientras una pieza tenga `plano: null`, sale un marcador con el nombre del archivo que falta.

## Los tiempos de los subtítulos

Si una frase no trae `desdeMs`/`hastaMs`, el tramo se reparte **proporcional al número de
caracteres**. Es una aproximación: sirve para maquetar antes de tener la voz, pero en cuanto
exista el audio real hay que ajustar a mano las que bailen. Por eso los campos son opcionales
y no calculados siempre.

## Reglas que ya están aplicadas

- Máximo **24 caracteres por línea**; por encima, se parte solo en dos por el hueco más
  cercano al centro, sin cortar palabras.
- **Una palabra en verde por frase**, la que carga el significado. Dos y deja de señalar nada.
- Base del subtítulo al **62%** de la altura.
- Nada legible en los 220px de arriba, 420px de abajo ni 72px laterales.
- Las capturas de la app entran con `contain`, no `cover`: recortadas se pierde justo lo que
  se quería enseñar.

## Los valores no se inventan aquí

`tokens.json` es una copia de la fuente de verdad del taller. Si allí cambia algo:

```bash
cp "/c/Users/javie/Desktop/DESIGN SYSTEMS/TACTIUM_2026-09-14/03_TOKENS/tokens.json" src/reel/tokens.json
```
