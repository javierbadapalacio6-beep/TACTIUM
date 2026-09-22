# Qué hay aprovechable en los PACKS

Triaje de `../MOTION GRAPICHS TACTIUM/PACKS` (28 carpetas, ~2 GB) para el sistema de
reels. El criterio es uno: **si Remotion no lo puede leer, no existe.**

Los packs están pensados para Premiere, DaVinci y After Effects. Nosotros montamos en
código, así que casi la mitad del material no nos sirve — y lo que sí sirve, sirve mucho.

---

## Lo que se puede usar hoy, sin tocar nada

### SOUND EFFECTS — 127 archivos · lo más valioso del lote

Es lo que más le falta a los reels ahora mismo: **los gráficos entran en silencio.**
Un tick que aparece sin whoosh se nota vacío, y es el arreglo más barato que hay.

Lo que hay y para qué:

| Sonido | Dónde va |
|---|---|
| `VS_Short Whoosh 1-8`, `Swoosh 01-xx`, `Standard Whip` | Entrada de cada `tick` y del `numero` |
| `Sub Bass Drop 1-10`, `Deep Bass Hit`, `Boom` | La `cortinilla` — el corte de marca pide peso |
| `01 Riser`, `02 Riser`, `RISER.mp3` | Subida hacia el remate |
| `106 Counter_9` | El `contador` de 60 → 2 |
| `Pop up SFX` | El `resalte` cuando señala la zona |
| `Camera Flash`, `Shutter` | Cambios de plano duros |
| `Efecto type de letras`, `Tecla`, `8-bit Game digital typing` | Texto que se escribe |

En Remotion se usan con `<Audio src={staticFile(...)} />` dentro de la `Sequence` del
gráfico, así que el sonido cae exactamente donde cae el dato. Sin sincronizar a mano.

### MÚSICA DE FONDO — 113 mp3

Cama para las piezas. Ojo con el volumen: en vertical la voz manda, la música va a -18
o -20 dB. Usar `<Audio volume={}>`.

### TEXTURAS PAPEL — 10 clips ProRes con alfa real

`yuva444p12le`. **Verificado: Remotion los lee directamente** con
`<OffthreadVideo transparent />`, sin convertir nada. Grano y elementos de papel para
dar textura al panel cuando está en reposo — que es justo el hueco que dejó quitar el
wordmark.

### LETRAS ANIMADAS — 26 ProRes con alfa (A-Z)

También verificado que funcionan directos. **Pero ojo con la marca:** son letras de
pincel dibujadas a mano, y TACTIUM es Satoshi, una geométrica. Mezclarlas cantaría.
Sirven como recurso puntual —una inicial, un remate— no como tipografía del sistema.

### DEGRADADOS NEGROS y RECTÁNGULOS SUPER 8MM — png

Sueltos, para viñeteo y marcos. Poca cosa pero cuesta cero usarlos.

### ZONA SEGURA

Ya se está usando: es la plantilla de la que salen los márgenes de `tokens.json`.

---

## Lo que se puede usar con blend mode

Sin canal alfa, sobre fondo oscuro. Se componen con `mixBlendMode: "screen"`, que deja
pasar lo claro y descarta lo oscuro.

- **FILM BURNS** (24) · **ANAMORPHIC FLARES** (7, en 4K) · **CINEMATIC OVERLAYS** (3)
- **GLITCH TRANSITIONS** (6) · **ART TRANSITIONS** (5)

Advertencia: el fondo de los film burns no es negro puro sino un azul muy oscuro, así
que en `screen` levantará algo los negros del panel. Hay que mirarlo pieza a pieza.

Y una advertencia de criterio: el sistema dice que **la marca vive en los bordes, no en
el plano**. Un film burn sobre tu cara es exactamente lo contrario. Estos overlays valen
para una transición puntual, no para tener encendido todo el rato.

---

## Lo que hay que convertir antes (y merece la pena)

### FLECHAS «Iman Gadzhi» — 17 clips

Dos problemas: vienen en **croma verde** (no alfa), y las flechas son **negras**, que
sobre el panel `#030F0F` serían invisibles.

Los dos se arreglan de una pasada. El truco es no ir a WebM —`libvpx-vp9` no conserva
el alfa en tu build de ffmpeg, lo probé— sino a **ProRes 4444, que Remotion sí lee**:

```bash
ffmpeg -i "Arrow 1.mp4" \
  -vf "format=rgba,colorkey=0x24D00B:0.34:0.12,lutrgb=r=0:g=223:b=130" \
  -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -an \
  public/flechas/arrow-01.mov
```

- `0x24D00B` es el verde real del croma, medido sobre el archivo (no es verde puro).
- `lutrgb=r=0:g=223:b=130` fuerza todo el píxel al accent de TACTIUM (`#00DF82`)
  conservando el alfa. La flecha sale ya en color de marca.

Probado y comprobado sobre fondo tinta: recorte limpio, sin halo verde.

Script para las 17 de golpe: `scripts/convertir-flechas.sh`.

Para qué sirven: señalar. Una flecha que apunta al aviso en rojo de la alineación, o al
botón de auto-orden, hace en medio segundo lo que el `resalte` hace con un marco.

### OBJETOS 3D — 19 `.glb`

Se pueden usar con Three.js dentro de Remotion, pero **ninguno es de pádel**: hay
ballena, dragón, unicornio, tigre, máscara de demonio, lingotes… Salvables: `Lupa.glb`
(buscar, comparar) y `Mancuerna.glb` (esfuerzo, entrenamiento). El resto no pinta nada
en una app de ligas de pádel.

No lo tocaría todavía: monta más coste (R3F, iluminación, determinismo por frame) del
que devuelve.

---

## Lo que no nos sirve

Casi la mitad del lote. No es que sea malo — es que es para otro programa.

| Pack | Por qué no |
|---|---|
| PRESETS SUBTÍTULOS PREMIERE V2, V3, Minimal (38 archivos) | `.mogrt` y `.xml` de Premiere. Nuestros subtítulos se generan en código y van sincronizados palabra a palabra desde `piezas.ts`. Los nuestros son mejores. |
| PRESETS SUBTÍTULOS CAPCUT / V3 DAVINCI | Igual, otro programa. |
| ANIMACIONES DE TEXTO AE, PRESETS TEXTO AE (9 `.ffx`) | After Effects. |
| PLUGINS y PRESETS DAVINCI (10) | DaVinci. |
| LUTS (15 `.cube`) | El sistema dice explícitamente que al plano **no se le mete LUT**. |
| BROLL CINEMÁTICO, BRUTOS PARA PRACTICAR | Metraje genérico de stock. Nuestra cobertura es la app y pádel real. |
| FUENTES PRO ELEGANTES (15) | Montserrat, Sequel Sans, Bernstein, Bootzy, Great Vives. TACTIUM es Satoshi y está resuelto. Cambiar la tipografía es romper el sistema, no mejorarlo. |

---

## Por dónde empezar

1. **Sonido en los gráficos.** Es una tarde de trabajo y es lo que más se nota.
2. **Las 17 flechas convertidas**, y un gráfico nuevo `flecha` en `graficos.tsx` que
   apunte a una zona en % del lienzo, igual que hace `resalte`.
3. **Textura de papel en el panel en reposo**, para el hueco que quedó al quitar el
   wordmark.

Lo demás puede esperar.
