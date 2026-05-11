import React from 'react';
import Svg, { Path, Circle, Line, Rect } from 'react-native-svg';

import { Colors } from '@core/theme/colors';

interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const make =
  (defaultSize: number, paths: (p: Required<IconProps>) => React.ReactNode) =>
  ({ size = defaultSize, color = Colors.text, strokeWidth = 1.6 }: IconProps) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {paths({ size, color, strokeWidth })}
    </Svg>
  );

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

export const IconEyeOff = make(18, ({ color, strokeWidth }) => (
  <>
    <Path
      d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"
      stroke={color}
      strokeWidth={strokeWidth}
    />
    <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={strokeWidth} />
    <Line x1="3" y1="3" x2="21" y2="21" stroke={Colors.accent} strokeWidth={strokeWidth + 0.2} />
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

export const IconApple = ({ size = 18, color = '#000' }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 18 18">
    <Path
      d="M14.5 9.5c0-2.4 2-3.5 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9s-2-.9-3.2-.9c-1.7 0-3.2 1-4.1 2.5-1.7 3-.4 7.5 1.3 9.9.8 1.2 1.8 2.5 3.1 2.5s1.7-.8 3.2-.8 1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.7-1-2.7-4.2zM12.1 2.6c.7-.8 1.1-2 1-3.1-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.4z"
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
