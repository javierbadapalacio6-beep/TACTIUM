import { Platform } from 'react-native';

// TACTIUM uses Satoshi for sans + JetBrains Mono for mono labels.
// Custom fonts aren't loaded in the bundle yet, so we fall back to native
// system fonts that match the look closely.
export const Fonts = {
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    default: 'System',
  }) as string,
  sansMedium: Platform.select({
    ios: 'System',
    android: 'sans-serif-medium',
    default: 'System',
  }) as string,
  mono: Platform.select({
    ios: 'Menlo',
    android: 'monospace',
    default: 'Menlo',
  }) as string,
};
