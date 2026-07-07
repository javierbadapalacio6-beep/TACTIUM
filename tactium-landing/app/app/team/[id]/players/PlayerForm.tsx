"use client";

import { useRef } from "react";

// Sub-componente compartido por las pantallas de añadir/editar jugador.
// Adaptación web de la cámara nativa: <input type="file" accept="image/*">.
// Muestra avatar circular con preview/foto actual o iniciales.

const initials = (s: string) =>
  s
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

export function PhotoPicker({
  name,
  preview,
  current,
  disabled,
  onPick,
  onRemove,
}: {
  name: string;
  preview: string | null;
  current?: string | null;
  disabled?: boolean;
  onPick: (file: File, previewUrl: string) => void;
  onRemove?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shown = preview ?? current ?? null;

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <div className="w-20 h-20 rounded-full overflow-hidden border border-[var(--color-hair-strong)] bg-[var(--color-bg-raised)] grid place-items-center">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shown} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-mono text-[18px] text-[var(--color-text-muted)]">
              {initials(name)}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            onPick(file, URL.createObjectURL(file));
            e.target.value = "";
          }}
        />
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="h-9 px-4 rounded-full border border-[var(--color-hair-strong)] text-[13px] font-medium text-[var(--color-text-muted)] transition hover:text-[var(--color-text)] hover:border-[var(--color-accent-40)] disabled:opacity-40"
        >
          {shown ? "Cambiar foto" : "Subir foto"}
        </button>
        {shown && onRemove && (
          <button
            type="button"
            disabled={disabled}
            onClick={onRemove}
            className="text-[12px] text-[var(--color-text-faint)] hover:text-[var(--color-error)] transition text-left"
          >
            Quitar foto
          </button>
        )}
      </div>
    </div>
  );
}
