# Manual del entrenador — Jugadas tácticas para la pizarra TACTIUM

> Catálogo de jugadas de pádel pensado para **recrearse en la pizarra interactiva**: cada jugada
> trae posiciones iniciales en coordenadas y una secuencia numerada de movimientos, lista para
> traducirse a fichas animadas sobre un canvas.

## Sistema de coordenadas (vista cenital)

Pista de **10 m de ancho × 20 m de largo**, **red horizontal en el centro** (y = 0.5).

- `x = 0` → banda izquierda · `x = 1` → banda derecha · `x = 0.5` → centro / "la T".
- `y = 0` → fondo rival · `y = 1` → nuestro fondo · `y = 0.5` → red.
- **Nuestra** pareja juega en la mitad inferior (y > 0.5). **Rivales** en la mitad superior (y < 0.5).
- Línea de saque ≈ y = 0.65 (nuestra) y y = 0.35 (rival). Posición de red ≈ y = 0.60 / y = 0.40.
- Fichas: **A1, A2** (nuestros) · **R1, R2** (rivales) · **B** (bola).
- Todas las coordenadas en **fracción 0–1**. El renderer multiplica por el tamaño del canvas
  (que conserva el ratio 10×20 con letterbox). Para el lado izquierdo, espeja `x → 1 - x`.

Convención de roles: **A1 = lado derecho, A2 = lado izquierdo** (ajusta el espejo según el lado).

---

## Familia 1 · Posicionamiento base

### 1.1 — Posición de ataque (red en bloque) · *Iniciación*
- **Categoría:** Red / posicionamiento.
- **Inicio:** A1 (0.72, 0.60), A2 (0.28, 0.60); R1 (0.72, 0.15), R2 (0.28, 0.15).
- **Secuencia:** ambos A justo por dentro de la línea de saque, cuerpos al frente; ajustes laterales, nunca retroceder salvo globo.
- **Objetivo:** los puntos se ganan desde la red; quitar tiempo y ángulo, forzar el globo.

### 1.2 — Posición de defensa (fondo en bloque) · *Iniciación*
- **Categoría:** Defensa.
- **Inicio:** A1 (0.70, 0.92), A2 (0.30, 0.92); rivales en red (y ≈ 0.40).
- **Secuencia:** ambos detrás de la línea de fondo, peso atrás para leer el cristal; esperar la bola que rebota para resetear o globear.
- **Objetivo:** sobrevivir, usar la pared para ganar tiempo, buscar globo para recuperar la red. **Nunca quedarse a media pista.**

### 1.3 — La cuerda invisible / mover como bloque · *Iniciación*
- **Categoría:** Sistema de pareja.
- **Inicio:** A1 (0.70, 0.60), A2 (0.30, 0.60).
- **Secuencia:** 1) bola al fondo → **ambos** retroceden a la vez a y=0.90. 2) globean → **ambos** suben a la vez a y=0.60. Distancia constante (~4–5 m), como atados por una cuerda.
- **Objetivo:** evitar la configuración "uno arriba / uno abajo", que abre un pasillo diagonal explotable.

### 1.4 — La diagonal · *Iniciación*
- **Categoría:** Posicionamiento.
- **Inicio:** A1 en red (0.72, 0.60), A2 en fondo opuesto (0.28, 0.90).
- **Secuencia:** mientras uno sube, el compañero ocupa el fondo del lado contrario; transición hasta igualar alturas.
- **Objetivo:** cubrir huecos en transición; reducir el pasillo explotable.

### 1.5 — Limpiaparabrisas (cubrir el paralelo) · *Intermedio*
- **Categoría:** Red / posicionamiento.
- **Inicio:** A1 (0.70, 0.60), A2 (0.30, 0.60); bola en R a x≈0.20.
- **Secuencia:** 1) bola en banda izquierda rival → ambos A se desplazan **juntos** (A1→0.55, A2→0.18), tapando el **paralelo**. 2) bola cambia a la derecha → barren al lado contrario. Como las escobillas de un parabrisas.
- **Objetivo:** cerrar siempre el paralelo (el más peligroso) y ceder solo el cruzado, más largo y controlable.

