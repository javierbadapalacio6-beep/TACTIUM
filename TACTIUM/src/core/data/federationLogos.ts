import type { ImageSourcePropType } from 'react-native';

// Logos/avatares de las federaciones (los que tenemos). De momento solo la
// Cántabra (única integrada). El resto usan un placeholder con sus siglas.
const LOGOS: Record<string, ImageSourcePropType> = {
  FCantP: require('../../../assets/federations/fcantp.png'),
};

export const federationLogo = (
  code: string | null | undefined,
): ImageSourcePropType | null => (code ? LOGOS[code] ?? null : null);
