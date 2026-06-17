/**
 * Nombre a mostrar de un jugador. Centraliza el formateo que antes estaba
 * inline en LineupScreen.
 *
 * Prioriza el ALIAS (apodo) si existe. El alias resuelve el problema de los
 * nombres importados del ranking FEP, que vienen apellido-primero: partir el
 * texto en "nombre + inicial" no es fiable porque no sabemos qué token es el
 * nombre. Con alias el capitán fija exactamente cómo quiere ver al jugador.
 */

interface NameLike {
  alias?: string | null;
  name: string;
}

interface PhotoLike {
  photo_url?: string | null;
  profile_avatar_url?: string | null;
}

/**
 * Foto a mostrar de un jugador. Precedencia: la que subió el capitán
 * (`photo_url`, override explícito) y, si no hay, la del perfil del propio
 * jugador (`profile_avatar_url`). null = sin foto → iniciales.
 */
export function photoOf(p: PhotoLike): string | null {
  return p.photo_url ?? p.profile_avatar_url ?? null;
}

/** Nombre completo a mostrar: alias si lo hay, si no el nombre tal cual. */
export function displayName(p: NameLike): string {
  const alias = p.alias?.trim();
  return alias && alias.length > 0 ? alias : p.name;
}

/**
 * Versión corta para chips/slots: alias si lo hay; si no, primer token +
 * inicial del segundo ("Javier B."). Pensada para espacios estrechos.
 */
export function shortName(p: NameLike): string {
  const alias = p.alias?.trim();
  if (alias && alias.length > 0) return alias;
  const parts = p.name.trim().split(/\s+/);
  const first = parts[0] ?? p.name;
  const secondInitial = parts[1]?.[0];
  return secondInitial ? `${first} ${secondInitial}.` : first;
}

/** Iniciales para el avatar (del alias o del nombre). */
export function initialsOf(p: NameLike): string {
  const base = (p.alias?.trim() || p.name).trim();
  const parts = base.split(/\s+/);
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return base.slice(0, 2).toUpperCase();
}
