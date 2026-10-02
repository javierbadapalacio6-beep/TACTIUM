# Escenas sin Remotion (HTML + Three.js + FFmpeg)

Vídeo escrito como una página: cada escena expone `seek(t)` y pinta el fotograma
`t` sin depender del reloj. `render.mjs` la abre en el Chrome sin ventana que ya
trae Remotion, la recorre fotograma a fotograma y la pasa a FFmpeg.

```bash
node sin-remotion/render.mjs escenas/<escena>.html                 # vídeo en su `salida`
node sin-remotion/render.mjs escenas/<escena>.html --stills 1,3.5  # storyboard/<escena>/*.jpg
```

Antes del render completo, sacar el storyboard y revisarlo: es barato y evita
rehacer renders.

## Cada escena declara

```js
arrancar({ dur, fps, musica: { src, desde }, salida }, seek);
```

- `salida` en `renders/...`: pieza completa. Con `musica`, la pista se recorta
  desde `desde` (cuadrar el golpe fuerte con el primer corte).
- `salida` en `public/broll/3d-*.mp4` y sin `musica`: plano 3D sin audio, que
  los reels de Remotion usan como cualquier clip (`clip: { src: "broll/3d-…" }`
  o `fondoClip`).

Abierta en el navegador sin `?render=1`, la escena se reproduce en bucle.

## Kit (`lib/`)

- `base.js`, `base.css`: renderer 1080x1920, fuentes de marca, tokens, HUD, arranque.
- `util.js`: easings, aleatorio con semilla y texto que se descifra.
- `pistas.js`: 5 pistas (una por pareja), jugadores, red de equipo y rutas de cámara.
- `pelota.js`: pelota de pádel con polvo.

Vídeo real dentro de una escena: extraer los fotogramas del tramo con FFmpeg a
`clips/<id>/%03d.jpg` y cambiarlos en un `<img>` dentro de `seek()`
(`showreel.html` lo hace con el clip 13 a 0,5x).

## Escenas

- `escenas/showreel.html`: reel TACTIUM (gancho, palabras a golpe, 5 pistas 3D,
  picado a jugada real, 3–2 y wordmark).
- `escenas/showreel-claude.html`: prueba del prompt de un solo disparo de
  RoboNuggets («make a dynamic 15-second motion graphics video…»).
