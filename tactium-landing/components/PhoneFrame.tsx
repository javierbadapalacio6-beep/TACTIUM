import Image from "next/image";
import type { CSSProperties } from "react";

// Marco iPhone reutilizable: bisel + Dynamic Island + reflejo superior + halo
// glow accent detrás. Acepta una imagen de screenshot via `src`/`alt`.
//
// Tamaños:
//   - "hero"  → 260px / 300px (mobile / sm+), aspect 9/19.5
//   - "card"  → 180px / 220px, mismo aspecto
//   - "tile"  → 140px, miniatura para bento
//
// Variantes de `glow`: "ambient" (halo grande verde), "subtle" (sombra plana),
// "none" (sin halo, para cuando va dentro de una card con su propio bg).
type Size = "hero" | "card" | "tile";
type Glow = "ambient" | "subtle" | "none";

const sizeMap: Record<Size, string> = {
  hero: "w-[260px] sm:w-[300px]",
  card: "w-[180px] sm:w-[220px]",
  tile: "w-[140px]",
};

export function PhoneFrame({
  src,
  alt,
  size = "hero",
  glow = "ambient",
  priority = false,
  float = false,
  className = "",
  style,
}: {
  src: string;
  alt: string;
  size?: Size;
  glow?: Glow;
  priority?: boolean;
  float?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const widths: Record<Size, number> = { hero: 300, card: 220, tile: 140 };
  const sizesAttr =
    size === "hero"
      ? "(min-width: 640px) 300px, 260px"
      : size === "card"
        ? "(min-width: 640px) 220px, 180px"
        : "140px";

  return (
    <div
      className={`relative flex items-center justify-center perspective-[1200px] ${className}`}
      style={style}
    >
      {glow === "ambient" && (
        <div
          className="absolute w-[80%] h-[110%] rounded-full bg-[var(--color-accent)] opacity-20 blur-3xl"
          aria-hidden="true"
        />
      )}
      <div
        className={`relative ${sizeMap[size]} aspect-[9/19.5] rounded-[42px] bg-gradient-to-br from-[var(--color-bg-card)] to-[var(--color-bg)] border border-[var(--color-hair-strong)] overflow-hidden ${
          glow === "ambient"
            ? "shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
            : glow === "subtle"
              ? "shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(255,255,255,0.04)]"
              : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
        } ${float ? "animate-hero-float" : ""}`}
      >
        {/* Bisel interno + recorte de imagen al radio del frame interior. */}
        <div className="absolute inset-[3px] rounded-[40px] bg-black overflow-hidden">
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizesAttr}
            priority={priority}
            quality={85}
            className="object-cover object-top"
          />
          {/* Dynamic Island sobre la imagen, no se ve cortado el status bar. */}
          <div
            className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full border border-white/5"
            aria-hidden="true"
          />
        </div>
        {/* Reflejo de borde superior */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
          aria-hidden="true"
        />
      </div>
    </div>
  );
}

// Versión sólo del frame, sin imagen — para placeholders o casos custom.
// No se exporta hasta que haga falta, lo dejo aquí comentado como referencia.
//
// export function PhoneFrameShell({ children, size = 'hero', glow = 'ambient', float = false }) { ... }
