import type { FcpPlayerMatch } from '@core/services/fcpSearch';

// Datos de un jugador en el formulario de inscripción. `fcp` es la ficha de la
// Federación aplicada (confirmada) y `fcpDismissed` las que el jugador ha dicho
// que no son él, para no volver a aplicarlas solas.
export interface PlayerDraft {
  name: string;
  email: string;
  phone: string;
  pts: string;
  lvl: string;
  noFed: boolean;
  fcp: FcpPlayerMatch | null;
  fcpDismissed: string[];
}

export type PlayerField = 'name' | 'pts' | 'lvl' | 'email' | 'phone';
export type PlayerErrors = Partial<Record<PlayerField, string>>;

export const emptyPlayer = (p: Partial<PlayerDraft> = {}): PlayerDraft => ({
  name: '',
  email: '',
  phone: '',
  pts: '',
  lvl: '',
  noFed: false,
  fcp: null,
  fcpDismissed: [],
  ...p,
});

/** Nombre y apellidos: al menos 2 palabras de 2+ letras. */
export const isFullName = (s: string) =>
  s.trim().split(/\s+/).filter((w) => w.length > 1).length >= 2;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Contribución de cada jugador (0 si NO es federado: sin ficha → 0).
export const playerPoints = (d: PlayerDraft) => (d.noFed ? 0 : parseInt(d.pts, 10) || 0);
export const playerNivel = (d: PlayerDraft) => (d.noFed ? 0 : parseInt(d.lvl, 10) || 0);
export const ptsKnown = (d: PlayerDraft) => d.noFed || !!d.pts.trim();
export const nivelKnown = (d: PlayerDraft) => d.noFed || !!d.lvl.trim();

/** Errores de un jugador, uno por campo (vacío = todo bien). */
export function validatePlayer(
  d: PlayerDraft,
  opts: { me: boolean; usesNivel: boolean; emailRequired: boolean; phoneRequired: boolean },
): PlayerErrors {
  const e: PlayerErrors = {};
  if (!isFullName(d.name))
    e.name = opts.me ? 'Escribe tu nombre y apellidos' : 'Escribe su nombre y apellidos';
  if (!ptsKnown(d))
    e.pts = opts.me
      ? 'Pon tus puntos o indica que no juegas federado'
      : 'Pon sus puntos o indica que no juega federado';
  if (opts.usesNivel && !nivelKnown(d)) e.lvl = 'Pon el nivel (liga o circuito)';
  const email = d.email.trim();
  if (opts.emailRequired && !email) e.email = 'El email es obligatorio';
  else if (email && !EMAIL_RE.test(email)) e.email = 'Revisa el email, no parece válido';
  if (opts.phoneRequired && d.phone.replace(/\D/g, '').length < 9)
    e.phone = 'Pon un teléfono de al menos 9 cifras';
  return e;
}

export const hasErrors = (e: object) => Object.keys(e).length > 0;
