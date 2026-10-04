/**
 * Vibraciones cortas para la alineación, los resultados y los amistosos.
 *
 * `expo-haptics` se carga dentro de un try/catch: en un dev client sin el
 * módulo nativo no debe romper la pantalla, solo no vibrar.
 */
type HapticsModule = typeof import('expo-haptics');

let H: HapticsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  H = require('expo-haptics') as HapticsModule;
} catch {
  H = null;
}

export function tapLight(): void {
  try {
    H?.impactAsync(H.ImpactFeedbackStyle.Light).catch(() => {});
  } catch {
    // sin módulo nativo
  }
}

export function tapMedium(): void {
  try {
    H?.impactAsync(H.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {
    // sin módulo nativo
  }
}

export function notifySuccess(): void {
  try {
    H?.notificationAsync(H.NotificationFeedbackType.Success).catch(() => {});
  } catch {
    // sin módulo nativo
  }
}

export function notifyWarning(): void {
  try {
    H?.notificationAsync(H.NotificationFeedbackType.Warning).catch(() => {});
  } catch {
    // sin módulo nativo
  }
}
