import { config } from "dotenv";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
config({ path: resolve(process.cwd(), ".env.local") });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const BAD = "obiesa@gmail.vom", GOOD = "obiesa@gmail.com";
async function run() {
  const { data: dup } = await sb.from("waitlist").select("email").eq("email", GOOD);
  if (dup && dup.length) {
    console.log("Ya existe", GOOD, "— borro la errata");
    await sb.from("waitlist").delete().eq("email", BAD);
  } else {
    const { error } = await sb.from("waitlist").update({ email: GOOD }).eq("email", BAD);
    if (error) { console.error("✗", error.message); process.exit(1); }
    console.log("✓ Corregido:", BAD, "→", GOOD);
  }
  const { data } = await sb.from("waitlist").select("email").order("created_at", { ascending: true });
  console.log("\nLista actual:");
  (data || []).forEach((r: any) => console.log("  ·", r.email));
}
run();
