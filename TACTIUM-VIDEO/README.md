# TACTIUM-VIDEO — vídeo del ecosistema (Remotion, 100% local)

Proyecto de motion graphics del vídeo explicativo del ecosistema TACTIUM (~3 min, 1920x1080@30).
Sin servicios de pago: Remotion + ffmpeg locales, capturas reales de la app y marca oficial.

## Comandos

```bash
# Editor visual con previsualización en vivo
npx remotion studio src/index.ts

# Render completo
npx remotion render src/index.ts tactium-ecosistema renders/tactium-ecosistema.mp4

# Un fotograma suelto (proofs)
npx remotion still src/index.ts tactium-ecosistema renders/frame.png --frame=300
```

## Estructura

- `src/timing.ts` — duración de cada escena y su audio de locución. **Única fuente de tiempos.**
- `src/theme.ts` — colores y tipografías de marca (BRAND_SYSTEM.md).
- `src/ui.tsx` — fondo, tipografía, chips, tarjetas, mockup de móvil, wordmark.
- `src/scenes/` — las 8 escenas (hook, problema, app, federación, web, arquitectura, negocio, cierre).
- `public/img/` — capturas reales de la app + logo.
- `public/fonts/` — Satoshi (Fontshare) y JetBrains Mono, vendidas en local.
- `public/voz/` — **aquí van los audios de locución** (`bloque-1.m4a` … `bloque-8.m4a`),
  guion en `../MOTION GRAPICHS TACTIUM/GUION-VIDEO-ECOSISTEMA.md`.

## Flujo de locución

1. Grabar los 8 bloques y dejarlos en `public/voz/`.
2. Medir duraciones (`ffprobe`) y actualizar `seconds` + `audio` en `src/timing.ts`
   (duración de escena = audio + ~1,5s de aire).
3. Render final.
