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

---

## Mapa de sonido (revisado el 30-09-2026)

Qué suena en cada momento de un reel. Todo sale de `MOTION GRAPICHS TACTIUM/PACKS/SOUND EFFECTS`
(102 sonidos únicos; el Pack 2 repite casi todo el Pack 1) y está copiado en `public/sfx/`.

| Momento | Archivo | Origen | Nota |
|---|---|---|---|
| Gancho (intriga) | `riser-4.wav` · `riser-6.wav` · `riser-corto.mp3` | 02 Riser · 01 Riser · Copia de riseer 1 | Pico medido a 3,5 s · 5,5 s · 1,5 s. `RiserGancho` elige el que cabe y lo cuadra para que el pico caiga en el corte |
| Corte tras el gancho | `golpe-sub.wav` | Sub Bass Hit | Golpe seco, pico en 0 s |
| Subida de la música / remate | `basshit.wav` + `flash.wav` | Deep Bass Hit 1 · Camera Flash | Con el quemado de película |
| Entrada a tarjeta | `whoosh-1.mp3` · `whoosh-3.mp3` · `swoosh.wav` | VS_Short Whoosh · Swoosh 01-03 | Uno por corte, no en todos |
| Icono chat | `pop.mp3` | Pop up SFX | |
| Icono cronómetro | `reloj.mp3` | RELOJ (primer 1,2 s) | Tic-tac corto |
| Icono libreta | `boli.mp3` | Bolígrafo (1,4 s) | Trazo de boli |
| Cierre (logo) | `pop.mp3` | Pop up SFX | Con el destello |

**Guardados para más adelante:** `Tecla.mp3` y `Escribir teclado` (texto que se teclea),
`Subrayado rotulador` (resaltar una palabra), `Acierto y error` (check / aviso: hay que cortar
cada mitad), `Camera Shutter` (capturas de pantalla), `Counter_9` (números que cuentan).

**Descartados:** `CENSORED`, `Laser Gun`, `Windows_error`, `Thunder`, `8-bit`, los `Boom` largos y
los `Cinematic Bass` de 10 s (demasiado peliculeros para la marca), y el `25 sonidos de
transiciones.mp3` (hay que trocearlo y repite lo que ya hay suelto).

Efectos visuales en uso: ver `public/efectos/` (glitch 6 y 4, quemado vertical/horizontal,
destello anamórfico 7), teñidos al verde de marca. Descartado el glitch 7 (lleva «NO REF»).

---

## Revisión a fondo (08-10-2026)

Segunda pasada, esta vez **mirando los archivos** (ffprobe de los 125 vídeos + hojas de contacto de
cada pack, guardadas en `referencias/packs/*.jpg`) y con otro objetivo: fondos de color y recursos
para vídeos de estilo «lanzamiento» (ver `src/reel/estilo/Lanzamiento.tsx`). Cambia el veredicto de
varias cosas del triaje anterior.

### Lo nuevo y lo que corrige el triaje anterior

