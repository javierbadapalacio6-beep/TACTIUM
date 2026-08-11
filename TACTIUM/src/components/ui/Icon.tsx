import React from 'react';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

import { useColors, type Palette } from '@core/theme';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const make =
  (
    defaultSize: number,
    paths: (p: Required<IconProps>, c: Palette) => React.ReactNode,
  ) =>
  ({ size = defaultSize, color, strokeWidth = 1.6 }: IconProps) => {
    const c = useColors();
    const resolvedColor = color ?? c.text;
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        {paths({ size, color: resolvedColor, strokeWidth }, c)}
      </Svg>
    );
  };

export const IconBack = make(20, ({ color, strokeWidth }) => (
  <Path
    d="M15 6l-6 6 6 6"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
));

export const IconChevron = make(14, ({ color, strokeWidth }) => (
  <Path
    d="M9 6l6 6-6 6"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
));

export const IconBell = make(22, ({ color, strokeWidth }) => (
  <Path
    d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
));

export const IconArrowRight = make(18, ({ color, strokeWidth }) => (
  <Path
    d="M5 12h14M13 6l6 6-6 6"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
));

export const IconPlus = make(16, ({ color, strokeWidth }) => (
  <Path
    d="M12 5v14M5 12h14"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
  />
));

export const IconCheck = make(16, ({ color, strokeWidth }) => (
  <Path
    d="M5 12l4 4 10-10"
    stroke={color}
    strokeWidth={strokeWidth + 0.4}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
));

export const IconX = make(14, ({ color, strokeWidth }) => (
  <Path
    d="M6 6l12 12M18 6l-12 12"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
  />
));

export const IconCalendar = make(20, ({ color, strokeWidth }) => (
  <>
    <Rect
      x="3"
      y="5"
      width="18"
      height="16"
      rx="2"
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth={strokeWidth} />
    <Line x1="8" y1="3" x2="8" y2="7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Line x1="16" y1="3" x2="16" y2="7" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
  </>
));

export const IconTeam = make(20, ({ color, strokeWidth }) => (
  <>
    <Circle cx="9" cy="9" r="3.4" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M3 19c.4-3 3-5 6-5s5.6 2 6 5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Circle cx="17" cy="8" r="2.6" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M16.5 13.5c2 .3 3.6 1.7 4 3.5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </>
));

export const IconAnalytics = make(20, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M4 19V9M10 19V5M16 19v-6M22 19H2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </>
));

export const IconCourt = make(20, ({ color, strokeWidth }) => (
  <>
    <Rect x="3" y="5" width="18" height="14" rx="1.5" stroke={color} strokeWidth={strokeWidth} />
    <Line x1="12" y1="5" x2="12" y2="19" stroke={color} strokeWidth={strokeWidth} />
    <Line x1="3" y1="12" x2="21" y2="12" stroke={color} strokeWidth={strokeWidth} strokeOpacity={0.6} />
  </>
));

export const IconHome = make(22, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M3 11l9-7 9 7v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2v-9z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  </>
));

export const IconPlane = make(20, ({ color, strokeWidth }) => (
  <Path
    d="M17.8 19.2 16 11l3.5-3.5a2.1 2.1 0 0 0-3-3L13 8 4.8 6.2a.5.5 0 0 0-.5.8L8 11l-2 2-2.5-.5a.5.5 0 0 0-.5.8L5 15l1.7 1.7 1.7 1.7 1.7-1.5a.5.5 0 0 0 .8-.5L11 16l2-2 3.2 3.7a.5.5 0 0 0 .8-.5z"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinejoin="round"
    strokeLinecap="round"
  />
));

export const IconUser = make(22, ({ color, strokeWidth }) => (
  <>
    <Circle cx="12" cy="9" r="3.6" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M5 21c1-4 4-6 7-6s6 2 7 6"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </>
));

export const IconEye = make(18, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
  </>
));

export const IconEyeOff = make(18, ({ color, strokeWidth }, c) => (
  <>
    <Path
      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
    <Line x1="3" y1="3" x2="21" y2="21" stroke={c.accent} strokeWidth={strokeWidth + 0.2} />
  </>
));

export const IconSearch = make(16, ({ color, strokeWidth }) => (
  <>
    <Circle cx="10" cy="10" r="6" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M15 15l5 5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </>
));

/** Menú de tres líneas (hamburguesa) — abre Ajustes desde el perfil. */
export const IconMenu = make(22, ({ color, strokeWidth }) => (
  <Path
    d="M4 7h16M4 12h16M4 17h16"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
  />
));

