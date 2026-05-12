import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';
import type { Database } from './database.types';

// Persistimos sesión en todos los entornos (dev y prod): el usuario sólo
// debe iniciar sesión una vez. Para volver al onboarding/login en dev,
// usa `signOut()` desde el perfil o limpia AsyncStorage manualmente.
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
