import type { TextStyle } from 'react-native';

import { Colors, type Palette } from './colors';
import { Fonts } from './fonts';

const sans = Fonts.sans;
const mono = Fonts.mono;

// TACTIUM type scale — three clear hierarchy levels per screen
//   display / h1 / h2 — dominant focal element
//   title / headline — section headers
//   body / bodyMuted — paragraph & list rows
//   caption / meta / eyebrow — labels & captions
//
// El color va ligado a la paleta activa: `Typography` (abajo) es la variante
// OSCURA estática (retrocompat de primitivas aún sin migrar). Las pantallas
// migradas usan `useTypography()` para obtener la variante del tema actual.
const build = (c: Palette) =>
  ({
    display: {
      fontFamily: sans,
      fontSize: 38,
      fontWeight: '600',
      letterSpacing: -1.2,
      lineHeight: 38,
      color: c.text,
    } satisfies TextStyle,
    h1: {
      fontFamily: sans,
      fontSize: 30,
      fontWeight: '600',
      letterSpacing: -0.7,
      lineHeight: 32,
      color: c.text,
    } satisfies TextStyle,
    h2: {
      fontFamily: sans,
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: -0.4,
      lineHeight: 26,
      color: c.text,
    } satisfies TextStyle,
    title: {
      fontFamily: sans,
      fontSize: 17,
      fontWeight: '600',
      letterSpacing: -0.2,
      lineHeight: 22,
      color: c.text,
    } satisfies TextStyle,
    headline: {
      fontFamily: sans,
      fontSize: 15,
      fontWeight: '600',
      letterSpacing: -0.2,
      lineHeight: 20,
      color: c.text,
    } satisfies TextStyle,
    body: {
      fontFamily: sans,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
      color: c.text,
    } satisfies TextStyle,
    bodyMuted: {
      fontFamily: sans,
      fontSize: 14,
      fontWeight: '400',
      lineHeight: 20,
      color: c.textMuted,
    } satisfies TextStyle,
    caption: {
      fontFamily: sans,
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 17,
      color: c.textMuted,
    } satisfies TextStyle,
    eyebrow: {
      fontFamily: mono,
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 2.4,
      color: c.accent,
    } satisfies TextStyle,
    eyebrowFaint: {
      fontFamily: mono,
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 2.4,
      color: c.textFaint,
    } satisfies TextStyle,
    meta: {
      fontFamily: mono,
      fontSize: 11,
      fontWeight: '500',
      letterSpacing: 1.2,
      color: c.textFaint,
    } satisfies TextStyle,
    mono: {
      fontFamily: mono,
      fontSize: 13,
      fontWeight: '500',
      letterSpacing: 0.4,
      color: c.text,
    } satisfies TextStyle,

    // ── Legacy aliases used by the existing UI primitives ─────────────
    largeTitle: {
      fontFamily: sans,
      fontSize: 32,
      fontWeight: '700',
      letterSpacing: -0.8,
      lineHeight: 36,
      color: c.text,
    } satisfies TextStyle,
    title1: {
      fontFamily: sans,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.6,
      lineHeight: 32,
      color: c.text,
    } satisfies TextStyle,
    title2: {
      fontFamily: sans,
      fontSize: 22,
      fontWeight: '600',
      letterSpacing: -0.4,
      lineHeight: 26,
      color: c.text,
    } satisfies TextStyle,
    title3: {
      fontFamily: sans,
      fontSize: 20,
      fontWeight: '600',
      letterSpacing: -0.3,
      lineHeight: 24,
      color: c.text,
    } satisfies TextStyle,
    callout: {
      fontFamily: sans,
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 21,
      color: c.text,
    } satisfies TextStyle,
    subheadline: {
      fontFamily: sans,
      fontSize: 15,
      fontWeight: '400',
      lineHeight: 20,
      color: c.text,
    } satisfies TextStyle,
    footnote: {
      fontFamily: sans,
      fontSize: 13,
      fontWeight: '400',
      lineHeight: 18,
      color: c.textMuted,
    } satisfies TextStyle,
    caption1: {
      fontFamily: sans,
      fontSize: 12,
      fontWeight: '400',
      lineHeight: 16,
      color: c.textMuted,
    } satisfies TextStyle,
    caption2: {
      fontFamily: sans,
      fontSize: 11,
      fontWeight: '400',
      lineHeight: 14,
      color: c.textFaint,
    } satisfies TextStyle,
  }) as const;

/** Variante OSCURA estática (retrocompat). */
export const Typography = build(Colors);

/** Escala tipográfica para una paleta concreta (la usa `useTypography()`). */
export const makeTypography = build;

export type TypographyKey = keyof typeof Typography;
