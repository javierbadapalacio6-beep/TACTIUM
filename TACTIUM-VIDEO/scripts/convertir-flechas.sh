#!/usr/bin/env bash
# Convierte las 17 flechas del pack de croma verde a ProRes 4444 con alfa,
# recoloreadas al accent de TACTIUM.
#
# No se va a WebM: libvpx-vp9 no conserva el alfa en este ffmpeg. ProRes 4444 sí,
# y Remotion lo lee con <OffthreadVideo transparent />.
set -euo pipefail

ORIGEN="../MOTION GRAPICHS TACTIUM/PACKS/FLECHAS _IMAN GADZHI_"
DESTINO="public/flechas"

# Verde real del croma, medido sobre el archivo. No es verde puro.
CROMA="0x24D00B"
# #00DF82 en decimal: el accent de TACTIUM.
ACCENT="r=0:g=223:b=130"

mkdir -p "$DESTINO"
i=0
for F in "$ORIGEN"/*.mp4; do
  i=$((i + 1))
  SALIDA=$(printf "%s/arrow-%02d.mov" "$DESTINO" "$i")
  echo "→ $(basename "$F")  →  $SALIDA"
  ffmpeg -v error -i "$F" \
    -vf "format=rgba,colorkey=${CROMA}:0.34:0.12,lutrgb=${ACCENT}" \
    -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -an \
    "$SALIDA" -y
done
echo "Listas $i flechas en $DESTINO"