### 1.6 — Las 3 zonas (rojo-naranja-verde) · *Intermedio*
- **Categoría:** Toma de decisiones.
- **Inicio:** franjas: **rojo** y≈0.80–1.0 (defensa), **naranja** y≈0.55–0.80 (transición, prohibido estar parado), **verde** y≈0.50–0.60 (ataque red).
- **Secuencia:** la ficha nunca se **detiene** en naranja; o avanza a verde o retrocede a rojo.
- **Objetivo:** reducir errores y ordenar la decisión de subir/bajar.

---

## Familia 2 · Saque y resto

### 2.1 — Saque y subida a la red · *Iniciación*
- **Inicio:** A1 sacador (0.60, 0.72), A2 en red (0.30, 0.60); R1 restador (0.72, 0.15), R2 red (0.28, 0.40).
- **Secuencia:** 1) A1 saca cruzado **B**: (0.60,0.72)→(0.80,0.38). 2) A1 avanza a red (0.60,0.72)→(0.62,0.62). 3) volea a los pies del que sube.
- **Objetivo:** tomar la red tras sacar; el saque es para colocar, no para hacer daño.

### 2.2 — Saque plano al cuerpo · *Intermedio*
- **Secuencia:** **B** directo a la cadera del restador: (0.60,0.72)→(0.72,0.20), rápido y sin efecto.
- **Objetivo:** quitar tiempo y ángulo; el restador no sabe si jugar drive o revés.

### 2.3 — Saque cortado a la pared lateral · *Intermedio*
- **Secuencia:** **B** con slice abierto al cristal: (0.60,0.72)→(0.95,0.30)→rebota pared→muere baja.
- **Objetivo:** el saque más usado a nivel pro; saca al restador de la pista y obliga a un resto incómodo pegado al cristal. Da tiempo a subir.

### 2.4 — Saque a la T (al centro) · *Intermedio*
- **Inicio:** A1 más central (0.55, 0.72).
- **Secuencia:** **B** ceñido a la línea central: (0.55,0.72)→(0.52,0.33).
- **Objetivo:** cierra el ángulo cruzado del restador y siembra duda sobre quién resta; reduce el paralelo.

### 2.5 — Saque abierto (al cristal exterior) · *Avanzado*
- **Secuencia:** **B** muy angulado a la pared lateral exterior: (0.62,0.72)→(0.98,0.28).
- **Objetivo:** crear hueco central enorme para el primer ataque; arriesgado. Variar con 2.4 para romper ritmo.

### 2.6 — Resto profundo + globo (neutralizar) · *Iniciación*
- **Inicio:** A1 restador (0.75, 0.20) recibe saque rival.
- **Secuencia:** 1) llega **B** del saque. 2) A1 resta **globo profundo** sobre el sacador que sube: (0.75,0.20)→(0.70,0.05). 3) ambos A suben.
- **Objetivo:** si el saque es bueno, globear largo para frenar la subida del rival y robar la red.

### 2.7 — Resto a los pies del que sube · *Intermedio*
- **Inicio:** A1 restador (0.75, 0.20); sacador R1 subiendo (0.62, 0.55).
- **Secuencia:** **B** bajo y cruzado a los pies del sacador: (0.75,0.20)→(0.60,0.52).
- **Objetivo:** obligar a una media volea baja e incómoda; frena su subida.

### 2.8 — La chiquita al resto · *Avanzado*
- **Inicio:** A1 restador (0.75, 0.22).
- **Secuencia:** 1) **B** suave y baja, liftado corto a los pies del rival junto a la red: (0.75,0.22)→(0.55,0.44), apenas pasa la red. 2) A1 + A2 suben juntos.
- **Objetivo:** obligar al rival a levantar desde abajo → siguiente bola alta para atacar y recuperar la red.

---

## Familia 3 · Golpes-llave que generan jugada

