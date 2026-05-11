import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config';
import type { Database } from './database.types';

// En desarrollo NO persistimos la sesión: facilita iterar sobre onboarding
// y flujos de auth sin tener que cerrar sesión manualmente cada vez.
const persistSession = !__DEV__;

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: persistSession,
      persistSession,
      detectSessionInUrl: false,
    },
  },
);
