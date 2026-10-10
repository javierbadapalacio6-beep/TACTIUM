# Referencias y técnicas de vídeo · TACTIUM

Documento vivo del agente `editor-video-viral`. Cada vez que Javier pase una referencia (guía, vídeo, web,
cuenta), se añade aquí con **qué técnica se roba y cómo se aplica a TACTIUM**, para que cada vídeo salga mejor
que el anterior. Última actualización: 10-10-2026.

Certeza: ✅ comprobado en nuestros datos o en una fuente primaria · 🟡 receta de un creador concreto que merece
la pena probar · ⚪ regla general de blogs, hipótesis.

---

## 1. «The Real One» · guía de Riccardo Bosso (@riki.bosso) · 🟡

PDF de 10 páginas: cómo hacer un anuncio de producto de 30 segundos, estilo keynote, con IA, en 8 pasos. Caso de
estudio: un anuncio de la herramienta Tally (anuncio de muestra, sin relación con la marca). Es **una receta**
de un creador, no una norma de Instagram; las cifras son suyas. Lo valioso es el método.

### Los 8 pasos

| # | Paso | Idea | Cifras de la guía |
|---|---|---|---|
| 1 | **Encuentra la suma** | Un buen anuncio es un cálculo, no una lista de funciones: un número grande que la gente cree, uno pequeño que es verdad y 3-5 costes que se comen la diferencia | Los importes suman exactamente; el número pequeño cae por debajo del 30 % del grande |
| 2 | **El guion** | 12 líneas, 28 segundos; se escriben 15 y se cortan a 12. Gancho < 2 s que acusa algo en lo que el espectador confía. Una línea por coste, con el verbo delante. Números dichos con palabras. Cierre: «Conoce [MARCA]», una frase de 4 palabras y el nombre solo | ~75 palabras en 28 s |
| 3 | **Beat sheet** | UN objeto héroe que muestre los números cambiando; cada cambio cae sobre una palabra. Rehacer cada plano para 9:16, sin recortar | En Tally: una moneda cortada como un gráfico circular |
| 4 | **Sistema de diseño** | «Premium es sustracción»: escribir primero la lista de «nunca» (sin mascotas, sin caras, sin serif, sin glitch) | Fondo casi negro, UN acento, una tipografía, tres pesos; palabra clave en blanco y el resto en gris |
| 5 | **La voz es la columna** | Grabar la voz ANTES de animar; la imagen se ajusta a la voz, nunca al revés. Dos tomas y se queda la que suena más segura. Sacar los tiempos por palabra con una transcripción | Huecos de 0,33-0,45 s; solo 2 pausas largas; nunca estirar la voz |
| 6 | **Música y tempo** | Calcular el tempo desde el instante del logo para que «Conoce X» caiga en un tiempo fuerte | `compás = (t_logo − t_inicio_música) ÷ nº de compases`; `BPM = 240 ÷ compás`; 4/4 y entre 95 y 120 BPM |
| 7 | **Diseño de sonido** | La mitad del anuncio es sonido: hoja de señales con una regla por evento, solo 2 golpes héroe y 0,3 s de subida justo antes de la palabra gancho. Nunca empezar en silencio | 457 señales en 30 s |
| 8 | **Acabado y entrega** | Lista final de comprobación (abajo) | Ver tabla |

### Comprobaciones de acabado (suyas)

| Qué | Valor |
|---|---|
| Volumen | −14 LUFS integrado; pico real ≤ −1 dBTP |
| Voz sobre música | Música ≥ 20 dB por debajo de la voz en 1-4 kHz; comprobar con el altavoz del móvil |
| Sincronía | Cada golpe a ≤ 1 fotograma de su evento en imagen |
| Bucle | Entrada de 4 ms en la primera muestra para que no «clic» al repetirse el reel |
| Zonas seguras 9:16 | Títulos al 20-30 % de la altura; nada en el 18 % inferior |
| Másters | 1920×1080 y 1080×1920, 60 fps, H.264 a ~20 Mb/s, 48 kHz estéreo |
| Entrega | Pistas separadas (voz, música, efectos) y un montaje con cada sonido en su clip y marcadores en cada golpe |
| Firma | Tarjeta final de 2 s con el nombre y el último acorde sonando |

Las 5 reglas de su cierre: empezar por UNA suma · hacer el número físico («una moneda que puedes cortar gana a un
gráfico que tienes que leer») · ajustar la imagen a la voz y hacer las cuentas para que el logo caiga en un tiempo
fuerte · premium es sustracción · diseñar los primeros 5 segundos dos veces (para el ojo y para el oído). Y su
historia: v1 de 45,6 s con personajes de dibujos → v3 de 30,3 s estilo keynote; cada versión quitó algo.

### Cómo se aplica a TACTIUM

- **La suma de TACTIUM** (el cálculo que la gente no hace): *«Montar la alineación: 60 minutos → 20 segundos»*;
  *«47 mensajes de WhatsApp, 3 bajas, 1 orden de parejas»* (ya es el reel J1); *«323 equipos, 41 grupos: ¿en cuál
  juegas?»* (es lo local, lo que más se envía).
- **Objeto héroe:** la **ficha del equipo**, o la pareja que sube o baja de puesto en el orden de fuerza. Que se
  mueva sobre la palabra.
- **Lista de «nunca» propia:** nada de mascotas ni caras sobre los objetos, nada de serif salvo la palabra
  emocional del estilo cinético, nada de anotaciones sobre las capturas de pantalla.
- **Voz primero + Whisper:** ya tenemos `scripts/transcribir.py` (tiempos por palabra). La guía confirma el orden:
  voz → tiempos → imagen.
- **Tempo y logo:** la fórmula sirve para los reels con música (cierre con el wordmark sobre un tiempo fuerte).
  Para reels de cara a cámara con música a 0,2 casi no importa; para los de motion, sí.
- **Cuidado:** es una receta de anuncio de 30 s en 16:9. Los reels fríos de TACTIUM duran 10-20 s; hay que
  recortar los pasos, no copiarlos tal cual. 60 fps y 20 Mb/s son un máster; Instagram recomprime.

---

## 2. prompt-motion.com · ❓ pendiente

Javier la pasó el 10-10-2026. **No cargó**: ni desde el servidor ni desde su Chrome (página de error). Hay que
confirmar la dirección exacta o enviar capturas/contenido. Qué buscamos de ella: prompts de motion graphics
reutilizables y su estructura.

---

## 3. Plantilla para añadir una referencia nueva

```
## N. <nombre> · <autor/fuente> · <certeza>
Qué es (2 líneas) · de dónde viene (enlace / fichero).
Técnica que se roba (1-3 puntos concretos, con números si los hay).
Cómo se aplica a TACTIUM (pieza, herramienta, ejemplo).
Qué NO copiar (por qué no encaja con nuestra marca o con 9:16).
Experimento: qué reel lo prueba y qué métrica dirá si funcionó (retención, envíos).
```