### 3.1 — Bandeja (antídoto del globo) · *Intermedio*
- **Inicio:** A1 en red (0.70, 0.60) recibe globo no muy profundo; A2 (0.30, 0.60).
- **Secuencia:** 1) globo cae sobre A1: (…)→(0.70,0.68). 2) bandeja con slice, lenta y profunda, ceñida al cristal: (0.70,0.68)→(0.90,0.08). 3) A1 recupera red.
- **Objetivo:** golpe de control para **mantener la red** sin arriesgar.

### 3.2 — Víbora · *Avanzado*
- **Secuencia:** golpe con efecto lateral, más ofensivo: (0.70,0.66)→(0.85,0.12), bote bajo y vivo que se abre tras el cristal.
- **Objetivo:** presionar manteniendo red; bote difícil de levantar.

### 3.3 — Remate plano (a romper) · *Intermedio*
- **Inicio:** A1 (0.68, 0.58) con bola corta y alta.
- **Secuencia:** **B** plano y potente al centro/cuerpo: (0.68,0.58)→(0.50,0.10).
- **Objetivo:** cerrar punto cuando el globo se queda corto; al centro genera duda entre los rivales.

### 3.4 — Remate por 3 (x3, salida por lateral) · *Avanzado*
- **Secuencia:** liftado a la pared lateral: **B** (0.70,0.56)→bote→(0.95,0.08)→cristal→sale por encima de la valla lateral.
- **Objetivo:** sacar la bola fuera por el lateral; el rival no puede devolverla.

### 3.5 — Remate por 4 (x4, salida por el fondo) · *Competición*
- **Secuencia:** liftado muy potente al cristal del fondo: **B** (0.60,0.55)→bote→pared de fondo→sale por encima de la valla del fondo.
- **Objetivo:** punto definitivo cuando el bote y la altura lo permiten.

### 3.6 — Globo ofensivo · *Intermedio*
- **Inicio:** A1 fondo (0.72, 0.88); rivales en red.
- **Secuencia:** **B** alto y profundo sobre la cabeza del rival: (0.72,0.88)→(0.70,0.10).
- **Objetivo:** pasar al rival y obligarle a retroceder al cristal → recuperar la red.

### 3.7 — Dejada / drop desde la red · *Avanzado*
- **Inicio:** A1 en red (0.68, 0.58); rivales en fondo (y≈0.90).
- **Secuencia:** volea muy suave que muere pasada la red: **B** (0.68,0.58)→(0.60,0.46).
- **Objetivo:** sorprender a rivales clavados en el fondo; obligarles a sprintar y levantar.

### 3.8 — Contradejada · *Avanzado*
- **Inicio:** rival hace dejada; A2 corre (0.30,0.75→0.48).
- **Secuencia:** 1) bola muerta cerca de la red. 2) A2 responde con **otra dejada** cruzada: **B** (0.35,0.47)→(0.62,0.46).
- **Objetivo:** contra rival que subió tras su dejada; mandar la bola al hueco que dejó.

### 3.9 — Salida de pared / contrapared · *Intermedio*
- **Inicio:** A1 fondo (0.80, 0.85), bola al cristal del fondo.
- **Secuencia:** 1) **B** rebota en pared y sale hacia A1. 2) A1 deja trabajar la pared y golpea tras el bote, normalmente **globo**: (0.80,0.88)→(0.72,0.10).
- **Objetivo:** usar el cristal para ganar tiempo y resetear; base de toda la defensa.

### 3.10 — Doble pared (lateral + fondo) · *Avanzado*
- **Inicio:** A2 (0.15, 0.85), bola cerrada al lateral.
- **Secuencia:** **B** pega lateral y luego fondo y sale al centro; A2 espera el doble rebote y juega tarde con globo profundo.
- **Objetivo:** defender bolas muy cerradas a la esquina con paciencia.

---

## Familia 4 · Jugadas de pareja / sistemas

### 4.1 — Formación tradicional (cruzada) · *Iniciación*
- **Inicio:** sacador A1 (0.60, 0.72), compañero A2 en red del lado **opuesto** (0.28, 0.60).
- **Secuencia:** cada uno cubre "su" mitad; A1 sube tras sacar a su lado.
- **Objetivo:** estructura por defecto; responsabilidad clara de cada media pista.

