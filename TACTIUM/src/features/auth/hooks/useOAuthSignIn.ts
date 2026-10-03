import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { useAuthStore } from '@store/authStore';

export type OAuthProvider = 'apple' | 'google';

/**
 * Inicio de sesión con Apple / Google, compartido por la Bienvenida y el Login
 * para que los dos botones hagan EXACTAMENTE lo mismo. Éxito → el
 * `onAuthStateChange` del authStore navega solo; cancelar → silencio; error →
 * alerta. `busy` dice qué proveedor está en curso (para el spinner y para
 * bloquear el otro botón mientras tanto).
 */
export function useOAuthSignIn() {
  const signInApple = useAuthStore((s) => s.signInWithApple);
  const signInGoogle = useAuthStore((s) => s.signInWithGoogle);
  const [busy, setBusy] = useState<null | OAuthProvider>(null);

  const run = useCallback(
    async (provider: OAuthProvider) => {
      if (busy) return;
      setBusy(provider);
      const { error, cancelled } =
        provider === 'apple' ? await signInApple() : await signInGoogle();
      setBusy(null);
      if (error && !cancelled) {
        Alert.alert('No se pudo iniciar sesión', error);
      }
    },
    [busy, signInApple, signInGoogle],
  );

  const handleApple = useCallback(() => run('apple'), [run]);
  const handleGoogle = useCallback(() => run('google'), [run]);

  return { busy, handleApple, handleGoogle };
}