// ── Iconos F8 (jugador/amistosos) — mismo lenguaje de trazo ─────────

/** Pala de pádel con bola: el icono del amistoso. */
export const IconRacket = make(20, ({ color, strokeWidth }) => (
  <>
    <Circle
      cx="10"
      cy="8.5"
      r="5.5"
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Path
      d="M13.9 12.6L18.5 18"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Circle cx="8" cy="7" r="0.9" fill={color} />
    <Circle cx="12" cy="7" r="0.9" fill={color} />
    <Circle cx="10" cy="10" r="0.9" fill={color} />
    <Circle cx="19" cy="6" r="2.4" stroke={color} strokeWidth={strokeWidth} />
  </>
));

/** Pelota de tenis/pádel: icono del amistoso (partido entre amigos). */
export const IconBall = make(20, ({ color, strokeWidth }) => (
  <>
    <Circle cx="12" cy="12" r="8.5" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M5.3 5.3C8.6 8 8.6 16 5.3 18.7"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M18.7 5.3C15.4 8 15.4 16 18.7 18.7"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      fill="none"
    />
  </>
));

/** Ticket/código de partido. */
export const IconTicket = make(18, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M4 8a2 2 0 002-2h12a2 2 0 002 2v2.5a1.5 1.5 0 000 3V16a2 2 0 00-2 2H6a2 2 0 00-2-2v-2.5a1.5 1.5 0 000-3V8z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
    <Line
      x1="14.5"
      y1="7"
      x2="14.5"
      y2="17"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeDasharray="2 2.4"
    />
  </>
));

/** Regalo/invitación con premio. */
export const IconGift = make(18, ({ color, strokeWidth }) => (
  <>
    <Rect
      x="4"
      y="9"
      width="16"
      height="4"
      rx="1"
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Path
      d="M6 13v6a1 1 0 001 1h10a1 1 0 001-1v-6M12 9v11"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Path
      d="M12 9C10.5 9 8 8.6 8 6.8 8 5.5 9 5 10 5c1.6 0 2 2.2 2 4zm0 0c1.5 0 4-.4 4-2.2C16 5.5 15 5 14 5c-1.6 0-2 2.2-2 4z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </>
));

/** Trofeo (torneos). */
export const IconTrophy = make(20, ({ color, strokeWidth }) => (
  <Path
    d="M7 4h10v4a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 13v3M9 20h6M10 20v-1.5a2 2 0 0 1 4 0V20"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
));

/** Eslabón: jugador vinculado a su cuenta. */
export const IconLink = make(14, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.2 1.2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
    <Path
      d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.2-1.2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </>
));

export const IconApple = ({ size = 18, color = '#000' }: IconProps) => (
  // viewBox 0 0 24 24 con el logo bien centrado y la hoja sin cortar.
  // El logo anterior tenía coordenadas negativas (la hoja) que el viewBox
  // 0 0 18 18 recortaba arriba.
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path
      d="M17.05 12.04c-.02-2.13 1.74-3.16 1.82-3.21-.99-1.45-2.54-1.65-3.09-1.67-1.32-.13-2.57.78-3.24.78-.67 0-1.7-.76-2.79-.74-1.44.02-2.77.84-3.51 2.13-1.49 2.59-.38 6.43 1.07 8.53.71 1.03 1.55 2.18 2.66 2.14 1.07-.04 1.47-.69 2.76-.69 1.29 0 1.65.69 2.78.67 1.15-.02 1.88-1.04 2.59-2.07.81-1.19 1.15-2.34 1.17-2.4-.03-.01-2.24-.86-2.22-3.47zM14.92 5.59c.59-.71 1-1.7.89-2.69-.86.04-1.91.57-2.52 1.28-.55.63-1.04 1.65-.91 2.62.96.07 1.94-.49 2.54-1.21z"
      fill={color}
    />
  </Svg>
);