### 4.2 — Formación Australiana (en I) · *Competición*
- **Inicio:** A1 saca pegado a la **T** (0.52, 0.72); A2 en red del **mismo lado** del sacador (0.70, 0.60).
- **Secuencia:** 1) A1 saca cerrado a la T: (0.52,0.72)→(0.52,0.34). 2) A1 **cruza** rápido a cubrir el **paralelo** (0.52,0.72)→(0.28,0.62). 3) A2 se responsabiliza del **centro**.
- **Objetivo:** anular el cruzado favorito del restador y obligarle al paralelo; proteger un lado débil; romper el ritmo.

### 4.3 — Cruzar tras el saque · *Avanzado*
- **Inicio:** A1 sacador (0.60, 0.72); A2 red (0.28, 0.60).
- **Secuencia:** 1) saque. 2) por señal previa, A2 **cruza** a tapar el centro/lado contrario mientras A1 sube a su lado.
- **Objetivo:** sorprender al restador que apunta a un hueco prefijado; esconder el lado débil.

### 4.4 — Tapar el hueco central · *Intermedio*
- **Inicio:** A1 (0.68, 0.60), A2 (0.32, 0.60); bola al centro.
- **Secuencia:** regla: la bola al centro la juega quien la tiene de **drive**. El otro cierra su banda.
- **Objetivo:** eliminar la duda del "seam" central que los rivales atacan a propósito.

### 4.5 — Sistema "quién cubre el globo" · *Intermedio*
- **Inicio:** A1 (0.70, 0.60), A2 (0.30, 0.60); globo cruzado por encima de A2.
- **Secuencia:** 1) globo cae al lado de A2. 2) si A2 no llega, **A1 cruza por detrás** y cubre el remate, **A2 desliza** al hueco (rotación). Cantar "¡voy!" / "¡tuya!".
- **Objetivo:** que el globo sobre el lado débil no rompa la estructura.

### 4.6 — Intercambio de lados permanente · *Avanzado*
- **Inicio:** tras rotaciones quedan A1 (x=0.30) y A2 (x=0.70).
- **Secuencia:** la pareja **no vuelve** a su lado original; juega desde donde quedó hasta fin del punto.
- **Objetivo:** no perder tiempo recolocándose; evitar huecos durante el retorno.

### 4.7 — Cambio de pareja en defensa · *Avanzado*
- **Inicio:** A1 (0.70, 0.90), A2 (0.30, 0.90); rival ataca al lado débil de A1.
- **Secuencia:** durante un globo largo, A1 y A2 **intercambian lados** en el fondo para que el mejor defensor reciba el ataque insistente.
- **Objetivo:** reubicar al mejor defensor en la zona bombardeada.

---

## Familia 5 · Patrones tácticos

### 5.1 — Atacar al jugador más débil · *Iniciación*
- **Secuencia:** dirigir el 70–80% de las bolas a la media pista del rival más flojo.
- **Objetivo:** acumular presión sobre uno; el otro se enfría.

### 5.2 — Jugar al cuerpo · *Intermedio*
- **Secuencia:** voleas y remates a la cadera del rival, sin ángulo.
- **Objetivo:** anular el brazo; no puede extenderse ni decidir drive/revés.

### 5.3 — Abrir, abrir, cerrar · *Avanzado*
- **Inicio:** A1 (0.68, 0.58), rivales en fondo.
- **Secuencia:** 1) volea abierta a una esquina (x=0.92). 2) volea a la **otra** esquina (x=0.08). 3) tercera bola al **centro/hueco**: **B**→(0.50,0.90).
- **Objetivo:** mover al rival a los extremos para abrir el centro y cerrar.

### 5.4 — El 2 contra 1 · *Avanzado*
- **Secuencia:** bombardear a un solo rival hasta que falle o levante corto, **luego** cambiar al hueco del otro.
- **Objetivo:** saturar a un jugador y romper su posición; el cambio finaliza.

### 5.5 — Romper el ritmo con globos · *Intermedio*
- **Secuencia:** alternar bolas rápidas con **globos profundos** inesperados sobre rivales agresivos: **B**→(0.70,0.08).
- **Objetivo:** descolocar a una pareja de red, obligarla a retroceder y cansarla.

