import type { CSSProperties } from "react";

import { IconBuilding, IconShield } from "./Icon";

/**
 * Escudo de un equipo o de un club: la imagen si la han subido, y si no la
 * tesela de marca con el icono. Mismo hueco en los dos casos, así el logo
 * puede llegar después sin mover nada.
 */
export function Crest({
  src,
  kind = "team",
  size = 44,
  style,
}: {
  src?: string | null;
  kind?: "team" | "club";
  size?: number;
  style?: CSSProperties;
}) {
  const Icon = kind === "club" ? IconBuilding : IconShield;
  return (
    <span
      className={"crest" + (src ? " has-img" : "")}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.28), ...style }}
      aria-hidden="true"
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" />
      ) : (
        <Icon size={Math.round(size * 0.42)} />
      )}
    </span>
  );
}
