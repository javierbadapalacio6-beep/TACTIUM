import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
function env(p: string) { const o: Record<string,string> = {}; for (const l of fs.readFileSync(p,'utf8').split(/\r?\n/)) { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) o[m[1]] = m[2].trim().replace(/^["']|["']$/g,''); } return o; }
const tac = env('C:/Users/javie/Desktop/4PADEL LAB PRUEBA/tactium-web/.env.local');
export const supabase = createClient(tac.NEXT_PUBLIC_SUPABASE_URL, tac.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
