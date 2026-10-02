import AsyncStorage from '@react-native-async-storage/async-storage';

// Código de invitación pendiente: alguien abre `tactium.io/i/{CODE}` SIN sesión.
// Lo guardamos y, en cuanto entra (login o alta), le abrimos `JoinTeam` con él.
// Todo en try/catch: si el almacenamiento falla, se pierde el atajo, nada más.

const KEY = 'tactium-pending-invite-code';

export async function savePendingInviteCode(code: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, code.trim().toUpperCase());
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

/** Lee y BORRA el código pendiente (se consume una sola vez). */
export async function takePendingInviteCode(): Promise<string | null> {
  try {
    const v = await AsyncStorage.getItem(KEY);
    if (v) await AsyncStorage.removeItem(KEY);
    return v && /^[A-Z0-9]{8}$/.test(v) ? v : null;
  } catch {
    return null;
  }
}

export async function clearPendingInviteCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