| Pack | Qué es de verdad (medido) | Veredicto |
|---|---|---|
| **FONDOS ABSTRACTOS** (no estaba en el triaje) | 4 rejillas en perspectiva **verticales 1080×1920**, 15 s, 4 MB (azul hue 216°, oro 56°, rosa 350°, rojo 352°) con brillo en la parte baja; `Kold Topography` (líneas blancas sobre negro, 4,8 s); `Kold Halftone Grunge` y `Film Dust Roll` (grano, 5,3 s); `Bonus` (polvo); `Topographic Textures` (16:9, 60 s) | **Lo mejor del lote para cambiar el color del fondo.** Con `hue-rotate` cualquiera llega al verde de marca (o a un turquesa, lima…). Los promos de agosto parecen usar ya la rejilla verde y la topografía |
| **TEXTURAS PAPEL** | Alfa real (ProRes 4444). `07`: bola → hoja que se queda. **`08`: bola → hoja que CUBRE la pantalla ~1,3 s → se arruga y se va.** `09`/`10`: papel arrugado | **`08` es una cortina de transición** (y la hoja sirve de tarjeta con texto impreso). Ya montado en `lanzamiento-L2` |
| **FLECHAS** | Flechas discontinuas dibujándose, negras sobre croma verde. 17 clips, 5–7 s. Script de conversión listo (`convertir-flechas.sh`) pero **nunca se ejecutó** (no existe `public/flechas/`) | Pendiente. Ojo: señalar la pantalla va contra «sin anotaciones sobre las pantallas»; valen para apuntar al texto o a un botón fuera del móvil |
| **FILM BURNS** | 15 verticales (0,5–2,8 s, naranja/rojo/amarillo sobre negro) + 9 horizontales; los dos largos (40 s) son «8mm con sonido» | Verticales en `screen` + `hue-rotate(-75°)` = destello verde de marca. Mejor como golpe de 0,5 s en un corte que como textura |
| **GLITCH TRANSITIONS** | Ruido de TV con texto incrustado: `5` = «Low RF», `8` = «ERROR · SIGNAL», `7` = «NO REF» (descartado) | `8` encaja con el gancho de «caos» (el grupo de chat «sin señal») |
| **ANAMORPHIC FLARES** | 3 en 4K (azul/naranja) + 4 en 1920×800 azules | Ya se usa el 7. Los de 4K sirven para un destello de cierre más grande |
| **CINEMATIC OVERLAYS** | Rayas y motas muy tenues sobre negro | Casi invisibles: solo como capa de grano al 15–20 % |
| **ART TRANSITIONS** | Cortinas de color con garabatos (cian, violeta, amarillo), 16:9, 3 s | Colores ajenos a la marca; habría que teñirlas. Prioridad baja |
| **LETRAS ANIMADAS** | Letras A–Z a mano, blancas, 2 s, **completas desde el primer fotograma** (no se dibujan) | Descartadas: aportan menos de lo que parecía |
| **BROLL CINEMÁTICO** | 4 clips de stock (chica en un campo, moto, desierto, atardecer), nada de pádel | Descartado |
| **OBJETOS 3D** | Realistas y con textura: Lupa, Billetera (cuero), Archivos (archivador amarillo), Mancuerna, Cámara, Cofre, Diamante, 4 llaves doradas, etc. | Estilo fotorrealista, choca con el verde plano. Salvables como «ancla» de una idea: Lupa = «busca tu equipo», Diamante = plan Élite, Llave = invitar/acceso, Archivos = «papeles». Habría que montarlos en `sin-remotion` (Three.js) |

### Lo que se construyó con esto

- `scripts/preparar-packs.sh`: versiones ligeras (30 fps constantes, sin B-frames) en
  `public/broll/packs/` (fuera de git, son de terceros). **Gotcha:** con los originales a 24 fps el
  render en paralelo falla con «No frame found at position»; por eso se recodifican.
- `src/reel/estilo/Recursos.tsx`: `FondoPack` (rejilla de color; `tono` en grados lo lleva al color
  que se quiera), `Grano`, `Topo`, `Papel`. Reutilizables en cualquier reel.
- `lanzamiento-L2` (variante «color»): gancho en rojo (el problema), una rejilla verde distinta por
  verbo (marca 154°, turquesa 170°, lima 116°, esmeralda 160°, fresco 146°), bola de papel que cubre
  la pantalla con «TODO EL EQUIPO en un solo sitio» impreso, y «Ya disponible» sobre rejilla verde.

### Música: la mayoría no se puede publicar

De las 115 pistas, casi todas son instrumentales de canciones comerciales (Drake, Kendrick, Metro
Boomin, Hans Zimmer…): reclamación casi segura en Instagram. Las que se usan están en
`public/musica/LICENCIAS.md` (Pixabay sin Content ID + las «sin copyright» que Javier decidió
asumir). No añadir más sin comprobar la ficha.

### Sigue sin servir

Presets de Premiere/CapCut/DaVinci/After Effects (`.mogrt`, `.ffx`, `.drfx`), LUTs, fuentes (el
sistema es Satoshi + Instrument Serif) y `BRUTOS PARA PRACTICAR`. Lo único aprovechable de los
`.mogrt` son los **nombres** de efectos de texto (Blur Text, Focus Revelation, Bounce Left, Error
Highlight…), que ya tenemos como `desenfoque` / `mascara` en `Cinetico.tsx`.

### La raíz de la carpeta

Además de `PACKS/` hay 10 promos de agosto (`tactium-promo-v2…v8`, `tactium-torneos-v1/v2`, 9:16),
dos guiones (`GUION-VIDEO-ECOSISTEMA.md`: locución del vídeo «ecosistema» de ~3 min, pensado para el tribunal), 16 imágenes de
referencia (fondos verdes, pistas de pádel) y el logo. Los promos son anteriores al sistema actual:
usan en la escena «TU CLUB» unas pelotas que parecen de tenis, y el texto «DESCÁRGALA GRATIS»; no reutilizar tal cual.
