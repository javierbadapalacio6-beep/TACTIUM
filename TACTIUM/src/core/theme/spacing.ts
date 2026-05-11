export const Spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 22,
  xl: 32,
  xxl: 44,
} as const;

export const Radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  full: 9999,
} as const;

export type SpacingKey = keyof typeof Spacing;
export type RadiusKey = keyof typeof Radius;
