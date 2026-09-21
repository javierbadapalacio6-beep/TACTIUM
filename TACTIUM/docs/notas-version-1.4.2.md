# Notas de versión · TACTIUM 1.4.2

Cubre lo que entra desde el binario que se publicó como 1.4.1 (iOS build 26,
Android versionCode 19, subido el 5 de septiembre). 24 commits.
iOS build 31 · Android versionCode 25.

El hilo de la versión es **la temporada que viene**: la Federación abrió la
2026/2027 con 322 equipos meses antes de que exista calendario, y hasta ahora
eso no se veía por ningún lado.

---

## App Store · «Novedades de esta versión»

*(límite 4.000 caracteres)*

```
LA TEMPORADA QUE VIENE
• La temporada que aún está en inscripción ya se puede explorar, marcada como no empezada. Ahí es donde se ven los fichajes, meses antes de que arranque la liga.
• En el panel del club, una tarjeta te dice si tus equipos están apuntados y confirmados y en qué categoría han quedado. Si la categoría cambia se ven las dos («2ª → 1ª»), que es lo primero que se mira al salir la liga nueva.
• Toca un equipo inscrito y se despliega su plantilla ordenada por puntos, con la sede donde jugará de local — el dato que dice quién va a jugar en pistas ajenas.

FEDERACIÓN
• Las temporadas se leen como cursos (2025/2026) y no como años sueltos, que es como las nombra todo el mundo.
• La temporada vigente es la que se está jugando, no la más nueva que exista, así que abrir la inscripción del año que viene ya no cambia lo que ves de la liga en curso.
• La ficha de un jugador ya no mezcla los puntos de una temporada con los de otra.
• Arreglada la importación de plantilla desde la Federación, que fallaba con un error; ahora trae en la misma pasada tus equipos y los invitados.

CLUBES
• Horarios de local muestra el género, la categoría y el grupo de liga de cada equipo, para no confundir dos equipos con el mismo nombre.
• Los equipos invitados aparecen en cuanto los das de alta, se pueden dar de alta desde la propia pantalla de Horarios y admiten equipos de varios clubes distintos.

SUSCRIPCIÓN
• Cambia entre plan de club y plan de capitán sin cancelar ni volver a comprar: mantienes lo pagado hasta la fecha que ya tenías y la app te explica antes qué va a pasar.
• Si ya habías comprado en la tienda, la app lo reconoce sola al entrar y lo aplica a tu club, sin tener que pulsar «Restaurar compras».
• Cuando pides la baja, la app lo dice claro: «No se renovará, tu acceso termina el…», en vez de anunciarte un cobro que no va a llegar.
• Una suscripción ya caducada deja de aparecer como activa.

PRECIOS
• El plan Club Elite pasa a 49,99 €/mes y 479,99 €/año. Si ya estabas suscrito, mantienes el precio que tenías: la subida sólo afecta a altas nuevas. Los planes Capitán, Club Starter y Club Pro no cambian.

ADEMÁS
• Al borrar tu cuenta se borran también tus fotos y archivos, no solo tus datos.
• Ajustes muestra el número de compilación real, también en Android.
```

---

## Google Play · «Novedades»

*(límite 500 caracteres)*

```
La temporada que viene: explora la que aún está en inscripción y mira los fichajes antes de que empiece la liga. El club ve si sus equipos están apuntados, en qué categoría y su plantilla con la sede de local.
Federación: temporadas como cursos (2025/2026) e importación arreglada.
Suscripción: cambia entre plan de club y de capitán sin cancelar.
Club Elite pasa a 49,99 €/mes; si ya estabas suscrito mantienes tu precio.
Al borrar la cuenta se borran también tus archivos.
```

---

## Notas para quien publica

- **El precio de Club Elite ha subido** a 49,99 €/mes y 479,99 €/año, y se dice
  en las notas de las dos tiendas. La frase importante es la segunda: quien ya
  estuviera suscrito mantiene su precio. Es literalmente cierto —los dos scripts
  de precio usan `preserveCurrentPrice` en Apple y en Google el cambio sólo rige
  para altas nuevas— y además hoy no hay ni una sola suscripción Elite viva, así
  que no afecta a ningún cliente real. Capitán, Starter y Pro no se han tocado.
- **No mencionar** el cobro por torneo, que sigue siendo web: Apple no admite
  enlaces de compra externa en una app con compras integradas.
- **Capturas**: siguen siendo las de la 1.3.0. Donde más se notaría una nueva es
  en el panel del club con la tarjeta de la temporada que viene, que es la cara
  de esta versión.
- **Android** está subido como borrador en el canal de producción: hay que
  pulsar publicar en Play Console.
- **iOS** está en TestFlight (build 31, ya validada): hay que crear la versión
  1.4.2 en App Store Connect y enviarla a revisión.
