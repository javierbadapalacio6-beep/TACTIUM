import qrcode from "qrcode-generator";

/**
 * QR como SVG, generado en el servidor (no añade JavaScript al cliente).
 *
 * Siempre negro sobre blanco y con zona de silencio de 4 módulos, también en
 * tema oscuro: un QR invertido o con poco margen lo leen peor las cámaras.
 */
export function QrCode({
  value,
  label,
  size = 184,
}: {
  value: string;
  /** Texto alternativo: a dónde lleva. */
  label: string;
  size?: number;
}) {
  const qr = qrcode(0, "M");
  qr.addData(value);
  qr.make();
  const n = qr.getModuleCount();
  const quiet = 4;
  const total = n + quiet * 2;

  let d = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      style={{
        display: "block",
        maxWidth: "100%",
        height: "auto",
        borderRadius: 10,
        // En tema claro la baldosa blanca se funde con la tarjeta: se le da borde.
        boxShadow: "0 0 0 1px var(--line)",
      }}
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
