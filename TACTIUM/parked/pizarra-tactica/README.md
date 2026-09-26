# Pizarra táctica — código aparcado

Esto **no está enchufado a la app**. Vive aquí, y no en `src/features/`, para que
nadie lo importe por error creyendo que funciona: le faltan dos dependencias
NATIVAS, así que no basta con una OTA para encenderlo.

De dónde viene: el snapshot `823229a6` de la rama local `backup/strava-social`
(7 de julio de 2026). Estaba solo ahí, sin copia en GitHub, así que se trae a
`main` para no tenerlo en un único disco.

## Qué es

Pizarra interactiva para el capitán: fichas de jugador sobre la pista, jugadas
animadas y una biblioteca de jugadas. El plan, el manual de jugadas y la semilla
de las 36 jugadas están en [`../../docs/pizarra-tactica/`](../../docs/pizarra-tactica/).

| Fichero | Qué hace |
| --- | --- |
| `screens/TacticsBoardScreen.tsx` | La pantalla. Es lo único que toca Skia. |
| `courtGeometry.ts` | Medidas de la pista. Sin dependencias. |
| `actions.ts` · `plays.ts` | Modelo de jugadas y formaciones. TypeScript puro. |
| `tacticsStore.ts` | Estado y persistencia (zustand + AsyncStorage). |
| `assets/` | Seis pistas y la bola. |

## Qué falta para encenderla

Dos dependencias que **no** están en `TACTIUM/package.json`:

- `@shopify/react-native-skia` — el motor de dibujo.
- `expo-screen-orientation` — la pizarra se usa en horizontal.

Las dos son nativas: instalarlas obliga a una **build nativa nueva**, no se
pueden meter por OTA. Por eso el código está aparcado y no en `src/`.

## Cómo se enciende

1. Instalar las dos dependencias.
2. Mover la carpeta a `src/features/tactics/` y quitar `parked` del `exclude`
   del `tsconfig.json` (está excluido a propósito: aparcado no se
   type-checkea, porque los imports de Skia no resolverían).
3. Darle una entrada en la navegación — el snapshot original la colgaba de un
   stack que ya no existe, así que ese cableado hay que rehacerlo.
4. Build nativa y, a partir de ahí, ya sí por OTA.

El resto del snapshot (la tanda de «venues», los perfiles y sus migraciones)
sigue **solo** en `backup/strava-social`. Si esa rama se borra, se pierde.
