import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

import { supabase } from '@core/supabase/client';

// Asegura que cualquier sesión de auth web pendiente se cierre al volver.
WebBrowser.maybeCompleteAuthSession();

// Marcador para distinguir cancelación del usuario de un error real, para
// que la UI no muestre toast cuando alguien simplemente cierra el sheet.
export const CANCELLED = 'cancelled';

// ── Sign in with Apple (nativo · solo iOS) ───────────────────────────
export async function signInWithApple(): Promise<{ error?: string }> {
  try {
    if (Platform.OS !== 'ios') {
      return { error: 'Inicia sesión con Apple solo está disponible en iPhone.' };
    }
    if (!(await AppleAuthentication.isAvailableAsync())) {
      return { error: 'Inicia sesión con Apple no está disponible en este dispositivo.' };
    }

    // Apple recibe el SHA256 del nonce; Supabase valida con el nonce en claro.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      rawNonce,
    );

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      return { error: 'No se recibió el token de Apple.' };
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
      nonce: rawNonce,
    });
    if (error) return { error: error.message };

    // Apple solo envía el nombre la PRIMERA vez que el usuario autoriza la
    // app. Si llega, lo persistimos en el profile (el resto de veces es null).
    const fullName = [
      credential.fullName?.givenName,
      credential.fullName?.familyName,
    ]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (fullName) {
      await supabase.auth.updateUser({ data: { full_name: fullName } }).catch(() => {});
    }
    return {};
  } catch (e: any) {
    if (e?.code === 'ERR_REQUEST_CANCELED' || e?.code === 'ERR_CANCELED') {
      return { error: CANCELLED };
    }
    return { error: e?.message ?? 'No se pudo iniciar sesión con Apple.' };
  }
}

// ── Sign in with Google (OAuth web vía Supabase) ─────────────────────
export async function signInWithGoogle(): Promise<{ error?: string }> {
  try {
    const redirectTo = Linking.createURL('auth-callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { error: error.message };
    if (!data?.url) return { error: 'No se pudo iniciar el flujo de Google.' };

    const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (res.type === 'cancel' || res.type === 'dismiss') return { error: CANCELLED };
    if (res.type !== 'success' || !res.url) {
      return { error: 'No se completó el inicio de sesión con Google.' };
    }

    const url = new URL(res.url);
    const errDesc = url.searchParams.get('error_description');
    if (errDesc) return { error: errDesc };

    // Flow PKCE → ?code=... ; flow implicit (default) → #access_token=...
    const code = url.searchParams.get('code');
    if (code) {
      const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
      return exErr ? { error: exErr.message } : {};
    }

    const frag = new URLSearchParams(url.hash.replace(/^#/, ''));
    const access_token = frag.get('access_token');
    const refresh_token = frag.get('refresh_token');
    if (access_token && refresh_token) {
      const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
      return sErr ? { error: sErr.message } : {};
    }

    return { error: 'No se recibió la sesión de Google.' };
  } catch (e: any) {
    return { error: e?.message ?? 'No se pudo iniciar sesión con Google.' };
  }
}