### 5.6 — Salir del fondo con globo y recuperar la red · *Intermedio*
- **Inicio:** A1 (0.72, 0.90), A2 (0.30, 0.90); rivales en red.
- **Secuencia:** 1) A1 **globo profundo** (0.72,0.90)→(0.70,0.08). 2) **solo si** pasa claramente al rival, **ambos** suben a y=0.60. 3) si el rival rematea cómodo, no suben.
- **Objetivo:** el globo es el golpe más usado para recuperar la red; subir solo cuando incomoda de verdad.

### 5.7 — La contradejada como respuesta a la dejada · *Avanzado*
- **Secuencia:** rival deja → en vez de levantar, **contradejada** cruzada al hueco que dejó al subir (ver 3.8).
- **Objetivo:** castigar al rival que sube tras su dejada.

### 5.8 — Volea a los pies para subir · *Intermedio*
- **Inicio:** A1 sube desde y=0.70 y recibe bola a media altura.
- **Secuencia:** media volea **baja a los pies** del rival de red en vez de pegar fuerte: **B**→(rival, y=0.42); A1 completa la subida a y=0.60.
- **Objetivo:** ganar metros sin regalar bola atacable.

---

## Familia 6 · Jugadas ensayadas / set plays

### 6.1 — Saque a la T + volea al centro · *Avanzado*
- **Secuencia:** 1) A1 saca a la T (0.52,0.34). 2) el resto sale forzado por el centro. 3) A2 intercepta y **volea al centro** entre los dos rivales (0.50,0.12). Con seña previa.
- **Objetivo:** saque que cierra ángulo + interceptación al seam; punto rápido.

### 6.2 — Saque abierto + ataque al hueco central · *Competición*
- **Secuencia:** 1) saque abierto al cristal (0.98,0.28) saca al restador fuera. 2) resto débil. 3) primer golpe **al centro vacío** (0.50,0.90).
- **Objetivo:** crear y atacar el hueco del centro que deja el restador desplazado.

### 6.3 — Australiana ensayada con seña · *Competición*
- **Secuencia:** seña del de red → 1) saque a la T. 2) sacador cruza a cubrir paralelo. 3) el de red **cierra el centro** y rematea el resto cruzado forzado.
- **Objetivo:** anular el cruzado del restador con un sistema acordado.

### 6.4 — Señas de saque (comunicación) · *Avanzado*
- **Secuencia:** el de red enseña con los dedos a la espalda: **1 = T, 2 = al cuerpo, 3 = abierto**; puño = "yo cruzo"/australiana.
- **Objetivo:** coordinar dirección de saque + anticipación del compañero; base de todas las jugadas ensayadas.

### 6.5 — Cierre de punto: bandeja → víbora → remate · *Competición*
- **Secuencia:** 1) **bandeja** al cristal (0.90,0.08) para mantener red. 2) globo corto → **víbora** (0.85,0.12). 3) globo aún más corto → **remate x3** a la salida lateral. Escalera de presión creciente.
- **Objetivo:** patrón pro para asfixiar desde la red hasta el winner sin arriesgar antes de tiempo.

### 6.6 — Break point: resto cruzado profundo + subida · *Competición*
- **Secuencia:** 1) resto profundo y seguro a los pies del sacador (0.60,0.52). 2) ambos A suben juntos. 3) primera bola al rival más débil.
- **Objetivo:** maximizar fiabilidad y presión en el punto decisivo.

---

## Modelo de serialización (resumen)

Cada jugada se guarda con el esquema definido en `jugadas-seed.json` (mismo directorio):
posiciones en fracción 0–1, dos tipos de paso (`mueve_a` para fichas, `bola_a` para la bola,
con `arco` para globos/bandejas/dejadas). Ver el seed para el formato exacto consumible por el renderer.

## Fuentes

The Padel School · Padel39 · PadelStar · Babolat · Racket Trip · PINQ Padel · StarVie · PadelExperto ·
Padel VS · padel.how · El Neverazo · Wilson · Padel Coach Finder · actu-padel · Revista Retos.