export const IconGoogle = ({ size = 18 }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    <Path
      d="M16.5 9.2c0-.6-.1-1.1-.2-1.7H9v3.2h4.2c-.2 1-.7 1.8-1.5 2.4v2h2.5c1.5-1.4 2.3-3.4 2.3-5.9z"
      fill="#4285F4"
    />
    <Path
      d="M9 17c2.1 0 3.8-.7 5.1-1.9l-2.5-2c-.7.5-1.5.7-2.6.7-2 0-3.7-1.4-4.3-3.2H2.1v2.1C3.4 15.4 6 17 9 17z"
      fill="#34A853"
    />
    <Path
      d="M4.7 10.6c-.2-.5-.3-1-.3-1.6s.1-1.1.3-1.6V5.3H2.1C1.4 6.4 1 7.7 1 9s.4 2.6 1.1 3.7l2.6-2.1z"
      fill="#FBBC05"
    />
    <Path
      d="M9 4.2c1.1 0 2.1.4 2.9 1.1l2.2-2.2C12.8 1.9 11.1 1 9 1 6 1 3.4 2.6 2.1 5.3l2.6 2.1C5.3 5.6 7 4.2 9 4.2z"
      fill="#EA4335"
    />
  </Svg>
);

export const IconMail = make(18, ({ color, strokeWidth }) => (
  <>
    <Rect x="3" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M3 7l9 6 9-6"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
    />
  </>
));

export const IconBolt = make(14, ({ color, strokeWidth }) => (
  <Path
    d="M13 2 L4 14 h6 l-1 8 l9 -12 h-6 l1 -8 z"
    stroke={color}
    strokeWidth={strokeWidth}
    fill={color}
    strokeLinejoin="round"
  />
));

export const IconAlert = make(16, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M12 3 L22 20 H2 Z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      fill="none"
    />
    <Line x1="12" y1="9" x2="12" y2="14" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
    <Circle cx="12" cy="17" r="0.6" fill={color} stroke={color} strokeWidth={strokeWidth} />
  </>
));

export const IconPencil = make(14, ({ color, strokeWidth }) => (
  <Path
    d="M4 20h4l10-10-4-4L4 16v4z M14 6l4 4"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
));

export const IconShare = make(16, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M12 3v13M7 8l5-5 5 5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
));

export const IconPin = make(14, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Circle cx="12" cy="9" r="2.5" stroke={color} strokeWidth={strokeWidth} />
  </>
));

export const IconClock = make(16, ({ color, strokeWidth }) => (
  <>
    <Circle cx="12" cy="12" r="9" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M12 7v5l3 2"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </>
));

export const IconTrash = make(14, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>
));

export const IconCamera = make(18, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M3 8.5h3l1.5-2h9l1.5 2h3v10.5H3v-10.5z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinejoin="round"
      fill="none"
    />
    <Circle cx="12" cy="13" r="3.4" stroke={color} strokeWidth={strokeWidth} />
  </>
));

export const IconImage = make(18, ({ color, strokeWidth }) => (
  <>
    <Rect
      x="3.5"
      y="4.5"
      width="17"
      height="15"
      rx="2.5"
      stroke={color}
      strokeWidth={strokeWidth}
      fill="none"
    />
    <Circle cx="8.5" cy="9.5" r="1.6" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M5 17l4.5-4.5 4 4 3-2.5L20 18"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </>
));

export const IconFile = make(18, ({ color, strokeWidth }) => (
  <>
    {/* Hoja con esquina doblada — usado para indicar archivos genéricos
        (PDF / Word / Excel / TXT) en el ScanSheet. */}
    <Path
      d="M7 3h7l4 4v12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M14 3v4h4"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <Path
      d="M9 13h6M9 17h4"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </>
));

/** Entrar — el clásico: flecha que entra por la puerta. */
export const IconLogIn = make(20, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M14 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M10 16l4-4-4-4"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <Path
      d="M14 12H4"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </>
));

/** Sol — tema claro. */
export const IconSun = make(20, ({ color, strokeWidth }) => (
  <>
    <Circle cx="12" cy="12" r="4.2" stroke={color} strokeWidth={strokeWidth} />
    <Path
      d="M12 2.6v2M12 19.4v2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M2.6 12h2M19.4 12h2M5.1 18.9l1.4-1.4M17.5 6.5l1.4-1.4"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
    />
  </>
));

/** Luna — tema oscuro. */
export const IconMoon = make(20, ({ color, strokeWidth }) => (
  <Path
    d="M20 13.4A8.2 8.2 0 1 1 10.6 4a6.6 6.6 0 0 0 9.4 9.4z"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
));

/** Estrella — favoritos. Rellena cuando está marcado. */
export const IconStar = make(20, ({ color, strokeWidth }, c) => (
  <Path
    d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    fill="none"
  />
));

/** Estrella rellena — favorito activo. */
export const IconStarFilled = make(20, ({ color }) => (
  <Path
    d="M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.75L12 16.9l-5.2 2.7 1-5.75-4.2-4.1 5.8-.85z"
    fill={color}
  />
));
