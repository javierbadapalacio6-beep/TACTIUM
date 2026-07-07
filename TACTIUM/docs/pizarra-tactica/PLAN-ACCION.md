# Plan de acción — Pizarra táctica TACTIUM

> Feature diferencial: pizarra interactiva para capitán/entrenador, con fichas arrastrables,
> caras reales de jugadores, animación de jugadas y biblioteca de jugadas precargadas.
> **No se lanza directo a producción**: se prueba en canal interno y se promociona al final.

## Decisiones cerradas (2026-06-25)

- **Motor de render:** `@shopify/react-native-skia` (60fps GPU). Obliga a un **build nativo nuevo (1.0.3)** la primera vez; después todo se itera por **OTA**.
- **Alcance v1:** experiencia completa → editor + animación (timeline) + biblioteca de las 36 jugadas.
- **Acceso:** solo **capitán / club_admin** (entrenador). No visible para rol `player`.

## Stack confirmado en TACTIUM

| Pieza | Estado |
|---|---|
| Expo managed + react-navigation + Zustand + StyleSheet (dark, `#030F0F`/`#00DF82`) | ✅ existente |
| Reanimated 4.1, Gesture Handler 2.28, react-native-svg 15.12 | ✅ instalado |
| `@shopify/react-native-skia` | ⬜ por añadir (build nativo) |
| `perfect-freehand` (trazos suaves, JS puro) | ⬜ por añadir (OTA) |
| `players.photo_url` / `profile_avatar_url`, buckets `player-avatars/` | ✅ reutilizable para fichas |
| `runtimeVersion: appVersion` (1.0.2) → subir a **1.0.3** | ⚠️ requiere release de tienda |

## Arquitectura técnica (resumen)

- **Coordenadas world → screen:** posiciones en fracción 0–1 de una pista 10×20 m; un único
  factor de escala con letterbox conserva el ratio en móvil y tablet (encaja con `ResponsiveFrame` passthrough).
- **Jugada = JSON de keyframes** (ver `jugadas-seed.json`). Se guarda en Supabase como `jsonb`.
- **Animación:** un reloj Reanimated en UI thread; cada ficha deriva su posición con
  `useDerivedValue` interpolando entre keyframes. Velocidad = cambiar la `duration` del `withTiming`.
  Scrubbing = el slider escribe `progress.value`.
- **Drag:** `Gesture.Pan` + hit-test por distancia al centro de la ficha (worklet) o `react-native-skia-gesture`.
- **Avatares:** `Mask`/`ImageShader` circular con `fit="cover"` sobre la foto del jugador.
- **Export:** imagen con `makeImageSnapshotAsync` (OTA). Vídeo v1 → frames + FFmpeg en edge function de Supabase. Vídeo on-device = v2 opcional (`@azzapp/react-native-skia-video`, beta).

## Frontera OTA vs build nativo

- **Build nativo 1.0.3 (una vez):** añadir Skia (+ skia-video si se hiciera v2). Recomendado subir
  `runtimeVersion` a policy `fingerprint` para que el JS nuevo no se sirva a binarios viejos.
- **Iterable por OTA (sin tiendas):** TODO lo demás — pista, fichas, avatares, flechas, timeline,
  play/pausa/scrubbing/velocidad, esquema JSON, biblioteca, personalización y export-imagen.

## Fases

### Fase 0 · Spike técnico (de-risk lo nativo) — build 1.0.3
- [x] `npx expo install @shopify/react-native-skia` (2.2.12) + `perfect-freehand` (1.2.3). Instalados y verificados.
- [x] Setup base OK: babel ya tiene `react-native-worklets/plugin`; `App.tsx` ya monta `GestureHandlerRootView`. Sin cambios.
- [x] Pantalla spike `src/features/tactics/screens/TacticsBoardScreen.tsx` + geometría `courtGeometry.ts`: pista Skia (líneas, red, servicio, central), 4 fichas + bola arrastrables (Pan + hit-test en UI thread), clamp a pista, botón Captura (`makeImageSnapshotAsync`) y Reiniciar.
- [x] Navegación cableada: ruta `TacticsBoard` en `HomeStack`, oculta del tab bar, acceso en Home (solo capitán/club_admin). `tsc --noEmit` limpio.
- [x] **Dev build #14 (iOS) generado y validado** en iPhone real: Skia pinta, drag fluido, captura OK, pista fiel. (Nota: Skia también funciona en Expo Go, útil para iterar rápido.)
- [x] **Geometría corregida:** líneas de saque a 6,95 m de la red (≈3 m del cristal), no a 3 m. La central queda larga, como pista real.
- [ ] Registrar iPad y rebuild para validar tablet (pendiente, opcional).
- [ ] Decidir política `runtimeVersion` (`fingerprint`) al cortar la 1.0.3 de tienda (no tocar ahora para no alterar el canal OTA de producción).
- **Salida:** ✅ binario sobre el que iterar el resto por OTA. **FASE 0 COMPLETA.**

