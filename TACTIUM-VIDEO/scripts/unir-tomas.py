# python scripts/unir-tomas.py public/plano/<plano>.mp4 bruto/cara/<toma1> <toma2> ...
# Une tomas por partes en un plano: recorta cada una de la primera a la última palabra
# (con un pequeño margen) y las pega. Uso: python unir.py salida.mp4 toma1 toma2 ...
import subprocess, sys
from faster_whisper import WhisperModel
m = WhisperModel("small", device="cpu", compute_type="int8")
sal, tomas = sys.argv[1], sys.argv[2:]
tramos = []
for f in tomas:
    segs, _ = m.transcribe(f, language="es", word_timestamps=True, vad_filter=True)
    ws = [w for s in segs for w in (s.words or [])]
    a, b = max(0, ws[0].start - 0.12), ws[-1].end + 0.22
    tramos.append((f, a, b))
    print(f"{f}: {a:.2f}-{b:.2f}")
partes = []
for i, (f, a, b) in enumerate(tramos):
    p = f"{sal}.parte{i}.mp4"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{a:.3f}", "-to", f"{b:.3f}", "-i", f,
        "-vf", "scale=1080:1920:force_original_aspect_ratio=increase:flags=lanczos,crop=1080:1920,fps=30,format=yuv420p",
        # Cada toma se graba a su volumen: se igualan todas a -18 LUFS para que no haya saltos.
        "-af", "loudnorm=I=-18:TP=-1.5:LRA=11,aresample=48000", "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", p], check=True)
    partes.append(p)
with open(f"{sal}.lista.txt", "w") as fh:
    for p in partes: fh.write(f"file '{p.split('/')[-1]}'\n")
subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", f"{sal}.lista.txt", "-c", "copy", sal], check=True)
import os
for p in partes: os.remove(p)
os.remove(f"{sal}.lista.txt")
print("ok", sal)
