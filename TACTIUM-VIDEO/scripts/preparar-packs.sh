#!/usr/bin/env bash
# Versiones ligeras de los fondos y elementos de MOTION GRAPICHS TACTIUM/PACKS que usan los
# vídeos de estilo «lanzamiento» (src/reel/estilo/Recursos.tsx). Salen en public/broll/packs/,
# que está fuera de git (material de terceros: vive solo en local, como el resto de broll).
#
#   bash scripts/preparar-packs.sh
set -euo pipefail

P="../MOTION GRAPICHS TACTIUM/PACKS"
D="public/broll/packs"
mkdir -p "$D"

# Todos a 30 fps constantes y sin B-frames: con 24 fps variables el compositor de Remotion no
# encontraba fotograma («No frame found at position») al renderizar en paralelo.
#
# Rejillas de 15 s: se recortan a 10 s (ninguna escena dura más). El color se cambia en
# Remotion con hue-rotate, así que con una basta; se copian las cuatro porque cada una
# tiene un brillo y una densidad de líneas distintos.
for par in "GRID BLUE v2:azul" "GRID GOLD:oro" "GRID PINK:rosa" "GRID RED:rojo"; do
  ffmpeg -v error -y -i "$P/FONDOS ABSTRACTOS/${par%%:*}.mp4" -t 10 -an \
    -r 30 -c:v libx264 -crf 27 -preset slow -bf 0 -g 30 -pix_fmt yuv420p "$D/grid-${par##*:}.mp4"
done

# Topografía (líneas blancas sobre negro) y texturas de grano: se funden en «screen».
ffmpeg -v error -y -i "$P/FONDOS ABSTRACTOS/Kold Topography.mp4" -an -r 30 -c:v libx264 -crf 26 -bf 0 -g 30 -pix_fmt yuv420p "$D/topo.mp4"
ffmpeg -v error -y -i "$P/FONDOS ABSTRACTOS/Film Dust Roll.mp4" -an -vf scale=720:-2 -r 30 -c:v libx264 -crf 28 -bf 0 -g 30 -pix_fmt yuv420p "$D/polvo.mp4"
ffmpeg -v error -y -i "$P/FONDOS ABSTRACTOS/Kold Halftone Grunge.mp4" -an -vf scale=720:-2 -r 30 -c:v libx264 -crf 28 -bf 0 -g 30 -pix_fmt yuv420p "$D/halftone.mp4"

# Papel con alfa (ProRes 4444, lo lee <OffthreadVideo transparent />): girado a vertical y a
# la mitad de tamaño (un papel no necesita más).
for n in 07 08; do
  ffmpeg -v error -y -i "$P/TEXTURAS PAPEL/White Paper Elements $n.mov" -an \
    -vf "transpose=1,scale=540:960" -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le "$D/papel-$n.mov"
done
ls -la "$D"
