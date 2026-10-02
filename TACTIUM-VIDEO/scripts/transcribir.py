"""Transcribe lo que dices en un plano, palabra a palabra y con sus tiempos (Whisper en local,
faster-whisper), para los subtítulos sincronizados. Guarda src/reel/palabras/<id>.json.

    python scripts/transcribir.py V1-vuelta public/plano/V1-vuelta.mp4

El <id> es el nombre del plano sin extensión: así lo encuentra el montaje (Karaoke.tsx).

La primera vez descarga el modelo (unos 480 MB). Todo corre en el ordenador: no se envía nada fuera.
"""
import json
import os
import re
import sys

from faster_whisper import WhisperModel

# Palabras que Whisper suele escribir mal y cómo se escriben aquí.
CORRECCIONES = {
    r"\btact?ium\b": "TACTIUM",
    r"\bpadel\b": "pádel",
    r"\bcantabra\b": "Cántabra",
    r"\bfederación cántabra\b": "Federación Cántabra",
    r"\bpdf\b": "PDF",
    r"\bwhatsapp\b": "WhatsApp",
    r"\b(20\d\d)[-–](20\d\d)\b": r"\1/\2",
}


def corregir(t: str) -> str:
    for patron, bien in CORRECCIONES.items():
        t = re.sub(patron, bien, t, flags=re.IGNORECASE)
    return t


def registrar(carpeta: str):
    """Reescribe palabras/index.ts con todas las transcripciones: Remotion solo ve lo importado."""
    ids = sorted(f[:-5] for f in os.listdir(carpeta) if f.endswith(".json"))
    lineas = ["// Generado por scripts/transcribir.py: no se edita a mano.",
              "// La clave es el nombre del plano sin extensión (public/plano/<clave>.mp4).",
              'import type { Transcripcion } from "../Karaoke";']
    lineas += [f'import t{i} from "./{x}.json";' for i, x in enumerate(ids)]
    lineas.append("export const PALABRAS: Record<string, Transcripcion> = {")
    lineas += [f'  "{x}": t{i},' for i, x in enumerate(ids)]
    lineas.append("};")
    with open(os.path.join(carpeta, "index.ts"), "w", encoding="utf-8") as f:
        f.write("\n".join(lineas) + "\n")


def main():
    if len(sys.argv) < 3:
        sys.exit("Uso: python scripts/transcribir.py <id> <plano.mp4> [modelo]")
    ident, plano = sys.argv[1], sys.argv[2]
    modelo = sys.argv[3] if len(sys.argv) > 3 else "small"
    m = WhisperModel(modelo, device="cpu", compute_type="int8")
    segmentos, _ = m.transcribe(
        plano, language="es", word_timestamps=True, vad_filter=True, beam_size=5,
        initial_prompt="TACTIUM, pádel, Federación Cántabra, alineación, temporada 2026/2027, capitán, torneo, consolación.",
    )
    palabras, texto = [], []
    for s in segmentos:
        texto.append(s.text.strip())
        for w in s.words or []:
            t = corregir(w.word.strip())
            if not t:
                continue
            # «2026» + «-2027» llegan partidas: van juntas y con barra, como se escribe aquí.
            if palabras and re.match(r"^[-–]\d", t) and re.search(r"\d$", palabras[-1]["t"]):
                palabras[-1]["t"] += "/" + t[1:]
                palabras[-1]["b"] = round(w.end * 1000)
                continue
            palabras.append({"t": t, "a": round(w.start * 1000), "b": round(w.end * 1000)})
    sal = os.path.join("src", "reel", "palabras", f"{ident}.json")
    os.makedirs(os.path.dirname(sal), exist_ok=True)
    with open(sal, "w", encoding="utf-8") as f:
        json.dump({"texto": corregir(" ".join(texto)), "palabras": palabras}, f, ensure_ascii=False, indent=1)
    registrar(os.path.dirname(sal))
    print(f"{len(palabras)} palabras -> {sal}")
    print(corregir(" ".join(texto)))


if __name__ == "__main__":
    main()
