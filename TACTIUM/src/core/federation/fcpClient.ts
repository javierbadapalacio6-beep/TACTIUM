import { createClient } from '@supabase/supabase-js';

// Cliente de SOLO LECTURA al proyecto público "4PADEL OFICIAL", que contiene
// los datos scrapeados de la Federación Cántabra de Pádel (tablas fcp_*).
// Todas esas tablas tienen lectura pública (RLS `using true`, rol public), así
// que la clave publishable es segura en cliente. Sin sesión: solo leemos.
//
// Es un proyecto Supabase DISTINTO al de TACTIUM. Aquí solo consultamos la
// "agenda" de la federación (jugadores+puntos, calendario); lo escribimos en
// TACTIUM con el cliente normal y la sesión del capitán.
const FCP_URL = 'https://djuveyjinumjkbeslvmf.supabase.co';
const FCP_PUBLISHABLE_KEY = 'sb_publishable_ZkoIvySHZTDiqYU9fpzzrg_ksVueOVa';

export const fcp = createClient(FCP_URL, FCP_PUBLISHABLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
