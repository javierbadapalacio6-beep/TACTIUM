import { LogoMark } from "./LogoMark";

/**
 * Logotipo TACTIUM: tesela con el isotipo + wordmark.
 *
 * La tesela lleva el ISOTIPO de verdad (`LogoMark`), no una "T" tipográfica:
 * la marca tiene sus cortes horizontales y una letra de la fuente no es el
 * logo. Relleno `--primary` en los dos temas, así que no necesita variante
 * clara (BRAND_SYSTEM · Logo Behavior).
 *
 * El punto de la "I" es un cuadrado en accent — el único accent permitido
 * dentro del wordmark (BRAND_SYSTEM · Wordmark Rules).
 *
 * Vive en su propio archivo porque lo usan los dos marcos (el de la app y el
 * público) y si colgara de uno de ellos se importarían en círculo.
 */
export function Wordmark({ size = 16 }: { size?: number }) {
  const tile = Math.round(size * 1.6);
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: tile,
          height: tile,
          borderRadius: 8,
          background: "var(--primary)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <LogoMark size={Math.round(tile * 0.72)} color="var(--accent)" />
      </span>
      <span
        style={{
          fontWeight: 900,
          letterSpacing: "-0.02em",
          fontSize: size,
          display: "flex",
          alignItems: "baseline",
        }}
      >
        TACT
        <span style={{ position: "relative", display: "inline-block" }}>
          I
          <span
            style={{
              position: "absolute",
              left: "50%",
              transform: "translateX(-50%)",
              top: -5,
              width: 3,
              height: 3,
              background: "var(--accent)",
            }}
          />
        </span>
        UM
      </span>
    </span>
  );
}