### Progreso real (2026-06-25, en dev build)
- **Fase 1** ✅ Pista fiel (líneas de saque a 6,95 m), fichas con **foto real** de jugadores (inicial dentro si no hay foto), **feel de elevación** al arrastrar, **selector de pareja** (avatares en cabecera → picker de plantilla con swap).
- **Fase 3** ✅ (núcleo) Animación por **keyframes**: “+ Paso”, **Play/Pausa**, **velocidad 0.5/1/2×**, Reiniciar/Limpiar. Interpolación en UI thread 60fps. *(Pendiente: scrubbing con slider, flechas/trayectorias.)*
- **Fase 4** ✅ (local) **Menú flotante (FAB)**: Biblioteca, Guardar, Jugadores, Reiniciar, Captura. **Guardar/cargar jugadas** local (AsyncStorage, store `tacticsStore`) + **biblioteca** con 7 jugadas del manual (`plays.ts`). *(Pendiente: ampliar a las 36, sync Supabase `tactic_plays`.)*
- **Pendiente**: flechas de movimiento, personalización de pista (color), export imagen/vídeo (Fase 5).

### Fase 1 · Pizarra MVP (editor estático) — OTA
- [ ] Nueva feature `src/features/tactics/` + pantalla `TacticsBoardScreen`, registrada en stack de capitán; oculta para `player`.
- [ ] Render de **pista reglamentaria** (rectángulo 10×20, red en y=0.5, líneas de servicio y=0.35/0.65, central, cristal).
- [ ] **4 fichas + bola** con drag, reset de posiciones, sistema world→screen, tablet OK.
- **Prueba:** canal `preview`.

### Fase 2 · Identidad y personalización — OTA
- [ ] Fichas con **caras reales** desde `players` (avatar circular); selector de qué jugadores van en pista.
- [ ] Personalización de pista: color de suelo, mostrar/ocultar números, colores de equipo (us/them).
- **Prueba:** `preview`.

### Fase 3 · Animación de jugadas — OTA
- [ ] Timeline de keyframes: **play / pausa / scrubbing / velocidad** (slow/normal/fast).
- [ ] **Flechas y trayectoria de bola** (rectas + freehand con `perfect-freehand`); arco para globos/bandejas.
- [ ] Editor de keyframes (capturar posiciones actuales como nuevo frame).
- **Prueba:** `preview`.

### Fase 4 · Biblioteca de jugadas — OTA
- [ ] Cargar las **36 jugadas** (`jugadas-seed.json`) como contenido precargado, filtrable por familia/nivel.
- [ ] Tabla Supabase `tactic_plays` (`id, team_id, created_by, name, data jsonb, created_at`) + RLS (solo capitán/club_admin del equipo).
- [ ] Guardar / cargar / duplicar / borrar jugadas propias.
- **Prueba:** `preview`.

### Fase 5 · Export y pulido — OTA
- [ ] Exportar **imagen** de la jugada (snapshot) → compartir.
- [ ] (Opcional) Exportar **vídeo** v1: frames → FFmpeg en edge function.
- [ ] Pulido de UX, gating premium si aplica (`usePremiumGate`), microinteracciones.
- **Prueba:** `preview`.

### Fase 6 · Release
- [ ] Validación interna completa en `preview`.
- [ ] Promoción `preview` → `production` (App Store / Play) con la 1.0.3.

## Riesgos / notas

- **Skia = release de tienda obligatorio** para estrenar; planificar junto a otros cambios nativos pendientes para no fragmentar versiones.
- **Vídeo on-device** depende de una lib beta sin audio → preferir ruta server-side en v1.
- **Hit-test de fichas en Skia** (canvas sin views): resolver en Fase 1 con `react-native-skia-gesture` o hit-test manual por distancia.
- Reutilizar **tokens de tema** existentes (`@core/theme`) para que la pizarra respete el dark mode.

## Entregables de la investigación (este directorio)

- `MANUAL-JUGADAS.md` — catálogo de 36 jugadas en 6 familias con coordenadas.
- `jugadas-seed.json` — 7 jugadas representativas ya serializadas (formato consumible por el renderer); ampliar a las 36 en Fase 4.
- `PLAN-ACCION.md` — este documento.
