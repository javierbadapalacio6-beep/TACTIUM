import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
config({ path: resolve(process.cwd(), ".env.local") });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

function mask(e?: string){ if(!e) return "(sin email)"; const [u,d]=e.split("@"); return (u?.slice(0,2)||"")+"***@"+(d||""); }

async function run(){
  // 1) usuarios de Auth
  try {
    const { data, error } = await sb.auth.admin.listUsers({ page:1, perPage:1000 });
    if (error) console.log("auth.users error:", error.message);
    else {
      const users = data.users;
      const withEmail = users.filter(u=>u.email);
      console.log(`AUTH USERS: ${users.length} (con email: ${withEmail.length})`);
      withEmail.slice(0,8).forEach(u=>console.log("  ·", mask(u.email!), "| confirmado:", !!u.email_confirmed_at));
    }
  } catch(e:any){ console.log("auth.users excepción:", e.message); }

  // 2) tablas públicas candidatas
  const tables = ["profiles","users","clubs","teams","players","memberships","team_members","waitlist"];
  console.log("\nTABLAS PÚBLICAS (conteo):");
  for (const t of tables){
    const { count, error } = await sb.from(t).select("*", { count:"exact", head:true });
    if (error) console.log(`  ${t}: —`);
    else console.log(`  ${t}: ${count} filas`);
  }
}
run();
