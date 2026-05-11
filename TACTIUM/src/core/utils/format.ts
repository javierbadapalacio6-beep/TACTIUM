/**
 * Capitalizes the first letter of a string
 */
export const capitalize = (str: string): string =>
  str.charAt(0).toUpperCase() + str.slice(1);

/**
 * Truncates a string to a max length with ellipsis
 */
export const truncate = (str: string, maxLength: number): string =>
  str.length > maxLength ? `${str.substring(0, maxLength)}...` : str;

/**
 * Formats a date to a readable string
 */
export const formatDate = (date: Date): string =>
  date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

/**
 * "Domingo 03 may"
 */
export const formatLongDay = (date: Date): string => {
  const weekday = capitalize(
    date.toLocaleDateString('es-ES', { weekday: 'long' }),
  );
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  return `${weekday} ${day} ${month}`;
};

/**
 * "Dom 03 may"
 */
export const formatShortDay = (date: Date): string => {
  const weekday = capitalize(
    date.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', ''),
  );
  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
  return `${weekday} ${day} ${month}`;
};

/**
 * Iniciales de un nombre: "Club Visitante" → "CV"
 */
export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '–';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};
