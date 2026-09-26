"use client";

import { useRef, useState } from "react";

import { Btn } from "./ui";
import { Crest } from "./Crest";
import { IconTrash, IconUpload } from "./Icon";
import { deleteLogo, uploadLogo } from "@/lib/queries";
import { guardedWrite } from "@/lib/writes";

/**
 * Campo «Escudo» de los modales de editar equipo y editar club. La subida es
 * inmediata (como el avatar del perfil): al elegir el fichero ya queda
 * guardado, no hace falta pulsar «Guardar».
 */
export function LogoField({
  kind,
  id,
  value,
  onChange,
  onError,
}: {
  kind: "team" | "club";
  id: string;
  value: string | null;
  onChange: (url: string | null) => void;
  onError: (msg: string) => void;
}) {
  const input = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  async function pick(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    const res = await guardedWrite("subir el escudo", () => uploadLogo(kind, id, file));
    setBusy(false);
    if (res.ok) onChange(res.data);
    else onError(res.reason);
    if (input.current) input.current.value = "";
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    const res = await guardedWrite("quitar el escudo", () => deleteLogo(kind, id));
    setBusy(false);
    if (res.ok) onChange(null);
    else onError(res.reason);
  }

  return (
    <div className="tw-logo-field">
      <Crest src={value} kind={kind} size={64} />
      <div style={{ flex: 1, minWidth: 180 }}>
        <div className="tw-logo-field-actions">
          <Btn
            size="sm"
            icon={<IconUpload size={14} />}
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            {busy ? "Subiendo…" : value ? "Cambiar escudo" : "Subir escudo"}
          </Btn>
          {value && (
            <Btn size="sm" variant="quiet" icon={<IconTrash size={14} />} disabled={busy} onClick={remove}>
              Quitar
            </Btn>
          )}
        </div>
        <span className="field-hint" style={{ display: "block", marginTop: 6 }}>
          PNG, JPG, WebP o SVG, cuadrado y de menos de 3 MB. Se ve en el inicio,
          la plantilla y el selector de arriba.
        </span>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          hidden
          onChange={(e) => void pick(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
