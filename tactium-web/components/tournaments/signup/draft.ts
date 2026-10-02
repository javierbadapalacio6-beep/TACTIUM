// Borrador de la inscripción en sessionStorage. Se guarda justo antes de ir a
// Stripe: si el jugador cancela el pago vuelve con ?pago=cancelado y recupera
// la ficha tal cual, en el paso 3. Todo con try/catch: sin almacenamiento
// (privado, bloqueado…) simplemente no hay borrador.

import type { PlayerDraft } from "./PlayerFields";

export interface SignupDraft {
  v: 1;
  gender: string;
  category: string | null;
  want2: boolean;
  category2: string | null;
  me: PlayerDraft;
  mate: PlayerDraft;
  mate2: PlayerDraft;
  blocked: string[];
  termsOk: boolean;
}

const keyOf = (tournamentId: string) => `tactium:signup-draft:${tournamentId}`;

export function saveSignupDraft(tournamentId: string, d: SignupDraft): void {
  try {
    window.sessionStorage.setItem(keyOf(tournamentId), JSON.stringify(d));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

export function takeSignupDraft(tournamentId: string): SignupDraft | null {
  try {
    const raw = window.sessionStorage.getItem(keyOf(tournamentId));
    if (!raw) return null;
    window.sessionStorage.removeItem(keyOf(tournamentId));
    const d = JSON.parse(raw) as SignupDraft;
    return d && d.v === 1 && d.me && d.mate ? d : null;
  } catch {
    return null;
  }
}
